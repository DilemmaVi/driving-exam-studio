"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SettingsModal } from "@/components/SettingsModal";
import { BatchActionBar } from "@/components/BatchActionBar";
import { VideoPreview } from "@/components/VideoPreview";
import type { Question, AudioDurations } from "@/remotion/types";

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
  durations?: AudioDurations;
  teacherExplanation: string;
  showOfficialExplanation: boolean;
  showTip: boolean;
  thinkTime: number | null;
  voiceStyle: string | null;
  expanded: boolean;
  checked: boolean;
  readOptions: number | null;
  speechRate: number | null;
  revealPause: number | null;
}

interface SeriesData {
  id: string;
  name: string;
  category: string;
  intro_title: string;
  intro_subtitle: string;
  default_think_time: number;
  default_voice_style: string;
  default_transition: string;
  bridge_think?: string;
  bridge_reveal?: string;
  bridge_explain?: string;
  bridge_tip?: string;
  theme?: string;
  font_scale?: number;
  avatar_image?: string;
  avatar_position?: string;
  avatar_size?: number;
  read_options?: number;
  keyword_style?: string;
  speech_rate?: number;
  reveal_pause?: number;
  panel_height?: number;
  answer_read_option?: number;
  answer_read_multi?: number;
  bridge_think_enabled?: number;
  bridge_reveal_enabled?: number;
  bridge_explain_enabled?: number;
  bridge_tip_enabled?: number;
  outro_text?: string;
  outro_subtitle?: string;
}

