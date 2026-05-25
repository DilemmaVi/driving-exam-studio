import React, { useCallback, useEffect, useState } from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile, cancelRender, delayRender, continueRender } from "remotion";
import { Lottie } from "@remotion/lottie";
import type { LottieAnimationData } from "@remotion/lottie";

const RING_WIDTH = 4;
const LABEL_TEXT = "全安老师";

interface Props {
  startFrame?: number;
  speaking?: boolean;
  position?: "bottom-right" | "bottom-left";
  hideFrame?: number;
  size?: number;
  avatarSrc?: string;
}

export const TeacherAvatar: React.FC<Props> = ({
  startFrame = 0,
  speaking = false,
  position = "bottom-right",
  hideFrame,
  size = 120,
  avatarSrc = "images/teacher-avatar.png",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isLottie = avatarSrc?.endsWith(".json");

  const [animationData, setAnimationData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => isLottie ? delayRender("Loading Lottie animation") : null);

  const fetchLottie = useCallback(async () => {
    if (!isLottie || !handle) return;
    try {
      const res = await fetch(staticFile(avatarSrc));
      const data = await res.json();
      setAnimationData(data);
      continueRender(handle);
    } catch (err) {
      cancelRender(err);
    }
  }, [avatarSrc, isLottie, handle]);

  useEffect(() => {
    fetchLottie();
  }, [fetchLottie]);

  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, stiffness: 70 },
    from: 0,
    to: 1,
  });

  const scale = interpolate(enter, [0, 1], [0.3, 1]);
  const speakPulse = speaking ? 1 + Math.sin(frame * 0.25) * 0.03 : 1;

  const hideProgress = hideFrame !== undefined && frame >= hideFrame
    ? spring({ frame: frame - hideFrame, fps, config: { damping: 20, stiffness: 100 } })
    : 0;
  const hideScale = interpolate(hideProgress, [0, 1], [1, 0.6]);
  const hideOpacity = interpolate(hideProgress, [0, 1], [1, 0]);

  const posStyle = position === "bottom-right"
    ? { right: 36, bottom: 36 }
    : { left: 36, bottom: 36 };

  const ringGlow = speaking
    ? `0 0 ${8 + Math.sin(frame * 0.2) * 4}px rgba(59, 130, 246, 0.6)`
    : "0 2px 12px rgba(0,0,0,0.3)";

  return (
    <div style={{
      position: "absolute",
      ...posStyle,
      opacity: enter * hideOpacity,
      transform: `scale(${scale * speakPulse * hideScale})`,
      transformOrigin: "center center",
      zIndex: 50,
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    }}>
      {isLottie ? (
        /* Lottie avatar — no ring, no clip, no label */
        <div style={{ width: size, height: size }}>
          {animationData && (
            <Lottie animationData={animationData} style={{ width: size, height: size }} />
          )}
        </div>
      ) : (
        <>
          {/* Circle avatar with ring */}
          <div style={{
            width: size + RING_WIDTH * 2,
            height: size + RING_WIDTH * 2,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            padding: RING_WIDTH,
            boxShadow: ringGlow,
          }}>
            <div style={{
              width: size,
              height: size,
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid rgba(255,255,255,0.9)",
            }}>
              <Img
                src={staticFile(avatarSrc)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 15%",
                }}
              />
            </div>
          </div>
          {/* Name label */}
          <div style={{
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            borderRadius: 20,
            padding: "4px 16px",
            boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
          }}>
            <span style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: 600,
              fontFamily: "'Noto Sans SC', sans-serif",
              letterSpacing: 2,
            }}>
              {LABEL_TEXT}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
