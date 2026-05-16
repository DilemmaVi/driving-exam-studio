import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill, Audio, Sequence } from "remotion";
import { Background } from "./Background";
import { ProgressBar } from "./ProgressBar";
import { QuestionHeader } from "./QuestionHeader";
import { OptionItem } from "./OptionItem";
import { AnswerReveal } from "./AnswerReveal";
import { BottomPanel } from "./BottomPanel";
import { TeacherAvatar } from "./TeacherAvatar";
import type { Question, AudioDurations } from "./types";
import { COLORS, FONT } from "./theme";

const FPS = 30;
const SCREEN_W = 1080;
const SCREEN_H = 1920;
const PADDING_TOP = 30;
const PADDING_SIDE = 48;
const CONTENT_W = SCREEN_W - PADDING_SIDE * 2;

function estimateLines(text: string, fontSize: number, maxWidth: number): number {
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.55));
  const clean = text.replace(/【/g, "").replace(/】/g, "").replace(/A[.:：][\s\S]*$/, "");
  return Math.max(1, Math.ceil(clean.length / charsPerLine));
}

function calcFontScale(questionText: string, options: string[]): number {
  const baseFontQ = FONT.size.question; // 62
  const baseFontOpt = FONT.size.option; // 52
  const lineHeightQ = 1.7;
  const lineHeightOpt = 1.5;
  const badgeHeight = 80;
  const optPadding = 32 * 2; // top+bottom padding per option
  const optGap = 12; // margin between options
  const answerRevealHeight = 130;
  const bottomMargin = 100;

  for (let scale = 1.0; scale >= 0.55; scale -= 0.05) {
    const fq = Math.round(baseFontQ * scale);
    const fo = Math.round(baseFontOpt * scale);
    const qLines = estimateLines(questionText, fq, CONTENT_W);
    const qHeight = badgeHeight + qLines * (fq * lineHeightQ) + 30;

    let optHeight = 0;
    for (const opt of options) {
      const clean = opt.replace(/【/g, "").replace(/】/g, "");
      const lines = Math.max(1, Math.ceil(clean.length / Math.floor((CONTENT_W - 100) / fo)));
      optHeight += lines * (fo * lineHeightOpt) + optPadding + optGap;
    }

    const totalHeight = PADDING_TOP + qHeight + 20 + optHeight + answerRevealHeight + bottomMargin;
    if (totalHeight <= SCREEN_H) return scale;
  }
  return 0.55;
}

