import { NextRequest, NextResponse } from "next/server";
import { generateTTSForQuestion, generateBridgeAudios } from "@/lib/tts";

export async function POST(request: NextRequest) {
  try {
    const { questionId, teacherExplanation, showOfficialExplanation, showTip, voiceStyle, ttsSpeed, ttsVoice, force } = await request.json();
    if (!questionId) {
      return NextResponse.json({ error: "questionId required" }, { status: 400 });
    }

    const [result, bridgeDurations] = await Promise.all([
      generateTTSForQuestion(questionId, {
        teacherExplanation, showOfficialExplanation, showTip, voiceStyle, ttsSpeed, ttsVoice, force,
      }),
      generateBridgeAudios(),
    ]);

    return NextResponse.json({
      durations: { ...result.durations, ...bridgeDurations },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
