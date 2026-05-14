export interface VideoStyle {
  theme: "light" | "dark" | "gradient";
  fontScale: number;
  avatarImage: string;
  avatarPosition: "bottom-right" | "bottom-left" | "none";
  avatarSize: number;
  keywordStyle: "circle" | "underline" | "highlight-bg";
  panelHeight: number;
  readOptions: boolean;
  speechRate: number;
  revealPause: number;
}

export const DEFAULT_VIDEO_STYLE: VideoStyle = {
  theme: "dark",
  fontScale: 1.0,
  avatarImage: "",
  avatarPosition: "bottom-right",
  avatarSize: 260,
  keywordStyle: "circle",
  panelHeight: 48,
  readOptions: true,
  speechRate: 1.0,
  revealPause: 0.3,
};
