# Video Style Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 11 visual/audio enhancements to improve video readability for older learners, add configurable animations, and support post-production editing workflows.

**Architecture:** Global style changes in theme.ts, behavioral toggles as DB columns on video_series, new Remotion animation components for underline progress and Lottie avatar. All config flows through render API → Remotion props.

**Tech Stack:** Remotion 4, React 19, Next.js 16, better-sqlite3, @remotion/lottie (new dep)

---

## File Structure

| File | Role |
|------|------|
| `src/remotion/theme.ts` | Global font sizes, spacing constants |
| `src/remotion/RedCircle.tsx` | Keyword circle with configurable flash |
| `src/remotion/BottomPanel.tsx` | Text panel with underline progress + explanation layout |
| `src/remotion/AnswerReveal.tsx` | Answer display with highlight + underline |
| `src/remotion/TeacherAvatar.tsx` | Avatar with Lottie support |
| `src/remotion/DynamicCombinedExam.tsx` | Composition: pauses, transition toggle |
| `src/remotion/QuestionTransition.tsx` | Conditional transition page |
| `src/remotion/MultipleChoice.tsx` | Correct option green highlight |
| `src/remotion/TrueFalseQuestion.tsx` | Pass new props |
| `src/remotion/ScrollableQuestion.tsx` | Pass new props |
| `src/lib/db.ts` | Migration for new columns |
| `src/lib/tts.ts` | Speed config, cache key update, transition gate |
| `src/app/api/render/route.ts` | Pass new config to Remotion props |
| `src/app/api/series/[id]/route.ts` | New field mappings |
| `src/components/SettingsModal.tsx` | New tabs and controls |
| `src/remotion/types.ts` | Extended QuestionEntry type with new fields |

---

### Task 1: Database Migration + API Layer

**Files:**
- Modify: `src/lib/db.ts` (add new migration block ~line 208)
- Modify: `src/app/api/series/[id]/route.ts` (add colMap entries)

- [ ] **Step 1: Add new columns migration in db.ts**

After the existing `newVsCols` migration block (~line 208), add:

```typescript
// migrate: add style enhancement columns to video_series
const vsColsV3 = db.prepare("PRAGMA table_info(video_series)").all() as { name: string }[];
const styleEnhanceCols: [string, string][] = [
  ["show_transition", "INTEGER DEFAULT 0"],
  ["pause_start", "REAL DEFAULT 2.0"],
  ["pause_end", "REAL DEFAULT 2.0"],
  ["pause_before_tip", "REAL DEFAULT 2.0"],
  ["tts_speed", "TEXT DEFAULT 'medium'"],
  ["keyword_flash_enabled", "INTEGER DEFAULT 1"],
  ["underline_progress_enabled", "INTEGER DEFAULT 1"],
  ["avatar_enabled", "INTEGER DEFAULT 1"],
];
for (const [col, typedef] of styleEnhanceCols) {
  if (!vsColsV3.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE video_series ADD COLUMN ${col} ${typedef}`);
  }
}
```

Note: `avatar_size` and `avatar_position` already exist from prior migration. Update `avatar_size` default from 260 to 80 for new rows is not needed (existing rows keep their value; UI will show slider capped at 150).

- [ ] **Step 2: Add colMap entries in series API**

In `src/app/api/series/[id]/route.ts`, add to `colMap`:

```typescript
showTransition: "show_transition",
pauseStart: "pause_start",
pauseEnd: "pause_end",
pauseBeforeTip: "pause_before_tip",
ttsSpeed: "tts_speed",
keywordFlashEnabled: "keyword_flash_enabled",
underlineProgressEnabled: "underline_progress_enabled",
avatarEnabled: "avatar_enabled",
```

- [ ] **Step 3: Verify by starting dev server**

Run: `npm run dev`
Visit settings, confirm no crash. Check DB has new columns via sqlite3 or API response.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/app/api/series/*/route.ts
git commit -m "feat: add style enhancement DB columns and API mappings"
```

