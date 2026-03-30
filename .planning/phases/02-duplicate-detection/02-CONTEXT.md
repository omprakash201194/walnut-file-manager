# Phase 2: Duplicate Detection - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the full scan-to-delete pipeline: a user can select a folder, initiate a scan, watch real-time progress, review grouped duplicate files, apply smart selection presets, preview the deletion, and move selected files to the Windows Recycle Bin.

Requirements covered: SCAN-01, SCAN-02, SCAN-03, SCAN-04, DUPE-01, DUPE-02, DUPE-03, DUPE-04, DUPE-05, DUPE-06, SELECT-01, SELECT-02, SAFETY-01, SAFETY-02, SAFETY-03.

No file organization, no undo, no scan history. Those belong to Phase 3 and Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Scan Trigger
- **D-01:** Explicit "Scan Now" button lives in DuplicatesPage (not in sidebar, not auto-triggered by folder pick). The sidebar handles folder selection; the page handles scan initiation. When a folder is selected and the user navigates to DuplicatesPage, they see the selected folder path and a "Scan Now" button.
- **D-02:** `selectedFolder` is global state (shared Zustand store). DuplicatesPage and OrganizerPage both read `selectedFolder` from `useAppStore`. No per-module folder state.
- **D-03:** The scan button is also the re-scan button — clicking it while results exist replaces old results. No separate re-scan action needed.

### Scan Progress Presentation
- **D-04:** Full-page progress view — when a scan is in progress, DuplicatesPage renders a dedicated progress screen (not inline above results). The progress view shows: folder path being scanned, progress bar, files scanned / total, elapsed time, current file path, and duplicates found so far (running count).
- **D-05:** A "Cancel Scan" button is present on the progress screen (satisfies SCAN-03).
- **D-06:** After scan completes, the page transitions to the results view. First-results streaming (SCAN-04: within 2 seconds) is an IPC/main-process concern — the UI transitions once scan is complete, not incrementally.

### Duplicate Groups Layout
- **D-07:** Accordion cards — each duplicate group is an expandable card. Collapsed state shows: file name, copy count, total size. Expanded state shows all copies as rows.
- **D-08:** Each file row within an expanded group shows: full path (truncated with ellipsis if needed), file size, modified date, and a visual "KEEP" badge on whichever copy would be kept by the current preset selection.
- **D-09:** On results load, the first group is expanded by default; all subsequent groups are collapsed.
- **D-10:** A summary bar at the top of the results view shows: space savings summary ("X duplicates found — you can reclaim Y GB") plus [Keep Newest] and [Keep Oldest] bulk preset buttons (SELECT-01). Presets apply globally across all groups.

### Selection & Delete Flow
- **D-11:** Sticky bottom panel — when one or more files are checked for deletion, a panel slides up from the bottom of DuplicatesPage showing: count of selected files, total size to be freed, and a "Delete X files → Trash" button. The panel is the preview (SAFETY-01).
- **D-12:** One-click final action — clicking "Delete X files → Trash" in the bottom panel is the confirmation (SAFETY-03). No second dialog. The panel text makes the action explicit. Files are moved to Recycle Bin via `shell.trashItem()` (SAFETY-02).
- **D-13:** Protected folders (DUPE-06) are configured in the sidebar, near the selected folder path — a small UI element allows marking the current folder (or sub-paths) as protected. Files in protected folders are never auto-selected by presets.

