import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM categories ORDER BY sort_order").all();
  return NextResponse.json({ categories: rows });
}

export async function POST(request: NextRequest) {
  const { name, car_type, subject } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const db = getDb();
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM categories").get() as { m: number | null }).m || 0;
  const id = uuid();
  db.prepare("INSERT INTO categories (id, name, car_type, subject, sort_order) VALUES (?, ?, ?, ?, ?)").run(id, name.trim(), car_type || "", subject || "", maxOrder + 1);
  return NextResponse.json({ id, name: name.trim() });
}

export async function PUT(request: NextRequest) {
  const { id, name, car_type, subject } = await request.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: "id and name required" }, { status: 400 });
  const db = getDb();
  db.prepare("UPDATE categories SET name = ?, car_type = ?, subject = ? WHERE id = ?").run(name.trim(), car_type || "", subject || "", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  db.prepare("DELETE FROM question_categories WHERE category_id = ?").run(id);
  return NextResponse.json({ ok: true });
}
