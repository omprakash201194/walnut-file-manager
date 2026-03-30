# Phase 2: Duplicate Detection - Research

**Researched:** 2026-03-30
**Domain:** Electron IPC streaming, Node.js file system scanning, SHA-256 hashing, React UI state machines
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Explicit "Scan Now" button in DuplicatesPage — sidebar handles folder selection, page handles scan initiation
- **D-02:** `selectedFolder` stays in global Zustand store (`useAppStore`) — shared between Duplicates and Organizer
- **D-03:** Scan button doubles as re-scan — clicking it replaces old results, no separate action
- **D-04:** Full-page progress view (not inline) — shows folder path, progress bar, files/total, elapsed time, current file path, duplicates found so far
- **D-05:** "Cancel Scan" button on progress screen (SCAN-03)
- **D-06:** UI transitions to results after scan completes — SCAN-04 (first results within 2s) is a main-process concern
- **D-07:** Accordion cards per duplicate group — collapsed = file name + copy count + total size; expanded = full file rows
- **D-08:** File row shows: full path (truncated), file size, modified date, "KEEP" badge on retained copy
- **D-09:** First group expanded on results load; all others collapsed
- **D-10:** Summary bar: space savings text + [Keep Newest] [Keep Oldest] bulk preset buttons
- **D-11:** Sticky bottom panel (is the SAFETY-01 preview) — slides up when >=1 file checked; shows count + total size + "Delete X files -> Trash"
- **D-12:** One-click confirmation on the panel button (no second dialog) — SAFETY-03
- **D-13:** Protected folders configured in sidebar, near selected folder path

### Claude's Discretion

- Exact IPC streaming implementation detail — `webContents.send()` for progress events, `ipcMain.handle()` for start/cancel
- Zustand state shape for scan state (`scanStatus`, `scanProgress`, `duplicateGroups`, `selections`) — design for clarity and Phase 3 extensibility
- Additional shadcn/ui components to install (accordion, checkbox, progress, badge — determine during planning)
- Error states during scanning (permission denied, path not found)
- Whether scan handlers live in `src/main/index.ts` or `src/main/handlers/` — follow electron-vite conventions

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | Recursive directory walk collecting file metadata (name, path, size, modified date, extension) | `fs/promises` `readdir` with `withFileTypes: true` + `stat` — built-in, no library needed |
| SCAN-02 | Real-time progress indicator (files scanned / total, elapsed time, current path) | `webContents.send()` push events from main to renderer; listener exposed via contextBridge |
| SCAN-03 | Cancel in-progress scan at any time | `AbortController` in main process; `scan:cancel` IPC handle calls `controller.abort()` |
| SCAN-04 | First results appear within 2 seconds — streaming | Size pre-filter is cheap I/O (stat only); first batch ready fast after walk completes |
| DUPE-01 | Pre-filter by file size — only colliding sizes proceed to hashing | Group by size in memory (Map), filter groups with count > 1 |
| DUPE-02 | SHA-256 content hash for size-colliding files | `crypto.createHash('sha256')` + `fs.createReadStream` — streaming hash, no full-file load |
| DUPE-03 | Duplicate groups list with path, size, modified date | Zustand `duplicateGroups` state; shadcn Accordion renders groups |
| DUPE-04 | Space savings summary (X duplicates found, Y GB reclaimable) | Computed from `duplicateGroups` in Zustand selector |
| DUPE-05 | Select files to remove per group; "keep newest" / "keep oldest" presets | shadcn Checkbox per file row; preset logic with keep-at-least-one enforcement |
| DUPE-06 | Protected folders — files in protected folders never auto-selected | `protectedFolders: string[]` in store; preset logic checks `file.path.startsWith(folder)` |
| SELECT-01 | Bulk smart selection across all groups (keep newest, keep oldest) | Zustand action iterates all groups, applies preset rule, returns new `Set<string>` |
| SELECT-02 | Keep-at-least-one constraint — cannot queue all copies | Preset logic always excludes the anchor (newest/oldest) from selection |
| SAFETY-01 | Preview panel listing files to be removed + total size | Sticky bottom panel derived from `selections` state — no separate modal needed |
| SAFETY-02 | Files moved to Recycle Bin — no permanent delete | `shell.trashItem(path.resolve(filePath))` — async Promise API, built into Electron |
| SAFETY-03 | Explicit confirm required before deletion | One-click "Delete X files -> Trash" button on the panel is the confirmation (D-12) |
</phase_requirements>

