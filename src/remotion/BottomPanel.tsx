import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill } from "remotion";
import { COLORS, FONT, SPACING, RADIUS } from "./theme";
import { RedCircle } from "./RedCircle";

const KEYWORD_COLOR = "#FF6B4A";
const BLUE_KEYWORD_COLOR = "#3B82F6";

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
  blueKeywords?: string[];
  panelHeight?: number;
  underlineEnabled?: boolean;
  underlineColor?: string;
  phase?: "question" | "answer" | "explanation" | "tip";
  originalQuestion?: string;
  originalOptions?: string[];
  originalKeywords?: string[];
  correctOptionIndices?: number[];
  keywordFlashEnabled?: boolean;
  fontSizeOverride?: number;
  readingPrefixDelay?: number;
  readingSpeedRatio?: number;
  panelSuffix?: string;
  readingClauseDurations?: number[];
}

interface Segment {
  text: string;
  isKeyword: boolean;
  isBlueKeyword?: boolean;
  startIdx: number;
}

function splitByKeywords(text: string, keywords: string[], blueKeywords: string[] = []): Segment[] {
  const allKws = [...keywords, ...blueKeywords];
  if (!allKws.length) return [{ text, isKeyword: false, startIdx: 0 }];
  const escaped = allKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const blueSet = new Set(blueKeywords);
  const segments: Segment[] = [];
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: text.slice(lastIdx, match.index), isKeyword: false, startIdx: lastIdx });
    }
    const isBlue = blueSet.has(match[0]);
    segments.push({ text: match[0], isKeyword: true, isBlueKeyword: isBlue, startIdx: match.index });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), isKeyword: false, startIdx: lastIdx });
  }
  return segments;
}

function renderWithKeywordUnderline(text: string, keywords: string[]): React.ReactNode {
  const cleanText = text.replace(/【/g, "").replace(/】/g, "");
  if (!keywords.length) return <span>{cleanText}</span>;
  const segments = splitByKeywords(cleanText, keywords);
  return segments.map((seg, i) => (
    <span key={i} style={seg.isKeyword ? {
      textDecoration: "underline",
      textDecorationColor: "#F59E0B",
      textUnderlineOffset: "4px",
      textDecorationThickness: "3px",
      fontWeight: 700,
    } : undefined}>{seg.text}</span>
  ));
}

