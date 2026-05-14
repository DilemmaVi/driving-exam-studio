"use client";
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT, SPACING } from "./theme";

interface Props {
  title: string;
  subtitle?: string;
  audioServerUrl?: string;
}

export const OutroCard: React.FC<Props> = ({ title, subtitle, audioServerUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 80 } });
  const titleOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const logoSrc = audioServerUrl ? `${audioServerUrl}/logo.png` : staticFile("logo.png");

  return (
    <AbsoluteFill style={{
      backgroundColor: COLORS.bgPrimary,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: fadeIn,
    }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Img
          src={logoSrc}
          style={{
            width: 180, height: 180,
            opacity: titleOpacity,
            marginBottom: SPACING.xl,
            borderRadius: 24,
          }}
        />
        <div style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          fontSize: FONT.size.title + 16,
          fontWeight: 800,
          color: COLORS.text,
          fontFamily: FONT.main,
          lineHeight: 1.4,
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