---

## Summary

Phase 2 delivers a full scan-to-delete pipeline in Electron. The architecture divides cleanly into three layers: (1) main process logic — recursive directory walk, SHA-256 hashing, IPC coordination; (2) IPC bridge — typed channels in `shared/ipc-types.ts`, `contextBridge` exposure; (3) renderer UI — Zustand state machine, shadcn/ui component tree.

The central design insight is a **two-pass scan**: Pass 1 is a fast recursive walk collecting only file stats (cheap I/O), grouped by size in memory. Pass 2 hashes only the size-colliding candidates (typically a small fraction of total files). This is what makes SCAN-04 (2-second first results) achievable — size grouping completes quickly for typical personal folders, and the first duplicate candidates are identifiable before hashing finishes.

The IPC streaming pattern uses `webContents.send()` for progress push events from main to renderer. This is a one-way push channel, not request/response, so it does NOT go through `ipcMain.handle()`. The renderer subscribes via a cleanup-safe `useEffect` hook. TanStack Query has NO role in the streaming scan pipeline — it manages request/response caching, not push-event streams. For Phase 2, Zustand handles all scan state directly.

Worker threads for SHA-256 hashing are possible in electron-vite (via `?nodeWorker` import syntax + separate rollup entry) but add significant build complexity, and streaming SHA-256 with `createReadStream` is I/O-bound, not CPU-bound. Worker threads should be deferred to v2 if profiling reveals a bottleneck.

**Primary recommendation:** Two-pass scan in main process (stats walk + size-group + streaming hash of candidates) with `webContents.send()` progress events, single Zustand store extension, and shadcn Accordion + Checkbox + Badge + Progress components.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|------------|-----------|
| IPC security | NEVER expose `ipcRenderer` directly; NEVER `nodeIntegration: true`; ALWAYS `contextIsolation: true`; ONE function per IPC channel in preload |
| File deletion | Use `shell.trashItem()` only — no permanent delete in v1 |
| Path manipulation | Always `path.resolve()` / `path.join()` — never string concatenation |
| File watching | Do NOT use `fs.watch` / `fs.watchFile` — unreliable on Windows |
| State management | Zustand only — no Redux, Jotai, Recoil; single store |
| Testing | Vitest for unit tests — NOT Jest |
| Build | electron-vite only — no Webpack |
| UI | shadcn/ui + Tailwind CSS v4; zinc color scale; blue-500 as accent |

---

## Standard Stack

### Core (all already in package.json — no new npm dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | built-in | Recursive directory walk, file stat, read streams | Native async APIs; zero overhead; available in main process |
| Node.js `crypto` | built-in | SHA-256 streaming hash | `createHash('sha256')` + `createReadStream` — streaming, low memory |
| Node.js `path` | built-in | Path normalization for Windows | `path.resolve()` required for `shell.trashItem()` on Windows |
| Electron `shell.trashItem()` | built-in (Electron 39.x installed) | Move files to Recycle Bin | Async Promise API; correct Windows Recycle Bin integration |
| Electron `webContents.send()` | built-in | Push progress events to renderer | Correct one-way push channel from main process |
| Zustand | 5.0.12 (installed) | Scan state machine | Extend `useAppStore` — no new store |
| shadcn Accordion | CLI install (code only) | Duplicate groups collapsible UI | Radix-based, accessible, keyboard navigable |
| shadcn Checkbox | CLI install (code only) | File selection per row | Radix accessible checkbox with correct ARIA states |
| shadcn Badge | CLI install (code only) | "KEEP" label on file rows | Small label, variant support for green/zinc |
| shadcn Progress | CLI install (code only) | Scan progress bar | Radix Progress with ARIA progressbar role |

### Not Needed for Phase 2

| Library | Reason to Skip |
|---------|---------------|
| TanStack Query | No role in push-event streaming; Zustand handles all scan state directly; revisit in Phase 4 for scan history queries |
| worker_threads | SHA-256 via `createReadStream` is I/O-bound not CPU-bound; main-process async is sufficient; workers add build complexity (separate rollup entry, no Electron APIs in worker, ASAR unpack config) |
| readdirp / @nodelib/fs.walk | `fs.promises.readdir` with `{ withFileTypes: true }` + iterative stack is sufficient for v1 |

