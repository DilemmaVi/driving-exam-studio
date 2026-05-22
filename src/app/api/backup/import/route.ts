import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { closeDb, reopenDb, getDbPath } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require("adm-zip");

const TEMP_DIR = path.join(process.cwd(), ".backup-temp");

export async function POST(request: NextRequest) {
  const confirm = request.nextUrl.searchParams.get("confirm") === "true";

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Extract to temp
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return NextResponse.json({ error: "Invalid zip file" }, { status: 400 });
  }

  zip.extractAllTo(TEMP_DIR, true);

  // Validate
  const manifestPath = path.join(TEMP_DIR, "manifest.json");
  const dbFilePath = path.join(TEMP_DIR, "exam.db");

  if (!fs.existsSync(manifestPath)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
    return NextResponse.json({ error: "Invalid backup: missing manifest.json" }, { status: 400 });
  }
  if (!fs.existsSync(dbFilePath)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
    return NextResponse.json({ error: "Invalid backup: missing exam.db" }, { status: 400 });
  }

  // Validate DB integrity
  try {
    const testDb = new Database(dbFilePath, { readonly: true });
    const result = testDb.pragma("integrity_check") as { integrity_check: string }[];
    testDb.close();
    if (result[0]?.integrity_check !== "ok") {
      fs.rmSync(TEMP_DIR, { recursive: true });
      return NextResponse.json({ error: "Invalid backup: database corrupted" }, { status: 400 });
    }
  } catch {
    fs.rmSync(TEMP_DIR, { recursive: true });
    return NextResponse.json({ error: "Invalid backup: cannot open database" }, { status: 400 });
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  if (!confirm) {
    fs.rmSync(TEMP_DIR, { recursive: true });
    return NextResponse.json({ valid: true, manifest });
  }

  // Apply backup
  try {
    const dbPath = getDbPath();
    const dataDir = path.dirname(dbPath);
    const settingsPath = path.join(dataDir, "settings.json");
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const audioDir = path.join(process.cwd(), "public", "audio");

    // Backup current DB in case of failure
    const backupPath = dbPath + ".bak";
    closeDb();
    fs.copyFileSync(dbPath, backupPath);

    try {
      // Replace DB
      fs.copyFileSync(dbFilePath, dbPath);
      if (fs.existsSync(dbPath + "-wal")) fs.unlinkSync(dbPath + "-wal");
      if (fs.existsSync(dbPath + "-shm")) fs.unlinkSync(dbPath + "-shm");

      // Replace settings
      const tempSettings = path.join(TEMP_DIR, "settings.json");
      if (fs.existsSync(tempSettings)) {
        fs.copyFileSync(tempSettings, settingsPath);
      }

      // Replace uploads
      if (fs.existsSync(uploadsDir)) fs.rmSync(uploadsDir, { recursive: true });
      fs.mkdirSync(uploadsDir, { recursive: true });
      const tempUploads = path.join(TEMP_DIR, "uploads");
      if (fs.existsSync(tempUploads)) {
        for (const f of fs.readdirSync(tempUploads)) {
          fs.copyFileSync(path.join(tempUploads, f), path.join(uploadsDir, f));
        }
      }

      // Clear stale TTS audio
      if (fs.existsSync(audioDir)) {
        for (const f of fs.readdirSync(audioDir)) {
          if (f === ".gitkeep") continue;
          fs.unlinkSync(path.join(audioDir, f));
        }
      }

      // Reopen DB (triggers migrations)
      reopenDb();

      // Remove backup file
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    } catch (e) {
      // Restore from backup
      fs.copyFileSync(backupPath, dbPath);
      reopenDb();
      throw e;
    }
  } finally {
    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
  }

  return NextResponse.json({ ok: true, message: "Backup imported successfully" });
}