---

### Task 2: Global Theme + RedCircle Adjustments

**Files:**
- Modify: `src/remotion/theme.ts`
- Modify: `src/remotion/RedCircle.tsx`

- [ ] **Step 1: Update font sizes in theme.ts**

```typescript
size: {
  badge: 32,
  label: 36,
  tip: 42,
  explanation: 50,   // was 44
  option: 58,        // was 52
  question: 68,      // was 62
  title: 64,         // was 60
  number: 88,
  answer: 40,        // NEW - smaller for answer area
},
```

- [ ] **Step 2: Update RedCircle stroke width and flash**

Replace the flash logic and SVG strokes:

```tsx
export const RedCircle: React.FC<Props> = ({ children, appearFrame, flashEnabled = true }) => {
  const frame = useCurrentFrame();

  let filterVal = "brightness(1)";
  if (flashEnabled && appearFrame !== undefined) {
    const localF = frame - appearFrame;
    if (localF >= 0 && localF < 36) {
      // 5 pulses over 36 frames
      const t = (localF / 36) * Math.PI * 4;
      const brightness = 1 + Math.cos(t) * 0.3;
      filterVal = `brightness(${brightness})`;
    }
  }

  return (
    <span style={{ position: "relative", display: "inline", whiteSpace: "nowrap", filter: filterVal }}>
      <svg ...>
        <ellipse
          ... strokeWidth="5.5" ...
        />
        <ellipse
          ... strokeWidth="2.5" ...
        />
      </svg>
      <span style={{ position: "relative" }}>{children}</span>
    </span>
  );
};
```

Add `flashEnabled` prop to interface.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open Remotion Studio, check a question with keywords — circles should be thicker and flash smoother.

- [ ] **Step 4: Commit**

```bash
git add src/remotion/theme.ts src/remotion/RedCircle.tsx
git commit -m "feat: enlarge fonts, thicken keyword circles, improve flash animation"
```

---

### Task 3: Underline Progress Effect in BottomPanel

**Files:**
- Modify: `src/remotion/BottomPanel.tsx`

- [ ] **Step 1: Remove existing top progress bar**

In BottomPanel, find the `readingProgress` bar div (the thin colored bar at top of panel) and remove it.

- [ ] **Step 2: Add underline progress to text container**

Wrap the text content area with a container that uses background-gradient as underline:

```tsx
const progress = readingDurationFrames && readingDurationFrames > 0
  ? Math.min(1, localFrame / readingDurationFrames)
  : 0;

const underlineStyle = underlineEnabled ? {
  backgroundImage: `linear-gradient(to right, ${COLORS.accent} ${progress * 100}%, transparent ${progress * 100}%)`,
  backgroundSize: "100% 3px",
  backgroundPosition: "bottom",
  backgroundRepeat: "no-repeat",
  paddingBottom: 6,
} : {};
```

Apply `underlineStyle` to the text content wrapper div.

- [ ] **Step 3: Add `underlineEnabled` prop**

Add to BottomPanel Props interface:
```typescript
underlineEnabled?: boolean;
```

Default to `true` if not provided.

- [ ] **Step 4: Verify visually**

