import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface ClientLogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: unknown;
  stack?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logs } = body as { logs: ClientLogEntry[] };

    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json({ success: true, received: 0 });
    }

    const logDir = process.env.LOG_DIR;
    if (!logDir) {
      return NextResponse.json({ success: true, received: logs.length });
    }

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const logFile = path.join(logDir, `client-${dateStr}.log`);

    const lines = logs.map((log) => {
      let line = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}`;
      if (log.data) {
        try {
          line += ` | ${JSON.stringify(log.data)}`;
        } catch {
          line += ` | [无法序列化]`;
        }
      }
      if (log.stack) {
        line += `\n${log.stack}`;
      }
      return line;
    });

    fs.appendFileSync(logFile, lines.join("\n") + "\n");

    return NextResponse.json({ success: true, received: logs.length });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
