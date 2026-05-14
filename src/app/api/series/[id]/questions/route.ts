import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface QuestionInput {
  questionId: number;
  sortOrder: number;
  teacherExplanation?: string;
  showOfficialExplanation?: boolean;
  showTip?: boolean;
  thinkTime?: number | null;
  voiceStyle?: string | null;
  transition?: string | null;
  readOptions?: number | null;
  speechRate?: number | null;
  revealPause?: number | null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { questions } = await request.json() as { questions: QuestionInput[] };

  if (!Array.isArray(questions)) {
    return NextResponse.json({ error: "questions array required" }, { status: 400 });
  }

  const db = getDb();
  const series = db.prepare("SELECT id FROM video_series WHERE id = ?").get(id);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  db.prepare("DELETE FROM series_questions WHERE series_id = ?").run(id);

  const insert = db.prepare(`
    INSERT INTO series_questions (series_id, question_id, sort_order, teacher_explanation, show_official_explanation, show_tip, think_time, voice_style, transition, read_options, speech_rate, reveal_pause)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: QuestionInput[]) => {
    for (const q of items) {
      insert.run(
        id, q.questionId, q.sortOrder,
        q.teacherExplanation || "",
        q.showOfficialExplanation !== false ? 1 : 0,
        q.showTip !== false ? 1 : 0,
        q.thinkTime ?? null,
        q.voiceStyle ?? null,
        q.transition ?? null,
        q.readOptions ?? null,
        q.speechRate ?? null,
        q.revealPause ?? null,
      );
    }
  });

  insertMany(questions);
  db.prepare("UPDATE video_series SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

  return NextResponse.json({ ok: true, count: questions.length });
}