export const ScrollableQuestion: React.FC<{
  question: Question;
  audioDurations: AudioDurations;
  audioServerUrl?: string;
  thinkTime?: number;
  teacherExplanation?: string;
  showOfficialExplanation?: boolean;
  showTip?: boolean;
  readOptions?: boolean;
  keywordFlashEnabled?: boolean;
  underlineProgressEnabled?: boolean;
  avatarEnabled?: boolean;
  avatarSize?: number;
  avatarPosition?: string;
  pauseBeforeTip?: number;
  optionGap?: number;
  fontSizeQuestion?: number;
  fontSizeOption?: number;
  fontSizeExplanation?: number;
  underlineQuestion?: boolean;
  underlineOption?: boolean;
  underlineExplanation?: boolean;
  underlineTip?: boolean;
  underlineColor?: string;
  stemKeywords?: string[];
  stemKeywordPhases?: string[];
  readingPrefixDelay?: number;
  readingSpeedRatio?: number;
  panelAdjust?: string;
  panelAdjustValue?: number;
  subjectLabel?: string;
}> = ({ question, audioDurations, audioServerUrl = "", thinkTime, teacherExplanation, showOfficialExplanation, showTip, readOptions = true, keywordFlashEnabled, underlineProgressEnabled, avatarEnabled, avatarSize, avatarPosition, pauseBeforeTip, optionGap, fontSizeQuestion, fontSizeOption, fontSizeExplanation, underlineQuestion, underlineOption, underlineExplanation, underlineTip, underlineColor, stemKeywords, stemKeywordPhases, readingPrefixDelay, readingSpeedRatio, panelAdjust, panelAdjustValue, subjectLabel }) => {
  const labels = ["A", "B", "C", "D"];
  const correctIndices = question.correctIndices || [question.correctIndex];
  const correctLabel = correctIndices.map(i => labels[i]).join("");
  const correctText = correctIndices.map(i => question.options[i]?.replace(/【/g, "").replace(/】/g, "").replace(/[{}｛｝]/g, "")).filter(Boolean).join("、");

  const kwRegex = /【([^】]+)】/g;
  const keywords: string[] = [];
  const blueKeywords: string[] = [];
  let m;
  while ((m = kwRegex.exec(question.questionContent)) !== null) keywords.push(m[1]);
  for (const opt of question.options) {
    const r = /【([^】]+)】/g;
    while ((m = r.exec(opt)) !== null) keywords.push(m[1]);
  }
  const bkRegex = /[{｛]([^}｝]+)[}｝]/g;
  while ((m = bkRegex.exec(question.questionContent)) !== null) blueKeywords.push(m[1]);
  for (const opt of question.options) {
    const r = /[{｛]([^}｝]+)[}｝]/g;
    while ((m = r.exec(opt)) !== null) blueKeywords.push(m[1]);
  }

  const hasTeacher = !!(teacherExplanation && audioDurations.teacherExplanation);
  const explanationText = hasTeacher ? teacherExplanation : question.explanation;
  const explanationAudio = hasTeacher ? `q${question.id}_teacher_explanation.wav` : `q${question.id}_explanation.wav`;
  const explanationDuration = hasTeacher ? audioDurations.teacherExplanation! : audioDurations.explanation;

  const optDurs = audioDurations.optionDurations || [];
  const qFrames = Math.ceil(audioDurations.question * FPS);
  const optFramesArr = optDurs.map(d => Math.ceil(d * FPS));
  const totalOptFrames = optFramesArr.reduce((s, v) => s + v, 0);
  const aFrames = Math.ceil(audioDurations.answer * FPS);
  const expFrames = Math.ceil(explanationDuration * FPS);
  const tFrames = Math.ceil(audioDurations.tip * FPS);
  const brFrames = audioDurations.bridgeReveal ? Math.ceil(audioDurations.bridgeReveal * FPS) : 0;
  const beFrames = audioDurations.bridgeExplain ? Math.ceil(audioDurations.bridgeExplain * FPS) : 0;
  const bpFrames = audioDurations.bridgeTip ? Math.ceil(audioDurations.bridgeTip * FPS) : 0;

  const T = {
    questionStart: 0,
    optionsStart: Math.round(2 * FPS),
    highlightPhaseFrame: 0,
    bridgeRevealStart: 0, revealStart: 0,
    bridgeExplainStart: 0, explanationStart: 0, explanationEnd: 0,
    bridgeTipStart: 0, tipStart: 0, tipEnd: 0,
  };

  const effectiveOptFrames = readOptions ? totalOptFrames : 0;

  let cursor = qFrames + effectiveOptFrames + Math.round(0.3 * FPS);
  cursor += Math.round((thinkTime || 0) * FPS);
  T.highlightPhaseFrame = cursor;
  T.bridgeRevealStart = cursor;
  cursor += brFrames;
  T.revealStart = cursor;
  cursor += aFrames + Math.round(0.3 * FPS);

  if (showOfficialExplanation !== false && expFrames > 0) {
    T.bridgeExplainStart = cursor; cursor += beFrames;
    T.explanationStart = cursor;
    T.explanationEnd = cursor + expFrames + Math.round(2.5 * FPS);
    cursor = T.explanationEnd;
  }
  if (showTip !== false && tFrames > 0) {
    cursor += Math.round((pauseBeforeTip || 0) * FPS);
    T.bridgeTipStart = cursor; cursor += bpFrames;
    T.tipStart = cursor;
    T.tipEnd = cursor + tFrames + Math.round(2.5 * FPS);
  }

  const optReadStarts: number[] = [];
  let optCursor = qFrames;
  for (let i = 0; i < question.options.length; i++) {
    optReadStarts.push(optCursor);
    optCursor += optFramesArr[i] || 0;
  }

  const fontScale = calcFontScale(question.questionContent, question.options);

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const panelVisibleFrame = T.explanationStart > 0 ? T.explanationStart : T.tipStart > 0 ? T.tipStart : 0;

  const panelTop = 1920 * 0.52;
  const fq = fontSizeQuestion || Math.round(62 * fontScale);
  const fo = fontSizeOption || Math.round(52 * fontScale);
  const gap = optionGap ?? 12;
  const charsPerLineQ = Math.max(8, Math.floor(CONTENT_W / (fq * 0.55)));
  const qText = question.questionContent.replace(/【[^】]*】/g, (m) => m.slice(1, -1)).replace(/[{｛][^}｝]*[}｝]/g, (m) => m.slice(1, -1)).replace(/A[.:：][\s\S]*$/, "");
  const qLines = Math.max(1, Math.ceil(qText.length / charsPerLineQ));
  const qHeight = 80 + qLines * fq * 1.7 + 30;
  const charsPerLineO = Math.max(6, Math.floor((CONTENT_W - 100) / (fo * 0.55)));
  const optHeight = question.options.reduce((sum, opt) => {
    const text = opt.replace(/【[^】]*】/g, (m) => m.slice(1, -1));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLineO));
    return sum + lines * fo * 1.5 + 64 + gap;
  }, 0);
  const contentBottom = PADDING_TOP + qHeight + 10 + optHeight + 250;
  const overflow = Math.max(0, contentBottom - panelTop + 40);

  const panelProgress = panelVisibleFrame > 0 && frame >= panelVisibleFrame
    ? spring({ frame: frame - panelVisibleFrame, fps, config: { damping: 28, stiffness: 90 } })
    : 0;

  const mode = panelAdjust || "auto-shift";
  let contentShift = 0;
  let contentScale = 1;
  if (mode === "auto-shift" && overflow > 0) {
    contentShift = interpolate(panelProgress, [0, 1], [0, -overflow]);
  } else if (mode === "auto-scale" && overflow > 0) {
    const contentHeight = contentBottom - PADDING_TOP;
    const targetScale = Math.max(0.5, (panelTop - 80) / contentHeight);
    contentScale = interpolate(panelProgress, [0, 1], [1, targetScale]);
  } else if (mode === "manual" && panelAdjustValue) {
    contentShift = interpolate(panelProgress, [0, 1], [0, -panelAdjustValue]);
  } else if (mode === "manual-scale" && panelAdjustValue) {
    const targetScale = Math.max(0.3, panelAdjustValue / 100);
    contentScale = interpolate(panelProgress, [0, 1], [1, targetScale]);
  }

  return (
    <AbsoluteFill>
      <Background />
      <ProgressBar />

      <div style={{
        position: "absolute",
        top: PADDING_TOP,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        transform: `translateY(${contentShift}px) scale(${contentScale})`,
        transformOrigin: "top center",
        width: contentScale < 1 ? `${100 / contentScale}%` : undefined,
        marginLeft: contentScale < 1 ? `${-(100 / contentScale - 100) / 2}%` : undefined,
      }}>
        <QuestionHeader
          text={question.questionContent}
          startFrame={T.questionStart}
          highlightPhaseFrame={T.highlightPhaseFrame}
          circleFrame={T.explanationStart > 0 ? T.explanationStart : undefined}
          tipFrame={T.tipStart > 0 ? T.tipStart : undefined}
          readingDurationFrames={qFrames}
          questionType={correctIndices.length > 1 ? "多选题" : "单选题"}
          subjectLabel={subjectLabel}
          fontScale={fontScale}
          fontSizeOverride={fontSizeQuestion}
          underlineEnabled={underlineQuestion}
          underlineColor={underlineColor}
          stemKeywords={stemKeywords}
          stemKeywordPhases={stemKeywordPhases}
          explanationStartFrame={T.explanationStart > 0 ? T.explanationStart : undefined}
          tipStartFrame={T.tipStart > 0 ? T.tipStart : undefined}
          readingPrefixDelay={readingPrefixDelay}
          readingSpeedRatio={readingSpeedRatio}
        />

        <div style={{ marginTop: 10 }}>
          {question.options.map((opt, i) => (
            <OptionItem
              key={i} label={labels[i]} text={opt} index={i}
              startFrame={T.optionsStart} revealFrame={T.revealStart}
              isCorrect={correctIndices.includes(i)}
              circleFrame={T.explanationStart > 0 ? T.explanationStart : undefined}
              tipFrame={T.tipStart > 0 ? T.tipStart : undefined}
              readStartFrame={readOptions ? optReadStarts[i] : undefined}
              optionGap={optionGap}
              fontScale={fontScale}
              fontSizeOverride={fontSizeOption}
              underlineEnabled={underlineOption}
              underlineColor={underlineColor}
            />
          ))}
          <AnswerReveal correctLabel={correctLabel} correctText={correctText} startFrame={T.revealStart} />
        </div>
      </div>

      {avatarEnabled !== false && (
        <TeacherAvatar startFrame={T.questionStart} speaking hideFrame={T.explanationStart > 0 ? T.explanationStart : undefined} size={avatarSize} position={avatarPosition as any} />
      )}

      {showOfficialExplanation !== false && T.explanationEnd > T.explanationStart && (
        <BottomPanel title="答题解析" titleColor={COLORS.correct} accentColor={COLORS.correct} borderColor={COLORS.correctBorder} content={explanationText} startFrame={T.explanationStart} endFrame={T.explanationEnd} readingDurationFrames={expFrames} underlineEnabled={underlineExplanation ?? underlineProgressEnabled} underlineColor={underlineColor} keywordFlashEnabled={keywordFlashEnabled} phase="explanation" originalQuestion={question.questionContent} originalOptions={question.options} originalKeywords={keywords} correctOptionIndices={correctIndices} fontSizeOverride={fontSizeExplanation} />
      )}
      {showTip !== false && T.tipEnd > T.tipStart && (
        <BottomPanel title="答题技巧" titleColor={COLORS.highlight} accentColor={COLORS.highlight} borderColor="rgba(252, 211, 77, 0.4)" content={question.tip} startFrame={T.tipStart} endFrame={T.tipEnd} readingDurationFrames={tFrames} keywords={keywords} blueKeywords={blueKeywords} underlineEnabled={underlineTip ?? underlineProgressEnabled} underlineColor={underlineColor} keywordFlashEnabled={keywordFlashEnabled} />
      )}

      <Sequence from={0}><Audio src={`${audioServerUrl}/audio/q${question.id}_question.wav`} /></Sequence>
      {readOptions && question.options.map((_, i) => (
        <Sequence key={`opt-audio-${i}`} from={optReadStarts[i]}>
          <Audio src={`${audioServerUrl}/audio/q${question.id}_opt_${i}.wav`} />
        </Sequence>
      ))}
      {brFrames > 0 && <Sequence from={T.bridgeRevealStart}><Audio src={`${audioServerUrl}/audio/q0_bridge_reveal.wav`} /></Sequence>}
      <Sequence from={T.revealStart}><Audio src={`${audioServerUrl}/audio/q${question.id}_answer.wav`} /></Sequence>
      {showOfficialExplanation !== false && T.explanationStart > 0 && (
        <>
          {beFrames > 0 && <Sequence from={T.bridgeExplainStart}><Audio src={`${audioServerUrl}/audio/q0_bridge_explain.wav`} /></Sequence>}
          <Sequence from={T.explanationStart}><Audio src={`${audioServerUrl}/audio/${explanationAudio}`} /></Sequence>
        </>
      )}
      {showTip !== false && T.tipStart > 0 && (
        <>
          {bpFrames > 0 && <Sequence from={T.bridgeTipStart}><Audio src={`${audioServerUrl}/audio/q0_bridge_tip.wav`} /></Sequence>}
          <Sequence from={T.tipStart}><Audio src={`${audioServerUrl}/audio/q${question.id}_tip.wav`} /></Sequence>
        </>
      )}
    </AbsoluteFill>
  );
};
