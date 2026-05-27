# src/app — Next.js App Router

## OVERVIEW

Pages + API routes. All pages `"use client"` except landing. No middleware, no auth. API routes directly call `getDb()`.

## STRUCTURE

```
app/
├── layout.tsx              # Root layout: nav bar, RenderStatusProvider, UpdateIndicator
├── page.tsx                # Landing page (server component, FluidBackground)
├── series/                 # Video series list (pagination, search, batch render)
├── editor/[seriesId]/      # Main editor (978 lines! DnD, TTS, preview)
├── questions/              # Question bank + Excel import
├── renders/                # Render task monitoring + progress
├── tts-dictionary/         # TTS pronunciation rules
├── data-management/        # Backup/restore (ZIP export/import)
└── api/                    # All API routes (see below)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Series CRUD | `api/series/route.ts` + `api/series/[id]/route.ts` | Paginated GET, POST/PUT/DELETE |
| Question import | `api/questions/import/route.ts` | XLSX/CSV multipart upload |
| Render video | `api/render/route.ts` | Creates task in queue, returns task ID |
| TTS generation | `api/tts/route.ts` | Calls MIMO API, caches in SQLite |
| File upload | `api/upload/route.ts` | Images to `public/uploads/` |
| Serve uploads | `api/uploads/[filename]/route.ts` | Rewrite trick: `/uploads/:file` → `/api/uploads/:file` |

## API ROUTES (27 total)

| Group | Routes | Methods |
|-------|--------|---------|
| questions | `/api/questions`, `/import`, `/batch`, `/template` | GET, POST, DELETE |
| series | `/api/series`, `/api/series/[id]`, `/api/series/[id]/questions` | GET, POST, PUT, DELETE |
| render | `/api/render`, `/batch`, `/download`, `/open-folder` | GET, POST, DELETE |
| tts | `/api/tts`, `/check`, `/preview`, `/sample`, `/tf-options` | GET, POST |
| tts-dictionary | `/api/tts-dictionary` | GET, POST, PUT, DELETE |
| backup | `/api/backup/export`, `/import`, `/stats` | GET, POST |
| infra | `/api/settings`, `/upload`, `/uploads/[file]`, `/audio/[...path]`, `/logs`, `/update` | GET, POST |

## CONVENTIONS

- API routes use `getDb()` directly — no service layer
- Error handling: `try/catch` in route handlers, return `NextResponse.json({ error }, { status })`
- Pagination: `?page=1&pageSize=20` query params
- File serving: `/uploads/:filename` rewritten to API route (not static)

## ANTI-PATTERNS

- `editor/[seriesId]/page.tsx` is 978 lines with inline components — complexity hotspot
- `editor/page.tsx` is orphaned legacy code (not in nav, no seriesId)
- Electron-only routes (`/api/render/open-folder`, `/api/logs`) have no guard for web context
- No `error.tsx`, `loading.tsx`, `not-found.tsx` boundaries
- No page-specific metadata exports (only root layout has metadata)
