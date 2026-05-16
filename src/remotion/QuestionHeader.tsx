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
  subjectLabel?: string;
  fontScale?: number;
  fontSizeOverride?: number;
  underlineEnabled?: boolean;
  underlineColor?: string;
  stemKeywords?: string[];
  stemKeywordPhases?: string[];
  explanationStartFrame?: number;
  tipStartFrame?: number;
  readingPrefixDelay?: number;
  readingSpeedRatio?: number;
}

const parseSegments = (text: string): { text: string; highlight: boolean; blue?: boolean }[] => {
  const parts: { text: string; highlight: boolean; blue?: boolean }[] = [];
  const regex = /【([^】]*)】|[{｛]([^}｝]*)[}｝]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    if (match[1] !== undefined) {
      parts.push({ text: match[1], highlight: true });
    } else {
      parts.push({ text: match[2], highlight: true, blue: true });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }
  return parts;
};

export const QuestionHeader: React.FC<Props> = ({
  text, startFrame, highlightPhaseFrame, circleFrame, tipFrame,
  readingDurationFrames, questionType, subjectLabel, fontScale = 1, fontSizeOverride, underlineEnabled, underlineColor,
  stemKeywords, stemKeywordPhases, explanationStartFrame, tipStartFrame, readingPrefixDelay, readingSpeedRatio,
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

  // Stem keyword wavy underline logic
  const cleanDisplayText = displayText.replace(/【([^】]*)】|[{｛]([^}｝]*)[}｝]/g, "$1$2");
  const phases = stemKeywordPhases || [];
  let currentPhase: string | null = null;
  if (tipStartFrame !== undefined && frame >= tipStartFrame) {
    currentPhase = "tip";
  } else if (explanationStartFrame !== undefined && frame >= explanationStartFrame) {
    currentPhase = "explanation";
  } else {
    currentPhase = "question";
  }
  const stemKwActive = stemKeywords && stemKeywords.length > 0 && currentPhase && phases.includes(currentPhase);
  const stemKwSet = stemKwActive ? stemKeywords : [];
  // Build a mask: for each char index in cleanDisplayText, is it part of a stem keyword?
  const stemKwMask: boolean[] = new Array(cleanDisplayText.length).fill(false);
  if (stemKwSet && stemKwSet.length > 0) {
    for (const kw of stemKwSet) {
      if (!kw) continue;
      let idx = 0;
      while ((idx = cleanDisplayText.indexOf(kw, idx)) !== -1) {
        for (let i = idx; i < idx + kw.length; i++) stemKwMask[i] = true;
        idx += kw.length;
      }
    }
  }

  const showCircles = circleFrame !== undefined && frame >= circleFrame;

  let highlightGroupIndex = 0;
  const allChars = parts.flatMap((p) =>
    p.text.split("").map((ch) => ({
      ch,
      highlight: p.highlight,
      blue: p.blue,
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
  const speedRatio = readingSpeedRatio ?? 1;
  const sweepDurationFrames = (readingDurationFrames || (totalChars / 5) * 30) / speedRatio;
  const prefixDelay = readingPrefixDelay ?? 8;
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

  const fontSize = fontSizeOverride || Math.round(FONT.size.question * fontScale);

  const renderedParts = parts.map((p, pi) => {
    const globalStartIdx = parts.slice(0, pi).reduce((s, pp) => s + pp.text.length, 0);

    if (!p.highlight) {
      return p.text.split("").map((ch, ci) => {
        const globalIdx = globalStartIdx + ci;
        const visible = globalIdx < visibleChars;
        const read = readChars >= 0 && globalIdx < readChars;
        const hasStemWavy = stemKwMask[globalIdx];
        return (
          <span key={`${pi}-${ci}`} style={{
            opacity: visible ? 1 : 0,
            display: "inline",
            color: read ? COLORS.accent : COLORS.text,
            borderBottom: hasStemWavy
              ? undefined
              : underlineEnabled && read ? `3px solid ${underlineColor || COLORS.accent}` : undefined,
            textDecoration: hasStemWavy ? "underline wavy" : undefined,
            textDecorationColor: hasStemWavy ? "#EF4444" : undefined,
            textUnderlineOffset: hasStemWavy ? "6px" : undefined,
            textDecorationThickness: hasStemWavy ? "4px" : undefined,
            transition: "color 0.15s",
          } as React.CSSProperties}>
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
      const hasStemWavy = stemKwMask[globalIdx];

      return (
        <span key={ci} style={{
          color: isHighlighted ? (charData?.blue ? "#3B82F6" : COLORS.highlight) : read ? COLORS.accent : COLORS.text,
          fontWeight: isHighlighted ? 700 : 500,
          opacity: visible ? (flashEffect ? 0.3 : 1) : 0,
          display: "inline",
          transform: isHighlighted ? `scale(${highlightScale})` : undefined,
          borderBottom: hasStemWavy
            ? undefined
            : underlineEnabled && read ? `3px solid ${underlineColor || COLORS.accent}` : undefined,
          textDecoration: hasStemWavy ? "underline wavy" : undefined,
          textDecorationColor: hasStemWavy ? "#EF4444" : undefined,
          textUnderlineOffset: hasStemWavy ? "6px" : undefined,
          textDecorationThickness: hasStemWavy ? "4px" : undefined,
        } as React.CSSProperties}>
          {ch}
        </span>
      );
    });

    if (showCircles) {
      const circleFlash = tipFlashOn;
      const circleChars = p.text.split("").map((ch, ci) => {
        const globalIdx = globalStartIdx + ci;
        const visible = globalIdx < visibleChars;
        return (
          <span key={ci} style={{
            color: p.blue ? "#3B82F6" : COLORS.highlight,
            fontWeight: 700,
            fontSize: "1.1em",
            opacity: visible ? 1 : 0,
            display: "inline",
          }}>
            {ch}
          </span>
        );
      });
      return (
        <span key={`circle-${pi}`} style={{
          opacity: circleFlash ? 0.3 : 1,
          transition: "opacity 0.1s",
        }}>
          <RedCircle color={p.blue ? "#3B82F6" : undefined}>{circleChars}</RedCircle>
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
          {subjectLabel || "科目一"} · {questionType || "判断题"}
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
