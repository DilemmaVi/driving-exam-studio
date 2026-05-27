import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as XLSX from "xlsx";
import crypto from "crypto";

function md5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}

function parseCorrectAnswer(raw: unknown): string {
  const map = ["A", "B", "C", "D", "E", "F", "G", "H"];
  try {
    let arr: string[];
    if (typeof raw === "string") {
      arr = JSON.parse(raw);
    } else if (Array.isArray(raw)) {
      arr = raw.map(String);
    } else {
      return "A";
    }
    return arr.map((v) => map[(parseInt(v) || 1) - 1] || "A").join("");
  } catch {
    return "A";
  }
}

export async function POST(request: NextRequest) {
  try {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const categoryId = formData.get("categoryId") as string || "";
  const importMode = formData.get("importMode") as string || "append";

  if (!file) {
    return NextResponse.json({ error: "未上传文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO questions
    (id, type, question_text, question_content, option1, option2, option3, option4,
     correct_answer, explanation, tip_text, tip_display, cover_image, gif_image,
     explanation_images, keywords, category_id, source_id, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const maxIdRow = db.prepare("SELECT MAX(id) as m FROM questions").get() as { m: number | null };
  let nextId = (maxIdRow.m || 0) + 1;

  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  const update = db.prepare(`
    UPDATE questions SET type = ?, question_text = ?, question_content = ?,
    option1 = ?, option2 = ?, option3 = ?, option4 = ?,
    correct_answer = ?, explanation = ?, tip_text = ?, tip_display = ?,
    cover_image = ?, gif_image = ?, explanation_images = ?, keywords = ?,
    category_id = ?, source_id = ?, content_hash = ?
    WHERE id = ?
  `);

  let deleted = 0;

  db.pragma("foreign_keys = OFF");
  const tx = db.transaction(() => {
    if (importMode === "replace" && categoryId) {
      const qIds = db.prepare(
        "SELECT question_id FROM question_categories WHERE category_id = ?"
      ).all(categoryId) as { question_id: number }[];
      const ids = qIds.map((r) => r.question_id);
      if (ids.length > 0) {
        const otherLinks = db.prepare(
          "SELECT question_id, COUNT(*) as cnt FROM question_categories WHERE question_id IN (" +
          ids.map(() => "?").join(",") + ") GROUP BY question_id"
        ).all(...ids) as { question_id: number; cnt: number }[];
        const multiLinked = new Set(otherLinks.filter((r) => r.cnt > 1).map((r) => r.question_id));
        const toDelete = ids.filter((id) => !multiLinked.has(id));
        if (toDelete.length > 0) {
          db.prepare("DELETE FROM questions WHERE id IN (" + toDelete.map(() => "?").join(",") + ")").run(...toDelete);
          db.prepare("DELETE FROM tts_cache WHERE question_id IN (" + toDelete.map(() => "?").join(",") + ")").run(...toDelete);
        }
        db.prepare("DELETE FROM question_categories WHERE category_id = ?").run(categoryId);
        deleted = ids.length;
      }
    }

    for (const row of rows) {
      const sourceId = Number(row["题库ID"]) || 0;
      const questionText = String(row["题目"] || "").trim();
      if (!questionText) continue;

      const questionContent = String(row["题目内容"] || "");
      const qType = Number(row["题目类型"]) || 1;
      const type = qType === 1 ? 1 : 2;

      const opts = [];
      for (let i = 1; i <= 8; i++) {
        const v = row[`答案${i}`];
        if (v != null && String(v).trim()) opts.push(String(v).trim());
      }

      const correctAnswer = parseCorrectAnswer(row["正确答案"]);

      const explanation = String(row["官方解读"] || "");
      const tipText = String(row["技巧(用于生成语音的技巧文字)"] || row["技巧"] || "");
      const tipDisplay = String(row["技巧（前端技巧弹窗显示内容）"] || "");
      const coverImage = String(row["封面（图片地址）"] || row["封面"] || "");
      const gifImage = String(row["动图地址（图片动图）"] || "");
      const keywords = String(row["关键字"] || "");

      const explainImgs: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const v = row[`官方解读${i}`];
        if (v && String(v).trim()) explainImgs.push(String(v).trim());
      }

      const hashInput = questionText.replace(/\s+/g, "") + opts.join("");
      const hash = md5(hashInput);

      const existing = db.prepare("SELECT id FROM questions WHERE content_hash = ? OR (source_id = ? AND source_id > 0)").get(hash, sourceId) as { id: number } | undefined;
      if (existing) {
        if (importMode === "overwrite" || importMode === "replace") {
          update.run(
            type, questionText, questionContent,
            opts[0] || null, opts[1] || null, opts[2] || null, opts[3] || null,
            correctAnswer, explanation, tipText, tipDisplay,
            coverImage || null, gifImage || null,
            explainImgs.length > 0 ? JSON.stringify(explainImgs) : null,
            keywords || null, categoryId, sourceId || null, hash,
            existing.id
          );
          db.prepare("DELETE FROM tts_cache WHERE question_id = ?").run(existing.id);
          updated++;
        } else {
          skipped++;
        }
        if (categoryId) {
          db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(existing.id, categoryId);
        }
        continue;
      }

      const qId = nextId++;
      insert.run(
        qId, type, questionText, questionContent,
        opts[0] || null, opts[1] || null, opts[2] || null, opts[3] || null,
        correctAnswer, explanation, tipText, tipDisplay,
        coverImage || null, gifImage || null,
        explainImgs.length > 0 ? JSON.stringify(explainImgs) : null,
        keywords || null, categoryId, sourceId || null, hash
      );
      if (categoryId) {
        db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(qId, categoryId);
      }
      inserted++;
    }
  });

  tx();
  db.pragma("foreign_keys = ON");

  return NextResponse.json({
    total: rows.length,
    inserted,
    skipped,
    updated,
    deleted,
  });
  } catch (e: any) {
    console.error("Import error:", e);
    return NextResponse.json({ error: e.message || "导入失败" }, { status: 500 });
  }
}