### Installation

```bash
# Run from project root — installs component source files only
npx shadcn@latest add accordion checkbox badge progress
```

Note: shadcn CLI v4.1.1 is already present (`npx shadcn --version` returns 4.1.1). Components install into `src/renderer/src/components/ui/` per the existing `components.json` alias configuration.

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
shared/
└── ipc-types.ts              # Add SCAN_START, SCAN_CANCEL, SCAN_PROGRESS,
                              # SCAN_COMPLETE, SCAN_ERROR, DELETE_FILES channels

src/main/
├── index.ts                  # Import and call registerScanHandlers(mainWindow)
└── handlers/
    └── scan.ts               # Scan logic + IPC handler registration

src/preload/
└── index.ts                  # Add scan functions to contextBridge

src/renderer/src/
├── store/
│   └── appStore.ts           # Extend with scan state slice
└── pages/
    └── DuplicatesPage.tsx    # Replace placeholder: 3 views (empty, scanning, results)
        components/           # Co-locate DuplicatesPage sub-components here
        ├── ScanProgress.tsx    # Full-page progress view (D-04)
        ├── ScanEmpty.tsx       # Empty state when no folder selected or no results
        ├── DuplicateGroups.tsx # Scrollable accordion list
        ├── DuplicateGroupCard.tsx  # Single accordion item
        ├── FileRow.tsx         # File path + size + date + KEEP badge + checkbox
        └── DeletePanel.tsx     # Sticky bottom panel (D-11)
```

The `src/main/handlers/` pattern keeps `index.ts` as an orchestrator. Each handler file is independently testable. This is the correct electron-vite convention for non-trivial main process logic.

### Pattern 1: Two-Pass Scan Algorithm

**What:** Separate the cheap stat walk (Pass 1) from the expensive hash computation (Pass 2).
**When to use:** Always. This structure achieves SCAN-04 (2-second first results) because size grouping completes before hashing.

```typescript
// src/main/handlers/scan.ts — conceptual structure

// PASS 1: Iterative walk (avoids call stack overflow on deep trees)
async function walkDirectory(
  dirPath: string,
  signal: AbortSignal,
  onFile: (entry: FileEntry, count: number) => void
): Promise<FileEntry[]>

// DUPE-01: Size pre-filter
function groupBySize(files: FileEntry[]): Map<number, FileEntry[]>
// Returns only groups with 2+ files — singleton sizes are discarded

// PASS 2: Hash only size-colliding candidates (DUPE-02)
async function hashFile(filePath: string): Promise<string>
// Uses crypto.createHash('sha256') + fs.createReadStream — streaming, non-blocking

// Group hash-confirmed duplicates
function groupByHash(
  candidates: FileEntry[]
): Promise<DuplicateGroup[]>
```

### Pattern 2: IPC Channel Design

**What:** Typed channels following existing `IPC_CHANNELS` convention. One function per channel in preload.
**When to use:** All new IPC operations.

```typescript
// shared/ipc-types.ts — add to IPC_CHANNELS
SCAN_START: 'scan:start',
SCAN_CANCEL: 'scan:cancel',
SCAN_PROGRESS: 'scan:progress',   // push event (main -> renderer)
SCAN_COMPLETE: 'scan:complete',   // push event (main -> renderer)
SCAN_ERROR: 'scan:error',         // push event (main -> renderer)
DELETE_FILES: 'files:delete',

// shared/ipc-types.ts — type definitions
export interface ScanProgressEvent {
  filesScanned: number
  totalFiles: number      // 0 during Pass 1 walk (total unknown until walk completes)
  currentPath: string
  duplicatesFound: number
  elapsedMs: number
}

export interface FileEntry {
  path: string
  size: number
  mtime: number   // millisecond timestamp
  name: string
}

export interface DuplicateGroup {
  hash: string
  files: FileEntry[]
  totalWastedBytes: number   // size * (files.length - 1)
}

