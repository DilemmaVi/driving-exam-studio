import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const logDir = process.env.LOG_DIR;
  if (!logDir || !fs.existsSync(logDir)) {
    return NextResponse.json({ error: "LOG_DIR not set" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file") || "";
  const tail = parseInt(searchParams.get("tail") || "100", 10);

  if (file) {
    const filePath = path.join(logDir, file);
    if (!path.resolve(filePath).startsWith(path.resolve(logDir))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const tailLines = lines.slice(-tail).join("\n");
    return new NextResponse(tailLines, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const files = fs.readdirSync(logDir)
    .filter(f => f.endsWith(".log"))
    .map(f => {
      const stat = fs.statSync(path.join(logDir, f));
      return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));

  return NextResponse.json({ logDir, files });
}