Open Remotion Studio, play a question. Text should have a blue underline sweeping left-to-right during reading.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/BottomPanel.tsx
git commit -m "feat: add underline progress effect to BottomPanel text"
```

---

### Task 4: AnswerReveal Enhancement

**Files:**
- Modify: `src/remotion/AnswerReveal.tsx`

- [ ] **Step 1: Shrink answer font, enhance correct letter**

Update the AnswerReveal component:
- Answer letter (correctLabel) div: `fontSize: 48`, `fontWeight: 800`, `color: "#16A34A"`
- Answer text (correctText): `fontSize: FONT.size.answer` (40px)
- Add post-appear scale pulse: after the initial spring, add a subtle `1 → 1.08 → 1` over 15 frames

- [ ] **Step 2: Add underline progress for answer reading**

Add props: `readingDurationFrames?: number`

When provided, render underline on the correctText span using same gradient technique as BottomPanel.

- [ ] **Step 3: Update lineHeight**

Set `lineHeight: 1.8` on the answer text.

- [ ] **Step 4: Commit**

```bash
git add src/remotion/AnswerReveal.tsx
git commit -m "feat: enhance answer reveal with highlight, underline, and adjusted sizing"
```

---

### Task 5: Explanation Phase Layout (Original Question Reference)

**Files:**
- Modify: `src/remotion/BottomPanel.tsx`

- [ ] **Step 1: Add props for original question reference**

Add to BottomPanel Props:
```typescript
phase?: "question" | "answer" | "explanation" | "tip";
originalQuestion?: string;
originalOptions?: string[];
originalKeywords?: string[];
correctOptionIndices?: number[];
```

- [ ] **Step 2: Render mini question reference when phase=explanation**

When `phase === "explanation"` and `originalQuestion` is provided, render above the content:

```tsx
{phase === "explanation" && originalQuestion && (
  <div style={{
    maxHeight: "35%",
    overflow: "hidden",
    fontSize: FONT.size.question * 0.7,
    lineHeight: 1.6,
    marginBottom: SPACING.md,
    opacity: 0.85,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: SPACING.sm,
  }}>
    {/* Render question text with yellow-underlined keywords */}
    {renderWithKeywordUnderline(originalQuestion, originalKeywords || [])}
    {/* Render options with green bar for correct ones */}
    {originalOptions?.map((opt, i) => (
      <div key={i} style={{
        borderLeft: correctOptionIndices?.includes(i) ? "3px solid #22C55E" : "3px solid transparent",
        paddingLeft: 8,
        marginTop: 4,
      }}>
        {String.fromCharCode(65 + i)}. {opt}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Implement renderWithKeywordUnderline helper**

```tsx
function renderWithKeywordUnderline(text: string, keywords: string[]) {
  const cleanText = text.replace(/【/g, "").replace(/】/g, "");
  if (!keywords.length) return <span>{cleanText}</span>;
  const segments = splitByKeywords(cleanText, keywords);
  return segments.map((seg, i) => (
    <span key={i} style={seg.isKeyword ? {
      textDecoration: "underline",
      textDecorationColor: "#F59E0B",
      textUnderlineOffset: "4px",
      fontWeight: 700,
    } : undefined}>{seg.text}</span>
  ));
}
```

- [ ] **Step 4: Verify visually**

Check explanation phase shows the mini question reference with yellow-underlined keywords above the explanation text.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/BottomPanel.tsx
git commit -m "feat: show original question with keyword underlines during explanation"
```

---

### Task 6: Correct Option Highlight in Question Components

**Files:**
- Modify: `src/remotion/MultipleChoice.tsx`
- Modify: `src/remotion/OptionItem.tsx`

- [ ] **Step 1: Add `isCorrect` and `revealed` props to OptionItem**

When `revealed && isCorrect`:
- Background: `rgba(34, 197, 94, 0.08)`
- Left border: `3px solid #22C55E`

- [ ] **Step 2: Pass correct option info from MultipleChoice**

After answer reveal frame, mark correct options with the highlight style.

- [ ] **Step 3: Commit**

```bash
git add src/remotion/MultipleChoice.tsx src/remotion/OptionItem.tsx
git commit -m "feat: highlight correct options with green after answer reveal"
```

---

### Task 7: Teacher Avatar Lottie Support

**Files:**
- Modify: `src/remotion/TeacherAvatar.tsx`
- Modify: `package.json` (add `@remotion/lottie`)

- [ ] **Step 1: Install @remotion/lottie**

```bash
npm install @remotion/lottie lottie-web
```

- [ ] **Step 2: Refactor TeacherAvatar for dual format**

Detect file extension. If `.json`, render with `<Lottie>` (no circular clip, no ring). If `.png`, keep current circular clip style.

```tsx
import { Lottie, useLottie } from "@remotion/lottie";

// In component:
const isLottie = avatarSrc.endsWith(".json");

if (isLottie) {
  // Render Lottie animation at configured size, no clip, transparent bg
  return (
    <div style={{ position: "absolute", ...posStyle, opacity, transform, zIndex: 50 }}>
      <Lottie animationData={...} style={{ width: size, height: size }} />
    </div>
  );
}
// else: existing PNG circular clip code
```

- [ ] **Step 3: Add size/position props**

Replace hardcoded `AVATAR_SIZE = 120` with prop `size` (from DB config). Replace hardcoded position with prop.

- [ ] **Step 4: Commit**

```bash
git add src/remotion/TeacherAvatar.tsx package.json package-lock.json
git commit -m "feat: support Lottie animated avatars with configurable size/position"
```

---

### Task 8: Transition Toggle + Pause Frames

**Files:**
- Modify: `src/remotion/DynamicCombinedExam.tsx`
- Modify: `src/remotion/types.ts` (if exists, or inline in DynamicCombinedExam)

- [ ] **Step 1: Add pause/transition props to DynamicCombinedExam**

```typescript
interface Props {
  // ... existing
  showTransition?: boolean;
  pauseStart?: number;  // seconds
  pauseEnd?: number;
  pauseBeforeTip?: number;
}
```

- [ ] **Step 2: Implement transition toggle**

Wrap the QuestionTransition sequence in a condition:
```tsx
if (showTransition !== false && idx > 0) {
  // ... existing transition code
}
```

When `showTransition` is false (default), skip inserting transition sequences entirely.

- [ ] **Step 3: Implement pause frames**

```tsx
// After intro, before first question:
if (pauseStart && pauseStart > 0) {
  const pauseFrames = Math.round(pauseStart * FPS);
  sequences.push(
    <Sequence key="pause-start" from={currentFrame} durationInFrames={pauseFrames}>
      <AbsoluteFill />
    </Sequence>
  );
  currentFrame += pauseFrames;
}

// After outro:
if (pauseEnd && pauseEnd > 0) {
  const pauseFrames = Math.round(pauseEnd * FPS);
  sequences.push(
    <Sequence key="pause-end" from={currentFrame} durationInFrames={pauseFrames}>
      <AbsoluteFill />
    </Sequence>
  );
  currentFrame += pauseFrames;
}
```

For `pauseBeforeTip`: pass as prop to question components, they insert silence before tip phase internally.

- [ ] **Step 4: Update calcCombinedDuration**

```typescript
export function calcCombinedDuration(
  entries: QuestionEntry[],
  hasIntro?: boolean, hasOutro?: boolean, tipOnly?: boolean,
  showTransition?: boolean, pauseStart?: number, pauseEnd?: number, pauseBeforeTip?: number,
): number {
  let total = hasIntro ? INTRO_DURATION : 0;
  total += (pauseStart || 0);
  entries.forEach((entry, idx) => {
    if (showTransition && idx > 0) total += TRANS_DURATION;
    let qDur = questionDuration(entry, tipOnly);
    if (entry.showTip !== false && pauseBeforeTip) qDur += pauseBeforeTip;
    total += qDur;
  });
  if (hasOutro) total += OUTRO_DURATION;
  total += (pauseEnd || 0);
  return Math.ceil(total * FPS);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/remotion/DynamicCombinedExam.tsx
git commit -m "feat: add transition toggle and configurable pause frames"
```

---

### Task 9: TTS Speed Config + Cache Key

**Files:**
- Modify: `src/lib/tts.ts`

- [ ] **Step 1: Add speed parameter to generateSegment**

```typescript
async function generateSegment(
  questionId: number, segment: string, text: string, style: string, speed: string = "medium"
): Promise<TTSResult> {
  // Speed modifier prepended to style
  const speedPrefix = speed === "slow" ? "语速稍慢，节奏从容。"
    : speed === "fast" ? "语速比正常稍快。"
    : "语速适中自然。";
  const fullStyle = speedPrefix + style;
  
  // Cache key includes speed
  const cacheSegment = speed === "medium" ? segment : `${segment}_${speed}`;
  
  const cached = db.prepare("SELECT file_path, duration_sec FROM tts_cache WHERE question_id = ? AND segment = ?")
    .get(questionId, cacheSegment) as ...;
  // ... rest uses cacheSegment for cache lookup/insert, fullStyle for API call
}
```

- [ ] **Step 2: Add speed parameter to generateTTSForQuestion**

Add `ttsSpeed?: string` to the options object. Pass it through to all `generateSegment` calls.

- [ ] **Step 3: Gate transition TTS on showTransition**

In `generateTTSForQuestion`, wrap the transition generation:
```typescript
if (showTransition !== false) {
  await generateSegment(questionId, "transition", ...);
}
```

Add `showTransition?: boolean` to the function options.

- [ ] **Step 4: Pass speed to generateBridgeAudios**

Add `ttsSpeed` parameter to `generateBridgeAudios` and pass to internal `generateSegment` calls.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tts.ts
git commit -m "feat: configurable TTS speed with cache key isolation"
```

---

### Task 10: Render API - Pass New Config

**Files:**
- Modify: `src/app/api/render/route.ts`

- [ ] **Step 1: Read new fields from seriesData**

After existing seriesData reads, add:
```typescript
const showTransition = seriesData?.show_transition === 1;
const pauseStart = seriesData?.pause_start ?? 2.0;
const pauseEnd = seriesData?.pause_end ?? 2.0;
const pauseBeforeTip = seriesData?.pause_before_tip ?? 2.0;
const ttsSpeed = seriesData?.tts_speed || "medium";
const keywordFlashEnabled = seriesData?.keyword_flash_enabled !== 0;
const underlineProgressEnabled = seriesData?.underline_progress_enabled !== 0;
const avatarEnabled = seriesData?.avatar_enabled !== 0;
const avatarSize = seriesData?.avatar_size ?? 80;
const avatarPosition = seriesData?.avatar_position || "bottom-right";
```

- [ ] **Step 2: Pass ttsSpeed to TTS generation calls**

Pass `ttsSpeed` to `generateTTSForQuestion` and `generateBridgeAudios`.
Pass `showTransition` to `generateTTSForQuestion`.

- [ ] **Step 3: Pass new props to Remotion composition**

Add to the props object passed to Remotion:
```typescript
showTransition,
pauseStart,
pauseEnd,
pauseBeforeTip,
keywordFlashEnabled,
underlineProgressEnabled,
avatarEnabled,
avatarSize,
avatarPosition,
```

- [ ] **Step 4: Update calcCombinedDuration call**

Pass the new parameters to match the updated signature.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/render/route.ts
git commit -m "feat: wire style enhancement config through render pipeline"
```

---

### Task 11: Settings Modal UI

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Add state variables for new fields**

```typescript
const [showTransition, setShowTransition] = useState(0);
const [pauseStart, setPauseStart] = useState(2.0);
const [pauseEnd, setPauseEnd] = useState(2.0);
const [pauseBeforeTip, setPauseBeforeTip] = useState(2.0);
const [ttsSpeed, setTtsSpeed] = useState("medium");
const [keywordFlashEnabled, setKeywordFlashEnabled] = useState(1);
const [underlineProgressEnabled, setUnderlineProgressEnabled] = useState(1);
const [avatarEnabled, setAvatarEnabled] = useState(1);
const [avatarSize, setAvatarSize] = useState(80);
const [avatarPosition, setAvatarPosition] = useState("bottom-right");
```

- [ ] **Step 2: Initialize from seriesData in useEffect**

- [ ] **Step 3: Add "播放控制" tab**

Contents:
- 显示过场页（想一想）: checkbox toggle
- 视频开头停顿: number input (0-5 sec)
- 视频结尾停顿: number input (0-5 sec)
- 技巧前停顿: number input (0-5 sec)

- [ ] **Step 4: Expand "语音设置" tab**

Add 语速 dropdown above existing controls:
- Options: 稍慢 / 适中 / 稍快
- Maps to: slow / medium / fast

- [ ] **Step 5: Add "动画效果" tab**

Contents:
- 朗读下划线进度: checkbox toggle
- 关键字闪动: checkbox toggle

- [ ] **Step 6: Add "头像设置" tab**

Contents:
- 显示头像: checkbox toggle
- 头像大小: range slider 60-150
- 头像位置: dropdown (右下角 / 左下角)
- 上传头像素材: file input (.png, .json)

- [ ] **Step 7: Wire save to API**

Include all new fields in the PATCH request body.

- [ ] **Step 8: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: add settings tabs for playback, animation, and avatar config"
```

---

### Task 12: Wire Props Through Question Components

**Files:**
- Modify: `src/remotion/MultipleChoice.tsx`
- Modify: `src/remotion/TrueFalseQuestion.tsx`
- Modify: `src/remotion/ScrollableQuestion.tsx`
- Modify: `src/remotion/DynamicCombinedExam.tsx`

- [ ] **Step 1: Pass new props from DynamicCombinedExam to question components**

Add to QuestionComponent render:
```tsx
keywordFlashEnabled={keywordFlashEnabled}
underlineProgressEnabled={underlineProgressEnabled}
avatarEnabled={avatarEnabled}
avatarSize={avatarSize}
avatarPosition={avatarPosition}
pauseBeforeTip={pauseBeforeTip}
```

- [ ] **Step 2: Accept and forward props in each question component**

Each component passes:
- `keywordFlashEnabled` → `RedCircle` (as `flashEnabled`)
- `underlineProgressEnabled` → `BottomPanel` (as `underlineEnabled`)
- `avatarEnabled/avatarSize/avatarPosition` → `TeacherAvatar`
- `phase` info → `BottomPanel` (for explanation layout)
- Original question/options/keywords → `BottomPanel` (for explanation reference)

- [ ] **Step 3: Verify end-to-end**

Run `npm run dev`, open Remotion Studio, render a test video with all features enabled. Check:
- Underline progress animates during reading
- Keywords flash with new timing
- Avatar shows at configured size/position
- No transition pages between questions
- Pauses present at start/end

- [ ] **Step 4: Commit**

```bash
git add src/remotion/MultipleChoice.tsx src/remotion/TrueFalseQuestion.tsx src/remotion/ScrollableQuestion.tsx src/remotion/DynamicCombinedExam.tsx
git commit -m "feat: wire all style enhancement props through question components"
```

---

### Task 13: Integration Verification

- [ ] **Step 1: Full render test**

Use the editor page to render a video with:
- Mixed question types (single, multi, true-false)
- Keywords in questions
- Explanation phase
- Tip phase
- All new settings configured

Verify:
- [ ] Fonts are larger and readable
- [ ] Keyword circles are thicker
- [ ] Underline sweeps left-to-right during all reading phases
- [ ] Keywords flash on appear
- [ ] Answer reveal is smaller but highlighted
- [ ] Explanation shows original question with yellow-underlined keywords
- [ ] Correct options highlighted green after reveal
- [ ] No transition page between questions (default off)
- [ ] Pauses at video start, end, and before tips
- [ ] Avatar displays at configured size (or Lottie if .json uploaded)
- [ ] TTS speed matches selected setting

- [ ] **Step 2: Commit any fixes**

- [ ] **Step 3: Push feature branch**

```bash
git push -u origin feature/video-style-enhancements
```
