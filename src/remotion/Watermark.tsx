import React from "react";
import { Img } from "remotion";

export type WatermarkPosition =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type WatermarkFont = "default" | "serif" | "rounded" | "kai" | "bold";

const FONT_MAP: Record<WatermarkFont, string> = {
  default: '"PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Noto Serif SC", "STSong", "SimSun", serif',
  rounded: '"Yuanti SC", "HYYuanLiTiJ", "Microsoft YaHei", sans-serif',
  kai: '"STKaiti", "KaiTi", "Kaiti SC", serif',
  bold: '"PingFang SC", "Microsoft YaHei", sans-serif',
};

interface Props {
  text?: string;
  logoUrl?: string;
  position?: WatermarkPosition;
  opacity?: number;
  fontSize?: number;
  scale?: number;
  color?: string;
  font?: WatermarkFont;
  stroke?: boolean;
}

const POS_STYLE: Record<WatermarkPosition, React.CSSProperties> = {
  "top-left": { top: 40, left: 40 },
  "top-center": { top: 40, left: "50%", transform: "translateX(-50%)" },
  "top-right": { top: 40, right: 40 },
  "center-left": { top: "50%", left: 40, transform: "translateY(-50%)" },
  "center": { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  "center-right": { top: "50%", right: 40, transform: "translateY(-50%)" },
  "bottom-left": { bottom: 140, left: 40 },
  "bottom-center": { bottom: 140, left: "50%", transform: "translateX(-50%)" },
  "bottom-right": { bottom: 140, right: 40 },
};

export const Watermark: React.FC<Props> = ({ text, logoUrl, position = "bottom-right", opacity = 30, fontSize = 36, scale = 100, color = "#ffffff", font = "default", stroke = true }) => {
  if (!text && !logoUrl) return null;
  const scaleFactor = scale / 100;
  const fontFamily = FONT_MAP[font] || FONT_MAP.default;
  const isBold = font === "bold";

  return (
    <div style={{
      position: "absolute",
      ...POS_STYLE[position],
      opacity: opacity / 100,
      pointerEvents: "none",
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: 12 * scaleFactor,
    }}>
      {logoUrl && (
        <Img src={logoUrl} style={{
          width: 80 * scaleFactor,
          height: 80 * scaleFactor,
          objectFit: "contain",
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))",
        }} />
      )}
      {text && (
        <span style={{
          color,
          fontSize: fontSize * scaleFactor,
          fontWeight: isBold ? 800 : 600,
          fontFamily,
          textShadow: stroke
            ? `0 0 6px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5), 1px 1px 0 rgba(0,0,0,0.3), -1px -1px 0 rgba(0,0,0,0.3)`
            : "0 1px 4px rgba(0,0,0,0.5)",
          letterSpacing: 2,
          whiteSpace: "nowrap",
        }}>
          {text}
        </span>
      )}
    </div>
  );
};
