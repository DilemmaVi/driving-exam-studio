import { NextRequest, NextResponse } from "next/server";
import { getDb, nowBeijing } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const series = db.prepare("SELECT * FROM video_series WHERE id = ?").get(id);
  if (!series) return NextResponse.json({ error: "not found" }, { status: 404 });

  const questions = db.prepare(`
    SELECT sq.*, q.id as question_db_id, q.type, q.question_text, q.question_content, q.option1, q.option2, q.option3, q.option4,
           q.correct_answer, q.explanation, q.tip_text, q.tip_display, q.cover_image, q.keywords
    FROM series_questions sq
    JOIN questions q ON q.id = sq.question_id
    WHERE sq.series_id = ?
    ORDER BY sq.sort_order
  `).all(id);

  return NextResponse.json({ series, questions });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(body)) {
    const colMap: Record<string, string> = {
      name: "name", category: "category", introTitle: "intro_title",
      introSubtitle: "intro_subtitle", defaultThinkTime: "default_think_time",
      defaultVoiceStyle: "default_voice_style", defaultTransition: "default_transition",
      bridgeThink: "bridge_think", bridgeReveal: "bridge_reveal",
      bridgeExplain: "bridge_explain", bridgeTip: "bridge_tip",
      theme: "theme", fontScale: "font_scale", avatarImage: "avatar_image",
      avatarPosition: "avatar_position", avatarSize: "avatar_size",
      readOptions: "read_options", keywordStyle: "keyword_style",
      speechRate: "speech_rate", revealPause: "reveal_pause", panelHeight: "panel_height",
      answerReadOption: "answer_read_option", answerReadMulti: "answer_read_multi",
      bridgeThinkEnabled: "bridge_think_enabled", bridgeRevealEnabled: "bridge_reveal_enabled",
      bridgeExplainEnabled: "bridge_explain_enabled", bridgeTipEnabled: "bridge_tip_enabled",
      outroText: "outro_text", outroSubtitle: "outro_subtitle",
      showTransition: "show_transition", pauseStart: "pause_start",
      pauseEnd: "pause_end", pauseBeforeTip: "pause_before_tip",
      ttsSpeed: "tts_speed", ttsVoice: "tts_voice", keywordFlashEnabled: "keyword_flash_enabled",
      underlineProgressEnabled: "underline_progress_enabled", avatarEnabled: "avatar_enabled",
    };
    const col = colMap[key];
    if (col) { fields.push(`${col} = ?`); values.push(val); }
  }

  if (fields.length > 0) {
    fields.push("updated_at = ?");
    values.push(nowBeijing());
    db.prepare(`UPDATE video_series SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM series_questions WHERE series_id = ?").run(id);
  db.prepare("DELETE FROM video_series WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
