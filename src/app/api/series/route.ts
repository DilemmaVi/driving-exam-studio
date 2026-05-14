import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET() {
  const db = getDb();
  const series = db.prepare(`
    SELECT s.*, COUNT(sq.id) as question_count
    FROM video_series s
    LEFT JOIN series_questions sq ON sq.series_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `).all();
  return NextResponse.json({ series });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, introTitle, introSubtitle, defaultThinkTime, defaultVoiceStyle, defaultTransition } = body;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const id = uuid();
    const db = getDb();
    db.prepare(`
      INSERT INTO video_series (id, name, category, intro_title, intro_subtitle, default_think_time, default_voice_style, default_transition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, category || "", introTitle || "", introSubtitle || "", defaultThinkTime ?? 3, defaultVoiceStyle || "教学", defaultTransition || "fade");

    return NextResponse.json({ id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
