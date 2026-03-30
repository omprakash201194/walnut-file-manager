# Phase 3: File Organization - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the file organization pipeline: user picks a folder (already selected globally), chooses an organization strategy, generates a dry-run preview of proposed moves grouped by destination category, applies the reorganization, and can undo it — including across app restarts. The undo stack is persistent and unlimited.

Requirements covered: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, SAFETY-04, SAFETY-05.

No new scan infrastructure — reuses Phase 2's walkDirectory results via shared Zustand state.
No duplicate detection changes. No new file safety dialogs beyond the preview.

</domain>

<decisions>
## Implementation Decisions

### Scan Trigger
- **D-01:** Shared scan — OrganizerPage reads from the same Zustand scan results (`duplicateGroups` / raw `FileEntry[]`) as DuplicatesPage. No second walkDirectory call. When the user has scanned a folder in Duplicates and switches to Organizer, the files are already available. If no scan has run yet, OrganizerPage shows an empty state prompting the user to scan first (via the existing Scan Now flow).

### Preview Visualization (SAFETY-04 / ORG-03)
- **D-02:** Grouped flat list by destination category. The preview shows one collapsible section per category (Documents, Photos, Music, Video, Archives, Other). Each section header shows the category name and file count (e.g., "Documents — 14 files"). Expanded section lists individual file names (or relative paths). No before/after columns — just the proposed destination grouping. The preview is read-only; user cannot reorder or exclude individual files in v1.

### Strategy Picker (ORG-02 / ORG-05)
- **D-03:** Tab-based picker at the top of OrganizerPage. Two tabs: "By Type" (default, selected on page load) and "By Extension". Switching tabs regenerates the preview if one has already been shown. Strategy interface is defined as a TypeScript interface (`OrganizationStrategy`) so future strategies can be added without restructuring — ORG-05 extensibility requirement.

### Preview Trigger
- **D-04:** Manual — user clicks a "Preview" button to generate the grouped list. The page does not auto-preview on load or on tab switch if no preview has been shown yet. After the first preview, switching strategy tabs regenerates automatically (tab switch = implicit re-preview).

### Page Layout & Action Buttons
- **D-05:** OrganizerPage layout (top to bottom):
  1. Strategy tabs (By Type | By Extension)
  2. "Preview" button — triggers dry-run categorization
  3. Preview area — grouped flat list (empty until Preview clicked)
  4. "Apply" button — enabled only after preview is shown; moves files on disk
  5. "Undo" button — appears below Apply once undo history exists; pops top of stack

### Undo Persistence (SAFETY-05)
- **D-06:** Stack-based undo using electron-store. Every Apply operation pushes a record of all file moves (`{ from: string, to: string }[]`) onto a persistent stack. Undo pops the top entry and reverses each move. Stack survives app restarts. No cap on stack depth — all reorganization history is retained. Undo button shows "Undo last reorganization" with the timestamp of the last apply.

### Claude's Discretion
- electron-store key name and exact schema for the undo stack
- Exact file extension → category mapping for ORG-01 (e.g., `.jpg .jpeg .png .gif .webp .heic` → Photos)
- Error handling for move failures (file locked, permission denied) — surface in a dismissible error area below the Apply button
- Empty state for OrganizerPage when no scan results exist yet
- Whether "By Extension" strategy creates one folder per extension or groups common extensions (e.g., `.jpg` + `.jpeg` → same folder)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §File Organization (ORG-01–05) — categorization categories, strategy extensibility, dry-run, apply, extensibility requirement
- `.planning/REQUIREMENTS.md` §File Safety (SAFETY-04–05) — dry-run preview requirement, undo across sessions
- `.planning/ROADMAP.md` §Phase 3 — Goal, success criteria, UAT criteria, Codex-agent notes (strategy pattern, electron-store vs SQLite note, reuse scanning infrastructure)

### Phase 2 Code (reused in Phase 3)
- `src/main/handlers/scan.ts` — walkDirectory, FileEntry type; Phase 3 consumes the same output
- `src/renderer/src/store/appStore.ts` — Zustand store; Phase 3 extends this with organizer state
- `shared/ipc-types.ts` — IPC channel constants and types; Phase 3 adds new channels here

### Prior Context
- `.planning/phases/02-duplicate-detection/02-CONTEXT.md` D-02 — selectedFolder is global Zustand state, shared across pages

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/handlers/scan.ts` — `walkDirectory` + `FileEntry` type reusable directly; Phase 3 categorizes the same `FileEntry[]` output
- `src/renderer/src/store/appStore.ts` — extend with `organizerStatus`, `organizerPreview`, undo stack actions
- `src/renderer/src/lib/utils.ts` — `formatBytes` available for preview size display
- `src/renderer/src/components/ui/` — accordion, badge, progress already installed; tabs (shadcn Tabs) likely needed for strategy picker
- `src/renderer/src/pages/OrganizerPage.tsx` — currently a placeholder; Phase 3 replaces it entirely

### Established Patterns
- IPC: `ipcMain.handle()` for request/response (apply, undo); `webContents.send()` if progress streaming is needed during apply
- State machine pattern from Phase 2 (`scanStatus: idle | scanning | complete | error`) — mirror for organizer (`organizerStatus: idle | previewing | ready | applying | done | error`)
- Zustand selector pattern: `useAppStore((s) => s.field)` — continue this in organizer components
- shadcn/ui + Tailwind for all UI; dark-mode-first

### Integration Points
- `src/renderer/src/store/appStore.ts` — add organizer slice (preview data, status, undo availability)
- `src/main/index.ts` — register organizer IPC handlers (same pattern as `registerScanHandlers`)
- `src/preload/index.ts` — expose organizer API methods via contextBridge
- `shared/ipc-types.ts` — add `ORG_PREVIEW`, `ORG_APPLY`, `ORG_UNDO` channel constants + types

</code_context>

<specifics>
## Specific Ideas

- "By Type" strategy default — user lands on By Type tab; By Extension is secondary
- Undo button label: "Undo last reorganization" with timestamp of the apply operation
- Preview header per group: "Documents — 14 files" (category name + count)
- After first preview, switching tabs auto-regenerates (tab switch = implicit re-preview)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-file-organization*
*Context gathered: 2026-03-30*
