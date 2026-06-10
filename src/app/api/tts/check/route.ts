import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAudioDir } from "@/lib/paths";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  const { questionIds } = await request.json();
  if (!Array.isArray(questionIds)) return NextResponse.json({ error: "questionIds required" }, { status: 400 });

  const db = getDb();
  const audioDir = getAudioDir();
  const result: Record<number, { ready: boolean; durations?: Record<string, number | number[]> }> = {};

  for (const qId of questionIds) {
    const rows = db.prepare(
      "SELECT segment, file_path, duration_sec FROM tts_cache WHERE question_id = ?"
    ).all(qId) as { segment: string; file_path: string; duration_sec: number }[];

    const hasQuestion = rows.some((r) => r.segment === "question" || r.segment === "question_slow" || r.segment === "question_fast");
    const hasAnswer = rows.some((r) => r.segment === "answer" || r.segment === "answer_slow" || r.segment === "answer_fast");

    if (!hasQuestion || !hasAnswer) {
      result[qId] = { ready: false };
      continue;
    }

    const allExist = rows.every((r) => fs.existsSync(path.join(audioDir, path.basename(r.file_path))));
    if (!allExist) {
      result[qId] = { ready: false };
      continue;
    }

    const durations: Record<string, number> = {};
    for (const r of rows) {
      const seg = r.segment.replace(/_(?:slow|fast)$/, "");
      if (seg.startsWith("opt_")) {
        if (!durations.optionDurations) (durations as Record<string, unknown>).optionDurations = [];
      }
      durations[seg] = r.duration_sec;
    }

    // Multiple choice: per-question opt_ segments
    let optDurs = rows.filter((r) => r.segment.startsWith("opt_")).sort((a, b) => a.segment.localeCompare(b.segment)).map((r) => r.duration_sec);

    // True/false: shared tf_opt_ segments (question_id = 0)
    if (optDurs.length === 0) {
      const tfRows = db.prepare(
        "SELECT segment, duration_sec FROM tts_cache WHERE question_id = 0 AND segment IN ('tf_opt_0','tf_opt_1') ORDER BY segment"
      ).all() as { segment: string; duration_sec: number }[];
      optDurs = tfRows.map((r) => r.duration_sec);
    }

    result[qId] = {
      ready: true,
      durations: {
        question: durations.question || 0,
        answer: durations.answer || 0,
        explanation: durations.explanation || durations.teacher_explanation || 0,
        tip: durations.tip || 0,
        teacherExplanation: durations.teacher_explanation || 0,
        optionDurations: optDurs,
      },
    };
  }

  return NextResponse.json(result);
}
