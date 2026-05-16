import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { renderQueue } from "@/lib/render-queue";
import { v4 as uuid } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { seriesIds } = await request.json();
    if (!Array.isArray(seriesIds) || seriesIds.length === 0) {
      return NextResponse.json({ error: "seriesIds required" }, { status: 400 });
    }

    const db = getDb();
    const taskIds: string[] = [];

    for (const seriesId of seriesIds) {
      const seriesData = db.prepare("SELECT * FROM video_series WHERE id = ?").get(seriesId) as Record<string, unknown> | undefined;
      if (!seriesData) continue;

      const seriesQuestions = db.prepare(
        "SELECT * FROM series_questions WHERE series_id = ? ORDER BY sort_order"
      ).all(seriesId) as Record<string, unknown>[];
      const qIds = seriesQuestions.map((sq) => sq.question_id as number);
      if (qIds.length === 0) continue;

      const taskId = uuid();
      db.prepare("INSERT INTO render_tasks (id, question_ids, series_id, status, phase, phase_label) VALUES (?, ?, ?, 'pending', '', '')")
        .run(taskId, JSON.stringify(qIds), seriesId);

      // Dynamically import to avoid circular dependency issues at module load time
      const { renderInBackground } = await import("../route");
      renderQueue.enqueue(taskId, () => renderInBackground(taskId, qIds, seriesData!, seriesQuestions, false));
      taskIds.push(taskId);
    }

    return NextResponse.json({ taskIds, count: taskIds.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
