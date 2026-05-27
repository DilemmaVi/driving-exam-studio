export const COLORS = {
  bgPrimary: "#F5F7FA",
  bgSecondary: "#FFFFFF",
  bgTertiary: "#EEF1F5",
  surface: "rgba(255, 255, 255, 0.9)",
  surfaceLight: "rgba(241, 245, 249, 0.8)",
  border: "rgba(203, 213, 225, 0.6)",
  borderLight: "rgba(226, 232, 240, 0.5)",
  text: "#1A1A2E",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  highlight: "#F59E0B",
  highlightBg: "rgba(245, 158, 11, 0.12)",
  correct: "#22C55E",
  correctBg: "rgba(34, 197, 94, 0.1)",
  correctBorder: "rgba(34, 197, 94, 0.4)",
  wrong: "#EF4444",
  wrongBg: "rgba(239, 68, 68, 0.08)",
  wrongBorder: "rgba(239, 68, 68, 0.4)",
  accent: "#3B82F6",
  accentBg: "rgba(59, 130, 246, 0.1)",
  accentBorder: "rgba(59, 130, 246, 0.4)",
  glass: "rgba(255, 255, 255, 0.92)",
  glassBorder: "rgba(203, 213, 225, 0.3)",
  overlay: "rgba(15, 23, 42, 0.5)",
  redBox: "#EF4444",
  redBoxBorder: "rgba(239, 68, 68, 0.8)",
  redBoxBg: "rgba(239, 68, 68, 0.06)",
  cardShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
};

export const FONT = {
  main: "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  size: {
    badge: 32,
    label: 36,
    tip: 42,
    explanation: 50,
    option: 58,
    question: 68,
    title: 64,
    number: 88,
    answer: 40,
  },
};

export const SPACING = {
  xs: 10,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
};

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 32,
};

export type ThemeName = "light" | "eye-care" | "gradient";

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  glass: string;
  glassBorder: string;
  overlay: string;
  border: string;
  accent: string;
}

const EYE_CARE_THEME: ThemeColors = {
  bgPrimary: "#E8F5E9",
  bgSecondary: "#F1F8E9",
  surface: "rgba(232, 245, 233, 0.92)",
  text: "#1B5E20",
  textSecondary: "#388E3C",
  textMuted: "#81C784",
  glass: "rgba(241, 248, 233, 0.94)",
  glassBorder: "rgba(165, 214, 167, 0.5)",
  overlay: "rgba(27, 94, 32, 0.3)",
  border: "rgba(165, 214, 167, 0.6)",
  accent: "#43A047",
};

const LIGHT_THEME: ThemeColors = {
  bgPrimary: "#F5F7FA",
  bgSecondary: "#FFFFFF",
  surface: "rgba(255, 255, 255, 0.9)",
  text: "#1A1A2E",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  glass: "rgba(255, 255, 255, 0.92)",
  glassBorder: "rgba(203, 213, 225, 0.3)",
  overlay: "rgba(15, 23, 42, 0.5)",
  border: "rgba(203, 213, 225, 0.6)",
  accent: "#3B82F6",
};

const GRADIENT_THEME: ThemeColors = {
  bgPrimary: "#1a0533",
  bgSecondary: "#0f1b4d",
  surface: "rgba(26, 5, 51, 0.85)",
  text: "#FFFFFF",
  textSecondary: "#C4B5FD",
  textMuted: "#7C3AED",
  glass: "rgba(15, 10, 40, 0.88)",
  glassBorder: "rgba(124, 58, 237, 0.3)",
  overlay: "rgba(0, 0, 0, 0.6)",
  border: "rgba(124, 58, 237, 0.4)",
  accent: "#A78BFA",
};

export function getThemeColors(theme: ThemeName): ThemeColors {
  switch (theme) {
    case "eye-care": return EYE_CARE_THEME;
    case "gradient": return GRADIENT_THEME;
    default: return LIGHT_THEME;
  }
}
