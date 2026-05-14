import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";
import { RedCircle } from "./RedCircle";

const KEYWORD_COLOR = "#FF6B4A";

interface Props {
  title: string;
  titleColor: string;
  accentColor: string;
  content: string;
  startFrame: number;
  endFrame: number;
  borderColor?: string;
  readingDurationFrames?: number;
  keywords?: string[];
  panelHeight?: number;
}

interface Segment {
  text: string;
  isKeyword: boolean;
  startIdx: number;
}

function splitByKeywords(text: string, keywords: string[]): Segment[] {
  if (!keywords.length) return [{ text, isKeyword: false, startIdx: 0 }];
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const segments: Segment[] = [];
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: text.slice(lastIdx, match.index), isKeyword: false, startIdx: lastIdx });
    }
    segments.push({ text: match[0], isKeyword: true, startIdx: match.index });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), isKeyword: false, startIdx: lastIdx });
  }
  return segments;
}

export const BottomPanel: React.FC<Props> = ({
  title, titleColor, accentColor, content, startFrame, endFrame, borderColor,
  readingDurationFrames, keywords, panelHeight: panelHeightProp,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame >= endFrame) return null;

  const localFrame = frame - startFrame;
  const exitStart = endFrame - startFrame - 15;

  const slideIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const slideOut = localFrame >= exitStart
    ? spring({ frame: localFrame - exitStart, fps, config: { damping: 20, stiffness: 120 } })
    : 0;

  const translateY = interpolate(slideIn, [0, 1], [900, 0]) + interpolate(slideOut, [0, 1], [0, 900]);
  const dimOpacity = interpolate(slideIn, [0, 1], [0, 0.35]) - interpolate(slideOut, [0, 1], [0, 0.35]);

  const cleanContent = content.replace(/【/g, "").replace(/】/g, "");
  const sentences = cleanContent.split(/(?<=[。！？；])/).filter(s => s.trim());
  const sentenceDelay = 12;

  // Determine effective panel height
  const effectivePanelPct = panelHeightProp && panelHeightProp > 0 ? panelHeightProp : 48;
  const panelContentHeight = Math.round(1920 * effectivePanelPct / 100) - 240;
  const baseFontSize = FONT.size.question - 4; // 58
  const baseLineHeight = 2;
  const contentWidth = 1080 - SPACING.xl * 2;
  let panelFontSize = baseFontSize;
  let estimatedTotalHeight = 0;
  for (let fs = baseFontSize; fs >= 32; fs -= 2) {
    const charsPerLine = Math.floor(contentWidth / fs);
    let totalLines = 0;
    for (const s of sentences) {
      totalLines += Math.max(1, Math.ceil(s.length / charsPerLine));
    }
    estimatedTotalHeight = totalLines * (fs * baseLineHeight);
    if (estimatedTotalHeight <= panelContentHeight) {
      panelFontSize = fs;
      break;
    }
    panelFontSize = fs;
  }

  // Recalculate at final font size
  const finalCharsPerLine = Math.floor(contentWidth / panelFontSize);
  let finalTotalLines = 0;
  for (const s of sentences) {
    finalTotalLines += Math.max(1, Math.ceil(s.length / finalCharsPerLine));
  }
  estimatedTotalHeight = finalTotalLines * (panelFontSize * baseLineHeight);

  // If content overflows even at min font, auto-scroll based on reading progress
  const needsScroll = estimatedTotalHeight > panelContentHeight;
  const scrollOffset = needsScroll && readingDurationFrames && readingDurationFrames > 0
    ? interpolate(localFrame, [0, readingDurationFrames], [0, estimatedTotalHeight - panelContentHeight + 40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const readProgress = readingDurationFrames && readingDurationFrames > 0
    ? Math.min(1, Math.max(0, localFrame / readingDurationFrames))
    : -1;

  const totalContentLen = sentences.reduce((s, t) => s + t.length, 0);
  let charCounter = 0;
  const kws = keywords || [];

  return (
    <AbsoluteFill style={{ zIndex: 100 }}>
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${Math.max(0, dimOpacity)})` }} />
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${effectivePanelPct}%`,
        transform: `translateY(${translateY}px)`,
      }}>
        <div style={{
          height: "100%",
          background: COLORS.glass,
          borderRadius: `${RADIUS.xxl}px ${RADIUS.xxl}px 0 0`,
          border: `2px solid ${borderColor || COLORS.glassBorder}`,
          borderBottom: "none",
          backdropFilter: "blur(30px)",
          padding: `${SPACING.xl}px ${SPACING.xl}px ${SPACING.xxl}px`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            width: 60, height: 5, borderRadius: 3,
            background: COLORS.textMuted, margin: "0 auto", marginBottom: SPACING.lg,
            opacity: 0.5,
          }} />

          <div style={{
            display: "flex", alignItems: "center", gap: SPACING.sm,
            marginBottom: SPACING.lg, flexShrink: 0,
          }}>
            <div style={{ width: 10, height: 44, borderRadius: 5, background: accentColor }} />
            <span style={{
              fontSize: FONT.size.title, color: titleColor,
              fontWeight: 700, fontFamily: FONT.main,
            }}>
              {title}
            </span>
          </div>

          {readProgress >= 0 && (
            <div style={{
              height: 3, borderRadius: 2,
              background: "rgba(148,163,184,0.15)",
              marginBottom: SPACING.md,
              flexShrink: 0,
            }}>
              <div style={{
                height: "100%",
                width: `${readProgress * 100}%`,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${accentColor}, ${titleColor})`,
                transition: "width 0.1s linear",
              }} />
            </div>
          )}

          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <div style={{ transform: `translateY(-${scrollOffset}px)` }}>
            {sentences.map((sentence, i) => {
              const sentenceFrame = sentenceDelay * i;
              const sentenceOpacity = interpolate(
                localFrame, [sentenceFrame, sentenceFrame + 10], [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const sentenceY = interpolate(
                localFrame, [sentenceFrame, sentenceFrame + 10], [15, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );

              const segments = splitByKeywords(sentence, kws);
              const sentenceCharStart = charCounter;

              const rendered = segments.map((seg, si) => {
                const segGlobalStart = sentenceCharStart + seg.startIdx;
                const segReadRatio = totalContentLen > 0 ? segGlobalStart / totalContentLen : 0;
                const isSegReached = readProgress >= 0 && readProgress > segReadRatio;

                const chars = seg.text.split("").map((ch, ci) => {
                  const globalIdx = segGlobalStart + ci;
                  const readRatio = readProgress >= 0 ? globalIdx / totalContentLen : -1;
                  const isRead = readRatio >= 0 && readRatio < readProgress;

                  let color = COLORS.text;
                  if (seg.isKeyword && isRead) {
                    color = KEYWORD_COLOR;
                  } else if (isRead) {
                    color = titleColor;
                  }

                  return (
                    <span key={ci} style={{
                      color,
                      fontWeight: seg.isKeyword && isRead ? 700 : undefined,
                      transition: "color 0.15s",
                    }}>{ch}</span>
                  );
                });

                if (seg.isKeyword && isSegReached) {
                  const kwAppearFrame = readingDurationFrames
                    ? startFrame + Math.round(segReadRatio * readingDurationFrames)
                    : startFrame;
                  return (
                    <RedCircle key={`seg-${si}`} appearFrame={kwAppearFrame}>
                      {chars}
                    </RedCircle>
                  );
                }
                return <span key={`seg-${si}`}>{chars}</span>;
              });

              charCounter += sentence.length;

              return (
                <div key={i} style={{
                  fontSize: panelFontSize,
                  color: COLORS.text,
                  lineHeight: 2,
                  fontFamily: FONT.main,
                  opacity: sentenceOpacity,
                  transform: `translateY(${sentenceY}px)`,
                }}>
                  {rendered}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
