"use client";

import { useState, useEffect, useCallback } from "react";
import { GuideTourButton } from "@/components/GuideTour";

interface RenderTask {
  id: string;
  question_ids: string;
  series_id: string | null;
  series_name: string | null;
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
  queue_position?: number;
}

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "error", label: "失败" },
];

export default function RendersPage() {
  const [tasks, setTasks] = useState<RenderTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const pageSize = 20;

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (statusFilter) params.set("status", statusFilter);
    if (keyword) params.set("keyword", keyword);
    const res = await fetch(`/api/render?${params}`);
    const data = await res.json();
    setTasks(data.tasks || []);
    setTotal(data.total || 0);
  }, [page, statusFilter, keyword]);

  const hasActive = tasks.some((t) => ["pending", "tts", "rendering"].includes(t.status));

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, [hasActive, fetchTasks]);

  const totalPages = Math.ceil(total / pageSize);

  const deleteTask = async (id: string) => {
    if (!confirm("确定删除此任务？")) return;
    await fetch(`/api/render?taskId=${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const clearCompleted = async () => {
    if (!confirm("确定清理所有已完成和失败的任务？")) return;
    await fetch("/api/render?clearDone=1", { method: "DELETE" });
    fetchTasks();
  };

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
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">渲染任务</h1>
          <p className="text-gray-500 text-sm mt-1">{total} 个任务</p>
        </div>
        <div className="flex items-center gap-2">
          <GuideTourButton page="renders" />
          <button onClick={clearCompleted} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            清理已完成
          </button>
        </div>
      </div>

      {/* Filters */}
      <div id="tour-render-tabs" className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium transition ${statusFilter === tab.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text" placeholder="搜索系列名/任务ID..." value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-gray-400 text-center py-20">{keyword || statusFilter ? "没有匹配的任务" : "暂无渲染任务"}</p>
      ) : (
        <div id="tour-render-list" className="space-y-3">
          {tasks.map((task) => {
            const qIds = JSON.parse(task.question_ids);
            const badge = statusBadge[task.status] || { text: task.status, color: "bg-gray-100" };
            const barColor = phaseColors[task.phase] || "bg-blue-500";
            const pct = Math.round(task.progress * 100);
            const isActive = ["pending", "tts", "rendering"].includes(task.status);

            return (
              <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-gray-300 transition group">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {task.series_name && (
                      <span className="text-sm font-medium text-gray-800 truncate">{task.series_name}</span>
                    )}
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{task.id.slice(0, 8)}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{qIds.length} 题</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.color}`}>
                      {badge.text}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-300 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {isActive && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{task.status === "pending" && task.queue_position ? `排队中（第${task.queue_position}位）` : task.phase_label || "准备中..."}</span>
                      <span className="text-sm font-mono text-gray-500">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`${barColor} h-2.5 rounded-full transition-all duration-500 ease-out ${pct < 100 ? "animate-pulse" : ""}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    {task.phase === "rendering" && task.total_frames > 0 && (
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                        <span>帧: {task.rendered_frames} / {task.total_frames}</span>
                        <span>{(task.total_frames / 30).toFixed(0)}秒视频</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Done */}
                {task.status === "done" && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 flex items-center gap-3">
                      {task.file_size && <span>{task.file_size}</span>}
                      {task.total_frames > 0 && <span>{(task.total_frames / 30).toFixed(0)}秒</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPlayingTaskId(task.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
                      >
                        ▶ 播放
                      </button>
                      <a
                        href={`/api/render/download?taskId=${task.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                      >
                        下载
                      </a>
                    </div>
                  </div>
                )}

                {/* Error */}
                {task.error && (
                  <div className="mt-2 p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700 break-all line-clamp-3">{task.error}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-2 text-xs text-gray-400">
                  {task.created_at}
                  {task.completed_at && <span className="ml-3">完成于 {task.completed_at}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50 transition">上一页</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50 transition">下一页</button>
        </div>
      )}
      {/* Video Player Modal */}
      {playingTaskId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setPlayingTaskId(null)}>
          <div className="relative w-[360px] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPlayingTaskId(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition"
            >×</button>
            <video
              src={`/api/render/download?taskId=${playingTaskId}`}
              controls
              autoPlay
              className="w-full max-h-[90vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
