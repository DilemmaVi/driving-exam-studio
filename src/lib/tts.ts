import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { getDb } from "./db";
import { getMimoApiKey, getMimoBaseUrl, getMimoTtsModel } from "./settings";
import { getAudioDir } from "./paths";

const AUDIO_DIR = getAudioDir();

function getClient() {
  const apiKey = getMimoApiKey();
  const baseURL = getMimoBaseUrl();
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: { "api-key": apiKey },
  });
}

interface TTSResult {
  filePath: string;
  duration: number;
}

export const MIMO_VOICES = [
  { id: "冰糖", name: "冰糖", gender: "female", lang: "zh" },
  { id: "茉莉", name: "茉莉", gender: "female", lang: "zh" },
  { id: "苏打", name: "苏打", gender: "male", lang: "zh" },
  { id: "白桦", name: "白桦", gender: "male", lang: "zh" },
  { id: "Mia", name: "Mia", gender: "female", lang: "en" },
  { id: "Chloe", name: "Chloe", gender: "female", lang: "en" },
  { id: "Milo", name: "Milo", gender: "male", lang: "en" },
  { id: "Dean", name: "Dean", gender: "male", lang: "en" },
] as const;

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

async function generateSegment(questionId: number, segment: string, text: string, style: string, speed: string = "medium", force = false, voice: string = "冰糖"): Promise<TTSResult> {
  text = applyDictionary(text);
  const speedPrefix = speed === "slow" ? "语速稍慢，节奏从容。"
    : speed === "fast" ? "语速比正常稍快。"
    : "语速适中自然。";
  const fullStyle = speedPrefix + style;
  let cacheSegment = speed === "medium" ? segment : `${segment}_${speed}`;
  if (voice !== "冰糖") cacheSegment = `${cacheSegment}_v${voice}`;
  if (questionId === 0) {
    const hash = Array.from(text).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);
    cacheSegment = `${cacheSegment}_${hash}`;
  }

  const db = getDb();

  if (!force) {
    const cached = db.prepare("SELECT file_path, duration_sec FROM tts_cache WHERE question_id = ? AND segment = ?").get(questionId, cacheSegment) as { file_path: string; duration_sec: number } | undefined;

    if (cached && fs.existsSync(path.join(AUDIO_DIR, path.basename(cached.file_path)))) {
      return { filePath: cached.file_path, duration: cached.duration_sec };
    }
  }

  const fileName = `q${questionId}_${cacheSegment}.wav`;
  const filePath = `audio/${fileName}`;
  const fullPath = path.join(AUDIO_DIR, fileName);

  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const client = getClient();
  const model = getMimoTtsModel();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "user", content: fullStyle },
      { role: "assistant", content: text },
    ],
    // @ts-ignore
    audio: { format: "wav", voice },
  }, { timeout: 30000 });

  const message = completion.choices?.[0]?.message;
  // @ts-ignore
  const audioData = message?.audio?.data;
  if (!audioData) throw new Error(`TTS returned no audio for q${questionId}_${segment}`);
  const audioBytes = Buffer.from(audioData, "base64");
  fs.writeFileSync(fullPath, audioBytes);

  const duration = getWavDuration(fullPath);

  db.prepare("INSERT OR REPLACE INTO tts_cache (question_id, segment, file_path, duration_sec) VALUES (?, ?, ?, ?)").run(questionId, cacheSegment, filePath, duration);

  return { filePath, duration };
}