function HighlightPreview({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/【(.*?)】/);
  return (
    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="border-2 border-red-500 rounded px-0.5 text-red-600 font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function SortableItem({
  item, index, onRemove, onUpdate,
  defaultThinkTime, defaultVoiceStyle, onPreview,
}: {
  item: SelectedQuestion;
  index: number;
  onRemove: (id: number) => void;
  onUpdate: (id: number, updates: Partial<SelectedQuestion>) => void;
  defaultThinkTime: number;
  defaultVoiceStyle: string;
  onPreview: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const typeLabel = item.row.type === 1 ? "判断" : "选择";
  const statusColors: Record<string, string> = {
    pending: "bg-gray-200 text-gray-600",
    generating: "bg-yellow-100 text-yellow-700",
    ready: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };
  const statusText: Record<string, string> = {
    pending: "待生成", generating: "生成中...", ready: "就绪", error: "失败",
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border rounded-xl shadow-sm transition-all ${item.checked ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"}`}>
      {/* Header row: controls */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <input
          type="checkbox" checked={item.checked}
          onChange={(e) => onUpdate(item.id, { checked: e.target.checked })}
          className="rounded border-gray-300 w-4 h-4"
        />
        <button {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 touch-none text-lg" aria-label="拖拽排序">⋮⋮</button>
        <span className="text-sm font-bold text-blue-600 bg-blue-50 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">{index + 1}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeLabel === "判断" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{typeLabel}</span>
        <div className="flex-1" />
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[item.ttsStatus]}`}>{statusText[item.ttsStatus]}</span>
        {item.ttsStatus === "ready" && (
          <button onClick={() => onPreview(item.id)} className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium transition">▶ 预览</button>
        )}
        <button
          onClick={() => onUpdate(item.id, { expanded: !item.expanded })}
          className="text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
        >
          {item.expanded ? "收起 ▲" : "编排 ▼"}
        </button>
        <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none transition" aria-label="移除">×</button>
      </div>

      {/* Question text - always visible, wraps properly */}
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{item.row.question_text}</p>
        {!item.expanded && item.teacherExplanation && (
          <div className="mt-1.5">
            <HighlightPreview text={item.teacherExplanation} />
          </div>
        )}
      </div>

      {item.expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4 bg-gray-50/50 rounded-b-xl">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">老师讲解（用【】标记关键词高亮）</label>
            <textarea
              value={item.teacherExplanation}
              onChange={(e) => onUpdate(item.id, { teacherExplanation: e.target.value })}
              placeholder="如：注意【禁止标线】表示该区域不允许通行..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {item.teacherExplanation && <HighlightPreview text={item.teacherExplanation} />}
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.showOfficialExplanation} onChange={(e) => onUpdate(item.id, { showOfficialExplanation: e.target.checked })} className="rounded" />
              答题解析
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.showTip} onChange={(e) => onUpdate(item.id, { showTip: e.target.checked })} className="rounded" />
              答题技巧
            </label>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">思考时间</label>
              <select
                value={item.thinkTime ?? ""}
                onChange={(e) => onUpdate(item.id, { thinkTime: e.target.value ? Number(e.target.value) : null })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认 ({defaultThinkTime}s)</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <option key={v} value={v}>{v}秒</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">语音风格</label>
              <select
                value={item.voiceStyle ?? ""}
                onChange={(e) => onUpdate(item.id, { voiceStyle: e.target.value || null })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认 ({defaultVoiceStyle})</option>
                <option value="教学">教学</option>
                <option value="轻快">轻快</option>
                <option value="权威">权威</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">选项朗读</label>
              <select
                value={item.readOptions ?? ""}
                onChange={(e) => onUpdate(item.id, { readOptions: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">跟随系列</option>
                <option value="999">总是读</option>
                <option value="0">不读</option>
                <option value="50">题干超50字不读</option>
                <option value="40">题干超40字不读</option>
                <option value="30">题干超30字不读</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">语速</label>
              <select
                value={item.speechRate ?? ""}
                onChange={(e) => onUpdate(item.id, { speechRate: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">跟随系列</option>
                <option value="0.8">0.8x</option>
                <option value="1.0">1.0x</option>
                <option value="1.2">1.2x</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">揭示停留</label>
              <select
                value={item.revealPause ?? ""}
                onChange={(e) => onUpdate(item.id, { revealPause: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">跟随系列</option>
                {[0.3, 0.5, 1, 2, 3, 5].map((v) => <option key={v} value={v}>{v}秒</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function rowToQuestion(row: QuestionRow): Question {
  const options = row.type === 1
    ? [row.option1 || "正确", row.option2 || "错误"]
    : [row.option1, row.option2, row.option3, row.option4].filter(Boolean) as string[];
  const correctMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  return {
    id: row.id,
    type: row.type === 1 ? "true-false" : "multiple-choice",
    questionContent: row.question_content || row.question_text,
    options,
    correctIndex: correctMap[row.correct_answer] ?? 0,
    explanation: row.explanation || "",
    tip: row.tip_display || row.tip_text || "",
    coverImage: row.cover_image || undefined,
  };
}

export default function SeriesEditorPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [series, setSeries] = useState<SeriesData | null>(null);
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
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch(`/api/series/${seriesId}`).then((r) => r.json()).then((data) => {
      setSeries(data.series);
      if (data.questions?.length > 0) {
        setSelected(data.questions.map((sq: Record<string, unknown>) => ({
          id: sq.question_id as number,
          row: sq as unknown as QuestionRow,
          ttsStatus: "pending" as const,
          teacherExplanation: (sq.teacher_explanation as string) || "",
          showOfficialExplanation: sq.show_official_explanation !== 0,
          showTip: sq.show_tip !== 0,
          thinkTime: sq.think_time as number | null,
          voiceStyle: sq.voice_style as string | null,
          expanded: false,
          checked: false,
          readOptions: (sq.read_options as number | null) ?? null,
          speechRate: (sq.speech_rate as number | null) ?? null,
          revealPause: (sq.reveal_pause as number | null) ?? null,
        })));
      }
    });
  }, [seriesId]);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  const fetchQuestions = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (keyword) params.set("keyword", keyword);
    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    setQuestions(data.questions);
    setTotal(data.total);
  }, [page, typeFilter, keyword, categoryFilter]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const totalPages = Math.ceil(total / 15);

  const addQuestion = (row: QuestionRow) => {
    if (selected.some((s) => s.id === row.id)) return;
    setSelected((prev) => [...prev, {
      id: row.id, row, ttsStatus: "pending",
      teacherExplanation: "", showOfficialExplanation: true, showTip: true,
      thinkTime: null, voiceStyle: null, expanded: false, checked: false,
      readOptions: null, speechRate: null, revealPause: null,
    }]);
  };

  const removeQuestion = (id: number) => setSelected((prev) => prev.filter((s) => s.id !== id));

  const updateQuestion = (id: number, updates: Partial<SelectedQuestion>) => {
    setSelected((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
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

  // Batch operations
  const checkedIds = selected.filter((s) => s.checked).map((s) => s.id);
  const allChecked = selected.length > 0 && selected.every((s) => s.checked);
  const toggleAll = () => {
    const newVal = !allChecked;
    setSelected((prev) => prev.map((s) => ({ ...s, checked: newVal })));
  };

  const batchUpdate = (updates: Partial<SelectedQuestion>) => {
    setSelected((prev) => prev.map((s) => s.checked ? { ...s, ...updates } : s));
  };

  const saveToServer = async () => {
    setSaving(true);
    await fetch(`/api/series/${seriesId}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: selected.map((s, i) => ({
          questionId: s.id,
          sortOrder: i,
          teacherExplanation: s.teacherExplanation,
          showOfficialExplanation: s.showOfficialExplanation,
          showTip: s.showTip,
          thinkTime: s.thinkTime,
          voiceStyle: s.voiceStyle,
          readOptions: s.readOptions,
          speechRate: s.speechRate,
          revealPause: s.revealPause,
        })),
      }),
    });
    setSaving(false);
  };

  const updateSeriesSettings = async (updates: Record<string, unknown>) => {
    await fetch(`/api/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSeries((prev) => prev ? { ...prev, ...updates } as SeriesData : prev);
  };

  const generateTTS = async () => {
    if (generatingTTS) return;
    await saveToServer();
    setGeneratingTTS(true);
    const pending = selected.filter((s) => s.ttsStatus === "pending" || s.ttsStatus === "error");
    for (const item of pending) {
      setSelected((prev) => prev.map((s) => (s.id === item.id ? { ...s, ttsStatus: "generating" as const } : s)));
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: item.id,
            teacherExplanation: item.teacherExplanation,
            showOfficialExplanation: item.showOfficialExplanation,
            showTip: item.showTip,
            voiceStyle: item.voiceStyle,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSelected((prev) => prev.map((s) => s.id === item.id ? { ...s, ttsStatus: "ready" as const, durations: data.durations } : s));
      } catch {
        setSelected((prev) => prev.map((s) => (s.id === item.id ? { ...s, ttsStatus: "error" as const } : s)));
      }
    }
    setGeneratingTTS(false);
  };

  const startRender = async (tipOnly = false) => {
    if (rendering) return;
    const notReady = selected.filter((s) => s.ttsStatus !== "ready");
    if (notReady.length > 0) { alert("请先生成所有题目的语音"); return; }
    if (tipOnly) {
      const noTip = selected.filter((s) => !s.row.tip_text && !s.row.tip_display);
      if (noTip.length > 0) { alert(`${noTip.length} 题没有技巧内容`); return; }
    }
    await saveToServer();
    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, tipOnly }),
      });
      const data = await res.json();
      setRenderTaskId(data.taskId);
    } catch { alert("渲染提交失败"); }
    setRendering(false);
  };

  // Preview
  const previewItem = selected.find((s) => s.id === previewId);
  const previewQuestion = previewItem ? rowToQuestion(previewItem.row) : null;
  const previewComponent = previewItem?.row.type === 1 ? "tf" as const : "mc" as const;

  const allReady = selected.length > 0 && selected.every((s) => s.ttsStatus === "ready");
  const defaultThinkTime = series?.default_think_time ?? 3;
  const defaultVoiceStyle = series?.default_voice_style ?? "教学";

  const estimatedDuration = selected.reduce((acc, s, idx) => {
    if (!s.durations) return acc + 30;
    const d = s.durations;
    const think = s.thinkTime ?? defaultThinkTime;
    let dur = (idx > 0 ? 3 : 0) + d.question + 0.5 + think + d.answer + 0.5;
    if (d.teacherExplanation) dur += d.teacherExplanation + 1;
    if (s.showOfficialExplanation) dur += d.explanation + 1;
    if (s.showTip) dur += d.tip + 1.5;
    return acc + dur;
  }, series?.intro_title ? 4 : 0);

  if (!series) return <div className="flex items-center justify-center h-96 text-gray-400">加载中...</div>;

  return (
    <div className="flex h-[calc(100vh-52px)]">
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} series={series} onSave={updateSeriesSettings} />

      <VideoPreview
        open={previewId !== null}
        onClose={() => setPreviewId(null)}
        question={previewQuestion}
        audioDurations={previewItem?.durations || null}
        component={previewComponent}
        audioServerUrl=""
        teacherExplanation={previewItem?.teacherExplanation}
        showOfficialExplanation={previewItem?.showOfficialExplanation}
        showTip={previewItem?.showTip}
        thinkTime={previewItem?.thinkTime ?? defaultThinkTime}
      />

      {/* 左侧题库 */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 space-y-3">
          <h2 className="font-bold text-base text-gray-800">题库选题</h2>
          <div className="relative">
            <input
              type="text" placeholder="搜索题目..." value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部分类</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-1.5">
            {[{ value: "all", label: "全部" }, { value: "1", label: "判断题" }, { value: "2", label: "选择题" }].map((t) => (
              <button key={t.value} onClick={() => { setTypeFilter(t.value); setPage(1); }}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${typeFilter === t.value ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >{t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {questions.map((q) => {
            const isSelected = selected.some((s) => s.id === q.id);
            return (
              <div key={q.id} onClick={() => !isSelected && addQuestion(q)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition ${isSelected ? "bg-blue-50/50 opacity-50" : "hover:bg-blue-50/30"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${q.type === 1 ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>{q.type === 1 ? "判断" : "选择"}</span>
                  {isSelected && <span className="text-xs text-blue-500 font-medium">✓ 已选</span>}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{q.question_text}</p>
              </div>
            );
          })}
        </div>
        <div className="p-2.5 border-t border-gray-200 flex items-center justify-between text-xs">
          <span className="text-gray-400">{total} 题</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition">←</button>
            <span className="px-2 py-1 text-gray-500">{page}/{totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition">→</button>
          </div>
        </div>
      </div>

      {/* 右侧编排 */}
      <div className="flex-1 flex flex-col bg-gray-50/50 min-w-0">
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-lg text-gray-900">{series.name}</h2>
              {series.category && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{series.category}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {selected.length} 题 · 预计 {Math.floor(estimatedDuration / 60)}:{String(Math.floor(estimatedDuration % 60)).padStart(2, "0")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition" title="设置">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button onClick={saveToServer} disabled={saving} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
              {saving ? "保存中..." : "💾 保存"}
            </button>
            <button onClick={generateTTS} disabled={selected.length === 0 || generatingTTS}
              className="px-4 py-1.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >{generatingTTS ? "生成中..." : "🎙 生成语音"}</button>
            <button onClick={() => startRender(false)} disabled={!allReady || rendering || generatingTTS}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >{rendering ? "提交中..." : "🎬 生成视频"}</button>
            <button onClick={() => startRender(true)} disabled={!allReady || rendering || generatingTTS}
              className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >{rendering ? "提交中..." : "💡 只渲染技巧"}</button>
          </div>
        </div>

        {/* Select all */}
        {selected.length > 0 && (
          <div className="px-6 py-2 border-b border-gray-100 bg-white flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded border-gray-300 w-3.5 h-3.5" />
              全选
            </label>
            {checkedIds.length > 0 && <span className="text-xs text-blue-600 font-medium">已选 {checkedIds.length} 题</span>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selected.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-4xl mb-4 opacity-30">📋</div>
              <p className="text-gray-400 text-sm mb-1">从左侧题库点击题目添加</p>
              <p className="text-gray-300 text-xs">支持拖拽排序，展开编排每题的讲解和参数</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selected.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {selected.map((item, idx) => (
                  <SortableItem
                    key={item.id} item={item} index={idx}
                    onRemove={removeQuestion} onUpdate={updateQuestion}
                    defaultThinkTime={defaultThinkTime} defaultVoiceStyle={defaultVoiceStyle}
                    onPreview={setPreviewId}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="px-6 py-2.5 border-t border-gray-200 bg-white text-xs text-gray-400 flex items-center gap-4">
          <span>默认: 思考{defaultThinkTime}s · {defaultVoiceStyle}语气 · {series.theme || "dark"}主题</span>
          <div className="flex-1" />
          {renderTaskId && (
            <a href="/renders" className="text-blue-600 hover:underline font-medium">渲染任务 {renderTaskId.slice(0, 8)} →</a>
          )}
        </div>
      </div>

      <BatchActionBar
        selectedCount={checkedIds.length}
        onBatchShowExplanation={(val) => batchUpdate({ showOfficialExplanation: val })}
        onBatchShowTip={(val) => batchUpdate({ showTip: val })}
        onBatchSpeechRate={(val) => batchUpdate({ speechRate: val })}
        onBatchThinkTime={(val) => batchUpdate({ thinkTime: val })}
        onBatchDelete={() => setSelected((prev) => prev.filter((s) => !s.checked))}
      />
    </div>
  );
}
