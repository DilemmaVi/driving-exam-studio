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

const clientLogs: ClientLogEntry[] = [];
const MAX_CLIENT_LOGS = 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logs } = body as { logs: ClientLogEntry[] };

    if (Array.isArray(logs)) {
      clientLogs.push(...logs);
      if (clientLogs.length > MAX_CLIENT_LOGS) {
        clientLogs.splice(0, clientLogs.length - MAX_CLIENT_LOGS);
      }
    }

    return NextResponse.json({ success: true, received: logs?.length || 0 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET() {
  const serverLogs = getServerLogs();
  const allLogs = [...serverLogs, ...clientLogs].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp)
  );

  const content = allLogs
    .map((log) => {
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
    })
    .join("\n");

  const header = `驾驶考题视频工作室 - 日志导出
导出时间: ${new Date().toISOString()}
日志条数: ${allLogs.length}
${"=".repeat(60)}

`;

  return new NextResponse(header + content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="driving-exam-studio-log-${Date.now()}.txt"`,
    },
  });
}

function getServerLogs(): ClientLogEntry[] {
  const logDir = process.env.LOG_DIR;
  if (!logDir || !fs.existsSync(logDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(logDir)
      .filter((f) => f.endsWith(".log"))
      .sort()
      .reverse()
      .slice(0, 3);

    const logs: ClientLogEntry[] = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(logDir, file), "utf-8");
      const lines = content.split("\n").filter(Boolean);
      for (const line of lines) {
        const match = line.match(/\[(.+?)\] \[(.+?)\] \[(.+?)\] (.+)/);
        if (match) {
          logs.push({
            timestamp: match[1],
            level: match[2].toLowerCase(),
            category: match[3],
            message: match[4],
          });
        }
      }
    }
    return logs;
  } catch {
    return [];
  }
}
