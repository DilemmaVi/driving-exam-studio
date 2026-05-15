# Video Style Enhancements Design

## Overview

11 requirements to improve video rendering quality, focusing on readability for older learners, configurable animations, and flexible editing support.

## Approach: Grouped Fields + Theme Defaults

- Global style changes (font sizes, circle thickness, spacing) go directly into `theme.ts` — no per-series config needed
- Behavioral toggles and numeric values stored as independent DB columns on `video_series`
- Optional `style_overrides` JSON field for future per-series customization

---

## Part 1: Global Style Adjustments (Requirements 1, 10, 11.3)

### Font Size Changes in theme.ts

```
FONT.size:
  question: 62 → 68
  option:   52 → 58
  explanation: 44 → 50
  answer: new field, 40 (smaller than options to emphasize question area)
  title:  60 → 64
```

### RedCircle Thickness (Requirement 10)

- Main ellipse strokeWidth: 3.5 → 5.5
- Secondary ellipse strokeWidth: 1.5 → 2.5

### Layout Adjustment (Requirement 11.3)

- AnswerReveal font size: shrink to fixed 40px (was `option + 4 = 56`)
- QuestionHeader top padding: `SPACING.xl(48)` → `SPACING.lg(32)`
- Add `SPACING.md(24)` gap between question area and answer area
- Text lineHeight in answer area: 2 → 1.8

---

## Part 2: Underline Progress Effect (Requirements 3, 5)

### Mechanism

A colored underline extends left-to-right beneath text, synchronized with TTS audio duration.

### Implementation

Modify `BottomPanel` rendering:
- Calculate `progress = localFrame / readingDurationFrames`
- Render a pseudo-underline using `linear-gradient` on background:
  - `background-image: linear-gradient(to right, accentColor progress%, transparent progress%)`
  - `background-size: 100% 3px`
  - `background-position: bottom`
  - `background-repeat: no-repeat`

### Applied To

| Phase | Component | Notes |
|-------|-----------|-------|
| Reading question | BottomPanel | Combined with existing keyword highlighting |
| Reading answer | AnswerReveal | New: underline on answer text |
| Reading explanation | BottomPanel | New |
| Reading tip | BottomPanel | New |

### Config

| Field | Type | Default |
|-------|------|---------|
| `underline_progress_enabled` | INTEGER | 1 |

---

## Part 3: Keyword Flash + Answer Highlight (Requirements 5, 6)

### Keyword Flash (Requirement 6)

Modify `RedCircle` component:
- Extend flash duration: 20 frames → 36 frames (~1.2s)
- Softer pulse: opacity 1 → 0.4 → 1 → 0.4 → 1
- After flash ends, hold at opacity=1

Config: `keyword_flash_enabled` INTEGER default 1

### Answer Highlight (Requirement 5)

Enhance `AnswerReveal`:
- Correct answer letter: fontSize 48, fontWeight 800, color #16A34A (deeper green)
- Post-appear scale pulse: 1 → 1.08 → 1 over 15 frames
- In option list: correct option gets light green background + green left border

### Explanation Phase: Original Question Keywords (Requirement 11.2)

During explanation phase, display a mini reference of the original question above the explanation panel:
- Font size: ~70% of normal question font
- Keywords (from `【】` markers): rendered with yellow underline (`text-decoration-color: #F59E0B`) + bold
- Correct option: green left bar indicator
- Max height: 35% of frame, auto-shrink font if overflow

---

## Part 4: Teacher Avatar (Requirement 2)

### Format Support

- Static PNG (current)
- Lottie JSON animation (new, via `@remotion/lottie`)
- Auto-detect by file extension

### Config Fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `avatar_enabled` | INTEGER | 1 | Show/hide |
| `avatar_size` | INTEGER | 80 | Pixels (recommended small for animated) |
| `avatar_position` | TEXT | "bottom-right" | "bottom-right" or "bottom-left" |

### Text Avoidance

- Avatar shown only during question display + reading options phases
- Auto-hide when BottomPanel expands (explanation/tip phases) via existing `hideFrame`
- Text area reserves padding at avatar position

### Asset Management

Settings page: upload button accepting `.png` or `.json`, saves to `public/images/teacher-avatar.{ext}`.

---

## Part 5: Transition Page + Pause + Speed (Requirements 4, 7, 9)

### Transition Page (Requirement 7)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `show_transition` | INTEGER | 0 | Off by default |

When off: skip `QuestionTransition` sequence entirely, no TTS generated for "下面是第X题".

