import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "./theme";

interface Props {
  children: React.ReactNode;
  appearFrame?: number;
  flashEnabled?: boolean;
}

export const RedCircle: React.FC<Props> = ({ children, appearFrame, flashEnabled = true }) => {
  const frame = useCurrentFrame();

  let filterVal = "brightness(1)";
  if (flashEnabled && appearFrame !== undefined) {
    const localF = frame - appearFrame;
    if (localF >= 0 && localF < 36) {
      const t = (localF / 36) * Math.PI * 4;
      const brightness = 1 + Math.cos(t) * 0.3;
      filterVal = `brightness(${brightness})`;
    }
  }

  return (
    <span style={{ position: "relative", display: "inline", whiteSpace: "nowrap", filter: filterVal }}>
      <svg
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: "-8%",
          top: "-12%",
          width: "116%",
          height: "124%",
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <ellipse
          cx="100" cy="40" rx="92" ry="34"
          fill="none"
          stroke={COLORS.redBox}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray="4 2"
          transform="rotate(-2, 100, 40)"
          opacity={0.85}
        />
        <ellipse
          cx="102" cy="41" rx="90" ry="32"
          fill="none"
          stroke={COLORS.redBox}
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(1, 102, 41)"
          opacity={0.4}
        />
      </svg>
      <span style={{ position: "relative" }}>
        {children}
      </span>
    </span>
  );
};
