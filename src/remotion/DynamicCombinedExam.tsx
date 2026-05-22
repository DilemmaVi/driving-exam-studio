"use client";
import React from "react";
import { Sequence, AbsoluteFill } from "remotion";
import { QuestionTransition } from "./QuestionTransition";
import { TrueFalseQuestion } from "./TrueFalseQuestion";
import { MultipleChoice } from "./MultipleChoice";
import { ScrollableQuestion } from "./ScrollableQuestion";
import { IntroCard } from "./IntroCard";
import { OutroCard } from "./OutroCard";
import { Watermark } from "./Watermark";
import type { QuestionEntry } from "./types";
import type { ThemeName } from "./theme";

const FPS = 30;
const PAUSE = 0.3;
const DEFAULT_THINK = 0;
const TRANS_DURATION = 3;
const INTRO_DURATION = 4;
const OUTRO_DURATION = 4;

function questionDuration(entry: QuestionEntry, tipOnly = false): number {
  const d = entry.durations;
  if (tipOnly) {
    const think = entry.thinkTime ?? DEFAULT_THINK;
    let dur = d.question + PAUSE;
    if (entry.readOptions !== false) {
      dur += (d.optionDurations || []).reduce((s, v) => s + v, 0);
    }
    dur += think;
    dur += (d.bridgeReveal || 0);
    dur += d.answer + PAUSE;
    dur += (d.bridgeTip || 0) + d.tip + 2.5;
    return dur;
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
  introDuration?: number;
  outroDuration?: number;
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
  watermarkText?: string;
  watermarkPosition?: "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";
  watermarkOpacity?: number;
  watermarkFontSize?: number;
  watermarkLogoUrl?: string;
  watermarkScale?: number;
  watermarkColor?: string;
  watermarkFont?: string;
  watermarkStroke?: boolean;
  theme?: ThemeName;
}

export const DynamicCombinedExam: React.FC<Props> = ({
  entries, audioServerUrl = "", introTitle, introSubtitle, introCategory, outroText, outroSubtitle, introDuration: introDurationProp, outroDuration: outroDurationProp, tipOnly,
  showTransition, pauseStart, pauseEnd, pauseBeforeTip,
  keywordFlashEnabled, underlineProgressEnabled, underlineQuestion, underlineOption, underlineExplanation, underlineTip, underlineColor, avatarEnabled, avatarSize, avatarPosition, watermarkText, watermarkPosition, watermarkOpacity, watermarkFontSize, watermarkLogoUrl, watermarkScale, watermarkColor, watermarkFont, watermarkStroke, theme,
}) => {
  let currentFrame = 0;
  const sequences: React.ReactElement[] = [];

  if (introTitle) {
    const introSecs = introDurationProp || INTRO_DURATION;
    const introFrames = Math.ceil(introSecs * FPS);
    sequences.push(
      <Sequence key="intro" from={currentFrame} durationInFrames={introFrames}>
        <IntroCard title={introTitle} subtitle={introSubtitle} category={introCategory} audioServerUrl={audioServerUrl} />
      </Sequence>
    );
    currentFrame += introFrames;
  }

  const pauseStartFrames = (pauseStart && pauseStart > 0) ? Math.round(pauseStart * FPS) : 0;
  const pauseEndFrames = (pauseEnd && pauseEnd > 0) ? Math.round(pauseEnd * FPS) : 0;

  entries.forEach((entry, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === entries.length - 1;
    const effectiveEntry = tipOnly ? {
      ...entry,
      showOfficialExplanation: false,
      showTip: true,
    } : entry;
    const qDurSecs = questionDuration(effectiveEntry, tipOnly);
    const optAnimSecs = entry.component === "tf" ? 1.5 : 2;
    const extraPause = isFirst ? (pauseStart || 0) : 0;
    const qFrames = Math.round(optAnimSecs * FPS) + Math.round(extraPause * FPS) + Math.ceil(qDurSecs * FPS) + 10;

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

    const extraEnd = isLast ? pauseEndFrames : 0;

    sequences.push(
      <Sequence key={`q-${idx}`} from={currentFrame} durationInFrames={qFrames + extraEnd}>
        <QuestionComponent
          question={entry.question}
          audioDurations={entry.durations}
          audioServerUrl={audioServerUrl}
          thinkTime={effectiveEntry.thinkTime}
          teacherExplanation={effectiveEntry.teacherExplanation}
          showOfficialExplanation={effectiveEntry.showOfficialExplanation}
          showTip={effectiveEntry.showTip}
          readOptions={effectiveEntry.readOptions}
          startDelay={isFirst ? pauseStartFrames : 0}
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
          panelAdjust={effectiveEntry.panelAdjust}
          panelAdjustValue={effectiveEntry.panelAdjustValue}
          subjectLabel={introCategory}
          watermarkText={watermarkText}
          watermarkPosition={watermarkPosition}
          watermarkOpacity={watermarkOpacity}
          watermarkFontSize={watermarkFontSize}
          watermarkLogoUrl={watermarkLogoUrl}
          watermarkScale={watermarkScale}
          watermarkColor={watermarkColor}
          watermarkFont={watermarkFont}
          watermarkStroke={watermarkStroke}
          theme={theme}
        />
      </Sequence>
    );
    currentFrame += qFrames + extraEnd;
  });

  if (outroText) {
    const outroSecs = outroDurationProp || OUTRO_DURATION;
    const outroFrames = Math.ceil(outroSecs * FPS);
    sequences.push(
      <Sequence key="outro" from={currentFrame} durationInFrames={outroFrames}>
        <OutroCard title={outroText} subtitle={outroSubtitle} audioServerUrl={audioServerUrl} />
      </Sequence>
    );
    currentFrame += outroFrames;
  }

  return (
    <AbsoluteFill>
      {sequences}
    </AbsoluteFill>
  );
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
  introDuration?: number,
  outroDuration?: number,
): number {
  let total = hasIntro ? (introDuration || INTRO_DURATION) : 0;
  entries.forEach((entry, idx) => {
    if (showTransition && idx > 0) total += TRANS_DURATION;
    const optAnimTime = entry.component === "tf" ? 1.5 : 2;
    const extraPause = idx === 0 ? (pauseStart || 0) : 0;
    let qDur = optAnimTime + extraPause + questionDuration(entry, tipOnly);
    total += qDur;
  });
  if (hasOutro) total += (outroDuration || OUTRO_DURATION);
  total += (pauseEnd || 0);
  return Math.ceil(total * FPS) + entries.length * 10;
}
