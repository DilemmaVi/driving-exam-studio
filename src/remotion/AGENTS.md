# src/remotion — Video Rendering Engine

## OVERVIEW

25 files. Separate module with own `registerRoot()` entry point. Renders 1080x1920 @ 30fps driving exam videos.

## STRUCTURE

```
remotion/
├── index.ts              # registerRoot() entry
├── Root.tsx              # Composition registration
├── types.ts              # Question, AudioDurations, QuestionEntry
├── VideoStyle.ts         # Theme/avatar/keyword style types
├── theme.ts              # Color palette definitions
├── DynamicCombinedExam.tsx  # Core orchestrator (241 lines)
├── IntroCard.tsx / OutroCard.tsx  # Title/end cards
├── TrueFalseQuestion.tsx / MultipleChoice.tsx / ScrollableQuestion.tsx  # Question renderers
├── QuestionHeader.tsx / QuestionImage.tsx / QuestionTransition.tsx  # Question parts
├── OptionItem.tsx / AnswerReveal.tsx  # Answer display
├── TeacherAvatar.tsx / TeacherExplanation.tsx  # Teacher overlay
├── BottomPanel.tsx / ModalOverlay.tsx  # Explanation panels
├── Background.tsx / Watermark.tsx / ProgressBar.tsx  # Video chrome
├── CountdownDots.tsx / RedCircle.tsx  # Animations
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new question type | Create new component, register in `DynamicCombinedExam.tsx` | Follow `TrueFalseQuestion.tsx` pattern |
| Change video dimensions | `Root.tsx` | Currently 1080x1920 @ 30fps |
| Modify color themes | `theme.ts` | Color palette definitions |
| Add new style option | `VideoStyle.ts` | Theme/avatar/keyword types |
| Change intro/outro | `IntroCard.tsx` / `OutroCard.tsx` | Standalone components |

## CONVENTIONS

- Components use Remotion's `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`
- Animations are frame-based, not time-based
- All components accept props from `DynamicCombinedExam.tsx` orchestrator
- `@ts-ignore` on `Root.tsx` Composition component (Remotion type limitation)

## ANTI-PATTERNS

- Remotion code is completely separate from Next.js — do NOT mix imports
- Render script (`scripts/render-video.ts`) compiled via esbuild with `--packages=external`
