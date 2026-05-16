import React from "react";

interface Props {
  text: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  opacity?: number;
  fontSize?: number;
}

const POS_STYLE: Record<string, React.CSSProperties> = {
  "top-left": { top: 40, left: 40 },
  "top-right": { top: 40, right: 40 },
  "bottom-left": { bottom: 140, left: 40 },
  "bottom-right": { bottom: 140, right: 40 },
  "center": { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

export const Watermark: React.FC<Props> = ({ text, position = "bottom-right", opacity = 30, fontSize = 36 }) => {
  if (!text) return null;
  return (
    <div style={{
      position: "absolute",
      ...POS_STYLE[position],
      color: "#fff",
      opacity: opacity / 100,
      fontSize,
      fontWeight: 600,
      textShadow: "0 1px 4px rgba(0,0,0,0.5)",
      pointerEvents: "none",
      zIndex: 10,
      letterSpacing: 1,
    }}>
      {text}
    </div>
  );
};
