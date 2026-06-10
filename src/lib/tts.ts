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
  clauseDurations: number[];
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
    const cached = db.prepare("SELECT file_path, duration_sec, clause_durations FROM tts_cache WHERE question_id = ? AND segment = ?").get(questionId, cacheSegment) as { file_path: string; duration_sec: number; clause_durations: string | null } | undefined;

    if (cached && fs.existsSync(path.join(AUDIO_DIR, path.basename(cached.file_path)))) {
      const cd = cached.clause_durations ? JSON.parse(cached.clause_durations) as number[] : [];
      return { filePath: cached.file_path, duration: cached.duration_sec, clauseDurations: cd };
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
  const clauseDurations = detectClauseBoundaries(fullPath, text);

  db.prepare("INSERT OR REPLACE INTO tts_cache (question_id, segment, file_path, duration_sec, clause_durations) VALUES (?, ?, ?, ?, ?)").run(questionId, cacheSegment, filePath, duration, clauseDurations.length > 0 ? JSON.stringify(clauseDurations) : null);

  return { filePath, duration, clauseDurations };
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

function detectClauseBoundaries(wavPath: string, text: string): number[] {
  const clauses = text.split(/(?<=[。，！？、；,])/);
  if (clauses.length <= 1) return [];

  const buf = fs.readFileSync(wavPath);
  if (buf.length < 44) return [];
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const channels = buf.readUInt16LE(22);
  const bytesPerSample = (bitsPerSample / 8) * channels;
  const dataIdx = buf.indexOf(Buffer.from("data"));
  if (dataIdx < 0) return [];
  const dataStart = dataIdx + 8;
  const totalSamples = Math.floor((buf.length - dataStart) / bytesPerSample);
  const totalDuration = totalSamples / sampleRate;

  const windowSize = Math.round(sampleRate * 0.02);
  const minSilenceSamples = Math.round(sampleRate * 0.06);
  const threshold = 0.015;

  const rms: number[] = [];
  for (let i = 0; i < totalSamples; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, totalSamples);
    for (let j = i; j < end; j++) {
      const offset = dataStart + j * bytesPerSample;
      if (offset + 1 >= buf.length) break;
      const sample = buf.readInt16LE(offset) / 32768;
      sum += sample * sample;
    }
    rms.push(Math.sqrt(sum / (end - i)));
  }

  // Find silence regions
  interface SilenceRegion { start: number; end: number; }
  const silences: SilenceRegion[] = [];
  let silStart = -1;
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] < threshold) {
      if (silStart < 0) silStart = i;
    } else {
      if (silStart >= 0) {
        const startSample = silStart * windowSize;
        const endSample = i * windowSize;
        if (endSample - startSample >= minSilenceSamples) {
          silences.push({ start: startSample, end: endSample });
        }
        silStart = -1;
      }
    }
  }
  if (silStart >= 0) {
    const startSample = silStart * windowSize;
    if (totalSamples - startSample >= minSilenceSamples) {
      silences.push({ start: startSample, end: totalSamples });
    }
  }

  const numBoundaries = clauses.length - 1;
  const totalChars = clauses.reduce((s, c) => s + c.length, 0);
  const boundaryTimes: number[] = [];
  const usedSilences = new Set<number>();
  let charAcc = 0;

  for (let i = 0; i < numBoundaries; i++) {
    charAcc += clauses[i].length;
    const estimatedTime = (charAcc / totalChars) * totalDuration;
    // Find closest unused silence within 1s of the estimated position
    let bestIdx = -1;
    let bestDist = 1.0;
    for (let si = 0; si < silences.length; si++) {
      if (usedSilences.has(si)) continue;
      const mid = ((silences[si].start + silences[si].end) / 2) / sampleRate;
      const dist = Math.abs(mid - estimatedTime);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = si;
      }
    }
    if (bestIdx >= 0) {
      usedSilences.add(bestIdx);
      boundaryTimes.push(((silences[bestIdx].start + silences[bestIdx].end) / 2) / sampleRate);
    } else {
      boundaryTimes.push(estimatedTime);
    }
  }
  boundaryTimes.sort((a, b) => a - b);

  // Convert boundary times to clause durations
  const durations: number[] = [];
  let prev = 0;
  for (const t of boundaryTimes) {
    durations.push(Math.max(0.01, t - prev));
    prev = t;
  }
  durations.push(Math.max(0.01, totalDuration - prev));
  return durations;
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
  // Remove parentheses characters but keep content inside
  content = content.replace(/[（(]/g, "").replace(/[）)]/g, "");
  content = content.replace(/[。，！？]+$/, "。");
  if (!/[。！？]$/.test(content.trim())) {
    content = content.trim() + "。";
  }
  return typeLabel + content;
}

