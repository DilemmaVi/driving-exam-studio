import React from "react";
import { Composition } from "remotion";
import { DynamicCombinedExam, calcCombinedDuration } from "./DynamicCombinedExam";
import type { QuestionEntry } from "./types";

const FPS = 30;

const defaultEntries: QuestionEntry[] = [];

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DynamicExam"
      // @ts-ignore
      component={DynamicCombinedExam}
      defaultProps={{ entries: defaultEntries, introTitle: "", introSubtitle: "", introCategory: "" } as Record<string, unknown>}
      durationInFrames={Math.max(1, calcCombinedDuration(defaultEntries))}
      fps={FPS}
      width={1080}
      height={1920}
      calculateMetadata={({ props }: { props: Record<string, unknown> }) => {
        const dur = calcCombinedDuration(
          props.entries as QuestionEntry[],
          !!props.introTitle,
          !!props.outroText,
          !!props.tipOnly,
          !!props.showTransition,
          props.pauseStart as number | undefined,
          props.pauseEnd as number | undefined,
          props.pauseBeforeTip as number | undefined,
        );
        return { durationInFrames: Math.max(1, dur) };
      }}
    />
  );
};
