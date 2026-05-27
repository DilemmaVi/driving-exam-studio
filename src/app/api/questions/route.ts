import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const type = searchParams.get("type");
  const hasImage = searchParams.get("hasImage");
  const keyword = searchParams.get("keyword");
  const category = searchParams.get("category");

  const db = getDb();

  const params: (string | number)[] = [];
  let from = "FROM questions q";
  let where = "WHERE 1=1";

  if (category && category !== "all") {
    from += " INNER JOIN question_categories qc ON qc.question_id = q.id";
    where += " AND qc.category_id = ?";
    params.push(category);
  }

  if (type && type !== "all") {
    if (type === "multi") {
      where += " AND q.type = 2 AND length(q.correct_answer) > 1";
    } else if (type === "single") {
      where += " AND q.type = 2 AND length(q.correct_answer) = 1";
    } else {
      where += " AND q.type = ?";
      params.push(parseInt(type));
    }
  }

  if (hasImage && hasImage !== "all") {
    if (hasImage === "true") {
      where += " AND ((q.cover_image IS NOT NULL AND q.cover_image != '') OR (q.gif_image IS NOT NULL AND q.gif_image != ''))";
    } else if (hasImage === "false") {
      where += " AND (q.cover_image IS NULL OR q.cover_image = '') AND (q.gif_image IS NULL OR q.gif_image = '')";
    }
  }

  if (keyword) {
    where += " AND (q.question_text LIKE ? OR q.question_content LIKE ? OR q.keywords LIKE ?)";
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }

  const countRow = db.prepare(`SELECT COUNT(DISTINCT q.id) as total ${from} ${where}`).get(...params) as { total: number };
  const total = countRow.total;

  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT DISTINCT q.* ${from} ${where} ORDER BY q.id LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

  return NextResponse.json({
    questions: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