function getWavDuration(filePath: string): number {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 44) return 1.0;
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  if (!channels || !sampleRate || !bitsPerSample) return 1.0;
  const dataIdx = buf.indexOf(Buffer.from("data"));
  if (dataIdx < 0) return 1.0;
  const dataStart = dataIdx + 8;
  const dataSize = buf.length - dataStart;
  if (dataSize <= 0) return 0;
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
  content = content.replace(/[（(]/g, "").replace(/[）)]/g, "");
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
    ttsVoice?: string;
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
  const ttsVoice = options?.ttsVoice || "冰糖";
  const showTransition = options?.showTransition;
  const force = options?.force || false;

  const labels = ["A", "B", "C", "D"];
  const opts = [row.option1, row.option2, row.option3, row.option4].filter(Boolean) as string[];

  const promises: Promise<TTSResult>[] = [
    generateSegment(questionId, "question", questionText, "用清晰的教学语气朗读题目。", ttsSpeed, force, ttsVoice),
    generateSegment(questionId, "answer", answerText, "用肯定、清晰的语气播报正确答案，其中A、B、C、D是选项编号，请读作英文字母。", ttsSpeed, force, ttsVoice),
  ];

  const isTrueFalse = row.type === 1;

  for (let i = 0; i < opts.length; i++) {
    const optText = buildOptionText(labels[i], opts[i]);
    if (isTrueFalse) {
      // True/false options ("A，正确。" / "B，错误。") are shared globally
      promises.push(generateSegment(0, `tf_opt_${i}`, optText, "朗读选项内容，其中A、B、C、D是选项编号，请读作英文字母。", ttsSpeed, false, ttsVoice));
    } else {
      promises.push(generateSegment(questionId, `opt_${i}`, optText, "朗读选项内容，其中A、B、C、D是选项编号，请读作英文字母。", ttsSpeed, force, ttsVoice));
    }
  }

  if (showExplanation) {
    promises.push(generateSegment(questionId, "explanation", row.explanation || "无解读。", "用沉稳、权威的教学语气解读法规内容。", ttsSpeed, force, ttsVoice));
  }
  if (showTip) {
    promises.push(generateSegment(questionId, "tip", row.tip_text || "无技巧。", "用轻快、提示性的语气分享答题技巧。", ttsSpeed, force, ttsVoice));
  }
  if (teacherText) {
    const cleanText = teacherText.replace(/【/g, "").replace(/】/g, "");
    promises.push(generateSegment(questionId, "teacher_explanation", cleanText, "用沉稳清晰的教学语气进行讲解，关键词处稍加重音。", ttsSpeed, force, ttsVoice));
  }

  const results = await Promise.all(promises);

  let idx = 0;
  const questionResult = results[idx++];
  const answerResult = results[idx++];
  const optionDurations: number[] = [];
  for (let i = 0; i < opts.length; i++) {
    const optResult = results[idx++];
    optionDurations.push(optResult.duration);
    if (isTrueFalse) {
      // Copy shared tf option audio to per-question filename for Remotion
      const srcFile = path.join(AUDIO_DIR, path.basename(optResult.filePath));
      const destFile = path.join(AUDIO_DIR, `q${questionId}_opt_${i}.wav`);
      if (fs.existsSync(srcFile) && srcFile !== destFile) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }
  const explanationResult = showExplanation ? results[idx++] : { duration: 0 };
  const tipResult = showTip ? results[idx++] : { duration: 0 };
  const teacherResult = teacherText ? results[idx++] : { duration: 0 };

  // transition audio
  const typeLabel = row.type === 1 ? "判断题" : isMulti ? "多选题" : "单选题";
  if (showTransition) {
    await generateSegment(questionId, "transition", `下一题，${typeLabel}。`, "用清晰、有节奏感的播报语气报出题号和类型。", ttsSpeed, false, ttsVoice);
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
}, ttsSpeed?: string, ttsVoice?: string): Promise<BridgeDurations> {
  const texts = {
    bridge_think: seriesData?.bridge_think || DEFAULT_BRIDGES.bridge_think,
    bridge_reveal: seriesData?.bridge_reveal || DEFAULT_BRIDGES.bridge_reveal,
    bridge_explain: seriesData?.bridge_explain || DEFAULT_BRIDGES.bridge_explain,
    bridge_tip: seriesData?.bridge_tip || DEFAULT_BRIDGES.bridge_tip,
  };

  const keys = Object.keys(texts) as Array<keyof typeof texts>;
  const results = await Promise.all(
    keys.map((key) =>
      generateSegment(0, key, texts[key], BRIDGE_STYLES[key], ttsSpeed || "medium", false, ttsVoice || "冰糖")
    )
  );

  // Copy to fixed filenames that Remotion components expect
  for (let i = 0; i < keys.length; i++) {
    const actualFile = path.join(AUDIO_DIR, path.basename(results[i].filePath));
    const fixedFile = path.join(AUDIO_DIR, `q0_${keys[i]}.wav`);
    if (fs.existsSync(actualFile) && actualFile !== fixedFile) {
      fs.copyFileSync(actualFile, fixedFile);
    }
  }

  return {
    bridgeThink: results[0].duration,
    bridgeReveal: results[1].duration,
    bridgeExplain: results[2].duration,
    bridgeTip: results[3].duration,
  };
}
