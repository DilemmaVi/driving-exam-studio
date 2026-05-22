import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getDb, getDbPath } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require("adm-zip");

export async function GET() {
  const db = getDb();
  db.pragma("wal_checkpoint(TRUNCATE)");

  const dbPath = getDbPath();
  const dataDir = path.dirname(dbPath);
  const settingsPath = path.join(dataDir, "settings.json");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  const questionCount = (db.prepare("SELECT COUNT(*) as c FROM questions").get() as { c: number }).c;
  const seriesCount = (db.prepare("SELECT COUNT(*) as c FROM video_series").get() as { c: number }).c;
  const categoryCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;

  const manifest = {
    appVersion: require("../../../../../package.json").version,
    exportDate: new Date(Date.now() + 8 * 3600000).toISOString(),
    questionCount,
    seriesCount,
    categoryCount,
  };

  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addLocalFile(dbPath, "", "exam.db");
  if (fs.existsSync(settingsPath)) {
    zip.addLocalFile(settingsPath, "", "settings.json");
  }
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      zip.addLocalFile(path.join(uploadsDir, f), "uploads");
    }
  }

  const buffer = zip.toBuffer();
  const dateStr = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(`全安驾考备份_${dateStr}`)}.zip"`,
      "Content-Length": String(buffer.length),
    },
  });
}