// IpcApi additions
scanStart: (folderPath: string) => Promise<void>
scanCancel: () => Promise<void>
deleteFiles: (paths: string[]) => Promise<DeleteResult>
onScanProgress: (cb: (e: ScanProgressEvent) => void) => () => void
onScanComplete: (cb: (groups: DuplicateGroup[]) => void) => () => void
onScanError: (cb: (message: string) => void) => () => void
```

**Critical:** `scan:start` handle returns `Promise<void>`. Results arrive via `scan:complete` push event. Do NOT return groups from the handle.

### Pattern 3: preload.ts Push Event Exposure

**What:** Expose listener functions that return cleanup callbacks. Never expose raw `ipcRenderer`.
**When to use:** All main-to-renderer push event subscriptions.

```typescript
// src/preload/index.ts — push event pattern (source: Electron IPC docs)
onScanProgress: (callback: (event: ScanProgressEvent) => void) => {
  const handler = (_: Electron.IpcRendererEvent, data: ScanProgressEvent) => callback(data)
  ipcRenderer.on(IPC_CHANNELS.SCAN_PROGRESS, handler)
  return () => ipcRenderer.off(IPC_CHANNELS.SCAN_PROGRESS, handler)
},
```

The return value (unsubscribe function) is used in React's `useEffect` cleanup.

### Pattern 4: Main Process scan handler with AbortController

**What:** Module-level controller allows cancel from a separate IPC handle.
**When to use:** Any cancellable long-running operation in main process.

```typescript
// src/main/handlers/scan.ts
let scanController: AbortController | null = null

export function registerScanHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.SCAN_START, async (_, folderPath: string) => {
    scanController?.abort()  // Cancel any in-progress scan
    scanController = new AbortController()
    const { signal } = scanController

    try {
      // ... walk + group + hash ...
      mainWindow.webContents.send(IPC_CHANNELS.SCAN_COMPLETE, duplicateGroups)
    } catch (err: unknown) {
      const isAbort = (err as { name?: string }).name === 'AbortError'
      if (!isAbort) {
        mainWindow.webContents.send(IPC_CHANNELS.SCAN_ERROR, (err as Error).message)
      }
      // AbortError = user cancelled — no error event to renderer
    } finally {
      scanController = null
    }
    // Returns void — results delivered via webContents.send()
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_CANCEL, async () => {
    scanController?.abort()
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_FILES, async (_, paths: string[]) => {
    const succeeded: string[] = []
    const failed: Array<{ path: string; error: string }> = []
    for (const filePath of paths) {
      try {
        await shell.trashItem(path.resolve(filePath))  // path.resolve = backslash on Windows
        succeeded.push(filePath)
      } catch (err) {
        failed.push({ path: filePath, error: (err as Error).message })
      }
    }
    return { succeeded, failed }
  })
}
```

### Pattern 5: Zustand Scan State Slice

**What:** Extend the existing `useAppStore` with scan state. Use explicit status enum.
**When to use:** All scan and duplicate state in Phase 2.

```typescript
// src/renderer/src/store/appStore.ts — additions

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error' | 'cancelled'

// State shape (add to existing AppState interface)
scanStatus: ScanStatus
scanProgress: ScanProgressEvent | null
duplicateGroups: DuplicateGroup[]
selections: Set<string>          // File paths checked for deletion
protectedFolders: string[]
scanError: string | null

