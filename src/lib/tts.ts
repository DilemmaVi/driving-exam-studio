import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { getDb } from "./db";
import { getMimoApiKey } from "./settings";
import { getAudioDir } from "./paths";

const AUDIO_DIR = getAudioDir();

function getClient() {
  const apiKey = getMimoApiKey();
  return new OpenAI({
    apiKey,
    baseURL: "https://api.xiaomimimo.com/v1",
    defaultHeaders: { "api-key": apiKey },
  });
}

interface TTSResult {
  filePath: string;
  duration: number;
}

async function generateSegment(questionId: number, segment: string, text: string, style: string, speed: string = "medium", force = false): Promise<TTSResult> {
  const speedPrefix = speed === "slow" ? "语速稍慢，节奏从容。"
    : speed === "fast" ? "语速比正常稍快。"
    : "语速适中自然。";
  const fullStyle = speedPrefix + style;
  const cacheSegment = speed === "medium" ? segment : `${segment}_${speed}`;

  const db = getDb();

  if (!force) {
    const cached = db.prepare("SELECT file_path, duration_sec FROM tts_cache WHERE question_id = ? AND segment = ?").get(questionId, cacheSegment) as { file_path: string; duration_sec: number } | undefined;

    if (cached && fs.existsSync(path.join(AUDIO_DIR, path.basename(cached.file_path)))) {
      return { filePath: cached.file_path, duration: cached.duration_sec };
    }
  }

  const client = getClient();
  const fileName = `q${questionId}_${cacheSegment}.wav`;
  const filePath = `audio/${fileName}`;
  const fullPath = path.join(AUDIO_DIR, fileName);

  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const completion = await client.chat.completions.create({
    model: "mimo-v2.5-tts",
    messages: [
      { role: "user", content: fullStyle },
      { role: "assistant", content: text },
    ],
    // @ts-ignore
    audio: { format: "wav", voice: "冰糖" },
  });

  const message = completion.choices[0].message;
  // @ts-ignore
  const audioBytes = Buffer.from(message.audio.data, "base64");
  fs.writeFileSync(fullPath, audioBytes);

  const duration = getWavDuration(fullPath);

  db.prepare("INSERT OR REPLACE INTO tts_cache (question_id, segment, file_path, duration_sec) VALUES (?, ?, ?, ?)").run(questionId, cacheSegment, filePath, duration);

  return { filePath, duration };
}

function getWavDuration(filePath: string): number {
  const buf = fs.readFileSync(filePath);
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const dataStart = buf.indexOf(Buffer.from("data")) + 8;
  const dataSize = buf.length - dataStart;
  return dataSize / (channels * sampleRate * (bitsPerSample / 8));
}

export interface QuestionRow {
  id: number;
  type: number;
  question_text: string;
  question_content: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correct_answer: string;
  explanation: string;
  tip_text: string;
  tip_display: string;
  cover_image: string | null;
  gif_image: string | null;
  explanation_images: string | null;
  keywords: string | null;
}

function buildQuestionStemText(row: QuestionRow): string {
  const isMulti = (row.correct_answer || "").length > 1;
  const typeLabel = row.type === 1 ? "判断题。" : isMulti ? "多选题。" : "单选题。";
  let content = row.question_content || row.question_text || "";
  content = content.replace(/;/g, "，");
  content = content.replace(/【/g, "").replace(/】/g, "");
  // Strip option part: A:xxx, B:xxx etc.
  content = content.replace(/[,，]?\s*A[.:：][\s\S]*$/, "");
  content = content.replace(/[（(]\s*[）)]/g, "");
  content = content.replace(/[。，！？]+$/, "。");
  if (!/[。！？]$/.test(content.trim())) {
    content = content.trim() + "。";
  }
  return typeLabel + content;
}

function buildOptionText(label: string, optionText: string): string {
  const clean = optionText.replace(/【/g, "").replace(/】/g, "");
  return `${label}，${clean}。`;
}

function buildAnswerText(row: QuestionRow, readContent = true): string {
  const correct = row.correct_answer;
  const opts = [row.option1, row.option2, row.option3, row.option4].filter(Boolean);
  const labelMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const letters = correct.split("").filter((c) => labelMap[c] !== undefined);
  if (letters.length === 1 && readContent) {
    const idx = labelMap[letters[0]];
    return `正确答案是${letters[0]}，${(opts[idx] || "").replace(/【/g, "").replace(/】/g, "")}。`;
  }
  return `正确答案是${letters.join("")}。`;
}