export const BottomPanel: React.FC<Props> = ({
  title, titleColor, accentColor, content, startFrame, endFrame, borderColor,
  readingDurationFrames, keywords, blueKeywords, panelHeight: panelHeightProp,
  underlineEnabled = false, phase, originalQuestion, originalOptions,
  originalKeywords, correctOptionIndices, keywordFlashEnabled, fontSizeOverride, underlineColor,
  readingPrefixDelay, readingSpeedRatio, panelSuffix, readingClauseDurations,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame >= endFrame) return null;

  const localFrame = frame - startFrame;
  const exitStart = endFrame - startFrame - 25;

  const slideIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const slideOut = localFrame >= exitStart
    ? spring({ frame: localFrame - exitStart, fps, config: { damping: 20, stiffness: 120 } })
    : 0;

  const translateY = interpolate(slideIn, [0, 1], [900, 0]) + interpolate(slideOut, [0, 1], [0, 900]);
  const dimOpacity = interpolate(slideIn, [0, 1], [0, 0.15]) - interpolate(slideOut, [0, 1], [0, 0.15]);

  const cleanContent = content.replace(/【/g, "").replace(/】/g, "").replace(/[{}｛｝]/g, "");
  const sentences = cleanContent.split(/(?<=[。！？；])/).filter(s => s.trim());
  const sentenceDelay = 12;

  // Extract keyword list for line estimation
  const allKwsForEst = [...(keywords || []), ...(blueKeywords || [])];

  // Determine effective panel height
  const effectivePanelPct = panelHeightProp && panelHeightProp > 0 ? panelHeightProp : 48;
  const panelContentHeight = Math.round(1920 * effectivePanelPct / 100) - 240;
  const baseFontSize = FONT.size.question - 4; // 58
  const baseLineHeight = 2;
  const contentWidth = 1080 - SPACING.xl * 2;

  // Estimate lines considering keyword nowrap behavior
  function estimateLines(text: string, charsPerLine: number): number {
    if (!allKwsForEst.length) return Math.max(1, Math.ceil(text.length / charsPerLine));
    const segments = splitByKeywords(text, allKwsForEst);
    let lines = 1;
    let col = 0;
    for (const seg of segments) {
      if (seg.isKeyword) {
        // nowrap keyword: if it doesn't fit on current line, move to next line
        if (col + seg.text.length > charsPerLine && col > 0) {
          lines++;
          col = 0;
        }
        // keyword occupies 1 visual line (nowrap), next content starts on new line if overflowed
        col += seg.text.length;
        if (col >= charsPerLine) {
          lines++;
          col = 0;
        }
      } else {
        for (let i = 0; i < seg.text.length; i++) {
          col++;
          if (col > charsPerLine) {
            lines++;
            col = 1;
          }
        }
      }
    }
    return lines;
  }

  let panelFontSize = baseFontSize;
  let estimatedTotalHeight = 0;
  for (let fs = baseFontSize; fs >= 32; fs -= 2) {
    const charsPerLine = Math.floor(contentWidth / fs);
    let totalLines = 0;
    for (const s of sentences) {
      totalLines += estimateLines(s, charsPerLine);
    }
    estimatedTotalHeight = totalLines * (fs * baseLineHeight);
    if (estimatedTotalHeight <= panelContentHeight) {
      panelFontSize = fs;
      break;
    }
    panelFontSize = fs;
  }

  if (fontSizeOverride) panelFontSize = fontSizeOverride;

  // Recalculate at final font size
  const finalCharsPerLine = Math.floor(contentWidth / panelFontSize);
  let finalTotalLines = 0;
  for (const s of sentences) {
    finalTotalLines += estimateLines(s, finalCharsPerLine);
  }
  estimatedTotalHeight = finalTotalLines * (panelFontSize * baseLineHeight);

  // If content overflows even at min font, auto-scroll based on reading progress
  const needsScroll = estimatedTotalHeight > panelContentHeight;
  const scrollOffset = needsScroll && readingDurationFrames && readingDurationFrames > 0
    ? interpolate(localFrame, [0, readingDurationFrames], [0, estimatedTotalHeight - panelContentHeight + 40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const prefixDelay = readingPrefixDelay ?? 0;
  const speedRatio = readingSpeedRatio ?? 1;
  const effectiveDuration = readingDurationFrames ? readingDurationFrames / speedRatio : 0;
  const totalContentLen = sentences.reduce((s, t) => s + t.length, 0);

  let readCharsCount = -1;
  if (effectiveDuration > 0) {
    const postPrefixElapsed = (localFrame - prefixDelay) / speedRatio;
    if (postPrefixElapsed >= 0) {
      const plainText = sentences.join("");
      const textClauses = plainText.split(/(?<=[。，！？、；,])/);
      const clauseMatch = readingClauseDurations && readingClauseDurations.length === textClauses.length;
      if (readingClauseDurations && readingClauseDurations.length > 0 && clauseMatch) {
        let accFrames = 0;
        let accChars = 0;
        for (let i = 0; i < readingClauseDurations.length; i++) {
          const cf = readingClauseDurations[i] * fps;
          const cc = textClauses[i]?.length || 0;
          if (postPrefixElapsed <= accFrames + cf) {
            readCharsCount = accChars + Math.floor(cf > 0 ? ((postPrefixElapsed - accFrames) / cf) * cc : cc);
            break;
          }
          accFrames += cf;
          accChars += cc;
        }
        if (readCharsCount < 0) readCharsCount = totalContentLen;
      } else {
        const readProgress = Math.min(1, Math.max(0, postPrefixElapsed / effectiveDuration));
        readCharsCount = Math.floor(readProgress * totalContentLen);
      }
    }
  }

  let charCounter = 0;
  const kws = keywords || [];
  const bkws = blueKeywords || [];

  const underlineProgress = readingDurationFrames && readingDurationFrames > 0
    ? Math.min(1, localFrame / readingDurationFrames)
    : 0;

  // Calculate actual needed height: title area + content + padding
  const titleAreaHeight = 5 + SPACING.lg + 44 + SPACING.lg;
  const paddingHeight = SPACING.xl + SPACING.xxl;
  const actualNeededHeight = titleAreaHeight + paddingHeight + estimatedTotalHeight;
  const maxPanelHeight = Math.round(1920 * effectivePanelPct / 100);
  const minPanelHeight = Math.round(1920 * 0.25);
  const adaptiveHeight = Math.max(minPanelHeight, actualNeededHeight + 60);
  const finalPanelHeight = needsScroll ? maxPanelHeight : Math.min(maxPanelHeight, adaptiveHeight);

  return (
    <AbsoluteFill style={{ zIndex: 100 }}>
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${Math.max(0, dimOpacity)})` }} />
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: finalPanelHeight,
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
              {title}{panelSuffix ? `-${panelSuffix}` : ""}
            </span>
          </div>


          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <div style={{
              transform: `translateY(-${scrollOffset}px)`,
            }}>
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

              const segments = splitByKeywords(sentence, kws, bkws);
              const sentenceCharStart = charCounter;

              const rendered = segments.map((seg, si) => {
                const segGlobalStart = sentenceCharStart + seg.startIdx;
                const segReadRatio = totalContentLen > 0 ? segGlobalStart / totalContentLen : 0;
                const isSegReached = readCharsCount >= 0 && segGlobalStart < readCharsCount;

                const chars = seg.text.split("").map((ch, ci) => {
                  const globalIdx = segGlobalStart + ci;
                  const isRead = readCharsCount >= 0 && globalIdx < readCharsCount;

                  let color = COLORS.text;
                  if (seg.isKeyword && isRead) {
                    color = seg.isBlueKeyword ? BLUE_KEYWORD_COLOR : KEYWORD_COLOR;
                  } else if (isRead) {
                    color = titleColor;
                  }

                  return (
                    <span key={ci} style={{
                      color,
                      fontWeight: seg.isKeyword && isRead ? 700 : undefined,
                      borderBottom: underlineEnabled && isRead ? `3px solid ${underlineColor || COLORS.accent}` : undefined,
                      transition: "color 0.15s",
                    }}>{ch}</span>
                  );
                });

                if (seg.isKeyword && isSegReached) {
                  const kwAppearFrame = readingDurationFrames
                    ? startFrame + Math.round(segReadRatio * readingDurationFrames)
                    : startFrame;
                  return (
                    <RedCircle key={`seg-${si}`} appearFrame={kwAppearFrame} flashEnabled={keywordFlashEnabled} color={seg.isBlueKeyword ? "#3B82F6" : undefined}>
                      {chars}
                    </RedCircle>
                  );
                }
                return <span key={`seg-${si}`} style={seg.isKeyword ? { whiteSpace: "nowrap", display: "inline-block" } : undefined}>{chars}</span>;
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
                  letterSpacing: 0,
                  wordBreak: "break-word",
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
