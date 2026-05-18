import { NextRequest, NextResponse } from "next/server";
import { getDb, nowBeijing } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const keyword = searchParams.get("keyword") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "updated_at";

  let where = "1=1";
  const params: unknown[] = [];
  if (keyword) {
    where += " AND s.name LIKE ?";
    params.push(`%${keyword}%`);
  }
  if (category) {
    where += " AND s.category = ?";
    params.push(category);
  }

  const orderCol = sort === "question_count" ? "question_count" : sort === "created_at" ? "s.created_at" : "s.updated_at";

  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM video_series s WHERE ${where}`).get(...params) as { cnt: number };

  const series = db.prepare(`
    SELECT s.*, COUNT(sq.id) as question_count
    FROM video_series s
    LEFT JOIN series_questions sq ON sq.series_id = s.id
    WHERE ${where}
    GROUP BY s.id
    ORDER BY ${orderCol} DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);

  const categories = db.prepare("SELECT DISTINCT category FROM video_series WHERE category != '' ORDER BY category").all() as { category: string }[];

  return NextResponse.json({ series, total: totalRow.cnt, categories: categories.map(c => c.category) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, introTitle, introSubtitle, defaultThinkTime, defaultVoiceStyle, defaultTransition } = body;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const id = uuid();
    const db = getDb();
    db.prepare(`
      INSERT INTO video_series (id, name, category, intro_title, intro_subtitle, default_think_time, default_voice_style, default_transition, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, category || "", introTitle || "", introSubtitle || "", defaultThinkTime ?? 3, defaultVoiceStyle || "教学", defaultTransition || "fade", nowBeijing(), nowBeijing());

    return NextResponse.json({ id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
