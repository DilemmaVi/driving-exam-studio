import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const questionId = request.nextUrl.searchParams.get("questionId");
  if (!questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  const db = getDb();
  const rows = db.prepare(
    "SELECT segment, file_path, duration_sec FROM tts_cache WHERE question_id = ? ORDER BY rowid"
  ).all(Number(questionId)) as { segment: string; file_path: string; duration_sec: number }[];

  const segmentOrder = ["question", "answer", "explanation", "teacher_explanation", "tip"];
  const segmentLabels: Record<string, string> = {
    question: "题目", answer: "答案", explanation: "解析",
    teacher_explanation: "讲师解析", tip: "技巧", transition: "过渡",
  };

  const segments = rows
    .filter((r) => !r.segment.startsWith("opt_"))
    .sort((a, b) => {
      const ai = segmentOrder.indexOf(a.segment.replace(/_(?:slow|fast)$/, ""));
      const bi = segmentOrder.indexOf(b.segment.replace(/_(?:slow|fast)$/, ""));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map((r) => {
      const baseSeg = r.segment.replace(/_(?:slow|fast)$/, "");
      return {
        segment: r.segment,
        label: segmentLabels[baseSeg] || baseSeg,
        url: `/api/audio/${r.file_path.replace(/^audio\//, "")}`,
        duration: r.duration_sec,
      };
    });

  return NextResponse.json({ segments });
}
