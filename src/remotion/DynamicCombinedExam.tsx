"use client";
import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import { QuestionTransition } from "./QuestionTransition";
import { TrueFalseQuestion } from "./TrueFalseQuestion";
import { MultipleChoice } from "./MultipleChoice";
import { ScrollableQuestion } from "./ScrollableQuestion";
import { IntroCard } from "./IntroCard";
import { OutroCard } from "./OutroCard";
import type { QuestionEntry } from "./types";

const FPS = 30;
const PAUSE = 0.3;
const DEFAULT_THINK = 0;
const TRANS_DURATION = 3;
const INTRO_DURATION = 4;
const OUTRO_DURATION = 4;

function questionDuration(entry: QuestionEntry, tipOnly = false): number {
  const d = entry.durations;
  if (tipOnly) {
    return d.question + PAUSE + d.answer + PAUSE + (d.bridgeTip || 0) + d.tip + 2.5;
  }
  const think = entry.thinkTime ?? DEFAULT_THINK;
  const hasTeacher = !!(entry.teacherExplanation && d.teacherExplanation);
  let dur = d.question + PAUSE;
  if (entry.readOptions !== false) {
    dur += (d.optionDurations || []).reduce((s, v) => s + v, 0);
  }
  dur += think;
  dur += (d.bridgeReveal || 0);
  dur += d.answer + PAUSE;
  if (entry.showOfficialExplanation !== false) {
    const expDur = hasTeacher ? d.teacherExplanation! : d.explanation;
    dur += (d.bridgeExplain || 0) + expDur + 2.5;
  }
  if (entry.showTip !== false) {
    dur += (d.bridgeTip || 0) + d.tip + 2.5;
  }
  return dur;
}

interface Props {
  entries: QuestionEntry[];
  audioServerUrl?: string;
  introTitle?: string;
  introSubtitle?: string;
  introCategory?: string;
  outroText?: string;
  outroSubtitle?: string;
  tipOnly?: boolean;
  showTransition?: boolean;
  pauseStart?: number;
  pauseEnd?: number;
  pauseBeforeTip?: number;
  keywordFlashEnabled?: boolean;
  underlineProgressEnabled?: boolean;
  underlineQuestion?: boolean;
  underlineOption?: boolean;
  underlineExplanation?: boolean;
  underlineTip?: boolean;
  underlineColor?: string;
  avatarEnabled?: boolean;
  avatarSize?: number;
  avatarPosition?: string;
}

