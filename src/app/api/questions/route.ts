import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const type = searchParams.get("type");
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
    where += " AND q.type = ?";
    params.push(parseInt(type));
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
