"use client";
import { useEffect, useState } from "react";

interface UpdateStatus {
  state: "checking" | "downloading" | "ready" | "up-to-date" | "error" | "unknown";
  version?: string;
  percent?: number;
  transferred?: string;
  total?: string;
  message?: string;
}

export function UpdateIndicator() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const check = () => {
      fetch("/api/update").then(r => r.json()).then((data) => {
        setStatus(data);
        if (data.state === "up-to-date" || data.state === "unknown") {
          clearInterval(timer);
        }
      }).catch(() => {});
    };
    check();
    timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!status || status.state === "unknown" || status.state === "up-to-date") return null;

  if (status.state === "checking") {
    return <span className="text-xs text-gray-400">检查更新...</span>;
  }

  if (status.state === "downloading") {
    return (
      <span className="text-xs text-blue-500">
        更新下载中 {status.percent}% ({status.transferred}/{status.total} MB)
      </span>
    );
  }

  if (status.state === "ready") {
    return <span className="text-xs text-green-600 font-medium">v{status.version} 已就绪，重启生效</span>;
  }

  if (status.state === "error") {
    return <span className="text-xs text-red-500">更新失败</span>;
  }

  return null;
}
