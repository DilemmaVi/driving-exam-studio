import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, getRemotionEnvironment } from "remotion";
import { COLORS, SPACING, RADIUS } from "./theme";

interface Props {
  src: string;
  startFrame: number;
}

export const QuestionImage: React.FC<Props> = ({ src, startFrame }) => {
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
          border: `1.5px solid ${COLORS.glassBorder}`,
          boxShadow: COLORS.cardShadow,
          background: COLORS.glass,
          padding: SPACING.md,
        }}
      >
        {isRendering ? (
          <Img
            src={src}
            style={{
              maxWidth: 850,
              maxHeight: 500,
              objectFit: "contain",
              borderRadius: RADIUS.lg,
            }}
          />
        ) : (
          <img
            src={src}
            style={{
              maxWidth: 850,
              maxHeight: 500,
              objectFit: "contain",
              borderRadius: RADIUS.lg,
            }}
          />
        )}
      </div>
    </div>
  );
};
