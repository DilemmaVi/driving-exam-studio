import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getDb, getDbPath } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const questionCount = (db.prepare("SELECT COUNT(*) as c FROM questions").get() as { c: number }).c;
  const seriesCount = (db.prepare("SELECT COUNT(*) as c FROM video_series").get() as { c: number }).c;
  const categoryCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;
  const ttsCacheCount = (db.prepare("SELECT COUNT(*) as c FROM tts_cache").get() as { c: number }).c;
  const dictionaryCount = (db.prepare("SELECT COUNT(*) as c FROM tts_dictionary").get() as { c: number }).c;

  const dbPath = getDbPath();
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  let uploadsSize = 0;
  if (fs.existsSync(uploadsDir)) {
    for (const f of fs.readdirSync(uploadsDir)) {
      uploadsSize += fs.statSync(path.join(uploadsDir, f)).size;
    }
  }

  return NextResponse.json({
    questionCount,
    seriesCount,
    categoryCount,
    ttsCacheCount,
    dictionaryCount,
    dbSize,
    uploadsSize,
    totalSize: dbSize + uploadsSize,
  });
}
