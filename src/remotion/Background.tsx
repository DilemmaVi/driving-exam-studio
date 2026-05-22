import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, getThemeColors, ThemeName } from "./theme";

interface Props {
  theme?: ThemeName;
}

export const Background: React.FC<Props> = ({ theme }) => {
  if (!theme || theme === "light") {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${COLORS.bgSecondary} 0%, ${COLORS.bgPrimary} 50%, ${COLORS.bgTertiary} 100%)`,
        }}
      >
        <div style={{
          position: "absolute", top: -200, right: -150, width: 600, height: 600,
          borderRadius: "50%", background: "rgba(59, 130, 246, 0.05)", filter: "blur(120px)",
        }} />
        <div style={{
          position: "absolute", bottom: -150, left: -100, width: 500, height: 500,
          borderRadius: "50%", background: "rgba(245, 158, 11, 0.04)", filter: "blur(100px)",
        }} />
      </AbsoluteFill>
    );
  }

  if (theme === "eye-care") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #E8F5E9 0%, #F1F8E9 50%, #E8F5E9 100%)" }}>
        <div style={{
          position: "absolute", top: -200, right: -150, width: 600, height: 600,
          borderRadius: "50%", background: "rgba(76, 175, 80, 0.08)", filter: "blur(150px)",
        }} />
        <div style={{
          position: "absolute", bottom: -150, left: -100, width: 500, height: 500,
          borderRadius: "50%", background: "rgba(139, 195, 74, 0.06)", filter: "blur(120px)",
        }} />
      </AbsoluteFill>
    );
  }

  // gradient theme
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1a0533 0%, #0f1b4d 50%, #1a0533 100%)" }}>
      <div style={{
        position: "absolute", top: -200, right: -150, width: 600, height: 600,
        borderRadius: "50%", background: "rgba(124, 58, 237, 0.12)", filter: "blur(150px)",
      }} />
      <div style={{
        position: "absolute", bottom: -150, left: -100, width: 500, height: 500,
        borderRadius: "50%", background: "rgba(236, 72, 153, 0.08)", filter: "blur(120px)",
      }} />
    </AbsoluteFill>
  );
};