### Claude's Discretion
- Exact IPC streaming implementation detail — use `webContents.send()` for scan progress events and `ipcMain.handle()` for scan start/cancel (ROADMAP notes guidance)
- Zustand state shape for scan state (e.g., `scanStatus`, `scanProgress`, `duplicateGroups`, `selections`) — design for clarity and Phase 3 extensibility
- Additional shadcn/ui components to install (likely: checkbox, progress, badge — determine during planning)
- Error states during scanning (permission denied, path not found) — handle gracefully with a clear error message in the progress/results view
- Whether scan handlers live in `src/main/index.ts` directly or a separate `src/main/handlers/` directory — follow electron-vite conventions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Scanning Infrastructure (SCAN-01–04) — acceptance criteria for scan behavior and streaming
- `.planning/REQUIREMENTS.md` §Duplicate Detection (DUPE-01–06) — hashing algorithm, grouping, space savings summary, presets, protected folders
- `.planning/REQUIREMENTS.md` §Smart Selection (SELECT-01–02) — bulk presets, keep-at-least-one constraint
- `.planning/REQUIREMENTS.md` §File Safety (SAFETY-01–03) — preview panel, Recycle Bin, explicit confirm requirements
- `.planning/ROADMAP.md` §Phase 2 — Goal, success criteria, UAT criteria, Codex-agent notes (streaming pattern, SHA-256, size pre-filter, worker threads note)

### Project & Tech Stack
- `CLAUDE.md` — IPC security rules (contextBridge, no nodeIntegration), Electron API references (`shell.trashItem()`, `webContents.send()`), testing constraints, what NOT to use

### Existing Code to Extend
- `shared/ipc-types.ts` — Existing IPC_CHANNELS + IpcApi pattern. Phase 2 adds scan channels following the same convention: `IPC_CHANNELS.SCAN_START`, `SCAN_CANCEL`, `SCAN_PROGRESS`, etc.
- `src/renderer/src/store/appStore.ts` — Existing Zustand store with `selectedFolder`. Phase 2 adds scan state to this same store (no new store).
- `src/renderer/src/pages/DuplicatesPage.tsx` — Currently a placeholder. Phase 2 replaces this with the full scan/results UI.
- `src/main/index.ts` — `registerIpcHandlers()` function. Phase 2 adds scan handlers here (or imports from a handlers module).
- `src/preload/index.ts` — `window.api` contextBridge. Phase 2 adds scan functions following the existing pattern.
- `src/renderer/src/components/Sidebar.tsx` — Phase 2 adds protected folders UI element here, near the selected folder display.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAppStore` (Zustand) — already has `selectedFolder`; extend with scan state (status, progress, duplicateGroups, selections, protectedFolders)
- `src/renderer/src/components/ui/button.tsx` — button component (blue primary style established in Phase 1)
- `src/renderer/src/components/ui/scroll-area.tsx` — use for the duplicate groups list (can be a long scroll)
- `src/renderer/src/lib/utils.ts` — `cn()` utility for conditional class names
- Lucide icons already in use (Files, FolderTree in Sidebar) — use for scan/status icons in Phase 2

### Established Patterns
- IPC: One typed function per channel in preload, channel name constants in `shared/ipc-types.ts`, `ipcMain.handle()` in main — follow exactly
- Zustand: single `useAppStore`, selector pattern (`useAppStore((s) => s.field)`) — extend, don't fork
- Tailwind + shadcn zinc dark theme — zinc color scale, blue (`blue-500`) as accent/primary action color
- React Router `<NavLink>` pattern — no changes needed for Phase 2 (DuplicatesPage is already routed)

### Integration Points
- `src/renderer/src/components/Sidebar.tsx` — add protected folders UI below the folder picker section
- `src/renderer/src/pages/DuplicatesPage.tsx` — full replacement: 3 states (empty/no folder, scanning/progress, results)
- `src/main/index.ts` `registerIpcHandlers()` — add `scan:start`, `scan:cancel` handlers; use `webContents.send()` for `scan:progress` events
- `shared/ipc-types.ts` — extend `IPC_CHANNELS` and `IpcApi` with scan operations

</code_context>

<specifics>
## Specific Ideas

- Progress bar and status: show all four stats simultaneously (files scanned/total, elapsed, current path, duplicates found so far) — user chose all four during discussion
- Bottom panel behavior: appears when ≥1 file is checked, disappears when 0 files selected — animate slide-up/down
- "Delete X files → Trash" button label dynamically updates as selection changes
- Keep badge: visually distinct (e.g., green badge labeled "KEEP") — updates in real-time when preset changes
- Accordion collapse/expand: first group open on results load, rest closed — consistent with familiar file manager UX

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-duplicate-detection*
*Context gathered: 2026-03-30*
