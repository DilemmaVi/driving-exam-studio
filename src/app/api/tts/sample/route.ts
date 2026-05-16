import { NextRequest, NextResponse } from "next/server";
import { getAudioDir } from "@/lib/paths";
import { getMimoApiKey } from "@/lib/settings";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const SAMPLE_TEXT = "驾考题目解析，正确答案是A，我们来看一下为什么。";

export async function POST(request: NextRequest) {
  try {
    const { voice } = await request.json();
    if (!voice) return NextResponse.json({ error: "voice required" }, { status: 400 });

    const audioDir = getAudioDir();
    fs.mkdirSync(audioDir, { recursive: true });
    const fileName = `sample_${voice.replace(/[^a-zA-Z0-9一-鿿]/g, "_")}.wav`;
    const fullPath = path.join(audioDir, fileName);

    if (!fs.existsSync(fullPath)) {
      const apiKey = getMimoApiKey();
      const client = new OpenAI({
        apiKey,
        baseURL: "https://api.xiaomimimo.com/v1",
        defaultHeaders: { "api-key": apiKey },
      });
      const completion = await client.chat.completions.create({
        model: "mimo-v2.5-tts",
        messages: [
          { role: "user", content: "用清晰的教学语气朗读。" },
          { role: "assistant", content: SAMPLE_TEXT },
        ],
        // @ts-ignore
        audio: { format: "wav", voice },
      });
      const message = completion.choices?.[0]?.message;
      // @ts-ignore
      const audioData = message?.audio?.data;
      if (!audioData) throw new Error("TTS returned no audio");
      fs.writeFileSync(fullPath, Buffer.from(audioData, "base64"));
    }

    const audioBuffer = fs.readFileSync(fullPath);
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
