import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT, SPACING } from "./theme";

interface Props {
  startFrame: number;
  durationFrames: number;
  bridgeText?: string;
}

export const CountdownDots: React.FC<Props> = ({ startFrame, durationFrames, bridgeText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame >= startFrame + durationFrames) return null;

  const elapsed = frame - startFrame;
  const totalSecs = Math.ceil(durationFrames / fps);
  const remaining = totalSecs - Math.floor(elapsed / fps);

  const enterOpacity = interpolate(elapsed, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  const pulse = spring({
    frame: elapsed % fps,
    fps,
    config: { damping: 10, stiffness: 200 },
    from: 0.85,
    to: 1,
  });

  const numberScale = spring({
    frame: elapsed % fps,
    fps,
    config: { damping: 12, stiffness: 180 },
    from: 1.15,
    to: 1,
  });

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.md,
      padding: `${SPACING.xl}px 0`,
      opacity: enterOpacity,
    }}>
      {bridgeText && (
        <div style={{
          fontSize: FONT.size.label + 4,
          color: COLORS.textSecondary,
          fontFamily: FONT.main,
          fontWeight: 500,
          letterSpacing: 2,
          marginBottom: SPACING.sm,
        }}>
          {bridgeText}
        </div>
      )}

      <div style={{
        fontSize: FONT.size.number + 20,
        fontWeight: 800,
        color: COLORS.accent,
        fontFamily: FONT.main,
        transform: `scale(${numberScale})`,
        lineHeight: 1,
      }}>
        {remaining}
      </div>

      <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center", marginTop: SPACING.xs }}>
        {Array.from({ length: totalSecs }).map((_, i) => (
          <div key={i} style={{
            width: i === totalSecs - remaining ? 20 : 14,
            height: i === totalSecs - remaining ? 20 : 14,
            borderRadius: "50%",
            background: i < totalSecs - remaining ? COLORS.textMuted : COLORS.accent,
            opacity: i === totalSecs - remaining ? pulse : 0.6,
            transform: `scale(${i === totalSecs - remaining ? pulse : 1})`,
            transition: "width 0.2s, height 0.2s",
          }} />
        ))}
      </div>
    </div>
  );
};
