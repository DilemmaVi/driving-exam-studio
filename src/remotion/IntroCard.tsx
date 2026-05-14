"use client";
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT, SPACING } from "./theme";

interface Props {
  title: string;
  subtitle?: string;
  category?: string;
  audioServerUrl?: string;
}

export const IntroCard: React.FC<Props> = ({ title, subtitle, category, audioServerUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 80 } });
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const categoryOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" });

  const titleScale = spring({ frame: frame - 35, fps, config: { damping: 12, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [35, 45], [0, 1], { extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });

  const fadeOut = interpolate(frame, [100, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const logoSrc = audioServerUrl ? `${audioServerUrl}/logo.png` : staticFile("logo.png");

  return (
    <AbsoluteFill style={{
      backgroundColor: COLORS.bgPrimary,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: bgOpacity * fadeOut,
    }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Img
          src={logoSrc}
          style={{
            width: 240,
            height: 240,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginBottom: SPACING.xl,
            borderRadius: 32,
          }}
        />
        {category && (
          <div style={{
            opacity: categoryOpacity,
            fontSize: FONT.size.label,
            color: COLORS.accent,
            fontFamily: FONT.main,
            marginBottom: SPACING.md,
            letterSpacing: 4,
          }}>
            {category}
          </div>
        )}
        <div style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          fontSize: FONT.size.title + 20,
          fontWeight: 800,
          color: COLORS.text,
          fontFamily: FONT.main,
          lineHeight: 1.3,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            opacity: subtitleOpacity,
            fontSize: FONT.size.explanation,
            color: COLORS.textSecondary,
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
