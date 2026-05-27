"use client";

import { useEffect } from "react";
import { logger } from "@/lib/client-logger";

let initialized = false;

function initLogger() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const [url, options] = args;
    const method = options?.method || "GET";
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    logger.info("API", `${method} ${urlStr}`);

    try {
      const response = await originalFetch.apply(this, args);

      if (!response.ok) {
        const clonedResponse = response.clone();
        let errorBody: string | undefined;
        try {
          errorBody = await clonedResponse.text();
        } catch {
          // ignore
        }
        logger.warn("API", `${method} ${urlStr} → ${response.status}`, { status: response.status, body: errorBody });
      } else {
        logger.info("API", `${method} ${urlStr} → ${response.status}`);
      }

      return response;
    } catch (error) {
      logger.error("API", `${method} ${urlStr} → 网络错误`, error);
      throw error;
    }
  };
}

export function LoggerInitializer() {
  useEffect(() => {
    const originalFetch = window.fetch;
    initLogger();

    const syncLogs = () => {
      const logs = logger.getRecentLogs(100);
      if (logs.length > 0) {
        originalFetch("/api/logs/client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs }),
        }).catch(() => {
          // ignore sync errors
        });
      }
    };

    const interval = setInterval(syncLogs, 30000);

    window.addEventListener("beforeunload", syncLogs);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", syncLogs);
    };
  }, []);

  return null;
}
