import { NextRequest, NextResponse } from "next/server";
import { getAudioDir } from "@/lib/paths";
import { getMimoApiKey } from "@/lib/settings";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { getDb } from "@/lib/db";

function applyDictionary(text: string): string {
  try {
    const db = getDb();
    const entries = db.prepare("SELECT original, replacement FROM tts_dictionary WHERE enabled = 1").all() as { original: string; replacement: string }[];
    let result = text;
    for (const { original, replacement } of entries) {
      result = result.split(original).join(replacement);
    }
    return result;
  } catch {
    return text;
  }
}

function getWavDuration(filePath: string): number {
  const buf = fs.readFileSync(filePath);
  const byteRate = buf.readUInt32LE(28);
  const dataStart = buf.indexOf("data") + 8;
  const dataSize = buf.length - dataStart;
  return byteRate > 0 ? dataSize / byteRate : 0;
}

export async function POST(request: NextRequest) {
  try {
    const { speed, voice, force } = await request.json();
    const ttsSpeed = speed || "medium";
    const ttsVoice = voice || "冰糖";

    const audioDir = getAudioDir();
    fs.mkdirSync(audioDir, { recursive: true });

    const speedPrefix = ttsSpeed === "slow" ? "语速稍慢，节奏从容。"
      : ttsSpeed === "fast" ? "语速比正常稍快。"
      : "语速适中自然。";
    const style = speedPrefix + "朗读选项内容，其中A、B、C、D是选项编号，请读作英文字母。";

    const optTexts = ["A，正确。", "B，错误。"];
    const results: { duration: number }[] = [];

    const apiKey = getMimoApiKey();
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.xiaomimimo.com/v1",
      defaultHeaders: { "api-key": apiKey },
    });

    const db = getDb();

    for (let i = 0; i < optTexts.length; i++) {
      const text = applyDictionary(optTexts[i]);
      let cacheSegment = ttsSpeed === "medium" ? `tf_opt_${i}` : `tf_opt_${i}_${ttsSpeed}`;
      if (ttsVoice !== "冰糖") cacheSegment = `${cacheSegment}_v${ttsVoice}`;
      const hash = Array.from(text).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);
      cacheSegment = `${cacheSegment}_${hash}`;

      const fileName = `q0_${cacheSegment}.wav`;
      const fullPath = path.join(audioDir, fileName);

      if (!force && fs.existsSync(fullPath)) {
        results.push({ duration: getWavDuration(fullPath) });
        continue;
      }

      const completion = await client.chat.completions.create({
        model: "mimo-v2.5-tts",
        messages: [
          { role: "user", content: style },
          { role: "assistant", content: text },
        ],
        // @ts-ignore
        audio: { format: "wav", voice: ttsVoice },
      });

      const message = completion.choices?.[0]?.message;
      // @ts-ignore
      const audioData = message?.audio?.data;
      if (!audioData) throw new Error(`TTS returned no audio for tf_opt_${i}`);
      fs.writeFileSync(fullPath, Buffer.from(audioData, "base64"));

      const duration = getWavDuration(fullPath);
      db.prepare("INSERT OR REPLACE INTO tts_cache (question_id, segment, file_path, duration_sec) VALUES (?, ?, ?, ?)").run(0, cacheSegment, `audio/${fileName}`, duration);
      // 同时用固定 segment 名注册，供题目生成时直接复用
      db.prepare("INSERT OR REPLACE INTO tts_cache (question_id, segment, file_path, duration_sec) VALUES (?, ?, ?, ?)").run(0, `tf_opt_${i}`, `audio/${fileName}`, duration);
      results.push({ duration });
    }

    return NextResponse.json({ ok: true, durations: results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const index = Number(searchParams.get("index") || 0);
  const speed = searchParams.get("speed") || "medium";
  const voice = searchParams.get("voice") || "冰糖";

  const audioDir = getAudioDir();
  let cacheSegment = speed === "medium" ? `tf_opt_${index}` : `tf_opt_${index}_${speed}`;
  if (voice !== "冰糖") cacheSegment = `${cacheSegment}_v${voice}`;

  const optTexts = ["A，正确。", "B，错误。"];
  const text = optTexts[index] || optTexts[0];
  const hash = Array.from(text).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);
  cacheSegment = `${cacheSegment}_${hash}`;

  const fullPath = path.join(audioDir, `q0_${cacheSegment}.wav`);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "not generated yet" }, { status: 404 });
  }

  const audioBuffer = fs.readFileSync(fullPath);
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(audioBuffer.length),
    },
  });
}
