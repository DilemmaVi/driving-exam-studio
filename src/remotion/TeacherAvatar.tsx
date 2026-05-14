import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";

const AVATAR_SIZE = 120;
const RING_WIDTH = 4;
const LABEL_TEXT = "考试讲师";

interface Props {
  startFrame?: number;
  speaking?: boolean;
  position?: "bottom-right" | "bottom-left";
  hideFrame?: number;
}

export const TeacherAvatar: React.FC<Props> = ({
  startFrame = 0,
  speaking = false,
  position = "bottom-right",
  hideFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
      {/* Circle avatar with ring */}
      <div style={{
        width: AVATAR_SIZE + RING_WIDTH * 2,
        height: AVATAR_SIZE + RING_WIDTH * 2,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
        padding: RING_WIDTH,
        boxShadow: ringGlow,
      }}>
        <div style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid rgba(255,255,255,0.9)",
        }}>
          <Img
            src={staticFile("images/teacher-avatar.png")}
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
    </div>
  );
};
