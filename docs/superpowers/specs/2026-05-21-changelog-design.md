# Version Changelog Feature Design

## Goal

Let users see what changed in each version — automatically on first launch after an update, and on demand by clicking the version number in the navigation bar.

## Data Source

A `CHANGELOG.md` file in the project root, using a simple structured format:

```markdown
## v0.3.1 (2026-05-21)
- Added split rendering: each question produces an independent video file
- Fixed options not being read aloud during rendering
- Fixed answer reveal animation bounce
- Fixed black screen during video start/end pause
- Changed panel adjust default to auto-scale at 90%
- Fixed underline settings not persisting to rendered video
- Empty category label no longer falls back to "科目一"
- pauseStart now means "pause after options load before reading"

## v0.3.0 (2026-05-20)
- Added watermark / brand logo support
- Added video style enhancement settings
```

Format rules:
- Each version starts with `## vX.Y.Z (YYYY-MM-DD)`
- Each change is a `- ` bullet point under its version header
- Newest version first

The file is bundled with the application at build time. No external network requests needed.

## API Endpoint

**`GET /api/changelog`**

Reads `CHANGELOG.md` from the project root (or app resources path in production), parses it into structured JSON:

```json
{
  "versions": [
    {
      "version": "0.3.1",
      "date": "2026-05-21",
      "changes": [
        "Added split rendering...",
        "Fixed options not being read aloud..."
      ]
    }
  ],
  "currentVersion": "0.3.1"
}
```

Parsing logic: split by `## v` headers, extract version/date from each header line, collect bullet lines as changes.

## UI: ChangelogModal Component

A modal dialog consistent with the existing `SettingsModal` style (centered overlay, white rounded card, max-height with scroll).

**Props:**
- `open: boolean`
- `onClose: () => void`
- `currentOnly?: boolean` — when true, only show the current version's changes (used for first-launch mode)

**Layout:**
- Title: "更新日志"
- Each version section: version badge + date, followed by bullet list of changes
- Current version gets a "当前" tag
- In `currentOnly` mode: only the current version is shown, with a "查看历史版本" link at the bottom that switches to full mode

## Trigger Logic

### 1. First Launch After Update

In `layout.tsx` (client-side):
- On mount, read `localStorage.getItem("lastSeenVersion")`
- Compare with current `package.json` version
- If different (or not set): show `ChangelogModal` in `currentOnly` mode, then set `localStorage.setItem("lastSeenVersion", currentVersion)`

### 2. Click Version Number

In `layout.tsx`:
- The existing `v{version}` text in the nav bar becomes a clickable button
- Click opens `ChangelogModal` in full mode (all versions)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `CHANGELOG.md` | Create | Version history content |
| `src/app/api/changelog/route.ts` | Create | Parse and serve changelog as JSON |
| `src/components/ChangelogModal.tsx` | Create | Modal UI component |
| `src/app/layout.tsx` | Modify | Add click handler on version, first-launch detection, mount ChangelogModal |

## Non-Goals

- No admin UI for editing changelog (developers edit the markdown file directly)
- No notification badge or dot indicator
- No integration with GitHub Releases API
- No remote changelog fetching
