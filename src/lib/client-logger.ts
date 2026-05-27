type LogLevel = "info" | "warn" | "error" | "action";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  stack?: string;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").replace("Z", "");
}

function addLog(level: LogLevel, category: string, message: string, data?: unknown, stack?: string) {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    category,
    message,
    data,
    stack,
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Also log to console in development
  if (process.env.NODE_ENV === "development") {
    const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[consoleMethod](`[${category}] ${message}`, data || "");
  }
}

export const logger = {
  info(category: string, message: string, data?: unknown) {
    addLog("info", category, message, data);
  },

  warn(category: string, message: string, data?: unknown) {
    addLog("warn", category, message, data);
  },

  error(category: string, message: string, error?: unknown) {
    const stack = error instanceof Error ? error.stack : undefined;
    addLog("error", category, message, error, stack);
  },

  action(category: string, message: string, data?: unknown) {
    addLog("action", category, message, data);
  },

  getLogs(): LogEntry[] {
    return [...logs];
  },

  getRecentLogs(count: number = 50): LogEntry[] {
    return logs.slice(-count);
  },

  getErrorLogs(): LogEntry[] {
    return logs.filter((log) => log.level === "error");
  },

  clearLogs() {
    logs.length = 0;
  },

  exportLogs(): string {
    return logs
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
  },
};
