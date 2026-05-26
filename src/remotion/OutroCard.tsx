"use client";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { COLORS, FONT, SPACING, getThemeColors, type ThemeName } from "./theme";

interface Props {
  title: string;
  subtitle?: string;
  audioServerUrl?: string;
  theme?: ThemeName;
  logoUrl?: string;
}

export const OutroCard: React.FC<Props> = ({ title, subtitle, audioServerUrl, theme, logoUrl }) => {
  const colors = theme ? getThemeColors(theme) : COLORS;
  const logoSrc = logoUrl || (audioServerUrl ? `${audioServerUrl}/logo.png` : staticFile("logo.png"));

  return (
    <AbsoluteFill style={{
      backgroundColor: colors.bgPrimary,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Img
          src={logoSrc}
          style={{
            width: 180, height: 180,
            marginBottom: SPACING.xl,
            borderRadius: 24,
          }}
        />
        <div style={{
          fontSize: FONT.size.title + 16,
          fontWeight: 800,
          color: colors.text,
          fontFamily: FONT.main,
          lineHeight: 1.4,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: FONT.size.explanation,
            color: colors.textSecondary,
            fontFamily: FONT.main,
            marginTop: SPACING.lg,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
