import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "./theme";

interface Props {
  children: React.ReactNode;
  appearFrame?: number;
}

export const RedCircle: React.FC<Props> = ({ children, appearFrame }) => {
  const frame = useCurrentFrame();

  let flashOpacity = 1;
  if (appearFrame !== undefined) {
    const localF = frame - appearFrame;
    if (localF >= 0 && localF < 20) {
      // Flash: bright → normal → bright → normal
      const cycle = Math.floor(localF / 5);
      flashOpacity = cycle % 2 === 0 ? 1.2 : 0.6;
    }
  }

  return (
    <span style={{ position: "relative", display: "inline", whiteSpace: "nowrap" }}>
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
          opacity: flashOpacity,
        }}
      >
        <ellipse
          cx="100" cy="40" rx="92" ry="34"
          fill="none"
          stroke={COLORS.redBox}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="4 2"
          transform="rotate(-2, 100, 40)"
          opacity={0.85}
        />
        <ellipse
          cx="102" cy="41" rx="90" ry="32"
          fill="none"
          stroke={COLORS.redBox}
          strokeWidth="1.5"
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