export const DynamicCombinedExam: React.FC<Props> = ({
  entries, audioServerUrl = "", introTitle, introSubtitle, introCategory, outroText, outroSubtitle, tipOnly,
  showTransition, pauseStart, pauseEnd, pauseBeforeTip,
  keywordFlashEnabled, underlineProgressEnabled, underlineQuestion, underlineOption, underlineExplanation, underlineTip, underlineColor, avatarEnabled, avatarSize, avatarPosition,
}) => {
  let currentFrame = 0;
  const sequences: React.ReactElement[] = [];

  if (introTitle) {
    const introFrames = Math.ceil(INTRO_DURATION * FPS);
    sequences.push(
      <Sequence key="intro" from={currentFrame} durationInFrames={introFrames}>
        <IntroCard title={introTitle} subtitle={introSubtitle} category={introCategory} audioServerUrl={audioServerUrl} />
      </Sequence>
    );
    currentFrame += introFrames;
  }

  if (pauseStart && pauseStart > 0) {
    const pauseFrames = Math.round(pauseStart * FPS);
    sequences.push(
      <Sequence key="pause-start" from={currentFrame} durationInFrames={pauseFrames}>
        <AbsoluteFill style={{ backgroundColor: "transparent" }} />
      </Sequence>
    );
    currentFrame += pauseFrames;
  }

  entries.forEach((entry, idx) => {
    const effectiveEntry = tipOnly ? {
      ...entry,
      showOfficialExplanation: false,
      showTip: true,
      thinkTime: 0,
      readOptions: false,
    } : entry;
    const qDurSecs = questionDuration(effectiveEntry, tipOnly);
    const qFrames = Math.ceil(qDurSecs * FPS) + 10;

    if (showTransition && idx > 0) {
      const transFrames = Math.ceil(TRANS_DURATION * FPS);
      const typeLabel = entry.question.type === "true-false" ? "判断题" : (entry.question.correctIndices && entry.question.correctIndices.length > 1) ? "多选题" : "单选题";
      const audioFile = `q${entry.question.id}_transition.wav`;

      sequences.push(
        <Sequence key={`trans-${idx}`} from={currentFrame} durationInFrames={transFrames}>
          <QuestionTransition
            questionNumber={idx + 1}
            totalQuestions={entries.length}
            questionType={typeLabel}
            audioFile={audioFile}
            audioServerUrl={audioServerUrl}
          />
        </Sequence>
      );
      currentFrame += transFrames;
    }

    const QuestionComponent =
      entry.component === "tf" ? TrueFalseQuestion
        : entry.component === "scroll" ? ScrollableQuestion
          : MultipleChoice;

    sequences.push(
      <Sequence key={`q-${idx}`} from={currentFrame} durationInFrames={qFrames}>
        <QuestionComponent
          question={entry.question}
          audioDurations={entry.durations}
          audioServerUrl={audioServerUrl}
          thinkTime={effectiveEntry.thinkTime}
          teacherExplanation={effectiveEntry.teacherExplanation}
          showOfficialExplanation={effectiveEntry.showOfficialExplanation}
          showTip={effectiveEntry.showTip}
          readOptions={effectiveEntry.readOptions}
          optionGap={effectiveEntry.optionGap}
          fontSizeQuestion={effectiveEntry.fontSizeQuestion}
          fontSizeOption={effectiveEntry.fontSizeOption}
          fontSizeExplanation={effectiveEntry.fontSizeExplanation}
          underlineQuestion={effectiveEntry.underlineQuestion ?? underlineQuestion}
          underlineOption={effectiveEntry.underlineOption ?? underlineOption}
          underlineExplanation={effectiveEntry.underlineExplanation ?? underlineExplanation}
          underlineTip={effectiveEntry.underlineTip ?? underlineTip}
          underlineColor={effectiveEntry.underlineColor || underlineColor}
          pauseBeforeTip={pauseBeforeTip}
          keywordFlashEnabled={keywordFlashEnabled}
          underlineProgressEnabled={underlineProgressEnabled}
          avatarEnabled={avatarEnabled}
          avatarSize={avatarSize}
          avatarPosition={avatarPosition}
          stemKeywords={effectiveEntry.stemKeywords}
          stemKeywordPhases={effectiveEntry.stemKeywordPhases}
          readingPrefixDelay={effectiveEntry.readingPrefixDelay}
          readingSpeedRatio={effectiveEntry.readingSpeedRatio}
          subjectLabel={introCategory}
        />
      </Sequence>
    );
    currentFrame += qFrames;
  });

  if (outroText) {
    const outroFrames = Math.ceil(OUTRO_DURATION * FPS);
    sequences.push(
      <Sequence key="outro" from={currentFrame} durationInFrames={outroFrames}>
        <OutroCard title={outroText} subtitle={outroSubtitle} audioServerUrl={audioServerUrl} />
      </Sequence>
    );
    currentFrame += outroFrames;
  }

  if (pauseEnd && pauseEnd > 0) {
    const pauseFrames = Math.round(pauseEnd * FPS);
    sequences.push(
      <Sequence key="pause-end" from={currentFrame} durationInFrames={pauseFrames}>
        <AbsoluteFill style={{ backgroundColor: "transparent" }} />
      </Sequence>
    );
    currentFrame += pauseFrames;
  }

  return <AbsoluteFill>{sequences}</AbsoluteFill>;
};

export function calcCombinedDuration(
  entries: QuestionEntry[],
  hasIntro?: boolean,
  hasOutro?: boolean,
  tipOnly?: boolean,
  showTransition?: boolean,
  pauseStart?: number,
  pauseEnd?: number,
  pauseBeforeTip?: number,
): number {
  let total = hasIntro ? INTRO_DURATION : 0;
  total += (pauseStart || 0);
  entries.forEach((entry, idx) => {
    if (showTransition && idx > 0) total += TRANS_DURATION;
    let qDur = questionDuration(entry, tipOnly);
    if (entry.showTip !== false && pauseBeforeTip) qDur += pauseBeforeTip;
    total += qDur;
  });
  if (hasOutro) total += OUTRO_DURATION;
  total += (pauseEnd || 0);
  return Math.ceil(total * FPS) + entries.length * 10;
}