function buildOptionText(label: string, optionText: string): string {
  const clean = optionText.replace(/【/g, "").replace(/】/g, "").replace(/[（(]/g, "").replace(/[）)]/g, "");
  return `${label}, ${clean}。`;
}

function buildAnswerText(row: QuestionRow, readContent = true): string {
  const correct = row.correct_answer;
  const opts = [row.option1, row.option2, row.option3, row.option4].filter(Boolean);
  const labelMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const letters = correct.split("").filter((c) => labelMap[c] !== undefined);
  if (letters.length === 1 && readContent) {
    const idx = labelMap[letters[0]];
    const content = (opts[idx] || "").replace(/【/g, "").replace(/】/g, "").replace(/[（(]/g, "").replace(/[）)]/g, "");
    const isEnglish = /^[A-Z]{2,}$/.test(content.trim());
    return isEnglish
      ? `正确答案是${letters[0]}。${content}。`
      : `正确答案是${letters[0]}，${content}。`;
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

  const optionDurations: number[] = [];
  const tfOptionResults: TTSResult[] = [];
  const hasEnglishOpts = opts.some(opt => /^[A-Z]{2,}$/.test(opt.replace(/【|】/g, "").trim()));
  const optTexts = opts.map((opt, i) => {
    const clean = opt.replace(/【/g, "").replace(/】/g, "").replace(/[（(]/g, "").replace(/[）)]/g, "");
    return hasEnglishOpts
      ? `${labels[i]}，${clean}`
      : buildOptionText(labels[i], opt);
  });
  const allOptsText = optTexts.join("！") + "。";
  const promises: Promise<TTSResult>[] = [
    generateSegment(questionId, "question", questionText, "用清晰的教学语气朗读题目。", ttsSpeed, force, ttsVoice),
    generateSegment(questionId, "answer", answerText, "用肯定、清晰的语气播报正确答案，其中A、B、C、D是选项编号，请读作英文字母。", ttsSpeed, force, ttsVoice),
  ];

  const isTrueFalse = row.type === 1;

  if (!isTrueFalse && opts.length > 0) {
    const optStyle = hasEnglishOpts
      ? "朗读选项内容，其中A、B、C、D是选项编号，请读作英文字母。读完编号后稍作停顿，再快速连读后面的英文字母缩写，字母之间不要停顿。每个选项之间要有明显的停顿。"
      : "朗读选项内容，其中A、B、C、D是选项编号，请读作英文字母。";
    promises.push(generateSegment(questionId, "options", allOptsText, optStyle, ttsSpeed, force, ttsVoice));
  } else {
    const db = getDb();
    for (let i = 0; i < opts.length; i++) {
      const cached = db.prepare("SELECT file_path, duration_sec, clause_durations FROM tts_cache WHERE question_id = 0 AND segment = ?").get(`tf_opt_${i}`) as { file_path: string; duration_sec: number; clause_durations: string | null } | undefined;
      if (cached) {
        const srcPath = path.join(AUDIO_DIR, path.basename(cached.file_path));
        const destPath = path.join(AUDIO_DIR, `q${questionId}_opt_${i}.wav`);
        if (fs.existsSync(srcPath)) {
          if (srcPath !== destPath) fs.copyFileSync(srcPath, destPath);
          optionDurations.push(cached.duration_sec);
          const clauseDurs = cached.clause_durations ? JSON.parse(cached.clause_durations) as number[] : [];
          tfOptionResults.push({ duration: cached.duration_sec, filePath: destPath, clauseDurations: clauseDurs });
          continue;
        }
      }
      // fallback: 设置里未生成，走正常流程
      const optText = `${labels[i]}，${opts[i].replace(/[（(]/g, "").replace(/[）)]/g, "")}。`;
      const result = await generateSegment(0, `tf_opt_${i}`, optText, "朗读选项内容，其中A、B、C、D是选项编号，请读作英文字母。", ttsSpeed, false, ttsVoice);
      optionDurations.push(result.duration);
      tfOptionResults.push(result);
      const srcFile = path.join(AUDIO_DIR, path.basename(result.filePath));
      const destFile = path.join(AUDIO_DIR, `q${questionId}_opt_${i}.wav`);
      if (fs.existsSync(srcFile) && srcFile !== destFile) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }

  if (showExplanation) {
    promises.push(generateSegment(questionId, "explanation", row.explanation || "无解读。", "用沉稳、权威的教学语气解读法规内容。", ttsSpeed, force, ttsVoice));
  }
  if (showTip) {
    promises.push(generateSegment(questionId, "tip", row.tip_text || "无技巧。", "用轻快、提示性的语气分享答题技巧。", ttsSpeed, force, ttsVoice));
  }
  if (teacherText) {
    const cleanText = teacherText.replace(/【/g, "").replace(/】/g, "").replace(/[（(]/g, "").replace(/[）)]/g, "");
    promises.push(generateSegment(questionId, "teacher_explanation", cleanText, "用沉稳清晰的教学语气进行讲解，关键词处稍加重音。", ttsSpeed, force, ttsVoice));
  }

  const results = await Promise.all(promises);

  let idx = 0;
  const questionResult = results[idx++];
  const answerResult = results[idx++];

  if (!isTrueFalse && opts.length > 0) {
    const optionsResult = results[idx++];
    const totalDuration = optionsResult.duration;
    const srcPath = path.join(AUDIO_DIR, path.basename(optionsResult.filePath));
    const buf = fs.readFileSync(srcPath);
    const bitsPerSample = buf.readUInt16LE(34);
    const channels = buf.readUInt16LE(22);
    const bytesPerSample = (bitsPerSample / 8) * channels;
    const sampleRate = buf.readUInt32LE(24);
    const dataStart = 44;

    // Use silence detection to find per-option durations
    // allOptsText uses "！" as separator between options, matching the TTS input
    const clauseDurs = detectClauseBoundaries(srcPath, allOptsText);
    const textClauses = allOptsText.split(/(?<=[。，！？、；,])/);

    if (clauseDurs.length > 0 && clauseDurs.length === textClauses.length) {
      // Assign clauses to options by accumulating character lengths
      let clauseIdx = 0;
      let charAcc = 0;
      for (let i = 0; i < opts.length; i++) {
        // The target char position where this option ends (including "！" separator)
        const optEndChar = optTexts.slice(0, i + 1).join("！").length;
        let optDur = 0;
        while (clauseIdx < textClauses.length && charAcc + textClauses[clauseIdx].length <= optEndChar) {
          optDur += clauseDurs[clauseIdx];
          charAcc += textClauses[clauseIdx].length;
          clauseIdx++;
        }
        optionDurations.push(optDur > 0 ? optDur : totalDuration / opts.length);
      }
      // Assign any remaining clauses to the last option
      while (clauseIdx < clauseDurs.length) {
        optionDurations[optionDurations.length - 1] += clauseDurs[clauseIdx];
        clauseIdx++;
      }
    } else {
      // Fallback to char ratio
      const totalChars = optTexts.reduce((s, t) => s + t.length, 0);
      for (const optText of optTexts) {
        optionDurations.push(totalDuration * optText.length / totalChars);
      }
    }

    let sampleOffset = 0;
    for (let i = 0; i < opts.length; i++) {
      const samples = Math.round(optionDurations[i] * sampleRate);
      const headerSize = 44;
      const dataSize = Math.min(samples * bytesPerSample, buf.length - dataStart - sampleOffset * bytesPerSample);
      const optBuf = Buffer.alloc(headerSize + Math.max(0, dataSize));
      buf.copy(optBuf, 0, 0, headerSize);
      optBuf.writeUInt32LE(Math.max(0, dataSize), 40);
      optBuf.writeUInt32LE(headerSize + Math.max(0, dataSize) - 8, 4);
      if (dataSize > 0) {
        buf.copy(optBuf, headerSize, dataStart + sampleOffset * bytesPerSample, dataStart + sampleOffset * bytesPerSample + dataSize);
      }
      const destFile = path.join(AUDIO_DIR, `q${questionId}_opt_${i}.wav`);
      fs.writeFileSync(destFile, optBuf);
      sampleOffset += samples;
    }
  }
  const explanationResult = showExplanation ? results[idx++] : { duration: 0, clauseDurations: [] };
  const tipResult = showTip ? results[idx++] : { duration: 0, clauseDurations: [] };
  const teacherResult = teacherText ? results[idx++] : { duration: 0, clauseDurations: [] };

  // transition audio
  const typeLabel = row.type === 1 ? "判断题" : isMulti ? "多选题" : "单选题";
  if (showTransition) {
    await generateSegment(questionId, "transition", `下一题，${typeLabel}。`, "用清晰、有节奏感的播报语气报出题号和类型。", ttsSpeed, false, ttsVoice);
  }

  // Build per-option clause durations
  const optionClauseDurations: number[][] = [];
  if (!isTrueFalse && opts.length > 0) {
    const optionsResult = results[2];
    if (optionsResult.clauseDurations.length > 0) {
      const textClauses = allOptsText.split(/(?<=[。，！？、；,])/);
      let clauseIdx = 0;
      let charAcc = 0;
      for (let i = 0; i < opts.length; i++) {
        const optEndChar = optTexts.slice(0, i + 1).join("！").length;
        const raw: number[] = [];
        while (clauseIdx < textClauses.length && charAcc + textClauses[clauseIdx].length <= optEndChar) {
          raw.push(optionsResult.clauseDurations[clauseIdx]);
          charAcc += textClauses[clauseIdx].length;
          clauseIdx++;
        }
        optionClauseDurations.push(raw.length > 0 ? raw : [0]);
      }
      if (clauseIdx < optionsResult.clauseDurations.length) {
        const last = optionClauseDurations[optionClauseDurations.length - 1];
        while (clauseIdx < optionsResult.clauseDurations.length) {
          last[last.length - 1] += optionsResult.clauseDurations[clauseIdx];
          clauseIdx++;
        }
      }
    }
  } else {
    for (let oi = 0; oi < tfOptionResults.length; oi++) {
      const optResult = tfOptionResults[oi];
      const raw = [...(optResult.clauseDurations || [])];
      if (raw.length >= 2) {
        raw[1] += raw[0];
        raw.shift();
      }
      optionClauseDurations.push(raw);
    }
  }

  return {
    durations: {
      question: questionResult.duration,
      answer: answerResult.duration,
      explanation: (explanationResult as TTSResult).duration,
      tip: (tipResult as TTSResult).duration,
      teacherExplanation: (teacherResult as TTSResult).duration || undefined,
      optionDurations,
      questionClauseDurations: questionResult.clauseDurations.length > 0 ? questionResult.clauseDurations : undefined,
      optionClauseDurations: optionClauseDurations.some(a => a.length > 0) ? optionClauseDurations : undefined,
      explanationClauseDurations: (explanationResult as TTSResult).clauseDurations?.length > 0 ? (explanationResult as TTSResult).clauseDurations : undefined,
      tipClauseDurations: (tipResult as TTSResult).clauseDurations?.length > 0 ? (tipResult as TTSResult).clauseDurations : undefined,
      teacherExplanationClauseDurations: (teacherResult as TTSResult).clauseDurations?.length > 0 ? (teacherResult as TTSResult).clauseDurations : undefined,
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
