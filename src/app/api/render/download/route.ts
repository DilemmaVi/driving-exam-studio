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

  const stat = fs.statSync(task.output_path);
  const stream = fs.createReadStream(task.output_path);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  const isZip = task.output_path.endsWith(".zip");
  const contentType = isZip ? "application/zip" : "video/mp4";
  const ext = isZip ? "zip" : "mp4";
  const fileName = `exam-${taskId.slice(0, 8)}.${ext}`;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(stat.size),
    },
  });
}
