import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exec } from "child_process";
import fs from "fs";

export async function POST(request: NextRequest) {
  const { taskId } = await request.json();
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const db = getDb();
  const task = db.prepare("SELECT output_path FROM render_tasks WHERE id = ?").get(taskId) as { output_path: string | null } | undefined;

  if (!task?.output_path) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const targetPath = task.output_path;

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ error: "path not found" }, { status: 404 });
  }

  const isDir = fs.statSync(targetPath).isDirectory();
  const folderPath = isDir ? targetPath : require("path").dirname(targetPath);

  if (process.platform === "win32") {
    exec(`explorer "${folderPath.replace(/\//g, "\\")}"`);
  } else if (process.platform === "darwin") {
    exec(`open "${folderPath}"`);
  } else {
    exec(`xdg-open "${folderPath}"`);
  }

  return NextResponse.json({ ok: true });
}
