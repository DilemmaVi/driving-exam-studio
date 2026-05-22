# Data Backup & Restore Design

## Goal

Allow users to export all application data as a single .zip file and import it on a new device, fully restoring their working environment (minus regenerable TTS audio).

## Data Inventory

| Source | Contents | Size (typical) |
|--------|----------|---------------|
| `data/exam.db` | Questions (4790+), video_series, series_questions, categories, tts_cache records, render_tasks, tts_dictionary | ~12 MB |
| `data/settings.json` | API key, watermark config | <1 KB |
| `public/uploads/` | Watermark logos, uploaded images | <1 MB |

**Excluded:** TTS audio files (`public/audio/`, ~44MB, regenerable), rendered videos (`output/`).

## Zip Structure

```
backup_2026-05-22.zip
├── manifest.json
├── exam.db
├── settings.json
└── uploads/
    └── *.png, *.jpg, ...
```

### manifest.json

```json
{
  "appVersion": "0.3.4",
  "exportDate": "2026-05-22T10:30:00+08:00",
  "questionCount": 4790,
  "seriesCount": 6,
  "categoryCount": 12
}
```

Used on import to verify compatibility and display confirmation info.

## API Design

### `GET /api/backup/export`

1. Run `PRAGMA wal_checkpoint(TRUNCATE)` to flush WAL into main DB file.
2. Create zip in memory (archiver or yazl):
   - Add `data/exam.db` as `exam.db`
   - Add `data/settings.json` as `settings.json`
   - Add all files in `public/uploads/` under `uploads/`
   - Generate and add `manifest.json`
3. Stream zip as response with headers:
   - `Content-Type: application/zip`
   - `Content-Disposition: attachment; filename="全安驾考备份_YYYY-MM-DD.zip"`

### `POST /api/backup/import`

Accepts multipart form upload of a .zip file.

**Phase 1 — Validate (dry run):**
1. Extract zip to temp directory.
2. Verify `manifest.json` exists and has valid structure.
3. Verify `exam.db` exists and is a valid SQLite file (`PRAGMA integrity_check`).
4. Return manifest info to frontend for confirmation display.

**Phase 2 — Apply (after user confirms):**

Could be a second request `POST /api/backup/import/confirm` with the temp path, or a query param `?confirm=true`.

1. Close existing DB connection (requires a `closeDb()` helper in `db.ts`).
2. Replace `data/exam.db` with backup's `exam.db`.
3. Replace `data/settings.json` with backup's `settings.json`.
4. Delete contents of `public/uploads/` and replace with backup's `uploads/`.
5. Delete contents of `public/audio/` (TTS cache is now stale since DB was replaced).
6. Re-initialize DB connection.
7. Return success; frontend shows "import complete" and reloads the page.

**Error handling:**
- If any step fails after DB close, restore from a pre-import snapshot (copy current DB to `exam.db.bak` before replacing).
- If zip is missing required files, reject with descriptive error.

## UI: `/data-management` Page

A new top-level page accessible from the navbar ("数据管理").

### Layout

```
┌─────────────────────────────────────────────────┐
│  数据管理                                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 数据概览 ────────────────────────────────┐  │
│  │  题库: 4790 题  │  系列: 6 个  │  分类: 12 │  │
│  │  TTS缓存: 127 条  │  数据大小: ~13 MB     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌─ 导出备份 ────────────────────────────────┐  │
│  │  将题库、系列配置、设置等打包为 zip 文件     │  │
│  │  [导出备份]                                 │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌─ 导入备份 ────────────────────────────────┐  │
│  │  从 zip 文件恢复数据（将覆盖现有数据）       │  │
│  │  [选择文件...]                              │  │
│  │                                             │  │
│  │  (选择后显示 manifest 信息和确认按钮)        │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Import Confirmation Dialog

After file selection and validation:

```
┌─ 确认导入 ─────────────────────────────┐
│                                         │
│  备份信息:                               │
│  • 版本: v0.3.4                         │
│  • 导出时间: 2026-05-22 10:30           │
│  • 题目数量: 4790                        │
│  • 系列数量: 6                           │
│                                         │
│  ⚠️ 导入将覆盖所有现有数据，此操作不可撤销  │
│                                         │
│  [取消]  [确认导入]                      │
└─────────────────────────────────────────┘
```

## Navigation

Add "数据管理" link to the navbar in `layout.tsx`, between "发音词典" and the version badge.

## Dependencies

- `archiver` (already in project for split-render zip) or built-in `yazl` for zip creation
- `yauzl` or `unzipper` for zip extraction on import

## Edge Cases

- **Large DB**: Stream zip instead of buffering in memory.
- **Concurrent access during import**: The import process should block other requests. Since this is a desktop app (single user), a simple lock flag suffices.
- **Version mismatch**: If `manifest.appVersion` is newer than current app, warn user but allow import (DB migrations will run on next restart).
- **Corrupted zip**: Validate before applying; never leave DB in half-replaced state.
