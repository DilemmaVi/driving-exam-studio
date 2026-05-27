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

const MAX_PREVIEW = 500;

interface PreviewQuestion {
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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryId = (formData.get("categoryId") as string) || "";
    const importMode = (formData.get("importMode") as string) || "append";

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const total = rows.length;
    const db = getDb();

    let toInsert = 0;
    let toUpdate = 0;
    let toSkip = 0;
    const errors: { row: number; message: string }[] = [];
    const questions: PreviewQuestion[] = [];

    const displayRows = rows.slice(0, MAX_PREVIEW);

    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i];
      const rowNum = i + 2;

      const sourceId = Number(row["题库ID"]) || 0;
      const questionText = String(row["题目"] || "").trim();

      if (!questionText) {
        errors.push({ row: rowNum, message: "题目为空" });
        continue;
      }

      const questionContent = String(row["题目内容"] || "");
      const qType = Number(row["题目类型"]) || 1;
      const type = qType === 1 ? 1 : 2;

      const opts: string[] = [];
      for (let j = 1; j <= 8; j++) {
        const v = row[`答案${j}`];
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
      for (let j = 1; j <= 5; j++) {
        const v = row[`官方解读${j}`];
        if (v && String(v).trim()) explainImgs.push(String(v).trim());
      }

      const hashInput = questionText.replace(/\s+/g, "") + opts.join("");
      const hash = md5(hashInput);

      const existing = db.prepare(
        "SELECT id FROM questions WHERE content_hash = ? OR (source_id = ? AND source_id > 0)"
      ).get(hash, sourceId) as { id: number } | undefined;

      let action: "insert" | "update" | "skip";
      if (existing) {
        if (importMode === "overwrite" || importMode === "replace") {
          action = "update";
          toUpdate++;
        } else {
          action = "skip";
          toSkip++;
        }
      } else {
        action = "insert";
        toInsert++;
      }

      questions.push({
        row: rowNum,
        type,
        question_text: questionText,
        question_content: questionContent,
        option1: opts[0] ?? null,
        option2: opts[1] ?? null,
        option3: opts[2] ?? null,
        option4: opts[3] ?? null,
        correct_answer: correctAnswer,
        explanation,
        tip_text: tipText,
        tip_display: tipDisplay,
        cover_image: coverImage || null,
        gif_image: gifImage || null,
        keywords: keywords || null,
        source_id: sourceId,
        action,
      });
    }

    // For replace mode, count how many would be deleted
    let toDelete = 0;
    if (importMode === "replace" && categoryId) {
      const qIds = db.prepare(
        "SELECT question_id FROM question_categories WHERE category_id = ?"
      ).all(categoryId) as { question_id: number }[];
      toDelete = qIds.length;
    }

    return NextResponse.json({
      preview: {
        total,
        displayed: displayRows.length,
        toInsert,
        toUpdate,
        toSkip,
        toDelete,
        errors,
        questions,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "预览失败";
    console.error("Preview error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
