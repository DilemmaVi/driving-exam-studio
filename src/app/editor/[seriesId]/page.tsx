"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { GuideTourButton } from "@/components/GuideTour";
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
import { AudioPreview } from "@/components/AudioPreview";
import { BatchActionBar } from "@/components/BatchActionBar";
import { VideoPreview } from "@/components/VideoPreview";
import { getStaticUrl } from "@/lib/static-url";
import type { Question, AudioDurations } from "@/remotion/types";

interface QuestionRow {
  id: number;
  question_id?: number;
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
  optionGap: number | null;
  fontSizeQuestion: number | null;
  fontSizeOption: number | null;
  fontSizeExplanation: number | null;
  stemKeywords: string;
  stemKeywordPhases: string;
  readingPrefixDelay: number | null;
  readingSpeedRatio: number | null;
  panelAdjust: string;
  panelAdjustValue: number | null;
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
  keyword_flash_enabled?: number;
  underline_progress_enabled?: number;
  avatar_enabled?: number;
  pause_before_tip?: number;
  show_transition?: number;
  pause_start?: number;
  pause_end?: number;
  tts_speed?: string;
  underline_question?: number;
  underline_option?: number;
  underline_explanation?: number;
  underline_tip?: number;
  underline_color?: string;
  split_render?: number;
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
  defaultThinkTime, defaultVoiceStyle, onPreview, onAudioPreview, onRegenerate,
}: {
  item: SelectedQuestion;
  index: number;
  onRemove: (id: number) => void;
  onUpdate: (id: number, updates: Partial<SelectedQuestion>) => void;
  defaultThinkTime: number;
  defaultVoiceStyle: string;
  onPreview: (id: number) => void;
  onAudioPreview: (id: number) => void;
  onRegenerate: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const typeLabel = item.row.type === 1 ? "判断" : (item.row.correct_answer || "").length > 1 ? "多选" : "单选";
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
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeLabel === "判断" ? "bg-amber-50 text-amber-700" : typeLabel === "多选" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>{typeLabel}</span>
        <div className="flex-1" />
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[item.ttsStatus]}`}>{statusText[item.ttsStatus]}</span>
        {item.ttsStatus === "ready" && (
          <button onClick={() => onAudioPreview(item.id)} className="text-xs px-3 py-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100 font-medium transition">🔊 试听</button>
        )}
        {item.ttsStatus === "ready" && (
          <button id={index === 0 ? "tour-preview-btn" : undefined} onClick={() => onPreview(item.id)} className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium transition">▶ 预览</button>
        )}
        <button onClick={() => onRegenerate(item.id)} disabled={item.ttsStatus === "generating"} className="text-xs px-3 py-1 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium transition disabled:opacity-40">🔄 重新生成</button>
        <button
          id={index === 0 ? "tour-question-expand" : undefined}
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
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {[item.row.option1, item.row.option2, item.row.option3, item.row.option4].map((opt, oi) => opt ? (
            <span key={oi} className={`text-xs ${item.row.correct_answer.includes("ABCD"[oi]) ? "text-green-600 font-medium" : "text-gray-500"}`}>
              {"ABCD"[oi]}. {opt}
            </span>
          ) : null)}
        </div>
        <p className="text-xs text-green-600 mt-1 font-medium">答案：{item.row.correct_answer}</p>
        {!item.expanded && item.teacherExplanation && item.teacherExplanation !== item.row.explanation && (
          <div className="mt-1.5">
            <HighlightPreview text={item.teacherExplanation} />
          </div>
        )}
      </div>

      {item.expanded && (
        <div id={index === 0 ? "tour-config-section" : undefined} className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4 bg-gray-50/50 rounded-b-xl">
          <div id={index === 0 ? "tour-teacher-exp" : undefined}>
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

          <div id={index === 0 ? "tour-show-toggles" : undefined} className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.showOfficialExplanation} onChange={(e) => onUpdate(item.id, { showOfficialExplanation: e.target.checked })} className="rounded" />
              答题解析
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.showTip} onChange={(e) => onUpdate(item.id, { showTip: e.target.checked })} className="rounded" />
              答题技巧
            </label>
          </div>

          <div id={index === 0 ? "tour-params-row" : undefined} className="flex items-center gap-4 flex-wrap">
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">选项间距</label>
              <select
                value={item.optionGap ?? ""}
                onChange={(e) => onUpdate(item.id, { optionGap: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认</option>
                {[4, 8, 12, 16, 24, 32, 48].map((v) => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">题干字号</label>
              <select
                value={item.fontSizeQuestion ?? ""}
                onChange={(e) => onUpdate(item.id, { fontSizeQuestion: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认</option>
                {[36, 40, 44, 48, 52, 56, 60, 64, 68, 72].map((v) => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">选项字号</label>
              <select
                value={item.fontSizeOption ?? ""}
                onChange={(e) => onUpdate(item.id, { fontSizeOption: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认</option>
                {[32, 36, 40, 44, 48, 52, 56, 60].map((v) => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">解析字号</label>
              <select
                value={item.fontSizeExplanation ?? ""}
                onChange={(e) => onUpdate(item.id, { fontSizeExplanation: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认</option>
                {[32, 36, 40, 44, 48, 52, 56, 60].map((v) => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
            <div id={index === 0 ? "tour-prefix-delay" : undefined}>
              <label className="block text-xs text-gray-500 mb-1">变色延迟</label>
              <select
                value={item.readingPrefixDelay ?? ""}
                onChange={(e) => onUpdate(item.id, { readingPrefixDelay: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认(8帧)</option>
                {[0, 3, 5, 8, 12, 15, 20, 25, 30, 40, 50, 60].map((v) => <option key={v} value={v}>{v}帧</option>)}
              </select>
            </div>
            <div id={index === 0 ? "tour-speed-ratio" : undefined}>
              <label className="block text-xs text-gray-500 mb-1">变色速率</label>
              <select
                value={item.readingSpeedRatio ?? ""}
                onChange={(e) => onUpdate(item.id, { readingSpeedRatio: e.target.value === "" ? null : Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="">默认(1.0x)</option>
                {[0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3].map((v) => <option key={v} value={v}>{v}x</option>)}
              </select>
            </div>
            <div id={index === 0 ? "tour-panel-adjust" : undefined}>
              <label className="block text-xs text-gray-500 mb-1">弹窗适配</label>
              <select
                value={item.panelAdjust || "auto-scale"}
                onChange={(e) => onUpdate(item.id, { panelAdjust: e.target.value })}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value="auto-shift">自动上移</option>
                <option value="auto-scale">自动缩小</option>
                <option value="manual">手动上移</option>
                <option value="manual-scale">手动缩小</option>
                <option value="none">不调整</option>
              </select>
            </div>
            {item.panelAdjust === "manual" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">上移量(px)</label>
                <select
                  value={item.panelAdjustValue ?? ""}
                  onChange={(e) => onUpdate(item.id, { panelAdjustValue: e.target.value === "" ? null : Number(e.target.value) })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                >
                  <option value="">请选择</option>
                  {[100, 200, 300, 400, 500, 600, 700, 800].map((v) => <option key={v} value={v}>{v}px</option>)}
                </select>
              </div>
            )}
            {item.panelAdjust === "manual-scale" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">缩放比例(%)</label>
                <select
                  value={item.panelAdjustValue ?? ""}
                  onChange={(e) => onUpdate(item.id, { panelAdjustValue: e.target.value === "" ? null : Number(e.target.value) })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                >
                  <option value="">请选择</option>
                  {[90, 85, 80, 75, 70, 65, 60, 55, 50].map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
            )}
          </div>

          <div id={index === 0 ? "tour-stem-keywords" : undefined}>
            <label className="block text-xs font-medium text-gray-500 mb-1">题干关键字红色波浪线（逗号分隔多个关键字）</label>
            <input
              value={item.stemKeywords}
              onChange={(e) => onUpdate(item.id, { stemKeywords: e.target.value })}
              placeholder="如：禁止标线,不允许通行"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-gray-500">触发阶段：</span>
              {([["question", "读题"], ["explanation", "解析"], ["tip", "技巧"]] as const).map(([val, label]) => {
                const phases = (item.stemKeywordPhases || "").split(",").filter(Boolean);
                const checked = phases.includes(val);
                return (
                  <label key={val} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox" checked={checked} className="rounded border-gray-300 w-3.5 h-3.5"
                      onChange={(e) => {
                        const next = e.target.checked ? [...phases, val] : phases.filter((p) => p !== val);
                        onUpdate(item.id, { stemKeywordPhases: next.join(",") || "question" });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
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
  const letters = (row.correct_answer || "").split("").filter((c) => correctMap[c] !== undefined);
  const correctIndices = letters.map((c) => correctMap[c]);
  return {
    id: row.question_id || row.id,
    type: row.type === 1 ? "true-false" : "multiple-choice",
    questionContent: row.question_content || row.question_text,
    options,
    correctIndex: correctIndices[0] ?? 0,
    correctIndices: correctIndices.length > 1 ? correctIndices : undefined,
    explanation: row.explanation || "",
    tip: row.tip_display || row.tip_text || "",
    coverImage: getStaticUrl(row.cover_image) || undefined,
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
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [audioPreviewId, setAudioPreviewId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch(`/api/series/${seriesId}`).then((r) => r.json()).then(async (data) => {
      setSeries(data.series);
      if (data.questions?.length > 0) {
        const qIds = data.questions.map((sq: Record<string, unknown>) => sq.question_id as number);
        const items = data.questions.map((sq: Record<string, unknown>) => ({
          id: sq.question_id as number,
          row: sq as unknown as QuestionRow,
          ttsStatus: "pending" as const,
          teacherExplanation: (sq.teacher_explanation as string) || (sq.explanation as string) || "",
          showOfficialExplanation: sq.show_official_explanation !== 0,
          showTip: sq.show_tip !== 0,
          thinkTime: sq.think_time as number | null,
          voiceStyle: sq.voice_style as string | null,
          expanded: false,
          checked: false,
          readOptions: (sq.read_options as number | null) ?? null,
          speechRate: (sq.speech_rate as number | null) ?? null,
          revealPause: (sq.reveal_pause as number | null) ?? null,
          optionGap: (sq.option_gap as number | null) ?? null,
          fontSizeQuestion: (sq.font_size_question as number | null) ?? null,
          fontSizeOption: (sq.font_size_option as number | null) ?? null,
          fontSizeExplanation: (sq.font_size_explanation as number | null) ?? null,
          stemKeywords: (sq.stem_keywords as string) || "",
          stemKeywordPhases: (sq.stem_keyword_phases as string) || "question",
          readingPrefixDelay: (sq.reading_prefix_delay as number | null) ?? null,
          readingSpeedRatio: (sq.reading_speed_ratio as number | null) ?? null,
          panelAdjust: (sq.panel_adjust as string) || "auto-scale",
          panelAdjustValue: (sq.panel_adjust_value as number | null) ?? null,
        }));
        setSelected(items);

        // Check TTS cache status
        try {
          const checkRes = await fetch("/api/tts/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionIds: qIds }),
          });
          const ttsStatus = await checkRes.json();
          setSelected((prev) => prev.map((s) => {
            const info = ttsStatus[s.id];
            if (info?.ready) return { ...s, ttsStatus: "ready" as const, durations: info.durations };
            return s;
          }));
        } catch {}
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
      teacherExplanation: row.explanation || "", showOfficialExplanation: true, showTip: true,
      thinkTime: null, voiceStyle: null, expanded: false, checked: false,
      readOptions: null, speechRate: null, revealPause: null, optionGap: null,
      fontSizeQuestion: null, fontSizeOption: null, fontSizeExplanation: null,
      stemKeywords: "", stemKeywordPhases: "question",
      readingPrefixDelay: null,
      readingSpeedRatio: null,
      panelAdjust: "auto-scale",
      panelAdjustValue: null,
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
          optionGap: s.optionGap,
          fontSizeQuestion: s.fontSizeQuestion,
          fontSizeOption: s.fontSizeOption,
          fontSizeExplanation: s.fontSizeExplanation,
          stemKeywords: s.stemKeywords,
          stemKeywordPhases: s.stemKeywordPhases,
          readingPrefixDelay: s.readingPrefixDelay,
          readingSpeedRatio: s.readingSpeedRatio,
          panelAdjust: s.panelAdjust,
          panelAdjustValue: s.panelAdjustValue,
        })),
      }),
    });
    setSaving(false);
    showToast("✅ 已保存");
  };

  const updateSeriesSettings = async (updates: Record<string, unknown>) => {
    await fetch(`/api/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const colMap: Record<string, string> = {
      introTitle: "intro_title", introSubtitle: "intro_subtitle", category: "category",
      theme: "theme", fontScale: "font_scale", avatarPosition: "avatar_position",
      avatarSize: "avatar_size", keywordStyle: "keyword_style", panelHeight: "panel_height",
      defaultThinkTime: "default_think_time", defaultVoiceStyle: "default_voice_style",
      speechRate: "speech_rate", readOptions: "read_options",
      answerReadOption: "answer_read_option", answerReadMulti: "answer_read_multi",
      bridgeThinkEnabled: "bridge_think_enabled", bridgeRevealEnabled: "bridge_reveal_enabled",
      bridgeExplainEnabled: "bridge_explain_enabled", bridgeTipEnabled: "bridge_tip_enabled",
      outroText: "outro_text", outroSubtitle: "outro_subtitle",
      bridgeThink: "bridge_think", bridgeReveal: "bridge_reveal",
      bridgeExplain: "bridge_explain", bridgeTip: "bridge_tip",
      showTransition: "show_transition", pauseStart: "pause_start",
      pauseEnd: "pause_end", pauseBeforeTip: "pause_before_tip",
      ttsSpeed: "tts_speed", keywordFlashEnabled: "keyword_flash_enabled",
      underlineProgressEnabled: "underline_progress_enabled", avatarEnabled: "avatar_enabled",
      underlineQuestion: "underline_question", underlineOption: "underline_option",
      underlineExplanation: "underline_explanation", underlineTip: "underline_tip",
      underlineColor: "underline_color",
      splitRender: "split_render",
      introEnabled: "intro_enabled",
      outroEnabled: "outro_enabled",
      introDuration: "intro_duration",
      outroDuration: "outro_duration",
    };
    const snakeUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      snakeUpdates[colMap[k] || k] = v;
    }
    setSeries((prev) => prev ? { ...prev, ...snakeUpdates } as SeriesData : prev);
  };

  const generateTTS = async (force = false) => {
    if (generatingTTS) return;
    await saveToServer();
    setGeneratingTTS(true);
    const targets = force ? selected : selected.filter((s) => s.ttsStatus === "pending" || s.ttsStatus === "error");
    for (const item of targets) {
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
            force,
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
    showToast("✅ 语音生成完成");
  };

  const regenerateSingle = async (id: number) => {
    const item = selected.find((s) => s.id === id);
    if (!item) return;
    setSelected((prev) => prev.map((s) => s.id === id ? { ...s, ttsStatus: "generating" as const } : s));
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
          force: true,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelected((prev) => prev.map((s) => s.id === id ? { ...s, ttsStatus: "ready" as const, durations: data.durations } : s));
      showToast("✅ 语音已重新生成");
    } catch {
      setSelected((prev) => prev.map((s) => s.id === id ? { ...s, ttsStatus: "error" as const } : s));
      showToast("❌ 语音生成失败");
    }
  };

  const startRender = async (tipOnly = false) => {
    if (rendering) return;
    const targetSelected = checkedIds.length > 0 ? selected.filter((s) => checkedIds.includes(s.id)) : selected;
    const notReady = targetSelected.filter((s) => s.ttsStatus !== "ready");
    if (notReady.length > 0) { alert("请先生成所有题目的语音"); return; }
    if (tipOnly) {
      const noTip = targetSelected.filter((s) => !s.row.tip_text && !s.row.tip_display);
      if (noTip.length > 0) { alert(`${noTip.length} 题没有技巧内容`); return; }
    }
    await saveToServer();
    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, tipOnly, questionIds: checkedIds.length > 0 ? checkedIds : undefined }),
      });
      const data = await res.json();
      setRenderTaskId(data.taskId);
      showToast("✅ 视频生成任务已提交，请到任务列表查看进度");
      setTimeout(() => setRenderTaskId(null), 3000);
    } catch { alert("渲染提交失败"); }
    setRendering(false);
  };

  // Preview
  const previewItem = selected.find((s) => s.id === previewId);
  const previewQuestion = previewItem ? rowToQuestion(previewItem.row) : null;
  const previewComponent = (() => {
    if (!previewItem) return "mc" as const;
    if (previewItem.row.type === 1) return "tf" as const;
    const opts = [previewItem.row.option1, previewItem.row.option2, previewItem.row.option3, previewItem.row.option4].filter(Boolean) as string[];
    const qText = previewItem.row.question_content || previewItem.row.question_text || "";
    const isLong = qText.length > 100 || opts.some((o) => o.length > 20);
    return isLong ? "scroll" as const : "mc" as const;
  })();

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
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-lg text-sm animate-fade-in">
          {toast}
        </div>
      )}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} series={series} onSave={updateSeriesSettings} />
      <AudioPreview questionId={audioPreviewId || 0} open={audioPreviewId !== null} onClose={() => setAudioPreviewId(null)} />

      <VideoPreview
        open={previewId !== null}
        onClose={() => setPreviewId(null)}
        question={previewQuestion}
        audioDurations={previewItem?.durations || null}
        component={previewComponent}
        audioServerUrl="/api"
        teacherExplanation={previewItem?.teacherExplanation}
        showOfficialExplanation={previewItem?.showOfficialExplanation}
        showTip={previewItem?.showTip}
        thinkTime={previewItem?.thinkTime ?? defaultThinkTime}
        readOptions={(() => {
          if (!previewItem) return true;
          const threshold = previewItem.readOptions ?? (series?.read_options as number | null | undefined) ?? 999;
          if (threshold === 0) return false;
          if (threshold >= 999) return true;
          const stemLen = (previewItem.row.question_text || "").replace(/【|】/g, "").length;
          return stemLen <= threshold;
        })()}
        keywordFlashEnabled={Number(series?.keyword_flash_enabled ?? 1) !== 0}
        underlineProgressEnabled={Number(series?.underline_progress_enabled ?? 0) !== 0}
        avatarEnabled={Number(series?.avatar_enabled ?? 1) !== 0}
        avatarSize={series?.avatar_size ?? 260}
        avatarPosition={series?.avatar_position || "bottom-right"}
        pauseBeforeTip={(series?.pause_before_tip as number) ?? 2.0}
        optionGap={previewItem?.optionGap ?? undefined}
        fontSizeQuestion={previewItem?.fontSizeQuestion ?? undefined}
        fontSizeOption={previewItem?.fontSizeOption ?? undefined}
        fontSizeExplanation={previewItem?.fontSizeExplanation ?? undefined}
        underlineQuestion={Number(series?.underline_question ?? 0) !== 0}
        underlineOption={Number(series?.underline_option ?? 0) !== 0}
        underlineExplanation={Number(series?.underline_explanation ?? 0) !== 0}
        underlineTip={Number(series?.underline_tip ?? 0) !== 0}
        underlineColor={series?.underline_color || "#6366F1"}
        stemKeywords={previewItem?.stemKeywords ? previewItem.stemKeywords.split(",").filter(Boolean) : undefined}
        stemKeywordPhases={previewItem?.stemKeywordPhases ? previewItem.stemKeywordPhases.split(",").filter(Boolean) : undefined}
        readingPrefixDelay={previewItem?.readingPrefixDelay ?? undefined}
        readingSpeedRatio={previewItem?.readingSpeedRatio ?? undefined}
        panelAdjust={previewItem?.panelAdjust || undefined}
        panelAdjustValue={previewItem?.panelAdjustValue ?? undefined}
        subjectLabel={series?.category || undefined}
        pauseStart={(series?.pause_start as number) ?? 2.0}
        theme={(series?.theme as any) || "light"}
      />

      {/* 左侧题库 */}
      <div id="tour-question-bank" className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
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
            {[{ value: "all", label: "全部" }, { value: "1", label: "判断题" }, { value: "single", label: "单选题" }, { value: "multi", label: "多选题" }].map((t) => (
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
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${q.type === 1 ? "bg-amber-50 text-amber-600" : (q.correct_answer || "").length > 1 ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>{q.type === 1 ? "判断" : (q.correct_answer || "").length > 1 ? "多选" : "单选"}</span>
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
      <div id="tour-selected-list" className="flex-1 flex flex-col bg-gray-50/50 min-w-0">
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
          <div id="tour-batch-bar" className="flex items-center gap-2">
            <GuideTourButton page="editor" />
            <button id="tour-settings-btn" onClick={() => setShowSettings(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition" title="设置">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button id="tour-save-btn" onClick={saveToServer} disabled={saving} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
              {saving ? "保存中..." : "💾 保存"}
            </button>
            <button id="tour-tts-btn" onClick={() => generateTTS(true)} disabled={selected.length === 0 || generatingTTS}
              className="px-4 py-1.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >{generatingTTS ? "生成中..." : "🎙 生成语音"}</button>
            <button id="tour-render-btn" onClick={() => startRender(false)} disabled={!allReady || rendering || generatingTTS || !!renderTaskId}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >{rendering ? "提交中..." : renderTaskId ? "已提交" : "🎬 生成视频"}</button>
            <button onClick={() => startRender(true)} disabled={!allReady || rendering || generatingTTS || !!renderTaskId}
              className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >{rendering ? "提交中..." : renderTaskId ? "已提交" : "💡 只渲染技巧"}</button>
          </div>
        </div>

        {/* Select all */}
        {selected.length > 0 && (
          <div id="tour-select-all" className="px-6 py-2 border-b border-gray-100 bg-white flex items-center gap-3">
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
                    onAudioPreview={setAudioPreviewId}
                    onRegenerate={regenerateSingle}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="px-6 py-2.5 border-t border-gray-200 bg-white text-xs text-gray-400 flex items-center gap-4">
          <span>默认: 思考{defaultThinkTime}s · {defaultVoiceStyle}语气 · {series.theme || "light"}主题</span>
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