// Actions
setScanStatus: (status: ScanStatus) => void
setScanProgress: (p: ScanProgressEvent) => void
setScanComplete: (groups: DuplicateGroup[]) => void
setScanError: (msg: string) => void
toggleSelection: (path: string) => void    // Must create new Set() — see Pitfall 5
setSelections: (paths: Set<string>) => void  // Used by preset actions
clearSelections: () => void
addProtectedFolder: (folder: string) => void
removeProtectedFolder: (folder: string) => void
resetScan: () => void    // Returns to idle state, clears groups and selections
```

**Set mutation rule:** Always `new Set(state.selections)` — mutating in-place does not trigger re-renders.

### Pattern 6: Preset Selection Logic (SELECT-01 + SELECT-02)

**What:** Pure function computing which files to select given a preset and protected folders.
**When to use:** "Keep Newest" and "Keep Oldest" button handlers.

```typescript
// Lives in renderer — pure function, easy to unit-test
function applyPreset(
  groups: DuplicateGroup[],
  preset: 'newest' | 'oldest',
  protectedFolders: string[]
): Set<string> {
  const selected = new Set<string>()

  for (const group of groups) {
    const sorted = [...group.files].sort((a, b) =>
      preset === 'newest' ? b.mtime - a.mtime : a.mtime - b.mtime
    )
    // sorted[0] is the keeper — never selected
    const candidates = sorted.slice(1)

    for (const file of candidates) {
      const isProtected = protectedFolders.some(pf =>
        file.path.startsWith(pf + path.sep) || file.path === pf
      )
      if (!isProtected) selected.add(file.path)
    }
  }

  return selected
  // SELECT-02 satisfied: sorted[0] is always excluded from selection
}
```

### Pattern 7: Cleanup-Safe IPC Listeners in React

**What:** Subscribe to push events in `useEffect`, call the returned cleanup on unmount.
**When to use:** ALL `window.api.onScan*` listeners.

```typescript
// DuplicatesPage.tsx
useEffect(() => {
  const unsubProgress = window.api.onScanProgress((data) => {
    setScanProgress(data)
    // totalFiles is 0 during walk — show indeterminate progress bar
  })
  const unsubComplete = window.api.onScanComplete((groups) => {
    setScanComplete(groups)
  })
  const unsubError = window.api.onScanError((msg) => {
    setScanError(msg)
  })

  return () => {
    unsubProgress()
    unsubComplete()
    unsubError()
  }
}, [])  // Empty deps: mount once; handlers read latest Zustand state, not stale closure
```

### Pattern 8: shadcn Accordion with Controlled State

**What:** Use `type="multiple"` with controlled `value` array so preset changes update KEEP badges without collapsing open groups.
**When to use:** The `DuplicateGroups` component.

```typescript
// DuplicateGroups.tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
  from '@/components/ui/accordion'

// D-09: First group open, rest closed on initial load
const [openItems, setOpenItems] = useState<string[]>(
  groups.length > 0 ? [groups[0].hash] : []
)

<Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
  {groups.map((group) => (
    <AccordionItem key={group.hash} value={group.hash}>
      <AccordionTrigger>...</AccordionTrigger>
      <AccordionContent>...</AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

Use `group.hash` as `value` — stable unique key that does not change when group order changes.

### Anti-Patterns to Avoid

- **Returning groups from `ipcMain.handle(SCAN_START)`:** Handle returns void; results push via `webContents.send(SCAN_COMPLETE)`
- **Exposing `ipcRenderer.on` directly in preload:** Security violation — always return cleanup wrapper
- **`fs.watch` / `fs.watchFile` for anything:** CLAUDE.md prohibits; unreliable on Windows
- **String path concatenation:** `path + '\\file'` — always `path.join()` / `path.resolve()`
- **`shell.moveItemToTrash()`:** Deprecated — use `shell.trashItem()` exclusively
- **Hashing all files:** Pre-filter by size first (DUPE-01) — skips the majority of files
- **Forking a new Zustand store:** Extend `useAppStore` per project constraints
- **Mutating `Set` in-place in Zustand:** `new Set(state.selections)` always

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 file hashing | Custom hash implementation | `crypto.createHash('sha256')` + `createReadStream` | Built-in Node.js; streaming; handles files of any size |
| Windows Recycle Bin integration | Shell exec / third-party `trash` pkg | `shell.trashItem()` | Native Electron API; built-in; correct Windows integration |
| Accessible accordion | Custom expand/collapse divs | shadcn `Accordion` (Radix) | ARIA roles, keyboard nav, animation — done correctly |
| Accessible checkbox | `<input type="checkbox">` with custom CSS | shadcn `Checkbox` | Radix accessible checkbox; correct ARIA checked state |
| Progress bar | Animated div with `width: X%` | shadcn `Progress` | Radix Progress with ARIA `progressbar` role and `aria-valuenow` |
| Status badge | Inline `<span>` with conditional class | shadcn `Badge` | Consistent visual style; variant system (default/green/etc.) |
| Path normalization | `filePath.replace(/\//g, '\\')` | `path.resolve(filePath)` | `path.resolve` handles all edge cases; required for `shell.trashItem()` |
| File size display | `(bytes / 1024 / 1024).toFixed(2)` everywhere | `formatBytes()` utility in `lib/utils.ts` | Reused across file rows, summary bar, delete panel; write once |

**Key insight:** The scanning pipeline core logic (walk + size-group + hash) is Walnut-specific and must be custom. All I/O primitives (`fs`, `crypto`, `path`), all UI primitives (shadcn), and all platform APIs (`shell`, `webContents`) are provided — use them.

---

## Common Pitfalls

### Pitfall 1: `shell.trashItem()` Fails with Forward Slashes on Windows
**What goes wrong:** `shell.trashItem('C:/Users/foo/file.txt')` throws "Failed to create FileOperation instance" on some Windows configurations.
**Why it happens:** The Windows API underlying `shell.trashItem()` requires backslash path separators.
**How to avoid:** Always call `path.resolve(filePath)` before `shell.trashItem()`. On Windows, `path.resolve` produces backslash paths.
**Warning signs:** `Error: Failed to create FileOperation instance` in main process console.

### Pitfall 2: Returning Groups from `ipcMain.handle(SCAN_START)`
**What goes wrong:** Developer returns `DuplicateGroup[]` from the scan handle promise. The renderer awaits `window.api.scanStart()` and expects the result — but the long-running scan blocks or times out.
**Why it happens:** Confusion between request/response (`handle`/`invoke`) and streaming push events (`webContents.send`).
**How to avoid:** `handle(SCAN_START)` resolves immediately with void. Results arrive via `SCAN_COMPLETE` push event. The renderer sets up the `onScanComplete` listener before calling `scanStart`.

### Pitfall 3: IPC Listener Accumulation in React StrictMode
**What goes wrong:** In development (React StrictMode double-invokes effects), `DuplicatesPage` mounts twice. Each mount adds a progress listener. Two listeners fire on every progress event — state updates happen in rapid pairs.
**Why it happens:** `ipcRenderer.on()` accumulates listeners. StrictMode unmounts and remounts components.
**How to avoid:** The preload's `onScanProgress` returns an `() => void` unsubscribe. The `useEffect` MUST return this cleanup. Pattern 7 above shows the correct structure.
**Warning signs:** Console logs show duplicate progress events; progress bar jumps/flickers.

### Pitfall 4: Hashing Permission-Denied Files Crashes the Scan
**What goes wrong:** `hashFile()` throws when a locked or restricted file is encountered. Unhandled rejection propagates up and kills the entire scan.
**Why it happens:** Windows user directories contain many system/locked files (AppData, hidden dirs). Any file `stat()` can succeed but `createReadStream` can fail.
**How to avoid:** Wrap both `stat()` and `hashFile()` in try/catch and skip failures. Optionally log skipped file count in progress events.
**Warning signs:** Scan on `C:\Users\*` fails immediately due to locked AppData files.

### Pitfall 5: `Set<string>` in Zustand Not Triggering Re-renders
**What goes wrong:** `state.selections.add(path)` mutates in-place. Zustand's shallow compare sees the same `Set` reference — no state update, UI doesn't re-render.
**Why it happens:** Zustand uses reference equality by default. Mutating an object/Set in-place keeps the same reference.
**How to avoid:**
```typescript
toggleSelection: (filePath) => set((state) => {
  const next = new Set(state.selections)
  if (next.has(filePath)) next.delete(filePath)
  else next.add(filePath)
  return { selections: next }
})
```

### Pitfall 6: shadcn CLI Creates `@/` Directory Literally
**What goes wrong:** `npx shadcn@latest add accordion` creates `@/components/ui/accordion.tsx` as a literal path.
**Why it happens:** Known CLI behavior — does not resolve Vite alias paths at install time. Encountered and solved in Phase 1.
**How to avoid:** Verify `components.json` has the correct `aliases.ui` pointing to `src/renderer/src/components/ui`. If components land in the wrong place, move them as was done in Phase 1.
**Warning signs:** New `@/` directory appears at project root after install.

### Pitfall 7: Accordion `value` Using Array Index Instead of Stable Key
**What goes wrong:** Using `value={String(index)}` on `AccordionItem`. When groups re-order or a group is removed after deletion, open panels jump to wrong groups.
**Why it happens:** Radix Accordion identifies open panels by the `value` string. Array index is not stable after mutations.
**How to avoid:** Use `value={group.hash}` — the hash is the natural stable key per group.

### Pitfall 8: Keep-At-Least-One Not Enforced for Manual Checkbox Clicks
**What goes wrong:** User manually checks every file in a group. All copies get moved to trash. The file is gone.
**Why it happens:** Preset logic enforces SELECT-02 but per-row checkbox `toggleSelection` does not.
**How to avoid:** In `FileRow`'s `onCheckedChange`, check if this check would leave zero unselected files in the group. If so, block the action. Visually disable the checkbox on the last unchecked file in each group (the implied "KEEP" file) when all others are checked.

### Pitfall 9: `totalFiles` Is Unknown During Pass 1 Walk
**What goes wrong:** Progress bar shows `0 / 0` or divides by zero during the initial directory walk phase.
**Why it happens:** Total file count is not known until the walk finishes. Progress events during Pass 1 have `totalFiles: 0`.
**How to avoid:** Render an indeterminate progress bar (no percentage) when `totalFiles === 0`. Switch to a determinate bar during Pass 2 hashing (when `totalFiles > 0`). shadcn `Progress` supports both: pass `value={null}` for indeterminate (or omit value).

---

## Code Examples

### Verified: Streaming SHA-256 Hash

```typescript
// Source: Node.js crypto docs (built-in)
import { createHash } from 'crypto'
import { createReadStream } from 'fs'

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

### Verified: Iterative Directory Walk (avoids stack overflow on deep trees)

```typescript
// Source: Node.js fs/promises docs
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

async function walkDirectory(
  rootPath: string,
  signal: AbortSignal
): Promise<{ path: string; size: number; mtime: number; name: string }[]> {
  const results: { path: string; size: number; mtime: number; name: string }[] = []
  const stack = [rootPath]  // Iterative — no call stack limit

  while (stack.length > 0) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const dir = stack.pop()!
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          stack.push(fullPath)
        } else if (entry.isFile()) {
          try {
            const s = await stat(fullPath)
            results.push({ path: fullPath, size: s.size, mtime: s.mtimeMs, name: entry.name })
          } catch { /* skip locked/unreadable files */ }
        }
      }
    } catch { /* skip unreadable directories */ }
  }
  return results
}
```

### Verified: Size Group Pre-filter

```typescript
// No source needed — pure Map logic
function groupBySize<T extends { size: number }>(files: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>()
  for (const file of files) {
    if (!map.has(file.size)) map.set(file.size, [])
    map.get(file.size)!.push(file)
  }
  for (const [size, group] of map) {
    if (group.length < 2) map.delete(size)
  }
  return map
}
```

### Verified: shell.trashItem() with Path Resolution

```typescript
// Source: Electron shell API docs
import { shell } from 'electron'
import { resolve } from 'path'

