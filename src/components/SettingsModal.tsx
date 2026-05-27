"use client";
import { useState, useEffect, useRef } from "react";
import { Player } from "@remotion/player";
import { IntroCard } from "@/remotion/IntroCard";
import { OutroCard } from "@/remotion/OutroCard";
import { StylePreview } from "./StylePreview";

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
  intro_enabled?: number;
  outro_enabled?: number;
  intro_duration?: number;
  outro_duration?: number;
  show_transition?: number;
  pause_start?: number;
  pause_end?: number;
  pause_before_tip?: number;
  tts_speed?: string;
  tts_voice?: string;
  keyword_flash_enabled?: number;
  underline_progress_enabled?: number;
  underline_question?: number;
  underline_option?: number;
  underline_explanation?: number;
  underline_tip?: number;
  underline_color?: string;
  avatar_enabled?: number;
  split_render?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  series: SeriesData | null;
  onSave: (updates: Record<string, unknown>) => void;
}

const TABS = ["基本信息", "视频风格", "语音设置", "播放控制", "动画效果", "水印"] as const;

export function SettingsModal({ open, onClose, series, onSave }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("基本信息");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.xiaomimimo.com/v1");
  const [ttsModel, setTtsModel] = useState("mimo-v2.5-tts");
  const [saving, setSaving] = useState(false);

  // Basic
  const [introTitle, setIntroTitle] = useState("");
  const [introSubtitle, setIntroSubtitle] = useState("");
  const [category, setCategory] = useState("");

  // Style
  const [theme, setTheme] = useState("light");
  const [fontScale, setFontScale] = useState(1.0);
  const [avatarPosition, setAvatarPosition] = useState("bottom-right");
  const [avatarSize, setAvatarSize] = useState(260);
  const [keywordStyle, setKeywordStyle] = useState("circle");
  const [panelHeight, setPanelHeight] = useState(48);
  const [panelSuffix, setPanelSuffix] = useState("全安驾考");

  // Voice
  const [defaultThinkTime, setDefaultThinkTime] = useState(3);
  const [defaultVoiceStyle, setDefaultVoiceStyle] = useState("教学");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [readOptions, setReadOptions] = useState(999);
  const [bridgeThink, setBridgeThink] = useState("");
  const [bridgeReveal, setBridgeReveal] = useState("");
  const [bridgeExplain, setBridgeExplain] = useState("");
  const [bridgeTip, setBridgeTip] = useState("");
  const [answerReadOption, setAnswerReadOption] = useState(1);
  const [answerReadMulti, setAnswerReadMulti] = useState(0);
  const [bridgeThinkEnabled, setBridgeThinkEnabled] = useState(1);
  const [bridgeRevealEnabled, setBridgeRevealEnabled] = useState(1);
  const [bridgeExplainEnabled, setBridgeExplainEnabled] = useState(1);
  const [bridgeTipEnabled, setBridgeTipEnabled] = useState(1);
  const [outroText, setOutroText] = useState("");
  const [outroSubtitle, setOutroSubtitle] = useState("");
  const [introEnabled, setIntroEnabled] = useState(0);
  const [outroEnabled, setOutroEnabled] = useState(0);
  const [introDuration, setIntroDuration] = useState(4.0);
  const [introLogo, setIntroLogo] = useState("");
  const [outroDuration, setOutroDuration] = useState(4.0);
  const [showIntroPreview, setShowIntroPreview] = useState(false);
  const [showOutroPreview, setShowOutroPreview] = useState(false);

  // Playback control
  const [showTransition, setShowTransition] = useState(0);
  const [pauseStart, setPauseStart] = useState(2.0);
  const [pauseEnd, setPauseEnd] = useState(2.0);
  const [pauseBeforeTip, setPauseBeforeTip] = useState(2.0);
  const [ttsSpeed, setTtsSpeed] = useState("medium");
  const [ttsVoice, setTtsVoice] = useState("冰糖");
  const [voicePreviewing, setVoicePreviewing] = useState(false);
  const [tfOptGenerating, setTfOptGenerating] = useState(false);
  const [tfOptReady, setTfOptReady] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Animation effects
  const [keywordFlashEnabled, setKeywordFlashEnabled] = useState(1);
  const [underlineProgressEnabled, setUnderlineProgressEnabled] = useState(0);
  const [underlineQuestion, setUnderlineQuestion] = useState(0);
  const [underlineOption, setUnderlineOption] = useState(0);
  const [underlineExplanation, setUnderlineExplanation] = useState(0);
  const [underlineTip, setUnderlineTip] = useState(0);
  const [underlineColor, setUnderlineColor] = useState("#6366F1");

  // Avatar
  const [avatarEnabled, setAvatarEnabled] = useState(1);

  // Render
  const [splitRender, setSplitRender] = useState(0);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkFontSize, setWatermarkFontSize] = useState(36);
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState("");
  const [watermarkScale, setWatermarkScale] = useState(100);
  const [watermarkColor, setWatermarkColor] = useState("#ffffff");
  const [watermarkFont, setWatermarkFont] = useState("default");
  const [watermarkStroke, setWatermarkStroke] = useState(true);
  const [watermarkLogoGrayscale, setWatermarkLogoGrayscale] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/settings").then((r) => r.json()).then((d) => {
        setMaskedKey(d.mimoApiKey || "");
        setBaseUrl(d.mimoBaseUrl || "https://api.xiaomimimo.com/v1");
        setTtsModel(d.mimoTtsModel || "mimo-v2.5-tts");
        setWatermarkEnabled(!!d.watermarkEnabled);
        setWatermarkText(d.watermarkText || "");
        setWatermarkPosition(d.watermarkPosition || "bottom-right");
        setWatermarkOpacity(d.watermarkOpacity ?? 30);
        setWatermarkFontSize(d.watermarkFontSize ?? 36);
        setWatermarkLogoUrl(d.watermarkLogoUrl || "");
        setWatermarkScale(d.watermarkScale ?? 100);
        setWatermarkColor(d.watermarkColor || "#ffffff");
        setWatermarkFont(d.watermarkFont || "default");
        setWatermarkStroke(d.watermarkStroke !== false);
        setWatermarkLogoGrayscale(d.watermarkLogoGrayscale || false);
      });
      if (series) {
        setIntroTitle(series.intro_title || "");
        setIntroSubtitle(series.intro_subtitle || "");
        setCategory(series.category || "");
        setTheme(series.theme || "light");
        setFontScale(series.font_scale ?? 1.0);
        setAvatarPosition(series.avatar_position || "bottom-right");
        setAvatarSize(series.avatar_size ?? 260);
        setKeywordStyle(series.keyword_style || "circle");
        setPanelHeight(series.panel_height ?? 48);
        setPanelSuffix((series as any).panel_suffix ?? "全安驾考");
        setDefaultThinkTime(series.default_think_time ?? 3);
        setDefaultVoiceStyle(series.default_voice_style || "教学");
        setSpeechRate(series.speech_rate ?? 1.0);
        setReadOptions(series.read_options ?? 999);
        setBridgeThink(series.bridge_think || "");
        setBridgeReveal(series.bridge_reveal || "");
        setBridgeExplain(series.bridge_explain || "");
        setBridgeTip(series.bridge_tip || "");
        setAnswerReadOption(series.answer_read_option ?? 1);
        setAnswerReadMulti(series.answer_read_multi ?? 0);
        setBridgeThinkEnabled(series.bridge_think_enabled ?? 1);
        setBridgeRevealEnabled(series.bridge_reveal_enabled ?? 1);
        setBridgeExplainEnabled(series.bridge_explain_enabled ?? 1);
        setBridgeTipEnabled(series.bridge_tip_enabled ?? 1);
        setOutroText(series.outro_text || "");
        setOutroSubtitle(series.outro_subtitle || "");
        setIntroEnabled(Number(series.intro_enabled ?? 0));
        setOutroEnabled(Number(series.outro_enabled ?? 0));
        setIntroDuration(Number(series.intro_duration ?? 4.0));
        setOutroDuration(Number(series.outro_duration ?? 4.0));
        setIntroLogo((series as any).intro_logo || "");
        setShowTransition(series.show_transition ?? 0);
        setPauseStart(series.pause_start ?? 2.0);
        setPauseEnd(series.pause_end ?? 2.0);
        setPauseBeforeTip(series.pause_before_tip ?? 2.0);
        setTtsSpeed(series.tts_speed || "medium");
        setTtsVoice(series.tts_voice || "冰糖");
        setKeywordFlashEnabled(series.keyword_flash_enabled ?? 1);
        setUnderlineProgressEnabled(Number(series.underline_progress_enabled ?? 0));
        setUnderlineQuestion(Number(series.underline_question ?? 0));
        setUnderlineOption(Number(series.underline_option ?? 0));
        setUnderlineExplanation(Number(series.underline_explanation ?? 0));
        setUnderlineTip(Number(series.underline_tip ?? 0));
        setUnderlineColor(series.underline_color || "#6366F1");
        setAvatarEnabled(series.avatar_enabled ?? 1);
        setSplitRender(series.split_render ?? 0);
      }
    }
  }, [open, series]);

  const save = async () => {
    setSaving(true);
    if (apiKey.trim()) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimoApiKey: apiKey.trim(), mimoBaseUrl: baseUrl, mimoTtsModel: ttsModel, watermarkEnabled, watermarkText, watermarkPosition, watermarkOpacity, watermarkFontSize, watermarkLogoUrl, watermarkScale, watermarkColor, watermarkFont, watermarkStroke, watermarkLogoGrayscale }),
      });
      setMaskedKey("sk-****" + apiKey.trim().slice(-6));
      setApiKey("");
    } else {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimoBaseUrl: baseUrl, mimoTtsModel: ttsModel, watermarkEnabled, watermarkText, watermarkPosition, watermarkOpacity, watermarkFontSize, watermarkLogoUrl, watermarkScale, watermarkColor, watermarkFont, watermarkStroke, watermarkLogoGrayscale }),
      });
    }
    onSave({
      introTitle, introSubtitle, category,
      theme, fontScale, avatarPosition, avatarSize, keywordStyle, panelHeight, panelSuffix,
      defaultThinkTime, defaultVoiceStyle, speechRate, readOptions,
      answerReadOption, answerReadMulti,
      bridgeThinkEnabled, bridgeRevealEnabled, bridgeExplainEnabled, bridgeTipEnabled,
      outroText: outroText || undefined, outroSubtitle: outroSubtitle || undefined,
      introEnabled, outroEnabled, introDuration, outroDuration, introLogo,
      bridgeThink: bridgeThink || undefined,
      bridgeReveal: bridgeReveal || undefined,
      bridgeExplain: bridgeExplain || undefined,
      bridgeTip: bridgeTip || undefined,
      showTransition,
      pauseStart,
      pauseEnd,
      pauseBeforeTip,
      ttsSpeed,
      ttsVoice,
      keywordFlashEnabled,
      underlineProgressEnabled,
      underlineQuestion,
      underlineOption,
      underlineExplanation,
      underlineTip,
      underlineColor,
      avatarEnabled: avatarPosition === "none" ? 0 : 1,
      splitRender,
    });
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div id="tour-settings-modal" className={`bg-white rounded-xl shadow-xl max-h-[80vh] flex flex-col transition-all ${tab === "视频风格" ? "w-[920px]" : "w-[680px]"}`} onClick={(e) => e.stopPropagation()}>
        {/* Tab header */}
        <div id="tour-settings-tabs" className="flex flex-wrap gap-1 border-b border-gray-200 px-6 pt-4 pb-1">
          {TABS.map((t) => (
            <button key={t} id={`tour-settings-tab-${t}`} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >{t}</button>
          ))}
        </div>

        {/* Tab body */}
        <div className={`flex-1 overflow-y-auto ${tab === "视频风格" ? "flex gap-6" : ""}`}>
          <div className={`p-6 space-y-4 ${tab === "视频风格" ? "flex-1 min-w-0 overflow-y-auto" : ""}`}>
          {tab === "基本信息" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">片头片尾 Logo</label>
                <div className="flex items-center gap-3">
                  {introLogo && (
                    <img src={introLogo} alt="logo" className="w-12 h-12 object-contain rounded border" />
                  )}
                  <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5">
                    {introLogo ? "更换" : "上传 Logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("type", "intro-logo");
                      const res = await fetch("/api/upload", { method: "POST", body: formData });
                      const data = await res.json();
                      if (data.url) setIntroLogo(data.url);
                    }} />
                  </label>
                  {introLogo && (
                    <button type="button" onClick={() => setIntroLogo("")} className="text-xs text-red-500 hover:text-red-600">移除</button>
                  )}
                  {!introLogo && <span className="text-xs text-gray-400">未设置时使用默认品牌 Logo</span>}
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={introEnabled === 1} onChange={(e) => setIntroEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                  启用片头
                </label>
                {introEnabled === 1 && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">片头标题</label>
                      <input value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">片头副标题</label>
                      <input value={introSubtitle} onChange={(e) => setIntroSubtitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">片头时长（秒）</label>
                      <input type="number" min={2} max={15} step={0.5} value={introDuration} onChange={(e) => setIntroDuration(Number(e.target.value))} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={() => setShowIntroPreview(true)} className="text-xs px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition">
                      预览片头
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类标签</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如: 交通标志" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <hr />
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={outroEnabled === 1} onChange={(e) => setOutroEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                  启用片尾
                </label>
                {outroEnabled === 1 && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">片尾标题</label>
                      <input value={outroText} onChange={(e) => setOutroText(e.target.value)} placeholder="如: 关注我，带你轻松过驾考" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">片尾副标题</label>
                      <input value={outroSubtitle} onChange={(e) => setOutroSubtitle(e.target.value)} placeholder="如: 每天5题，轻松拿证" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">片尾时长（秒）</label>
                      <input type="number" min={2} max={15} step={0.5} value={outroDuration} onChange={(e) => setOutroDuration(Number(e.target.value))} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={() => setShowOutroPreview(true)} className="text-xs px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition">
                      预览片尾
                    </button>
                  </div>
                )}
              </div>
              <hr />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MIMO API Key</label>
                {maskedKey && <p className="text-xs text-gray-500 mb-2">当前: {maskedKey}</p>}
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="输入新的 API Key..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.xiaomimimo.com/v1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">默认: https://api.xiaomimimo.com/v1</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TTS 模型</label>
                <input value={ttsModel} onChange={(e) => setTtsModel(e.target.value)} placeholder="mimo-v2.5-tts" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">默认: mimo-v2.5-tts</p>
              </div>
            </>
          )}

          {tab === "视频风格" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">主题风格</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "light", label: "清新浅色", color: "from-gray-100 to-white", text: "text-gray-800" },
                    { value: "eye-care", label: "护眼绿色", color: "from-green-100 to-green-50", text: "text-green-800" },
                    { value: "gradient", label: "时尚渐变", color: "from-purple-900 to-indigo-900", text: "text-white" },
                  ] as const).map((t) => (
                    <button key={t.value} onClick={() => setTheme(t.value)}
                      className={`rounded-xl p-3 border-2 transition ${theme === t.value ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"}`}
                    >
                      <div className={`h-16 rounded-lg bg-gradient-to-br ${t.color} mb-2 flex items-center justify-center`}>
                        <span className={`text-xs font-medium ${t.text}`}>Aa</span>
                      </div>
                      <span className="text-xs font-medium text-gray-700">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">字体大小</label>
                <div className="flex gap-2">
                  {[{ v: 0, l: "自适应" }, { v: 0.85, l: "小" }, { v: 1.0, l: "中" }, { v: 1.15, l: "大" }, { v: 1.3, l: "超大" }].map(({ v, l }) => (
                    <button key={v} onClick={() => setFontScale(v)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition ${fontScale === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">头像位置</label>
                  <select value={avatarPosition} onChange={(e) => setAvatarPosition(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="bottom-right">右下角</option>
                    <option value="bottom-left">左下角</option>
                    <option value="none">不显示</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">头像大小</label>
                  <input type="range" min={160} max={360} step={20} value={avatarSize} onChange={(e) => setAvatarSize(Number(e.target.value))} className="w-full" />
                  <span className="text-xs text-gray-500">{avatarSize}px</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">关键词样式</label>
                <div className="flex gap-2">
                  {[{ v: "circle", l: "红圈" }, { v: "underline", l: "下划线" }, { v: "highlight-bg", l: "高亮底色" }].map(({ v, l }) => (
                    <button key={v} onClick={() => setKeywordStyle(v)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition ${keywordStyle === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">底部面板高度</label>
                <div className="flex gap-2">
                  {[{ v: 0, l: "自适应" }, { v: 38, l: "小" }, { v: 48, l: "中" }, { v: 58, l: "大" }].map(({ v, l }) => (
                    <button key={v} onClick={() => setPanelHeight(v)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition ${panelHeight === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">面板标题后缀</label>
                <input value={panelSuffix} onChange={(e) => setPanelSuffix(e.target.value)} placeholder="如：全安驾考（留空则不显示）" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">设置后显示为「答题解析-全安驾考」「答题技巧-全安驾考」</p>
              </div>
            </>
          )}

          {tab === "语音设置" && (
            <>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">语速</label>
                  <select value={ttsSpeed} onChange={(e) => setTtsSpeed(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="slow">稍慢</option>
                    <option value="medium">适中</option>
                    <option value="fast">稍快</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">音色</label>
                  <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <optgroup label="中文">
                      <option value="冰糖">冰糖（女声）</option>
                      <option value="茉莉">茉莉（女声）</option>
                      <option value="苏打">苏打（男声）</option>
                      <option value="白桦">白桦（男声）</option>
                    </optgroup>
                    <optgroup label="English">
                      <option value="Mia">Mia (Female)</option>
                      <option value="Chloe">Chloe (Female)</option>
                      <option value="Milo">Milo (Male)</option>
                      <option value="Dean">Dean (Male)</option>
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    disabled={voicePreviewing}
                    onClick={async () => {
                      setVoicePreviewing(true);
                      try {
                        if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
                        const res = await fetch("/api/tts/sample", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ voice: ttsVoice, speed: ttsSpeed }),
                        });
                        if (!res.ok) throw new Error(await res.text());
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        previewAudioRef.current = audio;
                        audio.onended = () => URL.revokeObjectURL(url);
                        audio.play();
                      } catch (e) { alert("试听失败: " + (e instanceof Error ? e.message : e)); }
                      setVoicePreviewing(false);
                    }}
                    className="mt-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    {voicePreviewing ? "加载中..." : "▶ 试听"}
                  </button>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">默认思考时间</label>
                  <select value={defaultThinkTime} onChange={(e) => setDefaultThinkTime(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <option key={v} value={v}>{v}秒</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">默认语音风格</label>
                  <select value={defaultVoiceStyle} onChange={(e) => setDefaultVoiceStyle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="教学">教学</option>
                    <option value="轻快">轻快</option>
                    <option value="权威">权威</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">语速</label>
                  <input type="range" min={0.8} max={1.3} step={0.1} value={speechRate} onChange={(e) => setSpeechRate(Number(e.target.value))} className="w-full" />
                  <span className="text-xs text-gray-500">{speechRate}x</span>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">选项朗读</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => setReadOptions(999)} className={`px-3 py-1.5 rounded-lg text-sm border ${readOptions === 999 ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}>总是读</button>
                    <button onClick={() => setReadOptions(0)} className={`px-3 py-1.5 rounded-lg text-sm border ${readOptions === 0 ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}>不读</button>
                    <button onClick={() => setReadOptions(readOptions > 0 && readOptions < 999 ? readOptions : 20)} className={`px-3 py-1.5 rounded-lg text-sm border ${readOptions > 0 && readOptions < 999 ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}>按字数</button>
                  </div>
                  {readOptions > 0 && readOptions < 999 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">题干超过</span>
                      <input type="number" min={5} max={200} value={readOptions}
                        onChange={(e) => setReadOptions(Math.max(1, Number(e.target.value)))}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"
                      />
                      <span className="text-xs text-gray-500">字则不读选项</span>
                    </div>
                  )}
                </div>
              </div>
              <hr />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">答案朗读</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={answerReadOption === 1} onChange={(e) => setAnswerReadOption(e.target.checked ? 1 : 0)} className="rounded" />
                    单选题读选项内容
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={answerReadMulti === 1} onChange={(e) => setAnswerReadMulti(e.target.checked ? 1 : 0)} className="rounded" />
                    多选题读选项内容
                  </label>
                </div>
              </div>
              <hr />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">判断题选项语音</label>
                <p className="text-xs text-gray-500 mb-2">判断题的"正确""错误"选项语音全局共用，可在此重新生成和试听</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={tfOptGenerating}
                    onClick={async () => {
                      setTfOptGenerating(true);
                      try {
                        const res = await fetch("/api/tts/tf-options", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ speed: ttsSpeed, voice: ttsVoice, force: true }),
                        });
                        if (!res.ok) throw new Error(await res.text());
                        setTfOptReady(true);
                      } catch (e) { alert("生成失败: " + (e instanceof Error ? e.message : e)); }
                      setTfOptGenerating(false);
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    {tfOptGenerating ? "生成中..." : "🔄 重新生成"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
                        const res = await fetch(`/api/tts/tf-options?index=0&speed=${ttsSpeed}&voice=${ttsVoice}`);
                        if (!res.ok) { alert("请先生成语音"); return; }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        previewAudioRef.current = audio;
                        audio.onended = () => URL.revokeObjectURL(url);
                        audio.play();
                      } catch {}
                    }}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    ▶ 试听"正确"
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
                        const res = await fetch(`/api/tts/tf-options?index=1&speed=${ttsSpeed}&voice=${ttsVoice}`);
                        if (!res.ok) { alert("请先生成语音"); return; }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        previewAudioRef.current = audio;
                        audio.onended = () => URL.revokeObjectURL(url);
                        audio.play();
                      } catch {}
                    }}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    ▶ 试听"错误"
                  </button>
                </div>
              </div>
              <hr />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">过渡话术</label>
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={bridgeThinkEnabled === 1} onChange={(e) => setBridgeThinkEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                    读题后衔接
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={bridgeRevealEnabled === 1} onChange={(e) => setBridgeRevealEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                    揭示答案前
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={bridgeExplainEnabled === 1} onChange={(e) => setBridgeExplainEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                    进入解析前
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={bridgeTipEnabled === 1} onChange={(e) => setBridgeTipEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                    进入技巧前
                  </label>
                </div>
                <label className="block text-xs text-gray-500 mb-2">自定义话术（留空使用默认值）</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">读题后</label>
                    <input value={bridgeThink} onChange={(e) => setBridgeThink(e.target.value)} placeholder="大家先想一想" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">揭示答案前</label>
                    <input value={bridgeReveal} onChange={(e) => setBridgeReveal(e.target.value)} placeholder="好，公布答案" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">进入解读前</label>
                    <input value={bridgeExplain} onChange={(e) => setBridgeExplain(e.target.value)} placeholder="我们来看一下为什么" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">进入技巧前</label>
                    <input value={bridgeTip} onChange={(e) => setBridgeTip(e.target.value)} placeholder="记住这个小技巧" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "播放控制" && (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={splitRender === 1} onChange={(e) => setSplitRender(e.target.checked ? 1 : 0)} className="rounded" />
                  逐题渲染（每道题生成独立视频，打包 zip 下载）
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showTransition === 1} onChange={(e) => setShowTransition(e.target.checked ? 1 : 0)} className="rounded" />
                  显示过场页（想一想）
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">视频开头停顿（秒）</label>
                <input type="number" min={0} max={10} step={0.5} value={pauseStart} onChange={(e) => setPauseStart(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">视频结尾停顿（秒）</label>
                <input type="number" min={0} max={10} step={0.5} value={pauseEnd} onChange={(e) => setPauseEnd(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">技巧前停顿（秒）</label>
                <input type="number" min={0} max={10} step={0.5} value={pauseBeforeTip} onChange={(e) => setPauseBeforeTip(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {tab === "动画效果" && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">朗读下划线进度</h4>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={underlineQuestion === 1} onChange={(e) => setUnderlineQuestion(e.target.checked ? 1 : 0)} className="rounded" />
                    题干
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={underlineOption === 1} onChange={(e) => setUnderlineOption(e.target.checked ? 1 : 0)} className="rounded" />
                    选项
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={underlineExplanation === 1} onChange={(e) => setUnderlineExplanation(e.target.checked ? 1 : 0)} className="rounded" />
                    解析
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={underlineTip === 1} onChange={(e) => setUnderlineTip(e.target.checked ? 1 : 0)} className="rounded" />
                    技巧
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">下划线颜色</label>
                  <input type="color" value={underlineColor} onChange={(e) => setUnderlineColor(e.target.value)} className="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
                  <span className="text-xs text-gray-400">{underlineColor}</span>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={keywordFlashEnabled === 1} onChange={(e) => setKeywordFlashEnabled(e.target.checked ? 1 : 0)} className="rounded" />
                  关键字闪动
                </label>
              </div>
            </>
          )}

          {tab === "水印" && (
            <>
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={watermarkEnabled} onChange={(e) => setWatermarkEnabled(e.target.checked)} className="rounded" />
                  <span className="font-medium text-gray-700">启用水印</span>
                </label>
                {watermarkEnabled && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">品牌 Logo</label>
                      <div className="flex items-center gap-3">
                        {watermarkLogoUrl && (
                          <img src={watermarkLogoUrl} alt="logo" className="w-10 h-10 object-contain rounded border" />
                        )}
                        <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5">
                          {watermarkLogoUrl ? "更换" : "上传 Logo"}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append("file", file);
                            formData.append("type", "watermark-logo");
                            const res = await fetch("/api/upload", { method: "POST", body: formData });
                            const data = await res.json();
                            if (data.url) setWatermarkLogoUrl(data.url);
                          }} />
                        </label>
                        {watermarkLogoUrl && (
                          <button type="button" onClick={() => setWatermarkLogoUrl("")} className="text-xs text-red-500 hover:text-red-600">移除</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">水印文案</label>
                      <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="如：全安驾考" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-600 mb-1">字体风格</label>
                        <select value={watermarkFont} onChange={(e) => setWatermarkFont(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                          <option value="default">黑体（默认）</option>
                          <option value="bold">粗黑体</option>
                          <option value="serif">宋体</option>
                          <option value="kai">楷体</option>
                          <option value="rounded">圆体</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">文字颜色</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={watermarkColor} onChange={(e) => setWatermarkColor(e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
                          <div className="flex gap-1">
                            {["#ffffff", "#FFD700", "#00E5FF", "#FF6B6B", "#A78BFA"].map(c => (
                              <button key={c} type="button" onClick={() => setWatermarkColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${watermarkColor === c ? "border-blue-500 scale-110" : "border-gray-200"}`}
                                style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={watermarkStroke} onChange={(e) => setWatermarkStroke(e.target.checked)} className="rounded" />
                      <span className="text-gray-600">文字描边（增强可读性）</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={watermarkLogoGrayscale} onChange={(e) => setWatermarkLogoGrayscale(e.target.checked)} className="rounded" />
                      <span className="text-gray-600">Logo 灰度化（降低视觉干扰）</span>
                    </label>
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">位置</label>
                      <div className="grid grid-cols-3 gap-1.5 w-40">
                        {(["top-left","top-center","top-right","center-left","center","center-right","bottom-left","bottom-center","bottom-right"] as const).map((pos) => (
                          <button key={pos} type="button" onClick={() => setWatermarkPosition(pos)}
                            className={`w-11 h-9 rounded text-xs border transition-all ${watermarkPosition === pos ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-400 border-gray-200 hover:border-blue-300"}`}>
                            {pos === watermarkPosition ? "●" : "○"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">透明度 ({watermarkOpacity}%)</label>
                      <input type="range" min={10} max={100} value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">整体缩放 ({watermarkScale}%)</label>
                      <input type="range" min={30} max={400} value={watermarkScale} onChange={(e) => setWatermarkScale(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">文字大小 ({watermarkFontSize}px)</label>
                      <input type="range" min={16} max={80} value={watermarkFontSize} onChange={(e) => setWatermarkFontSize(Number(e.target.value))} className="w-full" />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          </div>
          {tab === "视频风格" && (
            <div className="flex-shrink-0 p-6 pl-0 flex flex-col items-center gap-3">
              <span className="text-xs font-medium text-gray-500">实时预览</span>
              <StylePreview
                theme={theme}
                fontScale={fontScale}
                avatarPosition={avatarPosition}
                avatarSize={avatarSize}
                keywordStyle={keywordStyle}
                panelHeight={panelHeight}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">取消</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {showIntroPreview && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center" onClick={() => setShowIntroPreview(false)}>
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <span className="text-sm text-gray-300">预览片头</span>
              <button onClick={() => setShowIntroPreview(false)} className="text-gray-400 hover:text-white text-lg">×</button>
            </div>
            <Player
              key={`intro-preview-${introTitle}-${introDuration}`}
              component={IntroCard}
              inputProps={{ title: introTitle || series?.name || "", subtitle: introSubtitle, category, audioServerUrl: "/api", sequenceDuration: Math.ceil(introDuration * 30), theme: theme as any, logoUrl: introLogo || undefined }}
              durationInFrames={Math.ceil(introDuration * 30)}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              style={{ width: 270, height: 480 }}
              controls
              autoPlay
            />
          </div>
        </div>
      )}

      {showOutroPreview && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center" onClick={() => setShowOutroPreview(false)}>
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <span className="text-sm text-gray-300">预览片尾</span>
              <button onClick={() => setShowOutroPreview(false)} className="text-gray-400 hover:text-white text-lg">×</button>
            </div>
            <Player
              key={`outro-preview-${outroText}-${outroDuration}-${theme}`}
              component={OutroCard}
              inputProps={{ title: outroText || "片尾标题", subtitle: outroSubtitle, audioServerUrl: "/api", theme: theme as any, logoUrl: introLogo || undefined }}
              durationInFrames={Math.ceil(outroDuration * 30)}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              style={{ width: 270, height: 480 }}
              controls
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
}
