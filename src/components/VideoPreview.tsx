"use client";
import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { TrueFalseQuestion } from "@/remotion/TrueFalseQuestion";
import { MultipleChoice } from "@/remotion/MultipleChoice";
import { ScrollableQuestion } from "@/remotion/ScrollableQuestion";
import type { Question, AudioDurations } from "@/remotion/types";

interface Props {
  open: boolean;
  onClose: () => void;
  question: Question | null;
  audioDurations: AudioDurations | null;
  component: "tf" | "mc" | "scroll";
  audioServerUrl?: string;
  teacherExplanation?: string;
  showOfficialExplanation?: boolean;
  showTip?: boolean;
  thinkTime?: number;
}

export function VideoPreview({
  open, onClose, question, audioDurations, component,
  audioServerUrl = "", teacherExplanation, showOfficialExplanation, showTip, thinkTime,
}: Props) {
  const durationInFrames = useMemo(() => {
    if (!audioDurations) return 300;
    const d = audioDurations;
    const think = thinkTime ?? 0;
    let dur = d.question + 0.3;
    dur += (d.optionDurations || []).reduce((s, v) => s + v, 0);
    dur += think + (d.bridgeReveal || 0) + d.answer + 0.3;
    if (showOfficialExplanation !== false) {
      const expDur = teacherExplanation && d.teacherExplanation ? d.teacherExplanation : d.explanation;
      dur += (d.bridgeExplain || 0) + expDur + 1;
    }
    if (showTip !== false) {
      dur += (d.bridgeTip || 0) + d.tip + 1.5;
    }
    return Math.ceil(dur * 30);
  }, [audioDurations, thinkTime, showOfficialExplanation, showTip, teacherExplanation]);

  if (!open || !question || !audioDurations) return null;

  const Component = component === "tf" ? TrueFalseQuestion : component === "scroll" ? ScrollableQuestion : MultipleChoice;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
          <span className="text-sm text-gray-300">预览 — Q{question.id}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">×</button>
        </div>
        <Player
          component={Component}
          inputProps={{
            question,
            audioDurations,
            audioServerUrl,
            teacherExplanation,
            showOfficialExplanation,
            showTip,
            thinkTime,
          }}
          durationInFrames={durationInFrames}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={30}
          style={{ width: 360, height: 640 }}
          controls
          autoPlay
        />
      </div>
    </div>
  );
}
