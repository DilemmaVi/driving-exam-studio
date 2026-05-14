import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateTTSForQuestion, generateBridgeAudios, type QuestionRow } from "@/lib/tts";
import { getOutputDir } from "@/lib/paths";
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

    db.prepare("INSERT INTO render_tasks (id, question_ids, series_id, status, phase, phase_label) VALUES (?, ?, ?, 'pending', '', '')")
      .run(taskId, JSON.stringify(qIds), seriesId || null);

    renderInBackground(taskId, qIds, seriesData, seriesQuestions, !!tipOnly);

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

  if (taskId) {
    const task = db.prepare("SELECT * FROM render_tasks WHERE id = ?").get(taskId);
    if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(task);
  }

  const tasks = db.prepare("SELECT * FROM render_tasks ORDER BY created_at DESC LIMIT 50").all();
  return NextResponse.json({ tasks });
}

function updateTask(taskId: string, fields: Record<string, unknown>) {
  const db = getDb();
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(fields);
  db.prepare(`UPDATE render_tasks SET ${sets} WHERE id = ?`).run(...values, taskId);
}

async function renderInBackground(
  taskId: string,
  questionIds: number[],
  seriesData: Record<string, unknown> | null,
  seriesQuestions: Record<string, unknown>[],
  tipOnly = false,
) {
  try {
    updateTask(taskId, { status: "tts", phase: "tts", phase_label: "生成过渡语音", progress: 0 });

    const bridgeDurations = await generateBridgeAudios(seriesData ? {
      bridge_think: seriesData.bridge_think as string | null,
      bridge_reveal: seriesData.bridge_reveal as string | null,
      bridge_explain: seriesData.bridge_explain as string | null,
      bridge_tip: seriesData.bridge_tip as string | null,
    } : undefined);

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
        answerReadOption, answerReadMulti,
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
      });
    }

    updateTask(taskId, { status: "rendering", phase: "bundling", phase_label: "打包项目...", progress: 0.3 });

    const outputDir = getOutputDir();
    const outputPath = path.join(outputDir, `${taskId}.mp4`);
    const propsFile = path.join(outputDir, `${taskId}.json`);

    const props: Record<string, unknown> = { entries };
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
      const child = spawn("npx", ["tsx", "scripts/render-video.ts", propsFile, outputPath], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stderrBuf = "";

      child.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try { const msg = JSON.parse(line); handleRenderMessage(taskId, msg); } catch {}
        }
      });

      child.stderr.on("data", (data: Buffer) => { stderrBuf += data.toString(); });

      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderrBuf || `render process exited with code ${code}`));
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
        completed_at: new Date().toISOString(),
      });
      break;
    case "error":
      updateTask(taskId, { status: "error", error: msg.message as string });
      break;
  }
}
