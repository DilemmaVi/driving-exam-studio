import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, getRemotionEnvironment } from "remotion";
import { COLORS, SPACING, RADIUS } from "./theme";

interface Props {
  src: string;
  startFrame: number;
  circleFrame?: number;
}

export const QuestionImage: React.FC<Props> = ({ src, startFrame, circleFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = getRemotionEnvironment();

  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 25, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const scale = interpolate(enter, [0, 1], [0.85, 1]);
  const isRendering = env.isRendering;

  const circled = circleFrame != null && frame >= circleFrame;
  const circleProgress = circleFrame != null ? spring({ frame: frame - circleFrame, fps, config: { damping: 20, stiffness: 120 }, from: 0, to: 1 }) : 0;
  const borderWidth = circled ? interpolate(circleProgress, [0, 1], [0, 4]) : 0;
  const borderColor = `rgba(239,68,68,${circled ? interpolate(circleProgress, [0, 1], [0, 1]) : 0})`;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: `${SPACING.md}px ${SPACING.xl}px`,
        opacity: enter,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          borderRadius: RADIUS.xl,
          overflow: "hidden",
        border: circled ? `${borderWidth}px solid ${borderColor}` : `1.5px solid ${COLORS.glassBorder}`,
          boxShadow: COLORS.cardShadow,
          background: COLORS.glass,
          padding: SPACING.md,
        }}
      >
        {isRendering ? (
          <Img
            src={src}
            style={{
              maxWidth: 950,
              maxHeight: 600,
              objectFit: "contain",
              borderRadius: RADIUS.lg,
            }}
          />
        ) : (
          <img
            src={src}
            style={{
              maxWidth: 950,
              maxHeight: 600,
              objectFit: "contain",
              borderRadius: RADIUS.lg,
            }}
          />
        )}
      </div>
    </div>
  );
};