export async function generateTTSForQuestion(
  questionId: number,
  options?: {
    teacherExplanation?: string;
    showOfficialExplanation?: boolean;
    showTip?: boolean;
    voiceStyle?: string;
    answerReadOption?: boolean;
    answerReadMulti?: boolean;
    ttsSpeed?: string;
    showTransition?: boolean;
    force?: boolean;
  }
) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(questionId) as QuestionRow | undefined;
  if (!row) throw new Error(`Question ${questionId} not found`);

  const questionText = buildQuestionStemText(row);
  const isMulti = (row.correct_answer || "").length > 1;
  const readContent = isMulti ? (options?.answerReadMulti ?? false) : (options?.answerReadOption ?? true);
  const answerText = buildAnswerText(row, readContent);
  const showExplanation = options?.showOfficialExplanation !== false;
  const showTip = options?.showTip !== false;
  const teacherText = options?.teacherExplanation || "";
  const ttsSpeed = options?.ttsSpeed || "medium";
  const showTransition = options?.showTransition;
  const force = options?.force || false;

  const labels = ["A", "B", "C", "D"];
  const opts = [row.option1, row.option2, row.option3, row.option4].filter(Boolean) as string[];

  const promises: Promise<TTSResult>[] = [
    generateSegment(questionId, "question", questionText, "用清晰的教学语气朗读题目。", ttsSpeed, force),
    generateSegment(questionId, "answer", answerText, "用肯定、清晰的语气播报正确答案。", ttsSpeed, force),
  ];

  for (let i = 0; i < opts.length; i++) {
    const optText = buildOptionText(labels[i], opts[i]);
    promises.push(generateSegment(questionId, `opt_${i}`, optText, "用清晰的教学语气朗读选项。", ttsSpeed, force));
  }

  if (showExplanation) {
    promises.push(generateSegment(questionId, "explanation", row.explanation || "无解读。", "用沉稳、权威的教学语气解读法规内容。", ttsSpeed, force));
  }
  if (showTip) {
    promises.push(generateSegment(questionId, "tip", row.tip_text || "无技巧。", "用轻快、提示性的语气分享答题技巧。", ttsSpeed, force));
  }
  if (teacherText) {
    const cleanText = teacherText.replace(/【/g, "").replace(/】/g, "");
    promises.push(generateSegment(questionId, "teacher_explanation", cleanText, "用沉稳清晰的教学语气进行讲解，关键词处稍加重音。", ttsSpeed, force));
  }

  const results = await Promise.all(promises);

  let idx = 0;
  const questionResult = results[idx++];
  const answerResult = results[idx++];
  const optionDurations: number[] = [];
  for (let i = 0; i < opts.length; i++) {
    optionDurations.push(results[idx++].duration);
  }
  const explanationResult = showExplanation ? results[idx++] : { duration: 0 };
  const tipResult = showTip ? results[idx++] : { duration: 0 };
  const teacherResult = teacherText ? results[idx++] : { duration: 0 };

  // transition audio
  const typeLabel = row.type === 1 ? "判断题" : isMulti ? "多选题" : "单选题";
  if (showTransition) {
    await generateSegment(questionId, "transition", `下一题，${typeLabel}。`, "用清晰、有节奏感的播报语气报出题号和类型。", ttsSpeed);
  }

  return {
    durations: {
      question: questionResult.duration,
      answer: answerResult.duration,
      explanation: explanationResult.duration,
      tip: tipResult.duration,
      teacherExplanation: teacherResult.duration || undefined,
      optionDurations,
    },
  };
}

export interface BridgeDurations {
  bridgeThink: number;
  bridgeReveal: number;
  bridgeExplain: number;
  bridgeTip: number;
}

const DEFAULT_BRIDGES = {
  bridge_think: "大家先想一想",
  bridge_reveal: "好，公布答案",
  bridge_explain: "我们来看一下为什么",
  bridge_tip: "记住这个小技巧",
};

const BRIDGE_STYLES: Record<string, string> = {
  bridge_think: "用轻柔、引导性的语气说话。",
  bridge_reveal: "用清晰、有力的播报语气说话。",
  bridge_explain: "用沉稳的教学语气说话。",
  bridge_tip: "用轻快、提示性的语气说话。",
};

export async function generateBridgeAudios(seriesData?: {
  bridge_think?: string | null;
  bridge_reveal?: string | null;
  bridge_explain?: string | null;
  bridge_tip?: string | null;
}, ttsSpeed?: string): Promise<BridgeDurations> {
  const texts = {
    bridge_think: seriesData?.bridge_think || DEFAULT_BRIDGES.bridge_think,
    bridge_reveal: seriesData?.bridge_reveal || DEFAULT_BRIDGES.bridge_reveal,
    bridge_explain: seriesData?.bridge_explain || DEFAULT_BRIDGES.bridge_explain,
    bridge_tip: seriesData?.bridge_tip || DEFAULT_BRIDGES.bridge_tip,
  };

  const results = await Promise.all(
    Object.entries(texts).map(([key, text]) =>
      generateSegment(0, key, text, BRIDGE_STYLES[key], ttsSpeed || "medium")
    )
  );

  return {
    bridgeThink: results[0].duration,
    bridgeReveal: results[1].duration,
    bridgeExplain: results[2].duration,
    bridgeTip: results[3].duration,
  };
}
