import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { Background } from "./Background";
import { ProgressBar } from "./ProgressBar";
import { QuestionHeader } from "./QuestionHeader";
import { OptionItem } from "./OptionItem";
import { AnswerReveal } from "./AnswerReveal";
import { BottomPanel } from "./BottomPanel";
import { TeacherAvatar } from "./TeacherAvatar";
import type { Question, AudioDurations } from "./types";
import { COLORS } from "./theme";

const FPS = 30;

export const TrueFalseQuestion: React.FC<{
  question: Question;
  audioDurations: AudioDurations;
  audioServerUrl?: string;
  thinkTime?: number;
  teacherExplanation?: string;
  showOfficialExplanation?: boolean;
  showTip?: boolean;
}> = ({ question, audioDurations, audioServerUrl = "", thinkTime, teacherExplanation, showOfficialExplanation, showTip }) => {
  const labels = ["A", "B"];
  const correctLabel = labels[question.correctIndex];
  const correctText = question.options[question.correctIndex];

  const kwRegex = /【([^】]+)】/g;
  const keywords: string[] = [];
  let m;
  while ((m = kwRegex.exec(question.questionContent)) !== null) keywords.push(m[1]);
  for (const opt of question.options) {
    const r = /【([^】]+)】/g;
    while ((m = r.exec(opt)) !== null) keywords.push(m[1]);
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
    optionsStart: Math.round(1.5 * FPS),
    highlightPhaseFrame: 0,
    bridgeRevealStart: 0, revealStart: 0,
    bridgeExplainStart: 0, explanationStart: 0, explanationEnd: 0,
    bridgeTipStart: 0, tipStart: 0, tipEnd: 0,
  };

  let cursor = qFrames + totalOptFrames + Math.round(0.3 * FPS);
  T.highlightPhaseFrame = cursor;
  T.bridgeRevealStart = cursor;
  cursor += brFrames;
  T.revealStart = cursor;
  cursor += aFrames + Math.round(0.3 * FPS);

  if (showOfficialExplanation !== false && expFrames > 0) {
    T.bridgeExplainStart = cursor; cursor += beFrames;
    T.explanationStart = cursor;
    T.explanationEnd = cursor + expFrames + Math.round(1 * FPS);
    cursor = T.explanationEnd;
  }
  if (showTip !== false && tFrames > 0) {
    T.bridgeTipStart = cursor; cursor += bpFrames;
    T.tipStart = cursor;
    T.tipEnd = cursor + tFrames + Math.round(1.5 * FPS);
  }

  // Each option's read start = after stem audio + cumulative previous option durations
  const optReadStarts: number[] = [];
  let optCursor = qFrames;
  for (let i = 0; i < question.options.length; i++) {
    optReadStarts.push(optCursor);
    optCursor += optFramesArr[i] || 0;
  }

  return (
    <AbsoluteFill>
      <Background />
      <ProgressBar />

      <div style={{ position: "absolute", top: 80, left: 0, right: 0 }}>
        <QuestionHeader
          text={question.questionContent}
          startFrame={T.questionStart}
          highlightPhaseFrame={T.highlightPhaseFrame}
          circleFrame={T.explanationStart > 0 ? T.explanationStart : undefined}
          tipFrame={T.tipStart > 0 ? T.tipStart : undefined}
          readingDurationFrames={qFrames}
          questionType="判断题"
        />
      </div>

      <div style={{ position: "absolute", top: 540, left: 0, right: 0 }}>
        {question.options.map((opt, i) => (
          <OptionItem
            key={i} label={labels[i]} text={opt} index={i}
            startFrame={T.optionsStart} revealFrame={T.revealStart}
            isCorrect={i === question.correctIndex}
            circleFrame={T.explanationStart > 0 ? T.explanationStart : undefined}
            tipFrame={T.tipStart > 0 ? T.tipStart : undefined}
            readStartFrame={optReadStarts[i]}
          />
        ))}
        <AnswerReveal correctLabel={correctLabel} correctText={correctText} startFrame={T.revealStart} />
      </div>

      <TeacherAvatar startFrame={T.questionStart} speaking hideFrame={T.explanationStart > 0 ? T.explanationStart : undefined} />

      {showOfficialExplanation !== false && T.explanationEnd > T.explanationStart && (
        <BottomPanel title="答题解析" titleColor={COLORS.correct} accentColor={COLORS.correct} borderColor={COLORS.correctBorder} content={explanationText} startFrame={T.explanationStart} endFrame={T.explanationEnd} readingDurationFrames={expFrames} />
      )}
      {showTip !== false && T.tipEnd > T.tipStart && (
        <BottomPanel title="答题技巧" titleColor={COLORS.highlight} accentColor={COLORS.highlight} borderColor="rgba(252, 211, 77, 0.4)" content={question.tip} startFrame={T.tipStart} endFrame={T.tipEnd} readingDurationFrames={tFrames} keywords={keywords} />
      )}

      {/* Stem audio */}
      <Sequence from={0}><Audio src={`${audioServerUrl}/audio/q${question.id}_question.wav`} /></Sequence>
      {/* Per-option audio */}
      {question.options.map((_, i) => (
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
