<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-31
**Commit:** d5c7803
**Branch:** main

## OVERVIEW

Driving exam video production studio (驾考视频制作工作室). Next.js 16 + Electron 42 hybrid desktop app. Remotion renders 1080x1920 exam videos with MIMO TTS narration. SQLite stores everything.

## STRUCTURE

```
driving-exam-studio/
├── src/app/          # Next.js App Router (pages + API routes)
├── src/remotion/     # Video rendering engine (25 files, separate module)
├── src/components/   # Shared React components (flat, 13 files)
├── src/lib/          # Server-only utilities (db, tts, render-queue, settings)
├── electron/         # Electron main process (spawns Next.js on port 3456)
├── scripts/          # CLI tools (import-mysql, import-xlsx, render-video)
├── data/             # Runtime: SQLite DBs + settings.json (committed to git!)
├── output/           # Rendered video output
└── public/           # Static assets + uploads/
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify pages | `src/app/*/page.tsx` | All pages are `"use client"` except landing |
| Add API endpoints | `src/app/api/*/route.ts` | No middleware, no auth. Direct DB access |
| Modify video rendering | `src/remotion/` | Separate module, `registerRoot()` in index.ts |
| DB schema changes | `src/lib/db.ts` | Inline migrations in `initTables()`, additive-only |
| TTS integration | `src/lib/tts.ts` | MIMO API via OpenAI SDK, 8 voices |
| Render queue logic | `src/lib/render-queue.ts` | Singleton on `globalThis`, 30min timeout |
| Electron shell | `electron/main.js` | Auto-updater, path setup, junction hack |
| CI/CD pipeline | `.github/workflows/build-windows.yml` | Tag-triggered, Windows-only |
| Release process | `CLAUDE.md` | Must update version in 3 files before tagging |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `getDb()` | function | `src/lib/db.ts` | SQLite singleton, runs migrations on every call |
| `RenderQueue` | class | `src/lib/render-queue.ts` | In-process job queue, spawns Remotion CLI |
| `generateTtsAudio()` | function | `src/lib/tts.ts` | MIMO TTS via OpenAI SDK adapter |
| `RenderStatusProvider` | context | `src/components/RenderNotification.tsx` | Cross-page render status polling |
| `DynamicCombinedExam` | component | `src/remotion/DynamicCombinedExam.tsx` | Core video orchestrator (241 lines) |
| `Root` | component | `src/remotion/Root.tsx` | Remotion composition registration |

## CONVENTIONS

- **Path alias**: Always `@/` prefix → `./src/*`
- **Tailwind v4**: CSS-first config in `globals.css`, NO `tailwind.config.js`
- **ESLint only**: No Prettier. Flat config with `next/core-web-vitals` + `next/typescript`
- **Strict TypeScript**: `strict: true`, target ES2017
- **Server external packages**: `better-sqlite3`, `@remotion/*` excluded from Next.js bundling
- **Electron dev**: `npm run electron:dev` (Next.js on port 3456)

## WORKFLOW RULES

**正常工作模式**：用户提出需求 → 响应需求 → 修改代码 → 完成。不主动提交代码、不打 tag、不推送。

**发版模式（仅当用户明确说"提交代码"时触发）**：
1. 更新 `package.json` version
2. 更新 `package-lock.json` version
3. 在 `CHANGELOG.md` 顶部追加本次更新说明
4. 在 `src/lib/changelog.ts` 顶部插入新版本条目（应用内更新日志数据源）
5. `git add` + `git commit`
6. `git tag vX.Y.Z`
7. `git push origin main --tags` → 触发 CI

**禁止行为**：用户没有说"提交代码"时，绝对不能自动 commit、tag、push。即使改了很多代码，也要等用户判断是否可以发版。

## ANTI-PATTERNS (THIS PROJECT)

- **`@ts-ignore` on OpenAI TTS types**: Intentional SDK limitation (4 files). Do NOT remove without verifying SDK types
- **Inline DB migrations**: Schema evolves in `initTables()` via `ALTER TABLE ADD COLUMN`. No rollback. Additive-only
- **`node_modules` → `node_deps` rename**: CI hack for electron-builder. Junction symlink at runtime
- **Beijing timezone hardcoded**: `+8*3600000` in db.ts and main.js. Intentional for Chinese exam domain
- **No auth**: Desktop app, localhost only. API routes have no authentication
- **No tests**: Zero test infrastructure. No vitest, jest, or playwright configured
- **`data/` committed to git**: Contains actual SQLite databases with user data

## COMMANDS

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Next.js production build
npm run lint             # ESLint
npm run electron:dev     # Electron + Next.js dev (port 3456)
npm run electron:build   # Full Windows build (next build + electron-builder)
```

## NOTES

- Read `node_modules/next/dist/docs/` before ANY Next.js code changes (v16 breaking changes)
- Editor page `src/app/editor/[seriesId]/page.tsx` is 978 lines — complexity hotspot
- `src/app/editor/page.tsx` is orphaned legacy code (not linked from nav)
- TTS depends on external `api.xiaomimimo.com` — cached in SQLite `tts_cache` table
- Electron bundles its own `node.exe` (v20.18.3 portable) for standalone server
- Dual distribution: GitHub Releases + Aliyun OSS (`https://file.yxjky.com/studio-releases/`)
- No error boundaries: No `error.tsx`, `loading.tsx`, `not-found.tsx` in app tree
- No middleware: Zero request-level interception (no auth, no redirects, no rate limiting)
- No tests: Zero test infrastructure (no vitest, jest, or playwright configured)
