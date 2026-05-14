import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT, SPACING } from "./theme";
import { RedCircle } from "./RedCircle";

interface Props {
  text: string;
  startFrame: number;
  highlightPhaseFrame?: number;
  circleFrame?: number;
  tipFrame?: number;
  readingDurationFrames?: number;
  questionType?: string;
  fontScale?: number;
}

const parseSegments = (text: string): { text: string; highlight: boolean }[] => {
  const parts: { text: string; highlight: boolean }[] = [];
  const regex = /【([^】]*)】/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    parts.push({ text: match[1], highlight: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }
  return parts;
};

export const QuestionHeader: React.FC<Props> = ({
  text, startFrame, highlightPhaseFrame, circleFrame, tipFrame,
  readingDurationFrames, questionType, fontScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 30, stiffness: 120 },
    from: 0,
    to: 1,
  });

  const translateY = interpolate(enter, [0, 1], [40, 0]);

  const displayText = text.replace(/A:.*$/, "").trim();
  const parts = parseSegments(displayText);

  const showCircles = circleFrame !== undefined && frame >= circleFrame;

  let highlightGroupIndex = 0;
  const allChars = parts.flatMap((p) =>
    p.text.split("").map((ch) => ({
      ch,
      highlight: p.highlight,
      highlightGroup: p.highlight ? highlightGroupIndex++ : -1,
    }))
  );

  const highlightGroups: number[] = [];
  let currentGroup = -1;
  for (const c of allChars) {
    if (c.highlight && c.highlightGroup !== currentGroup) {
      highlightGroups.push(c.highlightGroup);
      currentGroup = c.highlightGroup;
    }
  }

  const totalChars = allChars.length;
  const visibleChars = Math.floor((frame - startFrame) * 2);

  // Reading progress based on actual TTS audio duration
  const sweepDurationFrames = readingDurationFrames || (totalChars / 5) * 30;
  const prefixDelay = 25;
  const readingProgress = sweepDurationFrames > 0
    ? Math.min(1, Math.max(0, (frame - startFrame - prefixDelay) / sweepDurationFrames))
    : -1;
  const readChars = readingProgress >= 0 ? Math.floor(readingProgress * totalChars) : -1;

  const HIGHLIGHT_INTERVAL = 9;

  // Tip phase flash: keywords flash twice
  const tipFlashing = tipFrame !== undefined && frame >= tipFrame;
  const tipLocalFrame = tipFrame !== undefined ? frame - tipFrame : 0;
  const flashCycle = tipLocalFrame > 0 ? Math.floor(tipLocalFrame / 8) : -1;
  const tipFlashOn = tipFlashing && flashCycle >= 0 && flashCycle < 4 && flashCycle % 2 === 0;

  const fontSize = Math.round(FONT.size.question * fontScale);

  const renderedParts = parts.map((p, pi) => {
    const globalStartIdx = parts.slice(0, pi).reduce((s, pp) => s + pp.text.length, 0);

    if (!p.highlight) {
      return p.text.split("").map((ch, ci) => {
        const globalIdx = globalStartIdx + ci;
        const visible = globalIdx < visibleChars;
        const read = readChars >= 0 && globalIdx < readChars;
        return (
          <span key={`${pi}-${ci}`} style={{
            opacity: visible ? 1 : 0,
            display: "inline",
            color: read ? COLORS.accent : COLORS.text,
            transition: "color 0.15s",
          }}>
            {ch}
          </span>
        );
      });
    }

    const chars = p.text.split("").map((ch, ci) => {
      const globalIdx = globalStartIdx + ci;
      const visible = globalIdx < visibleChars;
      const read = readChars >= 0 && globalIdx < readChars;

      let isHighlighted = false;
      let highlightScale = 1;
      const charData = allChars[globalIdx];

      if (charData && charData.highlight && highlightPhaseFrame !== undefined && frame >= highlightPhaseFrame) {
        const groupIdx = highlightGroups.indexOf(charData.highlightGroup);
        const groupActivateFrame = highlightPhaseFrame + groupIdx * HIGHLIGHT_INTERVAL;
        if (frame >= groupActivateFrame) {
          isHighlighted = true;
          const localF = frame - groupActivateFrame;
          if (localF < 8) {
            highlightScale = interpolate(localF, [0, 4, 8], [1, 1.08, 1], {
              extrapolateRight: "clamp",
            });
          }
        }
      }

      const flashEffect = tipFlashOn && charData?.highlight;

      return (
        <span key={ci} style={{
          color: isHighlighted ? COLORS.highlight : read ? COLORS.accent : COLORS.text,
          fontWeight: isHighlighted ? 700 : 500,
          opacity: visible ? (flashEffect ? 0.3 : 1) : 0,
          display: "inline",
          transform: isHighlighted ? `scale(${highlightScale})` : undefined,
        }}>
          {ch}
        </span>
      );
    });

    if (showCircles) {
      const circleFlash = tipFlashOn;
      return (
        <span key={`circle-${pi}`} style={{
          opacity: circleFlash ? 0.3 : 1,
          transition: "opacity 0.1s",
        }}>
          <RedCircle>{chars}</RedCircle>
        </span>
      );
    }
    return chars;
  });

  return (
    <div style={{
      padding: `${SPACING.xl}px ${SPACING.xl}px ${SPACING.lg}px`,
      opacity: enter,
      transform: `translateY(${translateY}px)`,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: SPACING.sm,
        marginBottom: SPACING.md,
      }}>
        <div style={{
          width: 10, height: 42, borderRadius: 5,
          background: `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.correct})`,
        }} />
        <span style={{
          fontSize: FONT.size.label,
          color: COLORS.textSecondary,
          fontFamily: FONT.main,
          fontWeight: 500,
          letterSpacing: 1,
        }}>
          科目一 · {questionType || "判断题"}
        </span>
      </div>
      <div style={{
        fontSize,
        color: COLORS.text,
        fontFamily: FONT.main,
        lineHeight: 1.7,
        fontWeight: 500,
      }}>
        {renderedParts}
      </div>
    </div>
  );
};
