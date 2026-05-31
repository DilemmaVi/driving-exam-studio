import type { VideoStyle } from "./VideoStyle";

export type QuestionType = "true-false" | "multiple-choice";

export interface Question {
  id: number;
  type: QuestionType;
  questionContent: string;
  options: string[];
  correctIndex: number;
  correctIndices?: number[];
  explanation: string;
  tip: string;
  coverImage?: string;
  gifImage?: string;
  explanationImages?: string[];
}

export interface AudioDurations {
  question: number;
  answer: number;
  explanation: number;
  tip: number;
  teacherExplanation?: number;
  optionDurations?: number[];
  bridgeThink?: number;
  bridgeReveal?: number;
  bridgeExplain?: number;
  bridgeTip?: number;
  questionClauseDurations?: number[];
  optionClauseDurations?: number[][];
  explanationClauseDurations?: number[];
  tipClauseDurations?: number[];
  teacherExplanationClauseDurations?: number[];
}

export interface QuestionEntry {
  question: Question;
  durations: AudioDurations;
  component: "tf" | "mc" | "scroll";
  audioServerUrl?: string;
  teacherExplanation?: string;
  showOfficialExplanation?: boolean;
  showTip?: boolean;
  thinkTime?: number;
  transition?: string;
  videoStyle?: VideoStyle;
  readOptions?: boolean;
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
  panelAdjust?: "auto-shift" | "auto-scale" | "manual" | "manual-scale" | "none";
  panelAdjustValue?: number;
}
