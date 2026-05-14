"use client";
import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";
import type { Question } from "./types";

interface Props {
  question: Question;
  teacherText: string;
  audioServerUrl: string;
  questionId: number;
  audioDuration: number;
}

function extractHighlightWords(text: string): string[] {
  const matches = text.match(/【(.*?)】/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

export const TeacherExplanation: React.FC<Props> = ({
  question, teacherText, audioServerUrl, questionId, audioDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const highlightWords = extractHighlightWords(teacherText);
  const cleanText = teacherText.replace(/【/g, "").replace(/】/g, "");

  const enterOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const panelEnter = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 100 } });

  const questionText = question.questionContent.replace(/A:.*$/, "").trim();
  const options = question.options;
  const labels = ["A", "B", "C", "D"];

  const renderHighlightedText = (text: string) => {
    let result = text;
    const parts: { text: string; highlighted: boolean }[] = [];
    let remaining = result;

    for (const word of highlightWords) {
      const idx = remaining.indexOf(word);
      if (idx >= 0) {
        if (idx > 0) parts.push({ text: remaining.slice(0, idx), highlighted: false });
        parts.push({ text: word, highlighted: true });
        remaining = remaining.slice(idx + word.length);
      }
    }
    if (remaining) parts.push({ text: remaining, highlighted: false });
    if (parts.length === 0) parts.push({ text, highlighted: false });

    return parts.map((p, i) => (
      <span key={i} style={p.highlighted ? {
        border: `3px solid ${COLORS.redBox}`,
        borderRadius: 8,
        padding: "2px 6px",
        backgroundColor: COLORS.redBoxBg,
      } : undefined}>
        {p.text}
      </span>
    ));
  };

  const highlightInterval = audioDuration > 0 && highlightWords.length > 0
    ? (audioDuration * fps) / highlightWords.length : 999;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgPrimary, opacity: enterOpacity }}>
      <Audio src={`${audioServerUrl}/audio/q${questionId}_teacher_explanation.wav`} />

      {/* Question display area */}
      <div style={{ padding: `${SPACING.xl}px`, paddingTop: SPACING.xxl }}>
        <div style={{
          display: "flex", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md,
        }}>
          <div style={{ width: 10, height: 42, borderRadius: 5, background: `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.correct})` }} />
          <span style={{ fontSize: FONT.size.label, color: COLORS.textSecondary, fontFamily: FONT.main, fontWeight: 500 }}>
            老师讲解
          </span>
        </div>

        <div style={{
          fontSize: FONT.size.question - 4,
          color: COLORS.text, fontFamily: FONT.main, lineHeight: 1.7, fontWeight: 500,
        }}>
          {renderHighlightedText(questionText)}
        </div>
      </div>

      {/* Options with highlight */}
      <div style={{ marginTop: SPACING.sm }}>
        {options.map((opt, i) => {
          const optText = opt.replace(/【/g, "").replace(/】/g, "");
          return (
            <div key={i} style={{
              margin: `0 ${SPACING.xl}px ${SPACING.sm}px`,
              padding: `${SPACING.md}px ${SPACING.lg}px`,
              borderRadius: RADIUS.lg,
              background: COLORS.surface,
              border: `1.5px solid ${COLORS.glassBorder}`,
              display: "flex", alignItems: "center", gap: SPACING.md,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: RADIUS.md,
                background: i === question.correctIndex ? COLORS.correctBg : COLORS.accentBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, fontWeight: 700,
                color: i === question.correctIndex ? COLORS.correct : COLORS.accent,
                fontFamily: FONT.main, flexShrink: 0,
              }}>
                {i === question.correctIndex ? "✓" : labels[i]}
              </div>
              <div style={{
                fontSize: FONT.size.option - 4, color: COLORS.text, fontFamily: FONT.main, lineHeight: 1.5,
              }}>
                {renderHighlightedText(optText)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Teacher explanation text panel */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: COLORS.glass, backdropFilter: "blur(20px)",
        borderTop: `1px solid ${COLORS.glassBorder}`,
        padding: `${SPACING.xl}px ${SPACING.xl}px ${SPACING.xxl}px`,
        transform: `translateY(${interpolate(panelEnter, [0, 1], [100, 0])}px)`,
        opacity: panelEnter,
      }}>
        <div style={{
          fontSize: FONT.size.explanation, color: COLORS.text, fontFamily: FONT.main,
          lineHeight: 1.8, fontWeight: 400,
        }}>
          {cleanText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
