"use client";
import React, { useState, useRef, useEffect } from "react";

interface Segment {
  segment: string;
  label: string;
  url: string;
  duration: number;
}

interface Props {
  questionId: number;
  open: boolean;
  onClose: () => void;
}

export function AudioPreview({ questionId, open, onClose }: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [playAll, setPlayAll] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadSegments = () => {
    setLoading(true);
    fetch(`/api/tts/preview?questionId=${questionId}`)
      .then((r) => r.json())
      .then((data) => setSegments(data.segments || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    loadSegments();
  }, [open, questionId]);

  const stop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(null);
    setPlayAll(false);
  };

  const playSingle = (idx: number) => {
    stop();
    const audio = new Audio(segments[idx].url + `?t=${Date.now()}`);
    audioRef.current = audio;
    setPlaying(idx);
    audio.onended = () => {
      setPlaying(null);
      if (playAll && idx + 1 < segments.length) {
        playSingle(idx + 1);
      } else {
        setPlayAll(false);
      }
    };
    audio.play();
  };

  const handlePlayAll = () => {
    setPlayAll(true);
    playSingle(0);
  };

  const [toast, setToast] = useState<string | null>(null);

  const handleRegenerateSegment = async (idx: number) => {
    stop();
    setRegeneratingIdx(idx);
    try {
      const res = await fetch("/api/tts/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, segment: segments[idx].segment }),
      });
      const data = await res.json();
      if (data.error) {
        setToast(`生成失败: ${data.error}`);
      } else {
        setToast(`「${segments[idx].label}」已重新生成`);
      }
      loadSegments();
    } catch {
      setToast("生成失败，请重试");
    } finally {
      setRegeneratingIdx(null);
      setTimeout(() => setToast(null), 2500);
    }
  };

  useEffect(() => { return () => stop(); }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl w-[420px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">语音预览</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        <div className="p-4">
          {loading && <p className="text-sm text-gray-400 text-center py-8">加载中...</p>}
          {!loading && segments.length === 0 && <p className="text-sm text-gray-400 text-center py-8">暂无语音，请先生成</p>}
          {!loading && segments.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={playAll ? stop : handlePlayAll}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                  {playAll ? "⏹ 停止" : "▶ 连续播放"}
                </button>
                <span className="text-xs text-gray-400 ml-auto">
                  共 {segments.reduce((s, seg) => s + seg.duration, 0).toFixed(1)}s
                </span>
              </div>
              <div className="space-y-1.5">
                {segments.map((seg, i) => (
                  <div key={seg.segment}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${playing === i ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"}`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-xs cursor-pointer"
                      onClick={() => playing === i ? stop() : playSingle(i)}>
                      {playing === i ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" /> : "▶"}
                    </span>
                    <span className="text-sm text-gray-700 flex-1 cursor-pointer"
                      onClick={() => playing === i ? stop() : playSingle(i)}>
                      {seg.label}
                    </span>
                    <span className="text-xs text-gray-400">{seg.duration.toFixed(1)}s</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRegenerateSegment(i); }}
                      disabled={regeneratingIdx !== null}
                      className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 disabled:opacity-40 whitespace-nowrap"
                    >
                      {regeneratingIdx === i ? "生成中..." : "重新生成"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg animate-fade-in">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
