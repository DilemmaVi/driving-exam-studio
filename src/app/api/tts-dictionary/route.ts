import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM tts_dictionary ORDER BY created_at DESC").all();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { original, replacement, note } = await request.json();
  if (!original || !replacement) {
    return NextResponse.json({ error: "original and replacement required" }, { status: 400 });
  }
  const db = getDb();
  try {
    db.prepare("INSERT INTO tts_dictionary (original, replacement, note) VALUES (?, ?, ?)").run(original.trim(), replacement.trim(), note || "");
  } catch (e: unknown) {
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ error: "该原文已存在" }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  const { id, original, replacement, note, enabled } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (original !== undefined) { sets.push("original = ?"); vals.push(original.trim()); }
  if (replacement !== undefined) { sets.push("replacement = ?"); vals.push(replacement.trim()); }
  if (note !== undefined) { sets.push("note = ?"); vals.push(note); }
  if (enabled !== undefined) { sets.push("enabled = ?"); vals.push(enabled ? 1 : 0); }
  if (sets.length === 0) return NextResponse.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE tts_dictionary SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM tts_dictionary WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
