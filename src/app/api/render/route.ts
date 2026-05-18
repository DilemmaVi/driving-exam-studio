import { NextRequest, NextResponse } from "next/server";
import { getDb, nowBeijing } from "@/lib/db";
import { generateTTSForQuestion, generateBridgeAudios, type QuestionRow } from "@/lib/tts";
import { getOutputDir } from "@/lib/paths";
import { getSettings } from "@/lib/settings";
import { renderQueue } from "@/lib/render-queue";
import { v4 as uuid } from "uuid";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seriesId, questionIds, tipOnly } = body;

    const taskId = uuid();
    const db = getDb();

    let qIds: number[] = [];
    let seriesData: Record<string, unknown> | null = null;
    let seriesQuestions: Record<string, unknown>[] = [];

    if (seriesId) {
      seriesData = db.prepare("SELECT * FROM video_series WHERE id = ?").get(seriesId) as Record<string, unknown>;
      if (!seriesData) return NextResponse.json({ error: "series not found" }, { status: 404 });

      seriesQuestions = db.prepare(
        "SELECT * FROM series_questions WHERE series_id = ? ORDER BY sort_order"
      ).all(seriesId) as Record<string, unknown>[];
      qIds = seriesQuestions.map((sq) => sq.question_id as number);
    } else if (Array.isArray(questionIds) && questionIds.length > 0) {
      qIds = questionIds;
    } else {
      return NextResponse.json({ error: "seriesId or questionIds required" }, { status: 400 });
    }

    db.prepare("INSERT INTO render_tasks (id, question_ids, series_id, status, phase, phase_label, created_at) VALUES (?, ?, ?, 'pending', '', '', ?)")
      .run(taskId, JSON.stringify(qIds), seriesId || null, nowBeijing());

    renderQueue.enqueue(taskId, () => renderInBackground(taskId, qIds, seriesData, seriesQuestions, !!tipOnly));

    return NextResponse.json({ taskId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const db = getDb();

  // Recover stale tasks: if a task is stuck in tts/rendering but not in the queue, mark as error
  const stuckTasks = db.prepare("SELECT id FROM render_tasks WHERE status IN ('tts', 'rendering')").all() as { id: string }[];
  for (const t of stuckTasks) {
    if (renderQueue.getCurrentTaskId() !== t.id && renderQueue.getPosition(t.id) === 0) {
      db.prepare("UPDATE render_tasks SET status = 'error', error = '进程重启，任务中断' WHERE id = ?").run(t.id);
    }
  }

  if (taskId) {
    const task = db.prepare("SELECT * FROM render_tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
    if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (task.status === "pending") {
      (task as Record<string, unknown>).queue_position = renderQueue.getPosition(taskId);
    }
    return NextResponse.json(task);
  }

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const status = searchParams.get("status") || "";
  const keyword = searchParams.get("keyword") || "";

  let where = "1=1";
  const params: unknown[] = [];
  if (status) {
    if (status === "active") {
      where += " AND r.status IN ('pending','tts','rendering')";
    } else {
      where += " AND r.status = ?";
      params.push(status);
    }
  }
  if (keyword) {
    where += " AND (r.id LIKE ? OR s.name LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM render_tasks r LEFT JOIN video_series s ON s.id = r.series_id WHERE ${where}`).get(...params) as { cnt: number };

  const tasks = db.prepare(`
    SELECT r.*, s.name as series_name
    FROM render_tasks r
    LEFT JOIN video_series s ON s.id = r.series_id
    WHERE ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];

  for (const t of tasks) {
    if (t.status === "pending") {
      t.queue_position = renderQueue.getPosition(t.id as string);
    }
  }

  return NextResponse.json({ tasks, total: totalRow.cnt, queueLength: renderQueue.getQueueLength() });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const clearDone = searchParams.get("clearDone");
  const db = getDb();

  if (taskId) {
    renderQueue.cancel(taskId);
    db.prepare("DELETE FROM render_tasks WHERE id = ?").run(taskId);
  } else if (clearDone === "1") {
    db.prepare("DELETE FROM render_tasks WHERE status IN ('done','error')").run();
  }
  return NextResponse.json({ ok: true });
}

const ALLOWED_TASK_COLUMNS = new Set([
  "status", "phase", "phase_label", "progress", "error",
  "output_path", "file_size", "completed_at",
  "rendered_frames", "total_frames",
]);

function updateTask(taskId: string, fields: Record<string, unknown>) {
  const db = getDb();
  const safeFields = Object.entries(fields).filter(([k]) => ALLOWED_TASK_COLUMNS.has(k));
  if (safeFields.length === 0) return;
  const sets = safeFields.map(([k]) => `${k} = ?`).join(", ");
  const values = safeFields.map(([, v]) => v);
  db.prepare(`UPDATE render_tasks SET ${sets} WHERE id = ?`).run(...values, taskId);
}

export async function renderInBackground(
  taskId: string,
  questionIds: number[],
  seriesData: Record<string, unknown> | null,
  seriesQuestions: Record<string, unknown>[],
  tipOnly = false,
) {
  try {
    updateTask(taskId, { status: "tts", phase: "tts", phase_label: "生成过渡语音", progress: 0 });

    const showTransition = seriesData?.show_transition === 1;
    const pauseStart = (seriesData?.pause_start as number) ?? 2.0;
    const pauseEnd = (seriesData?.pause_end as number) ?? 2.0;
    const pauseBeforeTip = (seriesData?.pause_before_tip as number) ?? 2.0;
    const ttsSpeed = (seriesData?.tts_speed as string) || "medium";
    const ttsVoice = (seriesData?.tts_voice as string) || "冰糖";
    const keywordFlashEnabled = seriesData?.keyword_flash_enabled !== 0;
    const underlineProgressEnabled = seriesData?.underline_progress_enabled !== 0;
    const underlineQuestion = seriesData?.underline_question !== 0;
    const underlineOption = (seriesData?.underline_option as number) === 1;
    const underlineExplanation = seriesData?.underline_explanation !== 0;
    const underlineTip = seriesData?.underline_tip !== 0;
    const underlineColor = (seriesData?.underline_color as string) || "#6366F1";
    const avatarEnabled = seriesData?.avatar_enabled !== 0;
    const avatarSize = (seriesData?.avatar_size as number) ?? 80;
    const avatarPosition = (seriesData?.avatar_position as string) || "bottom-right";

    const bridgeDurations = await generateBridgeAudios(seriesData ? {
      bridge_think: seriesData.bridge_think as string | null,
      bridge_reveal: seriesData.bridge_reveal as string | null,
      bridge_explain: seriesData.bridge_explain as string | null,
      bridge_tip: seriesData.bridge_tip as string | null,
    } : undefined, ttsSpeed, ttsVoice);

    // Apply bridge enabled switches
    const effectiveBridges = {
      bridgeThink: (seriesData?.bridge_think_enabled !== 0) ? bridgeDurations.bridgeThink : 0,
      bridgeReveal: (seriesData?.bridge_reveal_enabled !== 0) ? bridgeDurations.bridgeReveal : 0,
      bridgeExplain: (seriesData?.bridge_explain_enabled !== 0) ? bridgeDurations.bridgeExplain : 0,
      bridgeTip: (seriesData?.bridge_tip_enabled !== 0) ? bridgeDurations.bridgeTip : 0,
    };

    const answerReadOption = seriesData?.answer_read_option !== 0;
    const answerReadMulti = (seriesData?.answer_read_multi as number) === 1;

    const sqMap = new Map(seriesQuestions.map((sq) => [sq.question_id as number, sq]));

    const entries: Array<{
      question: {
        id: number;
        type: string;
        questionContent: string;
        options: string[];
        correctIndex: number;
        correctIndices?: number[];
        explanation: string;
        tip: string;
        coverImage?: string;
      };
      durations: {
        question: number; answer: number; explanation: number; tip: number;
        teacherExplanation?: number;
        bridgeThink?: number; bridgeReveal?: number; bridgeExplain?: number; bridgeTip?: number;
      };
      component: "tf" | "mc" | "scroll";
      teacherExplanation?: string;
      showOfficialExplanation?: boolean;
      showTip?: boolean;
      thinkTime?: number;
      readOptions?: boolean;
      optionGap?: number;
      fontSizeQuestion?: number;
      fontSizeOption?: number;
      fontSizeExplanation?: number;
      stemKeywords?: string[];
      stemKeywordPhases?: string[];
      readingPrefixDelay?: number;
      readingSpeedRatio?: number;
      panelAdjust?: string;
      panelAdjustValue?: number;
    }> = [];

    for (let i = 0; i < questionIds.length; i++) {
      const qId = questionIds[i];
      updateTask(taskId, {
        progress: i / questionIds.length * 0.3,
        phase_label: `生成语音 (${i + 1}/${questionIds.length})`,
      });

      const db = getDb();
      const sq = sqMap.get(qId);
      const teacherExplanation = (sq?.teacher_explanation as string) || "";
      const showOfficialExplanation = sq ? sq.show_official_explanation !== 0 : true;
      const showTip = sq ? sq.show_tip !== 0 : true;
      const thinkTime = (sq?.think_time as number | null) ?? (seriesData?.default_think_time as number) ?? 3;

      const ttsResult = await generateTTSForQuestion(qId, {
        teacherExplanation, showOfficialExplanation, showTip,
        answerReadOption, answerReadMulti, ttsSpeed, ttsVoice, showTransition,
      });
      const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(qId) as QuestionRow;

      const correctLetters = row.correct_answer.split("").filter((c: string) => "ABCD".includes(c));
      const labelMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      const correctIndices = correctLetters.map((c: string) => labelMap[c]);
      const correctIdx = correctIndices[0] ?? 0;
      const options = [row.option1, row.option2, row.option3, row.option4].filter(Boolean) as string[];

      // readOptions threshold: 0=never, 999=always, N=skip if any option > N chars
      const perQReadOpt = sq?.read_options as number | null | undefined;
      const seriesReadOpt = seriesData?.read_options as number | null | undefined;
      const threshold = perQReadOpt !== undefined && perQReadOpt !== null
        ? perQReadOpt
        : seriesReadOpt !== undefined && seriesReadOpt !== null
          ? seriesReadOpt
          : 999;

      let readOpts: boolean;
      if (threshold === 0) {
        readOpts = false;
      } else if (threshold >= 999) {
        readOpts = true;
      } else {
        const stemLen = (row.question_text || "").replace(/【|】/g, "").length;
        readOpts = stemLen <= threshold;
      }

      let questionContent = row.question_text || "";
      questionContent = questionContent.replace(/;/g, "，");

      const isLong = questionContent.length > 100 || options.some((o) => o.length > 20);
      const component: "tf" | "mc" | "scroll" = row.type === 1 ? "tf" : isLong ? "scroll" : "mc";

      entries.push({
        question: {
          id: row.id,
          type: row.type === 1 ? "true-false" : "multiple-choice",
          questionContent,
          options,
          correctIndex: correctIdx,
          correctIndices: correctIndices.length > 1 ? correctIndices : undefined,
          explanation: row.explanation || "",
          tip: row.tip_text || row.tip_display || "",
          coverImage: row.cover_image || undefined,
        },
        durations: { ...ttsResult.durations, ...effectiveBridges },
        component,
        teacherExplanation: teacherExplanation || undefined,
        showOfficialExplanation,
        showTip,
        thinkTime,
        readOptions: readOpts,
        optionGap: (sq?.option_gap as number | null) ?? undefined,
        fontSizeQuestion: (sq?.font_size_question as number | null) ?? undefined,
        fontSizeOption: (sq?.font_size_option as number | null) ?? undefined,
        fontSizeExplanation: (sq?.font_size_explanation as number | null) ?? undefined,
        stemKeywords: ((sq?.stem_keywords as string) || "").split(",").filter(Boolean) || undefined,
        stemKeywordPhases: ((sq?.stem_keyword_phases as string) || "").split(",").filter(Boolean) || undefined,
        readingPrefixDelay: (sq?.reading_prefix_delay as number | null) ?? undefined,
        readingSpeedRatio: (sq?.reading_speed_ratio as number | null) ?? undefined,
        panelAdjust: (sq?.panel_adjust as string) || undefined,
        panelAdjustValue: (sq?.panel_adjust_value as number | null) ?? undefined,
      });
    }

    updateTask(taskId, { status: "rendering", phase: "bundling", phase_label: "打包项目...", progress: 0.3 });

    const outputDir = getOutputDir();
    const outputPath = path.join(outputDir, `${taskId}.mp4`);
    const propsFile = path.join(outputDir, `${taskId}.json`);

    const props: Record<string, unknown> = {
      entries,
      showTransition,
      pauseStart,
      pauseEnd,
      pauseBeforeTip,
      keywordFlashEnabled,
      underlineProgressEnabled,
      underlineQuestion,
      underlineOption,
      underlineExplanation,
      underlineTip,
      underlineColor,
      avatarEnabled,
      avatarSize,
      avatarPosition,
    };

    const settings = getSettings();
    if (settings.watermarkEnabled && (settings.watermarkText || settings.watermarkLogoUrl)) {
      props.watermarkText = settings.watermarkText;
      props.watermarkPosition = settings.watermarkPosition || "bottom-right";
      props.watermarkOpacity = settings.watermarkOpacity ?? 30;
      props.watermarkFontSize = settings.watermarkFontSize ?? 36;
      props.watermarkLogoUrl = settings.watermarkLogoUrl;
      props.watermarkScale = settings.watermarkScale ?? 100;
      props.watermarkColor = settings.watermarkColor;
      props.watermarkFont = settings.watermarkFont;
      props.watermarkStroke = settings.watermarkStroke;
    }
    if (tipOnly) {
      props.tipOnly = true;
    } else if (seriesData) {
      props.introTitle = seriesData.intro_title || "";
      props.introSubtitle = seriesData.intro_subtitle || "";
      props.introCategory = seriesData.category || "";
      if (seriesData.outro_text) {
        props.outroText = seriesData.outro_text;
        props.outroSubtitle = seriesData.outro_subtitle || "";
      }
    }

    fs.writeFileSync(propsFile, JSON.stringify(props));

    await new Promise<void>((resolve, reject) => {
      const isPackaged = !!process.env.NODE_PATH;
      let cmd: string;
      let args: string[];
      let renderEnv = { ...process.env };
      if (isPackaged) {
        const scriptPath = path.join(process.cwd(), "scripts", "render-video.js");
        cmd = process.env.NODE_EXEC || process.execPath;
        const nodeDepsPath = path.join(process.cwd(), "node_modules");
        args = [scriptPath, propsFile, outputPath];
        renderEnv = { ...process.env, NODE_PATH: nodeDepsPath, NODE_ENV: "production" };
      } else {
        cmd = "npx";
        args = ["tsx", "scripts/render-video.ts", propsFile, outputPath];
      }
      const child = spawn(cmd, args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: renderEnv,
        shell: !isPackaged,
      });

      renderQueue.setCurrentProcess(child);

      let stderrBuf = "";
      let stdoutBuf = "";

      child.stdout.on("data", (data: Buffer) => {
        const text = data.toString();
        stdoutBuf += text;
        const lines = text.split("\n").filter(Boolean);
        for (const line of lines) {
          try { const msg = JSON.parse(line); handleRenderMessage(taskId, msg); } catch {}
        }
      });

      child.stderr.on("data", (data: Buffer) => { stderrBuf += data.toString(); });

      child.on("close", (code) => {
        if (code === 0) resolve();
        else {
          const errMsg = stderrBuf || stdoutBuf.slice(-2000) || `render process exited with code ${code}`;
          reject(new Error(errMsg));
        }
      });

      child.on("error", reject);
    });

    try { fs.unlinkSync(propsFile); } catch {}

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    updateTask(taskId, { status: "error", error: msg.slice(0, 2000) });
  }
}

function handleRenderMessage(taskId: string, msg: Record<string, unknown>) {
  switch (msg.type) {
    case "status":
      updateTask(taskId, { phase: msg.phase, phase_label: msg.message });
      if (msg.phase === "hd") {
        updateTask(taskId, { progress: 0.95 });
      }
      break;
    case "progress":
      if (msg.phase === "bundling") {
        updateTask(taskId, {
          phase: "bundling",
          phase_label: `打包项目 ${msg.progress}%`,
          progress: 0.3 + (msg.progress as number) / 100 * 0.15,
        });
      } else if (msg.phase === "rendering") {
        updateTask(taskId, {
          phase: "rendering",
          phase_label: `渲染帧 ${msg.renderedFrames}/${msg.totalFrames}`,
          progress: 0.45 + (msg.progress as number) / 100 * 0.55,
          rendered_frames: msg.renderedFrames as number,
          total_frames: msg.totalFrames as number,
        });
      }
      break;
    case "info":
      updateTask(taskId, {
        total_frames: msg.totalFrames as number,
        phase_label: `视频 ${msg.durationSec}秒 ${msg.totalFrames}帧 ${msg.width}x${msg.height}`,
      });
      break;
    case "done":
      updateTask(taskId, {
        status: "done", progress: 1, phase: "done", phase_label: "渲染完成",
        output_path: msg.outputPath as string,
        file_size: `${msg.fileSizeMB}MB`,
        completed_at: nowBeijing(),
      });
      break;
    case "error":
      updateTask(taskId, { status: "error", error: msg.message as string });
      break;
  }
}