async function trashFile(filePath: string): Promise<void> {
  // path.resolve() produces backslash paths on Windows — required by shell.trashItem()
  await shell.trashItem(resolve(filePath))
}
```

### Utility: File Size Formatter

```typescript
// Add to src/renderer/src/lib/utils.ts
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

// Add to src/renderer/src/lib/utils.ts
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
```

### Verified: shadcn Accordion Controlled Mode

```typescript
// Source: ui.shadcn.com/docs/components/radix/accordion
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion'

// type="multiple" + controlled value: allows multiple open groups simultaneously
// D-09: initialize with first group open
const [openItems, setOpenItems] = useState<string[]>(
  groups.length > 0 ? [groups[0].hash] : []
)

<Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
  {groups.map((group) => (
    <AccordionItem key={group.hash} value={group.hash}>
      <AccordionTrigger>
        {/* collapsed header */}
      </AccordionTrigger>
      <AccordionContent>
        {/* expanded rows */}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `shell.moveItemToTrash()` (sync, deprecated) | `shell.trashItem()` (async Promise) | Electron 29 | Must `await`; old API should not be used |
| `ipcRenderer.sendSync()` for progress | `webContents.send()` push events | Best practice since Electron 7 | Sync IPC blocks renderer thread — never use for streaming |
| TanStack Query for all async operations | TanStack Query for request/response; Zustand for streaming state | TanStack Query v5 (2023) | Push-event streams have no "query key" to cache or invalidate |
| Separate Zustand store per feature | Single store with slice-like organization | Zustand v4+ community consensus | Prevents import cycles; co-located state easier to read in devtools |
| Recursive `readdir` function | Iterative stack-based walk | Node.js best practice | Recursive walk hits call stack limit on deeply nested directories |

**Deprecated/outdated in this codebase:**
- `shell.moveItemToTrash(path, deleteOnFail)`: Removed in recent Electron — do not use
- `ipcRenderer.send()` for requests expecting a response: Use `ipcRenderer.invoke()` + `ipcMain.handle()`

---

## Environment Availability

The phase is entirely within the existing installed environment. All dependencies are built into the Electron/Node.js runtime or are already in `package.json`.

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| Node.js | All main process code | Yes | v22.16.0 | Built-in `fs`, `crypto`, `path` available |
| Electron `shell.trashItem` | SAFETY-02 | Yes | 39.2.6 installed | Async API — confirmed available since Electron 29 |
| Electron `webContents.send` | SCAN-02/04 | Yes | 39.2.6 installed | Standard API |
| Zustand 5.x | State management | Yes | 5.0.12 | Already in package.json |
| shadcn CLI | Component install | Yes | 4.1.1 | `npx shadcn --version` confirmed |
| Accordion/Checkbox/Badge/Progress | UI components | Install via CLI | n/a | Not yet installed; CLI will add to `components/ui/` |
| vitest | Unit tests (Phase 4) | Yes | 4.1.2 | Config exists at `vitest.config.ts` |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Accordion/Checkbox/Badge/Progress components not yet installed — install via `npx shadcn@latest add accordion checkbox badge progress` before implementing those components.

---

## Open Questions

1. **Throttling progress events during fast scans**
   - What we know: `webContents.send()` is called per-file. For large folders (100k+ files), this could flood the IPC bridge.
   - What's unclear: Whether Electron's IPC handles high-frequency sends gracefully or whether batching is needed.
   - Recommendation: Throttle progress events to a maximum of ~10/second using a simple timestamp check (`if (Date.now() - lastSend > 100) send(...)`) — simple enough to add in the handler without a library.

2. **`totalFiles` unavailability during Pass 1 walk**
   - What we know: Total file count is only known after the walk completes. Progress events during walk have `totalFiles: 0`.
   - What's unclear: Whether the UX is acceptable with an indeterminate progress bar during walk.
   - Recommendation: Indeterminate bar during walk (show just elapsed time and current path), determinate bar during hashing phase. shadcn `Progress` with `value={null}` for indeterminate.

3. **Protected folder path matching precision**
   - What we know: `file.path.startsWith(protectedFolder)` could match partial directory names (e.g., `/photos` matching `/photos-backup`).
   - What's unclear: Whether this is a real concern for v1.
   - Recommendation: Match with path separator: `file.path.startsWith(protectedFolder + path.sep)` or exact equality `file.path === protectedFolder`. Documented in Pattern 6 above.

---

## Sources

### Primary (HIGH confidence)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — Pattern 3 (main to renderer), contextBridge exposure, cleanup pattern
- [Electron shell API](https://www.electronjs.org/docs/latest/api/shell) — `shell.trashItem()` async behavior, Windows path requirement
- [Electron Multithreading](https://www.electronjs.org/docs/latest/tutorial/multithreading/) — Worker thread restrictions (no Electron APIs), native module constraints
- [shadcn/ui Accordion docs](https://ui.shadcn.com/docs/components/radix/accordion) — Component API, import paths, controlled mode props
- [electron-vite worker example](https://github.com/alex8088/electron-vite-worker-example) — `?nodeWorker` import syntax, rollup entry config
- Node.js built-in docs (`fs/promises`, `crypto`, `path`) — used per training data; APIs are stable

### Secondary (MEDIUM confidence)
- WebSearch: Electron AbortController cancel pattern — feature request confirms AbortSignal is not natively passed across IPC; module-level controller is the correct workaround
- WebSearch: shadcn CLI components available — accordion, checkbox, badge, progress confirmed available via `npx shadcn@latest add`
- WebSearch: Electron `shell.trashItem` Windows issues — confirmed path format requirement and OneDrive edge case

### Tertiary (LOW confidence — for awareness only)
- WebSearch: `readdirp`, `@nodelib/fs.walk` — considered but not recommended; built-in is sufficient
- WebSearch: `threads.js` ASAR unpack pattern — considered but not recommended for v1

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are built-in or already in package.json; shadcn component availability confirmed via CLI
- Architecture: HIGH — IPC patterns from official Electron docs; Zustand patterns from existing codebase
- Pitfalls: HIGH for Windows-specific ones (shell.trashItem path, fs.watch prohibition from CLAUDE.md); MEDIUM for Set mutation (common Zustand gotcha, well-documented)
- Code examples: HIGH — crypto/fs patterns are stable Node.js APIs; Accordion example from official shadcn docs

**Research date:** 2026-03-30
**Valid until:** 2026-05-30 (Electron/shadcn are stable; Node.js built-ins are permanent)
