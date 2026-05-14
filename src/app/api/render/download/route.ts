import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fs from "fs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const db = getDb();
  const task = db.prepare("SELECT * FROM render_tasks WHERE id = ?").get(taskId) as { status: string; output_path: string | null } | undefined;

  if (!task || task.status !== "done" || !task.output_path) {
    return NextResponse.json({ error: "not ready" }, { status: 404 });
  }

  if (!fs.existsSync(task.output_path)) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(task.output_path);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="exam-${taskId.slice(0, 8)}.mp4"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
