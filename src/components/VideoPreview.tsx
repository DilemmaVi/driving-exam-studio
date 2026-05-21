"use client";
import React, { useMemo, useState, useEffect } from "react";
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
  pauseStart?: number;
}

export function VideoPreview({
  open, onClose, question, audioDurations, component,
  audioServerUrl = "", teacherExplanation, showOfficialExplanation, showTip, thinkTime,
  readOptions, keywordFlashEnabled, underlineProgressEnabled,
  avatarEnabled, avatarSize, avatarPosition, pauseBeforeTip, optionGap,
  fontSizeQuestion, fontSizeOption, fontSizeExplanation,
  underlineQuestion, underlineOption, underlineExplanation, underlineTip, underlineColor,
  stemKeywords, stemKeywordPhases, readingPrefixDelay, readingSpeedRatio, panelAdjust, panelAdjustValue, subjectLabel, pauseStart,
}: Props) {
  const [watermark, setWatermark] = useState<{ text?: string; position?: string; opacity?: number; fontSize?: string; logoUrl?: string; scale?: number; color?: string; font?: string; stroke?: boolean }>({});
  useEffect(() => {
    if (open) {
      fetch("/api/settings").then(r => r.json()).then(d => {
        if (d.watermarkEnabled && (d.watermarkText || d.watermarkLogoUrl)) {
          setWatermark({ text: d.watermarkText, position: d.watermarkPosition, opacity: d.watermarkOpacity, fontSize: d.watermarkFontSize, logoUrl: d.watermarkLogoUrl, scale: d.watermarkScale, color: d.watermarkColor, font: d.watermarkFont, stroke: d.watermarkStroke });
        } else {
          setWatermark({});
        }
      });
    }
  }, [open]);
  const durationInFrames = useMemo(() => {
    if (!audioDurations) return 300;
    const d = audioDurations;
    const think = thinkTime ?? 0;
    const optAnimSecs = 2;
    let dur = optAnimSecs + (pauseStart || 0) + d.question + 0.3;
    if (readOptions !== false) {
      dur += (d.optionDurations || []).reduce((s, v) => s + v, 0);
    }
    dur += think + (d.bridgeReveal || 0) + d.answer + 0.3;
    if (showOfficialExplanation !== false) {
      const expDur = teacherExplanation && d.teacherExplanation ? d.teacherExplanation : d.explanation;
      dur += (d.bridgeExplain || 0) + expDur + 2.5;
    }
    if (showTip !== false) {
      dur += (d.bridgeTip || 0) + d.tip + 2.5;
    }
    return Math.ceil(dur * 30) + 10;
  }, [audioDurations, thinkTime, showOfficialExplanation, showTip, teacherExplanation, readOptions, pauseStart]);

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
          key={`player-${question.id}-${readingPrefixDelay ?? 8}-${readingSpeedRatio ?? 1}`}
          component={Component}
          inputProps={{
            question,
            audioDurations,
            audioServerUrl: "/api",
            teacherExplanation,
            showOfficialExplanation,
            showTip,
            thinkTime,
            readOptions,
            keywordFlashEnabled,
            underlineProgressEnabled,
            avatarEnabled,
            avatarSize,
            avatarPosition,
            pauseBeforeTip,
            optionGap,
            fontSizeQuestion,
            fontSizeOption,
            fontSizeExplanation,
            underlineQuestion,
            underlineOption,
            underlineExplanation,
            underlineTip,
            underlineColor,
            stemKeywords,
            stemKeywordPhases,
            readingPrefixDelay,
            readingSpeedRatio,
            panelAdjust,
            panelAdjustValue,
            subjectLabel,
            startDelay: pauseStart ? Math.round(pauseStart * 30) : 0,
            watermarkText: watermark.text,
            watermarkPosition: watermark.position as any,
            watermarkOpacity: watermark.opacity,
            watermarkFontSize: watermark.fontSize as any,
            watermarkLogoUrl: watermark.logoUrl,
            watermarkScale: watermark.scale,
            watermarkColor: watermark.color,
            watermarkFont: watermark.font,
            watermarkStroke: watermark.stroke,
          }}
          durationInFrames={durationInFrames}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={30}
          style={{ width: 360, height: 640 }}
          numberOfSharedAudioTags={12}
          controls
          autoPlay
        />
      </div>
    </div>
  );
}
