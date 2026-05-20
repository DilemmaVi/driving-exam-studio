"use client";
import { useEffect, useState } from "react";

interface UpdateStatus {
  state: string;
  currentVersion?: string;
  minVersion?: string;
  version?: string;
  percent?: number;
  transferred?: string;
  total?: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function ForceUpdateOverlay() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const check = () => {
      fetch("/api/update").then(r => r.json()).then(setStatus).catch(() => {});
    };
    check();
    timer = setInterval(check, 3000);
    return () => clearInterval(timer);
  }, []);

  if (!status || !status.minVersion || !status.currentVersion) return null;
  if (compareVersions(status.currentVersion, status.minVersion) >= 0) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "48px 56px",
        maxWidth: 480, width: "90%", textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>需要更新</h2>
        <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
          当前版本 <strong>v{status.currentVersion}</strong> 已不再支持，
          请更新到 <strong>v{status.minVersion}</strong> 或更高版本后使用。
        </p>

        {status.state === "downloading" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              background: "#e5e7eb", borderRadius: 8, height: 8, overflow: "hidden",
            }}>
              <div style={{
                background: "#3b82f6", height: "100%", width: `${status.percent || 0}%`,
                transition: "width 0.3s",
              }} />
            </div>
            <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
              下载中 {status.percent}% ({status.transferred}/{status.total} MB)
            </p>
          </div>
        )}

        {status.state === "ready" && (
          <button
            onClick={() => { fetch("/api/update?action=restart"); }}
            style={{
              background: "#3b82f6", color: "#fff", border: "none",
              borderRadius: 8, padding: "12px 32px", fontSize: 16,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            立即重启更新
          </button>
        )}

        {status.state === "checking" && (
          <p style={{ fontSize: 13, color: "#888" }}>正在检查更新...</p>
        )}

        {status.state === "error" && (
          <p style={{ fontSize: 13, color: "#ef4444" }}>
            更新出错，请手动下载最新版本安装
          </p>
        )}
      </div>
    </div>
  );
}
