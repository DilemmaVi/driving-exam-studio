import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";
import { RedCircle } from "./RedCircle";

interface Props {
  label: string;
  text: string;
  index: number;
  startFrame: number;
  revealFrame: number;
  isCorrect: boolean;
  circleFrame?: number;
  tipFrame?: number;
  readStartFrame?: number;
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

export const OptionItem: React.FC<Props> = ({
  label, text, index, startFrame, revealFrame, isCorrect,
  circleFrame, tipFrame, readStartFrame, fontScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterDelay = startFrame + index * 6;
  const enter = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 18, stiffness: 150 },
    from: 0,
    to: 1,
  });

  const translateX = interpolate(enter, [0, 1], [300, 0]);
  const opacity = interpolate(enter, [0, 0.2, 1], [0, 1, 1]);

  const revealed = frame >= revealFrame;
  const revealProgress = revealed
    ? spring({
        frame: frame - revealFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
        from: 0,
        to: 1,
      })
    : 0;

  let bgColor = COLORS.surface;
  let borderColor = COLORS.glassBorder;
  let labelBg = COLORS.accentBg;
  let labelColor = COLORS.accent;
  let labelText = label;
  let textColor = COLORS.text;

  if (revealed && revealProgress > 0.3) {
    if (isCorrect) {
      bgColor = COLORS.correctBg;
      borderColor = COLORS.correctBorder;
      labelBg = COLORS.correct;
      labelColor = "#fff";
      labelText = "✓";
      textColor = COLORS.correct;
    } else {
      bgColor = COLORS.wrongBg;
      borderColor = COLORS.wrongBorder;
      labelBg = COLORS.wrongBg;
      labelColor = COLORS.wrong;
      labelText = "✗";
      textColor = COLORS.textMuted;
    }
  }

  const showCircle = circleFrame !== undefined && frame >= circleFrame;

  // Tip phase flash
  const tipFlashing = tipFrame !== undefined && frame >= tipFrame;
  const tipLocalFrame = tipFrame !== undefined ? frame - tipFrame : 0;
  const flashCycle = tipLocalFrame > 0 ? Math.floor(tipLocalFrame / 8) : -1;
  const tipFlashOn = tipFlashing && flashCycle >= 0 && flashCycle < 4 && flashCycle % 2 === 0;

  const scale = revealed && isCorrect
    ? 1 + revealProgress * 0.04
    : 1;

  const parts = parseSegments(text);
  const plainText = parts.map(p => p.text).join("");
  const totalChars = plainText.length;

  // Reading color sweep: starts at readStartFrame, ~5 chars/sec
  const readActive = readStartFrame !== undefined && frame >= readStartFrame && !revealed;
  const readLocalFrame = readStartFrame !== undefined ? frame - readStartFrame : 0;
  const sweepFrames = (totalChars / 5) * 30;
  const readProgress = readActive && sweepFrames > 0
    ? Math.min(1, readLocalFrame / sweepFrames)
    : readActive ? 1 : -1;
  const readChars = readProgress > 0 ? Math.floor(readProgress * totalChars) : -1;

  let globalCharIdx = 0;

  const renderedContent = parts.map((p, pi) => {
    const chars = p.text.split("").map((ch, ci) => {
      const idx = globalCharIdx++;
      const isRead = readChars >= 0 && idx < readChars;
      const charColor = revealed ? textColor : isRead ? COLORS.accent : COLORS.text;
      return (
        <span key={`${pi}-${ci}`} style={{
          color: charColor,
          opacity: tipFlashOn && p.highlight ? 0.3 : 1,
          transition: "color 0.1s",
        }}>{ch}</span>
      );
    });

    if (showCircle && p.highlight) {
      return (
        <span key={pi} style={{
          opacity: tipFlashOn ? 0.3 : 1,
          transition: "opacity 0.1s",
        }}>
          <RedCircle appearFrame={circleFrame}>{chars}</RedCircle>
        </span>
      );
    }
    return <span key={pi}>{chars}</span>;
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px) scale(${scale})`,
        margin: `0 ${SPACING.xl}px ${Math.round(SPACING.sm * fontScale)}px`,
        padding: `${Math.round(SPACING.lg * fontScale)}px ${SPACING.lg}px`,
        borderRadius: RADIUS.lg,
        background: bgColor,
        border: `${revealed && isCorrect ? 3 : 1.5}px solid ${borderColor}`,
        display: "flex",
        alignItems: "center",
        gap: SPACING.md,
        backdropFilter: "blur(16px)",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          width: Math.round(64 * fontScale),
          height: Math.round(64 * fontScale),
          borderRadius: RADIUS.md,
          background: labelBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(36 * fontScale),
          fontWeight: 700,
          color: labelColor,
          fontFamily: FONT.main,
          flexShrink: 0,
          border: `1.5px solid ${borderColor}`,
        }}
      >
        {labelText}
      </div>
      <div
        style={{
          fontSize: Math.round(FONT.size.option * fontScale),
          color: textColor,
          fontFamily: FONT.main,
          fontWeight: revealed && isCorrect ? 700 : 500,
          lineHeight: 1.5,
        }}
      >
        {renderedContent}
      </div>
    </div>
  );
};
