import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
} from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";

interface Props {
  title: string;
  titleColor: string;
  accentColor: string;
  content: string;
  startFrame: number;
  endFrame: number;
  borderColor?: string;
}

export const ModalOverlay: React.FC<Props> = ({
  title,
  titleColor,
  accentColor,
  content,
  startFrame,
  endFrame,
  borderColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame >= endFrame) return null;

  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const exit = spring({
    frame: frame - (endFrame - 12),
    fps,
    config: { damping: 20, stiffness: 120 },
    from: 0,
    to: 1,
  });

  const isExiting = frame >= endFrame - 12;
  const opacity = isExiting ? interpolate(exit, [0, 1], [1, 0]) : enter;
  const scale = isExiting
    ? interpolate(exit, [0, 1], [1, 0.95])
    : interpolate(enter, [0, 1], [0.9, 1]);
  const translateY = isExiting
    ? interpolate(exit, [0, 1], [0, 40])
    : interpolate(enter, [0, 1], [80, 0]);

  const bgOpacity = isExiting
    ? interpolate(exit, [0, 1], [0.75, 0])
    : interpolate(enter, [0, 1], [0, 0.75]);

  return (
    <AbsoluteFill style={{ zIndex: 100 }}>
      <AbsoluteFill
        style={{ backgroundColor: `rgba(0,0,0,${bgOpacity})` }}
      />
      <div
        style={{
          position: "absolute",
          top: 120,
          left: SPACING.lg,
          right: SPACING.lg,
          bottom: 120,
          opacity,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: COLORS.glass,
            borderRadius: RADIUS.xxl,
            padding: `${SPACING.xl}px ${SPACING.xl}px`,
            border: `2px solid ${borderColor || COLORS.glassBorder}`,
            backdropFilter: "blur(30px)",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 标题 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACING.sm,
              marginBottom: SPACING.lg,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 44,
                borderRadius: 5,
                background: accentColor,
              }}
            />
            <span
              style={{
                fontSize: FONT.size.title,
                color: titleColor,
                fontWeight: 700,
                fontFamily: FONT.main,
              }}
            >
              {title}
            </span>
          </div>

          {/* 内容 */}
          <div
            style={{
              fontSize: FONT.size.question,
              color: COLORS.text,
              lineHeight: 2,
              fontFamily: FONT.main,
              fontWeight: 400,
              flex: 1,
            }}
          >
            {content}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
