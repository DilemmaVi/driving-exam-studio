import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

function md5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}

interface ConfirmQuestion {
  row: number;
  type: number;
  question_text: string;
  question_content: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correct_answer: string;
  explanation: string;
  tip_text: string;
  tip_display: string;
  cover_image: string | null;
  gif_image: string | null;
  keywords: string | null;
  source_id: number;
  action: "insert" | "update" | "skip";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, importMode, questions } = body as {
      categoryId: string;
      importMode: string;
      questions: ConfirmQuestion[];
    };

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "无题目数据" }, { status: 400 });
    }

    const db = getDb();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO questions
      (id, type, question_text, question_content, option1, option2, option3, option4,
       correct_answer, explanation, tip_text, tip_display, cover_image, gif_image,
       explanation_images, keywords, category_id, source_id, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE questions SET type = ?, question_text = ?, question_content = ?,
      option1 = ?, option2 = ?, option3 = ?, option4 = ?,
      correct_answer = ?, explanation = ?, tip_text = ?, tip_display = ?,
      cover_image = ?, gif_image = ?, explanation_images = ?, keywords = ?,
      category_id = ?, source_id = ?, content_hash = ?
      WHERE id = ?
    `);

    const maxIdRow = db.prepare("SELECT MAX(id) as m FROM questions").get() as { m: number | null };
    let nextId = (maxIdRow.m || 0) + 1;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
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

      for (const q of questions) {
        if (!q.question_text?.trim()) continue;

        const hashInput = q.question_text.replace(/\s+/g, "") + [q.option1, q.option2, q.option3, q.option4].filter(Boolean).join("");
        const hash = md5(hashInput);

        if (q.action === "skip") {
          skipped++;
          const existing = db.prepare("SELECT id FROM questions WHERE content_hash = ? OR (source_id = ? AND source_id > 0)").get(hash, q.source_id || 0) as { id: number } | undefined;
          if (existing && categoryId) {
            db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(existing.id, categoryId);
          }
          continue;
        }

        if (q.action === "update") {
          const existing = db.prepare("SELECT id FROM questions WHERE content_hash = ? OR (source_id = ? AND source_id > 0)").get(hash, q.source_id || 0) as { id: number } | undefined;
          if (existing) {
            updateStmt.run(
              q.type, q.question_text, q.question_content || "",
              q.option1 || null, q.option2 || null, q.option3 || null, q.option4 || null,
              q.correct_answer, q.explanation || "", q.tip_text || "", q.tip_display || "",
              q.cover_image || null, q.gif_image || null,
              null, q.keywords || null, categoryId, 0, hash,
              existing.id
            );
            db.prepare("DELETE FROM tts_cache WHERE question_id = ?").run(existing.id);
            if (categoryId) {
              db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(existing.id, categoryId);
            }
            updated++;
          } else {
            const qId = nextId++;
            insertStmt.run(
              qId, q.type, q.question_text, q.question_content || "",
              q.option1 || null, q.option2 || null, q.option3 || null, q.option4 || null,
              q.correct_answer, q.explanation || "", q.tip_text || "", q.tip_display || "",
              q.cover_image || null, q.gif_image || null,
              null, q.keywords || null, categoryId, 0, hash
            );
            if (categoryId) {
              db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(qId, categoryId);
            }
            inserted++;
          }
          continue;
        }

        const qId = nextId++;
        insertStmt.run(
          qId, q.type, q.question_text, q.question_content || "",
          q.option1 || null, q.option2 || null, q.option3 || null, q.option4 || null,
          q.correct_answer, q.explanation || "", q.tip_text || "", q.tip_display || "",
          q.cover_image || null, q.gif_image || null,
          null, q.keywords || null, categoryId, 0, hash
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
      success: true,
      inserted,
      updated,
      skipped,
      deleted,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "导入失败";
    console.error("Confirm import error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
