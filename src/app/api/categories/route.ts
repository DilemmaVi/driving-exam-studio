import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM categories ORDER BY sort_order").all();
  return NextResponse.json({ categories: rows });
}
