"use client";

import { useState, useEffect } from "react";

interface RenderTask {
  id: string;
  question_ids: string;
  status: string;
  progress: number;
  phase: string;
  phase_label: string;
  rendered_frames: number;
  total_frames: number;
  output_path: string | null;
  file_size: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function RendersPage() {
  const [tasks, setTasks] = useState<RenderTask[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/render");
      const data = await res.json();
      setTasks(data.tasks || []);
    };
    load();
    const interval = setInterval(load, 1500);
    return () => clearInterval(interval);
  }, []);

  const phaseColors: Record<string, string> = {
    tts: "bg-purple-500",
    bundling: "bg-yellow-500",
    composition: "bg-yellow-500",
    rendering: "bg-blue-500",
    done: "bg-green-500",
  };

  const statusBadge: Record<string, { text: string; color: string }> = {
    pending: { text: "等待中", color: "bg-gray-100 text-gray-600" },
    tts: { text: "语音合成", color: "bg-purple-100 text-purple-700" },
    rendering: { text: "渲染中", color: "bg-blue-100 text-blue-700" },
    done: { text: "已完成", color: "bg-green-100 text-green-700" },
    error: { text: "失败", color: "bg-red-100 text-red-700" },
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">渲染任务</h1>

      {tasks.length === 0 ? (
        <p className="text-gray-500 text-center py-20">暂无渲染任务</p>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const qIds = JSON.parse(task.question_ids);
            const badge = statusBadge[task.status] || { text: task.status, color: "bg-gray-100" };
            const barColor = phaseColors[task.phase] || "bg-blue-500";
            const pct = Math.round(task.progress * 100);
            const isActive = task.status === "tts" || task.status === "rendering" || task.status === "pending";

            return (
              <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 font-mono">{task.id.slice(0, 8)}</span>
                    <span className="text-sm text-gray-600">{qIds.length} 道题</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>

                {/* Progress bar */}
                {isActive && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-700">{task.phase_label || "准备中..."}</span>
                      <span className="text-sm font-mono text-gray-500">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`${barColor} h-3 rounded-full transition-all duration-500 ease-out ${
                          isActive && pct < 100 ? "animate-pulse" : ""
                        }`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    {task.phase === "rendering" && task.total_frames > 0 && (
                      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
                        <span>帧: {task.rendered_frames} / {task.total_frames}</span>
                        <span>{(task.total_frames / 30).toFixed(0)} 秒视频</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Done */}
                {task.status === "done" && (
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-sm text-gray-500">
                      {task.file_size && <span>文件大小: {task.file_size}</span>}
                      {task.total_frames > 0 && (
                        <span className="ml-3">时长: {(task.total_frames / 30).toFixed(0)}秒</span>
                      )}
                    </div>
                    <a
                      href={`/api/render/download?taskId=${task.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      下载视频
                    </a>
                  </div>
                )}

                {/* Error */}
                {task.error && (
                  <div className="mt-2 p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700 break-all">{task.error}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-3 text-xs text-gray-400">
                  创建: {task.created_at}
                  {task.completed_at && <span className="ml-4">完成: {task.completed_at}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
