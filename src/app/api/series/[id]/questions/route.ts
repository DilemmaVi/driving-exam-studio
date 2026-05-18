import { NextRequest, NextResponse } from "next/server";
import { getDb, nowBeijing } from "@/lib/db";

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
  optionGap?: number | null;
  fontSizeQuestion?: number | null;
  fontSizeOption?: number | null;
  fontSizeExplanation?: number | null;
  stemKeywords?: string;
  stemKeywordPhases?: string;
  readingPrefixDelay?: number | null;
  readingSpeedRatio?: number | null;
  panelAdjust?: string;
  panelAdjustValue?: number | null;
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
    INSERT INTO series_questions (series_id, question_id, sort_order, teacher_explanation, show_official_explanation, show_tip, think_time, voice_style, transition, read_options, speech_rate, reveal_pause, option_gap, font_size_question, font_size_option, font_size_explanation, stem_keywords, stem_keyword_phases, reading_prefix_delay, reading_speed_ratio, panel_adjust, panel_adjust_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        q.optionGap ?? null,
        q.fontSizeQuestion ?? null,
        q.fontSizeOption ?? null,
        q.fontSizeExplanation ?? null,
        q.stemKeywords || "",
        q.stemKeywordPhases || "question",
        q.readingPrefixDelay ?? null,
        q.readingSpeedRatio ?? null,
        q.panelAdjust || "auto-shift",
        q.panelAdjustValue ?? null,
      );
    }
  });

  insertMany(questions);
  db.prepare("UPDATE video_series SET updated_at = ? WHERE id = ?").run(nowBeijing(), id);

  return NextResponse.json({ ok: true, count: questions.length });
}
