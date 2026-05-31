import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateTTSForQuestion } from "@/lib/tts";
import { getAudioDir } from "@/lib/paths";
import * as fs from "fs";
import * as path from "path";

export async function POST(request: NextRequest) {
  try {
    const { questionId, segment } = await request.json();
    if (!questionId || !segment) {
      return NextResponse.json({ error: "questionId and segment required" }, { status: 400 });
    }

    const db = getDb();
    const audioDir = getAudioDir();

    const cached = db.prepare(
      "SELECT file_path FROM tts_cache WHERE question_id = ? AND segment = ?"
    ).get(questionId, segment) as { file_path: string } | undefined;

    if (cached) {
      const fullPath = path.join(audioDir, path.basename(cached.file_path));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      db.prepare("DELETE FROM tts_cache WHERE question_id = ? AND segment = ?").run(questionId, segment);
    }

    await generateTTSForQuestion(questionId, { force: false });

    const updated = db.prepare(
      "SELECT segment, file_path, duration_sec FROM tts_cache WHERE question_id = ? AND segment = ?"
    ).get(questionId, segment) as { segment: string; file_path: string; duration_sec: number } | undefined;

    return NextResponse.json({ success: true, duration: updated?.duration_sec });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
