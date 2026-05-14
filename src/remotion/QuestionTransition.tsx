import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Audio,
} from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";

interface Props {
  questionNumber: number;
  totalQuestions: number;
  questionType: string;
  audioFile: string;
  audioServerUrl?: string;
}

export const QuestionTransition: React.FC<Props> = ({
  questionNumber,
  totalQuestions,
  questionType,
  audioFile,
  audioServerUrl = "",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numberEnter = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const typeEnter = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const dividerEnter = spring({
    frame: frame - 6,
    fps,
    config: { damping: 20, stiffness: 120 },
    from: 0,
    to: 1,
  });

  const numberScale = interpolate(numberEnter, [0, 1], [0.3, 1]);
  const typeTranslateY = interpolate(typeEnter, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${COLORS.bgSecondary} 0%, ${COLORS.bgPrimary} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING.lg,
      }}
    >
      {/* 题号 */}
      <div
        style={{
          opacity: numberEnter,
          transform: `scale(${numberScale})`,
          display: "flex",
          alignItems: "baseline",
          gap: SPACING.sm,
        }}
      >
        <span
          style={{
            fontSize: 140,
            fontWeight: 800,
            color: COLORS.accent,
            fontFamily: FONT.main,
            lineHeight: 1,
          }}
        >
          {questionNumber}
        </span>
        <span
          style={{
            fontSize: FONT.size.title,
            color: COLORS.textMuted,
            fontFamily: FONT.main,
            fontWeight: 400,
          }}
        >
          / {totalQuestions}
        </span>
      </div>

      {/* 分隔线 */}
      <div
        style={{
          width: interpolate(dividerEnter, [0, 1], [0, 200]),
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`,
          borderRadius: 2,
        }}
      />

      {/* 题目类型 */}
      <div
        style={{
          opacity: typeEnter,
          transform: `translateY(${typeTranslateY}px)`,
          display: "flex",
          alignItems: "center",
          gap: SPACING.md,
        }}
      >
        <div
          style={{
            background: COLORS.accentBg,
            border: `2px solid ${COLORS.accentBorder}`,
            borderRadius: RADIUS.xl,
            padding: `${SPACING.sm}px ${SPACING.xl}px`,
          }}
        >
          <span
            style={{
              fontSize: FONT.size.title,
              color: COLORS.accent,
              fontFamily: FONT.main,
              fontWeight: 600,
            }}
          >
            {questionType}
          </span>
        </div>
      </div>

      <Audio src={`${audioServerUrl}/audio/${audioFile}`} />
    </AbsoluteFill>
  );
};
