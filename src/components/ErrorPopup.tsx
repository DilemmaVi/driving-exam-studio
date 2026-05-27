"use client";

import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/client-logger";

interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

export function ErrorPopup() {
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const handleError = useCallback((event: ErrorEvent) => {
    setError({
      message: event.message,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
    });
    logger.error("Runtime", event.message, event.error);
  }, []);

  const handleUnhandledRejection = useCallback((event: PromiseRejectionEvent) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
    setError({
      message,
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    logger.error("Promise", message, event.reason);
  }, []);

  useEffect(() => {
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [handleError, handleUnhandledRejection]);

  const copyError = async () => {
    if (!error) return;

    const recentLogs = logger.getRecentLogs(30);
    const logsText = recentLogs
      .map((log) => `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}`)
      .join("\n");

    const text = `错误信息: ${error.message}
发生时间: ${error.timestamp}
${error.stack ? `\n堆栈:\n${error.stack}` : ""}

最近操作:
${logsText}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!error) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">发生错误</h3>
            <p className="text-xs text-gray-500">{error.timestamp}</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800 font-mono break-all">{error.message}</p>
        </div>

        {error.stack && (
          <details className="mb-4">
            <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
              查看堆栈信息
            </summary>
            <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}

        <p className="text-xs text-gray-500 mb-4">
          点击「复制错误信息」可复制错误详情和最近操作记录，发给开发者排查问题。
        </p>

        <div className="flex gap-3">
          <button
            onClick={copyError}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            {copied ? "已复制 ✓" : "复制错误信息"}
          </button>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export function showManualError(message: string, details?: unknown) {
  const event = new ErrorEvent("error", {
    message,
    error: details instanceof Error ? details : new Error(String(details)),
  });
  window.dispatchEvent(event);
}