### Silence Pauses (Requirement 9)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `pause_start` | REAL | 2.0 | Seconds of silence at video start |
| `pause_end` | REAL | 2.0 | Seconds of silence at video end |
| `pause_before_tip` | REAL | 2.0 | Seconds of silence before tip reading |

Implementation:
- `pause_start`: insert blank frames before first question (hold IntroCard or first frame)
- `pause_end`: append blank frames after OutroCard
- `pause_before_tip`: insert blank frames before tip phase per question
- `questionDuration` and `calcCombinedDuration` include these values

### TTS Speed (Requirement 4)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `tts_speed` | TEXT | "medium" | "slow" / "medium" / "fast" |

Prompt mapping:
- slow → "语速稍慢，节奏从容"
- medium → "语速适中自然"
- fast → "语速比正常稍快"

Applied uniformly to all TTS generation (question, options, answer, explanation, tip).

---

## Part 6: Multi-Select + Explanation Layout (Requirements 8, 11)

### Reading Flow (Requirement 11.1)

Already implemented: question → options → explanation → correct answer. No change.

### Explanation Phase Layout (Requirement 11.2)

```
┌──────────────────────────────┐
│  [Original question - small] │  ~35% height
│  Keywords: yellow underline  │  Font: 70% of normal
│  Correct option: green bar   │
├──────────────────────────────┤
│  [Explanation content]       │  Normal explanation font
│  Blue underline progress     │  Synced with TTS
└──────────────────────────────┘
```

### Tone (Requirement 8)

No code change. TTS personality prompt remains: approachable, easy to understand, gentle, slightly playful.

---

## Part 7: Database Schema + Settings UI

### New Columns on video_series

```sql
ALTER TABLE video_series ADD COLUMN show_transition INTEGER DEFAULT 0;
ALTER TABLE video_series ADD COLUMN pause_start REAL DEFAULT 2.0;
ALTER TABLE video_series ADD COLUMN pause_end REAL DEFAULT 2.0;
ALTER TABLE video_series ADD COLUMN pause_before_tip REAL DEFAULT 2.0;
ALTER TABLE video_series ADD COLUMN tts_speed TEXT DEFAULT 'medium';
ALTER TABLE video_series ADD COLUMN keyword_flash_enabled INTEGER DEFAULT 1;
ALTER TABLE video_series ADD COLUMN underline_progress_enabled INTEGER DEFAULT 1;
ALTER TABLE video_series ADD COLUMN avatar_enabled INTEGER DEFAULT 1;
ALTER TABLE video_series ADD COLUMN avatar_size INTEGER DEFAULT 80;
ALTER TABLE video_series ADD COLUMN avatar_position TEXT DEFAULT 'bottom-right';
```

### Settings Modal Tabs

**语音设置 (expanded)**
- 语速: dropdown (稍慢 / 适中 / 稍快)
- Existing: 单选读选项内容, 多选读选项内容

**播放控制 (new)**
- 显示过场页: toggle, default off
- 视频开头停顿: number input (seconds)
- 视频结尾停顿: number input (seconds)
- 技巧前停顿: number input (seconds)

**动画效果 (new)**
- 朗读下划线进度: toggle, default on
- 关键字闪动: toggle, default on

**头像设置 (new)**
- 显示头像: toggle, default on
- 头像大小: slider (60~150px)
- 头像位置: dropdown (右下角 / 左下角)
- 上传头像素材: file upload (.png / .json)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/remotion/theme.ts` | Font sizes, spacing adjustments |
| `src/remotion/RedCircle.tsx` | Stroke width, flash duration/style |
| `src/remotion/BottomPanel.tsx` | Underline progress, explanation layout with original question |
| `src/remotion/AnswerReveal.tsx` | Shrink font, enhance highlight, add underline |
| `src/remotion/TeacherAvatar.tsx` | Lottie support, size/position from props |
| `src/remotion/DynamicCombinedExam.tsx` | Pause frames, transition toggle, pass new props |
| `src/remotion/QuestionTransition.tsx` | Conditional rendering based on config |
| `src/remotion/MultipleChoice.tsx` | Correct option green highlight on reveal |
| `src/lib/db.ts` | Migration for new columns |
| `src/lib/tts.ts` | Speed config mapping |
| `src/app/api/render/route.ts` | Pass new config to Remotion props |
| `src/app/api/series/[id]/route.ts` | New field mappings |
| `src/components/SettingsModal.tsx` | New tabs and controls |
| `package.json` | Add `@remotion/lottie` dependency |
