"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface QuestionRow {
  id: number;
  type: number;
  question_text: string;
  question_content: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correct_answer: string;
  explanation: string;
  tip_text: string;
  tip_display: string;
  cover_image: string | null;
}

interface SelectedQuestion {
  id: number;
  row: QuestionRow;
  ttsStatus: "pending" | "generating" | "ready" | "error";
  durations?: { question: number; answer: number; explanation: number; tip: number };
}

function SortableItem({
  item,
  index,
  onRemove,
}: {
  item: SelectedQuestion;
  index: number;
  onRemove: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeLabel = item.row.type === 1 ? "判断" : "选择";
  const statusColors = {
    pending: "bg-gray-200 text-gray-600",
    generating: "bg-yellow-100 text-yellow-700",
    ready: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };
  const statusText = {
    pending: "待生成",
    generating: "生成中...",
    ready: "就绪",
    error: "失败",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
        aria-label="拖拽排序"
      >
        ⋮⋮
      </button>
      <span className="text-sm font-medium text-gray-500 w-6">{index + 1}</span>
      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{typeLabel}</span>
      <span className="flex-1 text-sm truncate">{item.row.question_text}</span>
      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[item.ttsStatus]}`}>
        {statusText[item.ttsStatus]}
      </span>
      <button
        onClick={() => onRemove(item.id)}
        className="text-gray-400 hover:text-red-500 text-lg leading-none"
        aria-label="移除"
      >
        ×
      </button>
    </div>
  );
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/settings").then((r) => r.json()).then((d) => setMaskedKey(d.mimoApiKey || ""));
    }
  }, [open]);

  const save = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimoApiKey: apiKey.trim() }),
    });
    setSaving(false);
    setMaskedKey("sk-****" + apiKey.trim().slice(-6));
    setApiKey("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[440px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">设置</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">MIMO API Key (TTS 语音合成)</label>
          {maskedKey && (
            <p className="text-xs text-gray-500 mb-2">当前: {maskedKey}</p>
          )}
          <input
            type="password"
            placeholder="输入新的 API Key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">取消</button>
          <button
            onClick={save}
            disabled={!apiKey.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);
  const [generatingTTS, setGeneratingTTS] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderTaskId, setRenderTaskId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setApiConfigured(d.configured));
  }, [showSettings]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchQuestions = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (keyword) params.set("keyword", keyword);

    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    setQuestions(data.questions);
    setTotal(data.total);
  }, [page, typeFilter, keyword]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const totalPages = Math.ceil(total / 15);

  const addQuestion = (row: QuestionRow) => {
    if (selected.some((s) => s.id === row.id)) return;
    setSelected((prev) => [...prev, { id: row.id, row, ttsStatus: "pending" }]);
  };

  const removeQuestion = (id: number) => {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSelected((items) => {
      const oldIdx = items.findIndex((i) => i.id === active.id);
      const newIdx = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIdx, newIdx);
    });
  };

  const generateTTS = async () => {
    if (generatingTTS) return;
    setGeneratingTTS(true);
    const pending = selected.filter((s) => s.ttsStatus === "pending" || s.ttsStatus === "error");
    for (const item of pending) {
      setSelected((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, ttsStatus: "generating" as const } : s))
      );

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: item.id }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setSelected((prev) =>
          prev.map((s) =>
            s.id === item.id ? { ...s, ttsStatus: "ready" as const, durations: data.durations } : s
          )
        );
      } catch {
        setSelected((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, ttsStatus: "error" as const } : s))
        );
      }
    }
    setGeneratingTTS(false);
  };

  const startRender = async () => {
    if (rendering) return;
    const notReady = selected.filter((s) => s.ttsStatus !== "ready");
    if (notReady.length > 0) {
      alert("请先生成所有题目的语音");
      return;
    }

    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: selected.map((s) => s.id) }),
      });
      const data = await res.json();
      setRenderTaskId(data.taskId);
    } catch {
      alert("渲染提交失败");
    }
    setRendering(false);
  };

  const allReady = selected.length > 0 && selected.every((s) => s.ttsStatus === "ready");
  const estimatedDuration = selected.reduce((acc, s) => {
    if (!s.durations) return acc + 30;
    const d = s.durations;
    return acc + 3 + d.question + 0.5 + 3 + d.answer + 0.5 + d.explanation + 1 + d.tip + 1.5;
  }, 0);

  return (
    <div className="flex h-[calc(100vh-52px)]">
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 space-y-3">
          <h2 className="font-bold text-lg">题库选题</h2>
          <input
            type="text"
            placeholder="搜索题目..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            {[
              { value: "all", label: "全部" },
              { value: "1", label: "判断题" },
              { value: "2", label: "选择题" },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => { setTypeFilter(t.value); setPage(1); }}
                className={`px-3 py-1 rounded-full text-sm ${
                  typeFilter === t.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {questions.map((q) => {
            const isSelected = selected.some((s) => s.id === q.id);
            return (
              <div
                key={q.id}
                onClick={() => !isSelected && addQuestion(q)}
                className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  isSelected ? "bg-blue-50 opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">#{q.id}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {q.type === 1 ? "判断" : "选择"}
                  </span>
                  {isSelected && (
                    <span className="text-xs text-blue-600">已选</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{q.question_text}</p>
              </div>
            );
          })}
        </div>

        {/* 分页 */}
        <div className="p-3 border-t border-gray-200 flex items-center justify-between text-sm">
          <span className="text-gray-500">共 {total} 题</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded border disabled:opacity-40"
            >
              上一页
            </button>
            <span className="px-2 py-1">{page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded border disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：已选题目 + 操作 */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">已选题目</h2>
            <p className="text-sm text-gray-500">
              {selected.length} 题 | 预计时长 {Math.floor(estimatedDuration / 60)}:{String(Math.floor(estimatedDuration % 60)).padStart(2, "0")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!apiConfigured && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">未配置 API Key</span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              设置
            </button>
            <button
              onClick={generateTTS}
              disabled={selected.length === 0 || generatingTTS}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generatingTTS ? "语音生成中..." : "生成语音"}
            </button>
            <button
              onClick={startRender}
              disabled={!allReady || rendering || generatingTTS}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {rendering ? "提交中..." : "生成视频"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {selected.length === 0 ? (
            <div className="text-center text-gray-400 py-20">
              <p className="text-lg mb-2">从左侧题库点击题目添加</p>
              <p className="text-sm">支持拖拽排序</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selected.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {selected.map((item, idx) => (
                  <SortableItem key={item.id} item={item} index={idx} onRemove={removeQuestion} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {renderTaskId && (
          <div className="p-4 border-t border-gray-200 bg-green-50">
            <p className="text-sm text-green-700">
              渲染任务已提交！任务ID: {renderTaskId}
            </p>
            <a href="/renders" className="text-sm text-blue-600 hover:underline">
              查看渲染任务 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
