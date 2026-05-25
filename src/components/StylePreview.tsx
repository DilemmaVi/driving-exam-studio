"use client";
import React from "react";

interface StyleConfig {
  theme: string;
  fontScale: number;
  avatarPosition: string;
  avatarSize: number;
  keywordStyle: string;
  panelHeight: number;
}

const THEMES: Record<string, { bg: string; text: string; glass: string; border: string; muted: string }> = {
  light: { bg: "linear-gradient(180deg, #FFF 0%, #F5F7FA 50%, #EEF1F5 100%)", text: "#1A1A2E", glass: "rgba(255,255,255,0.92)", border: "rgba(203,213,225,0.3)", muted: "#94A3B8" },
  dark: { bg: "linear-gradient(180deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)", text: "#F1F5F9", glass: "rgba(15,23,42,0.92)", border: "rgba(51,65,85,0.5)", muted: "#64748B" },
  gradient: { bg: "linear-gradient(135deg, #1a0533 0%, #0f1b4d 50%, #1a0533 100%)", text: "#FFFFFF", glass: "rgba(15,10,40,0.88)", border: "rgba(124,58,237,0.3)", muted: "#7C3AED" },
};

const PREVIEW_W = 270;
const PREVIEW_H = 480;
const SCALE = PREVIEW_W / 1080;

export function StylePreview({ theme, fontScale, avatarPosition, avatarSize, keywordStyle, panelHeight }: StyleConfig) {
  const t = THEMES[theme] || THEMES.dark;
  const effectiveFontScale = fontScale > 0 ? fontScale : 1.0;
  const effectivePanelHeight = panelHeight > 0 ? panelHeight : 42;
  const fs = (base: number) => Math.round(base * effectiveFontScale * SCALE);

  const renderKeyword = (text: string) => {
    if (keywordStyle === "underline") {
      return <span style={{ borderBottom: "2px solid #EF4444", color: "#EF4444", fontWeight: 700 }}>{text}</span>;
    }
    if (keywordStyle === "highlight-bg") {
      return <span style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", fontWeight: 700, borderRadius: 3, padding: "0 2px" }}>{text}</span>;
    }
    // circle
    return (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ position: "relative", zIndex: 1, color: "#EF4444", fontWeight: 700 }}>{text}</span>
        <span style={{
          position: "absolute", inset: "-3px -5px", borderRadius: "50%",
          border: "2px solid #EF4444", zIndex: 0,
        }} />
      </span>
    );
  };

  const showAvatar = avatarPosition !== "none";
  const avatarPx = Math.round(avatarSize * SCALE * 0.4);
  const panelH = `${effectivePanelHeight}%`;

  return (
    <div style={{
      width: PREVIEW_W, height: PREVIEW_H, borderRadius: 16, overflow: "hidden",
      background: t.bg, position: "relative", fontFamily: "'Noto Sans SC', sans-serif",
      border: "1px solid rgba(128,128,128,0.2)", flexShrink: 0,
    }}>
      {/* Question header mock */}
      <div style={{ padding: `${Math.round(40 * SCALE)}px ${Math.round(48 * SCALE)}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          <div style={{ width: 3, height: Math.round(42 * SCALE), borderRadius: 2, background: "linear-gradient(180deg, #3B82F6, #22C55E)" }} />
          <span style={{ fontSize: fs(32), color: t.muted, fontWeight: 500 }}>科目一 · 判断题</span>
        </div>
        <div style={{ fontSize: fs(58), color: t.text, lineHeight: 1.6, fontWeight: 500 }}>
          驾驶机动车在道路上发生交通事故，当事人不能自行移动车辆的，应当保护现场并立即报警，同时在来车方向设置{renderKeyword("警告标志")}。
        </div>
      </div>

      {/* Options mock */}
      <div style={{ padding: `0 ${Math.round(48 * SCALE)}px` }}>
        {["正确", "错误"].map((opt, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: Math.round(16 * SCALE),
            padding: `${Math.round(20 * SCALE)}px ${Math.round(24 * SCALE)}px`,
            marginBottom: Math.round(8 * SCALE), borderRadius: Math.round(16 * SCALE),
            background: i === 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${i === 0 ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          }}>
            <div style={{
              width: Math.round(48 * effectiveFontScale * SCALE), height: Math.round(48 * effectiveFontScale * SCALE),
              borderRadius: Math.round(12 * SCALE), display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: fs(30), fontWeight: 700,
              background: i === 0 ? "#22C55E" : "rgba(239,68,68,0.08)",
              color: i === 0 ? "#fff" : "#EF4444",
            }}>
              {i === 0 ? "✓" : "✗"}
            </div>
            <span style={{ fontSize: fs(48), color: i === 0 ? "#22C55E" : t.muted, fontWeight: i === 0 ? 700 : 500 }}>{opt}</span>
          </div>
        ))}
      </div>

      {/* Avatar */}
      {showAvatar && (
        <div style={{
          position: "absolute",
          ...(avatarPosition === "bottom-right" ? { right: 8 } : { left: 8 }),
          bottom: 8,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3, zIndex: 50,
        }}>
          <div style={{
            width: avatarPx + 4, height: avatarPx + 4, borderRadius: "50%",
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", padding: 2,
          }}>
            <div style={{
              width: avatarPx, height: avatarPx, borderRadius: "50%",
              background: "#e2e8f0", border: "1.5px solid rgba(255,255,255,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: Math.max(8, avatarPx * 0.35), color: "#94A3B8",
            }}>👤</div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", borderRadius: 10,
            padding: "1px 6px",
          }}>
            <span style={{ color: "#fff", fontSize: Math.max(6, Math.round(8 * SCALE * effectiveFontScale)), fontWeight: 600 }}>全安老师</span>
          </div>
        </div>
      )}

      {/* Bottom panel mock */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: panelH,
        background: t.glass, borderRadius: `${Math.round(32 * SCALE)}px ${Math.round(32 * SCALE)}px 0 0`,
        borderTop: `1px solid ${t.border}`, borderLeft: `1px solid ${t.border}`, borderRight: `1px solid ${t.border}`, borderBottom: "none",        backdropFilter: "blur(20px)", padding: Math.round(24 * SCALE),
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ width: 20, height: 2, borderRadius: 1, background: t.muted, margin: "0 auto", marginBottom: 6, opacity: 0.5 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          <div style={{ width: 3, height: Math.round(20 * SCALE), borderRadius: 2, background: "#22C55E" }} />
          <span style={{ fontSize: fs(42), color: "#22C55E", fontWeight: 700 }}>答题解析</span>
        </div>
        <div style={{ fontSize: fs(40), color: t.text, lineHeight: 1.8 }}>
          交通事故发生后，应当保护现场并立即报警。设置{renderKeyword("警告标志")}是为了提醒后方来车注意安全。
        </div>
      </div>
    </div>
  );
}
