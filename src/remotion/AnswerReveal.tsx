import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";

interface Props {
  correctLabel: string;
  correctText: string;
  startFrame: number;
}

export const AnswerReveal: React.FC<Props> = ({ correctLabel, correctText, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const localFrame = frame - startFrame;

  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const shineScale = spring({
    frame: localFrame - 5,
    fps,
    config: { damping: 8, stiffness: 200 },
    from: 1.08,
    to: 1,
  });

  const glowOpacity = interpolate(localFrame, [5, 12, 25], [0, 0.6, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const scale = interpolate(enter, [0, 1], [0.8, 1]) * (localFrame > 5 ? shineScale : 1);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      padding: `${SPACING.md}px ${SPACING.xl}px`,
      opacity: enter,
      transform: `scale(${scale})`,
    }}>
      <div style={{
        background: COLORS.correctBg,
        border: `2px solid ${COLORS.correctBorder}`,
        borderRadius: RADIUS.xl,
        padding: `${SPACING.lg}px ${SPACING.xl}px`,
        display: "flex",
        alignItems: "center",
        gap: SPACING.md,
        backdropFilter: "blur(16px)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Shine sweep */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(105deg, transparent 40%, rgba(74, 222, 128, ${glowOpacity}) 50%, transparent 60%)`,
          transform: `translateX(${interpolate(localFrame, [5, 20], [-100, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%)`,
          pointerEvents: "none",
        }} />

        <div style={{
          minWidth: 72, height: 72, borderRadius: 18,
          padding: "0 12px",
          background: COLORS.correct,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: correctLabel.length > 2 ? 30 : 40, fontWeight: 700, color: "#fff",
        }}>
          {correctLabel}
        </div>
        <span style={{
          fontSize: FONT.size.option + 4,
          color: COLORS.correct,
          fontFamily: FONT.main,
          fontWeight: 700,
        }}>
          {correctText}
        </span>
      </div>
    </div>
  );
};
