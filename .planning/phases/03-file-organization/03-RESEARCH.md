# Phase 03: File Organization - Research

**Researched:** 2026-03-30
**Domain:** Electron file system operations, persistent storage, strategy pattern, React UI state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Shared scan):** OrganizerPage reads from same Zustand scan results (`duplicateGroups` / raw `FileEntry[]`) as DuplicatesPage. No second walkDirectory call. If no scan has run yet, OrganizerPage shows empty state prompting user to scan first via existing Scan Now flow.
- **D-02 (Preview visualization):** Grouped flat list by destination category. One collapsible section per category (Documents, Photos, Music, Video, Archives, Other). Section header: category name + file count. Expanded section lists individual file names. No before/after columns. Preview is read-only in v1.
- **D-03 (Strategy picker):** Tab-based picker at top of OrganizerPage. Two tabs: "By Type" (default) and "By Extension". Switching tabs regenerates the preview if one has already been shown. Strategy defined as TypeScript interface (`OrganizationStrategy`) for ORG-05 extensibility.
- **D-04 (Preview trigger):** Manual — user clicks "Preview" button. Page does not auto-preview on load or tab switch if no preview shown yet. After first preview, switching strategy tabs auto-regenerates.
- **D-05 (Page layout):** Top to bottom: strategy tabs → Preview button → preview area → Apply button → Undo button. Action bar fixed at bottom matching DeletePanel pattern.
- **D-06 (Undo persistence):** Stack-based undo using electron-store. Each Apply pushes `{ from: string, to: string }[]` onto persistent stack. Undo pops top entry and reverses each move. Stack survives app restarts. No cap on stack depth.

### Claude's Discretion

- electron-store key name and exact schema for the undo stack
- Exact file extension → category mapping for ORG-01
- Error handling for move failures (file locked, permission denied) — dismissible error area below Apply button
- Empty state for OrganizerPage when no scan results exist
- Whether "By Extension" strategy creates one folder per extension or groups common extensions

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORG-01 | App categorizes scanned files by type into: Documents, Photos, Music, Video, Archives, Other | Extension map defined in UI-SPEC; pure categorizer function in main process |
| ORG-02 | User can select organization strategy (By Type, By Extension) | Tab-based strategy picker; `OrganizationStrategy` TypeScript interface pattern |
| ORG-03 | App generates dry-run preview of proposed file moves before executing | IPC `ORG_PREVIEW` channel; no disk writes; returns categorized file arrays |
| ORG-04 | User applies reorganization — files moved into type-based subdirectories | `fs.promises.rename()` with EXDEV fallback (copy+delete); `mkdir -p` before move |
| ORG-05 | Organization strategy is extensible — new strategies addable without restructuring | `OrganizationStrategy` interface with `categorize(files: FileEntry[]): CategoryMap` method |
| SAFETY-04 | Before reorganization, user sees dry-run preview showing proposed moves | Preview area renders before any disk write occurs; Apply disabled until preview shown |
| SAFETY-05 | User can undo last reorganization, reversing all file moves | electron-conf persistent stack; `ORG_UNDO` IPC handler reverses `{ from, to }[]` array |
</phase_requirements>

---

## Summary

Phase 3 builds the file organization pipeline on top of Phase 2's infrastructure. The core work is three layers: (1) a main-process categorizer and strategy engine that maps `FileEntry[]` to destination paths, (2) three IPC handlers (`ORG_PREVIEW`, `ORG_APPLY`, `ORG_UNDO`) with matching preload exposure and Zustand state, and (3) a full OrganizerPage replacing the current placeholder.

The most significant technical decision is persistent undo. CONTEXT.md specifies electron-store, but electron-store v10+ is pure ESM and creates integration friction with electron-vite's CJS main process build. The project should use **electron-conf** instead — it is the drop-in alternative created by the electron-vite maintainer specifically for this scenario, is CJS+ESM compatible, and has an identical API surface.

The second critical pitfall is file moves. `fs.promises.rename()` is not safe for cross-device moves on Windows (throws EXDEV). Phase 3 must implement a safe move that catches EXDEV and falls back to `copyFile` + `unlink`. This is especially relevant since Walnut organizes files within the same scanned folder (same device, low risk), but defensive handling is required because any drive letter boundary triggers EXDEV.

**Primary recommendation:** Use electron-conf for persistence, implement `safeMove()` with EXDEV fallback, model the strategy engine as a pure TypeScript module, and follow the exact IPC+preload+Zustand pattern established in Phase 2.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | built-in | File moves (`rename`, `mkdir`, `copyFile`, `unlink`) | Already used in scan.ts; no new dependency |
| Node.js `path` | built-in | Path join for destination resolution | Platform-safe; already used throughout |
| electron-conf | ^1.3.0 | Persistent undo stack across app restarts | Created by electron-vite maintainer; CJS+ESM; drop-in replacement for electron-store; avoids ESM import error in CJS main process |
| shadcn Tabs | CLI v4 (add tabs) | Strategy picker UI | Only missing shadcn component; consistent with installed set |

### Already Installed (reuse from Phase 2)

| Library | Purpose |
|---------|---------|
| Zustand ^5.0 | Organizer state slice — status, preview, undo availability |
| shadcn Accordion | Collapsible category sections in preview |
| shadcn Badge | File count chip per category |
| shadcn Button | Preview / Apply / Undo buttons |
| shadcn ScrollArea | Preview list overflow |
| lucide-react | Category icons (FileText, Image, Music, Video, Archive, File) |

### Why NOT electron-store

electron-store v10+ is pure ESM. The electron-vite main process build outputs CommonJS by default (no `"type": "module"` in `package.json`). Importing a pure-ESM package into a CJS module causes a runtime error: `ERR_REQUIRE_ESM`. The workaround (changing tsconfig to NodeNext + adding `"type": "module"`) requires Electron 30+ and forces a full project migration. electron-conf was built by the electron-vite author to solve exactly this compatibility issue. Identical API, no migration required.

**Installation:**

```bash
npm install electron-conf
npx shadcn add tabs
```

**Version verification:**

```
electron-conf: 1.3.0 (verified 2026-03-30 via npm view electron-conf)
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── main/
│   └── handlers/
│       ├── scan.ts          # existing — unchanged
│       └── organizer.ts     # NEW: ORG_PREVIEW, ORG_APPLY, ORG_UNDO handlers + registerOrganizerHandlers()
├── renderer/src/
│   ├── pages/
│   │   └── OrganizerPage.tsx       # Replace placeholder entirely
│   ├── components/
│   │   ├── PreviewAccordion.tsx    # Accordion list of category sections
│   │   └── ActionBar.tsx           # Fixed bottom bar with Apply + Undo
│   └── store/
│       └── appStore.ts             # Extend with organizer slice
shared/
└── ipc-types.ts                    # Add ORG channels + types
```

### Pattern 1: OrganizationStrategy Interface (ORG-05)

**What:** A TypeScript interface that all organization strategies must implement. The strategy takes a `FileEntry[]` and returns a `CategoryMap` — a map from folder name to the files going there.

**When to use:** Always. Every strategy (By Type, By Extension, and future strategies) must conform to this interface. New strategies can be added by implementing the interface without touching the categorizer pipeline.

**Example:**

```typescript
// shared/ipc-types.ts (add alongside existing types)

export interface CategoryMap {
  [categoryName: string]: FileEntry[]
}

export interface OrganizationStrategy {
  readonly name: string
  categorize(files: FileEntry[], targetDir: string): CategoryMap
}

// src/main/strategies/byType.ts
export class ByTypeStrategy implements OrganizationStrategy {
  readonly name = 'By Type'

  categorize(files: FileEntry[], _targetDir: string): CategoryMap {
    const map: CategoryMap = {}
    for (const file of files) {
      const category = getCategory(file.name) // pure lookup
      if (!map[category]) map[category] = []
      map[category].push(file)
    }
    return map
  }
}

// src/main/strategies/byExtension.ts
export class ByExtensionStrategy implements OrganizationStrategy {
  readonly name = 'By Extension'

  categorize(files: FileEntry[], _targetDir: string): CategoryMap {
    const map: CategoryMap = {}
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase().replace('.', '') || 'no-extension'
      if (!map[ext]) map[ext] = []
      map[ext].push(file)
    }
    return map
  }
}
```

### Pattern 2: safeMove — EXDEV-Safe File Rename (ORG-04)

**What:** `fs.promises.rename()` throws EXDEV when source and destination are on different devices. On Windows this can occur even on the same physical drive if separate drive letters are involved. A safe wrapper catches EXDEV and falls back to copy + delete.

**When to use:** Always for file moves in Phase 3. Never use bare `fs.promises.rename()` for user files.

```typescript
// src/main/handlers/organizer.ts

async function safeMove(src: string, dest: string): Promise<void> {
  try {
    await fs.rename(src, dest)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EXDEV') {
      // Cross-device: copy then delete
      await fs.copyFile(src, dest)
      await fs.unlink(src)
    } else {
      throw err
    }
  }
}
```

### Pattern 3: IPC Handler Registration (mirrors registerScanHandlers)

**What:** All organizer IPC handlers live in `src/main/handlers/organizer.ts` and are registered via `registerOrganizerHandlers(mainWindow)` called once from `src/main/index.ts`.

```typescript
// src/main/index.ts additions
import { registerOrganizerHandlers } from './handlers/organizer'

// Inside app.whenReady():
registerOrganizerHandlers(mainWindow)
```

### Pattern 4: Zustand Organizer Slice (mirrors scan state)

**What:** Extend `appStore.ts` with organizer-specific state. Keep the organizer state isolated from scan state — the organizer slice reads from `scanFiles` (raw `FileEntry[]` derived from `duplicateGroups`) but does not own it.

```typescript
// New state to add to AppState interface:

export type OrganizerStatus =
  | 'no-scan'     // No scan results in store
  | 'idle'        // Scan exists, no preview generated
  | 'previewing'  // Preview IPC call in flight
  | 'ready'       // Preview data returned, Apply enabled
  | 'applying'    // Apply IPC call in flight
  | 'done'        // Apply complete, Undo visible
  | 'error'       // Move failure during apply

interface OrganizerState {
  organizerStatus: OrganizerStatus
  organizerPreview: CategoryMap | null      // from shared/ipc-types
  organizerError: string | null
  organizerUndoAvailable: boolean
  organizerLastApplyTime: number | null     // ms timestamp for Undo button label
  activeStrategy: 'by-type' | 'by-extension'

  setOrganizerStatus: (s: OrganizerStatus) => void
  setOrganizerPreview: (preview: CategoryMap) => void
  setOrganizerError: (msg: string | null) => void
  setOrganizerUndoAvailable: (available: boolean) => void
  setActiveStrategy: (s: 'by-type' | 'by-extension') => void
  resetOrganizer: () => void
}
```

### Pattern 5: electron-conf Persistent Undo Stack (D-06 / SAFETY-05)

**What:** electron-conf stores the undo stack as a JSON array in the app's userData directory. The stack is an array of move-record arrays, where each record captures one Apply operation.

```typescript
// src/main/handlers/organizer.ts

import { Conf } from 'electron-conf/main'

interface MoveRecord {
  from: string
  to: string
}

interface OrganizerStore {
  undoStack: MoveRecord[][]   // Each entry = one Apply operation's moves
}

const store = new Conf<OrganizerStore>({
  name: 'organizer',           // Creates organizer.json in userData
  defaults: {
    undoStack: []
  }
})

// Push after successful Apply:
const current = store.get('undoStack')
store.set('undoStack', [...current, moveRecords])

// Pop on Undo:
const stack = store.get('undoStack')
const toReverse = stack[stack.length - 1]
store.set('undoStack', stack.slice(0, -1))
```

### Pattern 6: IPC Channel + Preload + Type Extension

All three files must be updated together for each new IPC operation:

```typescript
// shared/ipc-types.ts additions

export const IPC_CHANNELS = {
  // ... existing channels ...
  ORG_PREVIEW: 'org:preview',
  ORG_APPLY: 'org:apply',
  ORG_UNDO: 'org:undo',
} as const

export interface OrgPreviewRequest {
  strategy: 'by-type' | 'by-extension'
  targetDir: string
}

export interface OrgApplyRequest {
  strategy: 'by-type' | 'by-extension'
  targetDir: string
}

export interface OrgApplyResult {
  succeeded: MoveRecord[]
  failed: Array<{ path: string; error: string }>
}

export interface OrgUndoResult {
  reversed: number
  failed: Array<{ path: string; error: string }>
}

// IpcApi additions:
orgPreview: (req: OrgPreviewRequest) => Promise<CategoryMap>
orgApply: (req: OrgApplyRequest) => Promise<OrgApplyResult>
orgUndo: () => Promise<OrgUndoResult>
undoStackSize: () => Promise<number>
```

```typescript
// src/preload/index.ts additions (inside contextBridge.exposeInMainWorld):
orgPreview: (req) => ipcRenderer.invoke(IPC_CHANNELS.ORG_PREVIEW, req),
orgApply: (req) => ipcRenderer.invoke(IPC_CHANNELS.ORG_APPLY, req),
orgUndo: () => ipcRenderer.invoke(IPC_CHANNELS.ORG_UNDO),
undoStackSize: () => ipcRenderer.invoke(IPC_CHANNELS.ORG_UNDO_STACK_SIZE),
```

### Anti-Patterns to Avoid

- **Anti-pattern: Using `fs.promises.rename()` directly.** Always use `safeMove()` — EXDEV on Windows is a runtime crash, not a compile-time error.
- **Anti-pattern: importing electron-store.** It is pure ESM and will fail at runtime in the CJS main process. Use electron-conf.
- **Anti-pattern: Storing preview data in the main process.** Preview is computed on demand and returned to renderer. Only the undo stack (applied operations) is persisted.
- **Anti-pattern: Moving files before `mkdir`.** Always `await fs.mkdir(destDir, { recursive: true })` before `safeMove()`. The destination subdirectory does not exist until created.
- **Anti-pattern: Exposing raw `ipcRenderer`.** Follow the one-function-per-operation pattern already established in preload/index.ts.
- **Anti-pattern: Storing full `FileEntry[]` in CategoryMap values sent over IPC.** The preview IPC response should use a serialization-safe shape — do not assume class instances survive the IPC boundary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent config/state across restarts | Custom JSON file read/write | electron-conf | Handles atomic writes, file locking, schema validation, userData path — custom impl has corruption risk on crash |
| Cross-device file moves | Custom copy+delete logic from scratch | `safeMove()` helper (12 lines) wrapping `fs.rename` + EXDEV fallback | Minimal — just the EXDEV catch; don't add a full library dependency |
| Collapsible category sections | Custom accordion component | shadcn Accordion (already installed) | Accessible keyboard nav, animation, aria-expanded — already in the project |
| Strategy tab switching | Custom tab state machine | shadcn Tabs (one `npx shadcn add tabs`) | Keyboard nav, aria-selected, active indicator — don't reimplement |

**Key insight:** The "hard parts" of Phase 3 are the undo persistence edge cases and the file move correctness — not the UI. Use existing libraries for UI, spend implementation care on move/undo correctness.

---

## Common Pitfalls

### Pitfall 1: electron-store ESM in CJS Main Process

**What goes wrong:** `import ElectronStore from 'electron-store'` in `src/main/handlers/organizer.ts` throws `ERR_REQUIRE_ESM` at runtime because electron-vite compiles the main process to CJS.

**Why it happens:** electron-store v10+ dropped CJS support entirely. The project `package.json` has no `"type": "module"`. When Node.js requires a pure-ESM package from a CJS module, it throws.

**How to avoid:** Use electron-conf (`import { Conf } from 'electron-conf/main'`). It explicitly supports both CJS and ESM. Same API surface.

**Warning signs:** Build succeeds but app crashes on startup with `ERR_REQUIRE_ESM` referencing electron-store.

### Pitfall 2: EXDEV on File Rename

**What goes wrong:** `await fs.promises.rename(src, dest)` throws `Error: EXDEV: cross-device link not permitted, rename` even when moving files within the same C: drive in some Windows configurations.

**Why it happens:** Windows treats certain directory junctions, drive mounts, or EFS-encrypted paths as separate devices. `rename(2)` is a syscall that cannot cross device boundaries.

**How to avoid:** Always use `safeMove()` which catches EXDEV and falls back to `copyFile` + `unlink`. Walnut moves files within the same scanned folder so risk is low, but defensive coding is required.

**Warning signs:** Move succeeds in dev on a clean Windows machine but fails for users with non-standard drive configurations (external drives, mapped network drives, EFS).

### Pitfall 3: Destination Directory Not Created Before Move

**What goes wrong:** `safeMove(file.path, path.join(targetDir, 'Documents', file.name))` throws `ENOENT` because the `Documents/` subdirectory does not exist yet.

**Why it happens:** The category subdirectories are created by the Apply operation. They do not exist in the original folder structure.

**How to avoid:** Before moving any file in a category, `await fs.mkdir(path.join(targetDir, categoryName), { recursive: true })`. The `recursive: true` flag makes it idempotent — safe to call even if directory exists.

**Warning signs:** First file in each new category directory fails with ENOENT; subsequent files (if directory was created by partial success) would succeed.

### Pitfall 4: Filename Collision in Destination

**What goes wrong:** Two source files have the same name (e.g., `notes.txt` in two different subfolders), both categorized as Documents. The second move overwrites the first.

**Why it happens:** Flat destination structure — all Documents go to `targetDir/Documents/filename`. The by-name collision is not detected during preview.

**How to avoid:** During Apply, check if destination path exists before moving. If it does, append a numeric suffix: `notes (1).txt`, `notes (2).txt`. Log the rename in the undo record using the actual destination path, not the planned one. The preview should ideally flag collisions.

**Warning signs:** Files disappear silently after reorganization. Undo does not restore one of the files because its undo record points to the overwritten path.

### Pitfall 5: Undo Stack Grows Unbounded

**What goes wrong:** The CONTEXT.md specifies "no cap on stack depth." This is by design (user decision), but the stack is read into memory on startup and must be serialized on every Apply.

**Why it happens:** electron-conf reads the entire store on first access. Very large stacks (thousands of operations) may cause slow startup.

**How to avoid:** Not a concern for v1 — users realistically run Apply a handful of times. No mitigation needed now. Document as a v2 concern if needed. The planner should NOT add an arbitrary cap — that contradicts D-06.

**Warning signs:** N/A for v1.

### Pitfall 6: Partial Apply with No Undo Record

**What goes wrong:** Apply moves 50 of 100 files, then fails. The handler throws. No undo record is pushed because the push happens after the loop. User has half-organized files with no way to undo.

**Why it happens:** Undo push placed after the Apply loop fails mid-execution.

**How to avoid:** Push the undo record for each file that succeeded immediately as moves complete (collect succeeded moves incrementally). On failure, push whatever succeeded so the user can undo the partial operation. Surface the partial-success error message from the UI-SPEC: "Moved [success] of [total] files. [N] file(s) could not be moved."

**Warning signs:** Partial file moves with no Undo button available.

---

## Code Examples

### Extension-to-Category Lookup (ORG-01)

Based on UI-SPEC category definitions (Claude's discretion resolved):

```typescript
// src/main/handlers/organizer.ts

const CATEGORY_MAP: Record<string, string> = {
  // Documents
  pdf: 'Documents', doc: 'Documents', docx: 'Documents',
  xls: 'Documents', xlsx: 'Documents', ppt: 'Documents', pptx: 'Documents',
  odt: 'Documents', ods: 'Documents', odp: 'Documents',
  txt: 'Documents', rtf: 'Documents', md: 'Documents',
  csv: 'Documents', pages: 'Documents', numbers: 'Documents', key: 'Documents',
  // Photos
  jpg: 'Photos', jpeg: 'Photos', png: 'Photos', gif: 'Photos',
  webp: 'Photos', heic: 'Photos', heif: 'Photos', bmp: 'Photos',
  tiff: 'Photos', tif: 'Photos', svg: 'Photos', ico: 'Photos',
  raw: 'Photos', cr2: 'Photos', nef: 'Photos', arw: 'Photos',
  // Music
  mp3: 'Music', flac: 'Music', aac: 'Music', wav: 'Music',
  ogg: 'Music', m4a: 'Music', wma: 'Music', opus: 'Music', aiff: 'Music',
  // Video
  mp4: 'Video', mov: 'Video', avi: 'Video', mkv: 'Video',
  wmv: 'Video', flv: 'Video', webm: 'Video', m4v: 'Video',
  mpg: 'Video', mpeg: 'Video', '3gp': 'Video',
  // Archives
  zip: 'Archives', rar: 'Archives', '7z': 'Archives',
  tar: 'Archives', gz: 'Archives', bz2: 'Archives',
  xz: 'Archives', iso: 'Archives', dmg: 'Archives', cab: 'Archives',
}

export function getCategory(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  return CATEGORY_MAP[ext] ?? 'Other'
}
```

### OrgApply Handler (main process skeleton)

```typescript
// src/main/handlers/organizer.ts

ipcMain.handle(IPC_CHANNELS.ORG_APPLY, async (_, req: OrgApplyRequest): Promise<OrgApplyResult> => {
  const files: FileEntry[] = /* received from request or re-derived from stored state */
  const strategy = req.strategy === 'by-type' ? new ByTypeStrategy() : new ByExtensionStrategy()
  const categoryMap = strategy.categorize(files, req.targetDir)

  const succeeded: MoveRecord[] = []
  const failed: Array<{ path: string; error: string }> = []

  for (const [category, categoryFiles] of Object.entries(categoryMap)) {
    const destDir = path.join(req.targetDir, category)
    await fs.mkdir(destDir, { recursive: true })  // Pitfall 3 prevention

    for (const file of categoryFiles) {
      let destPath = path.join(destDir, file.name)

      // Pitfall 4: collision avoidance
      let counter = 1
      while (await fileExists(destPath)) {
        const ext = path.extname(file.name)
        const base = path.basename(file.name, ext)
        destPath = path.join(destDir, `${base} (${counter})${ext}`)
        counter++
      }

      try {
        await safeMove(file.path, destPath)
        succeeded.push({ from: file.path, to: destPath })
      } catch (err) {
        failed.push({ path: file.path, error: (err as Error).message })
      }
    }
  }

  // Pitfall 6: push partial undo record even on failure
  if (succeeded.length > 0) {
    const stack = store.get('undoStack')
    store.set('undoStack', [...stack, succeeded])
  }

  return { succeeded, failed }
})
```

### OrgUndo Handler

```typescript
ipcMain.handle(IPC_CHANNELS.ORG_UNDO, async (): Promise<OrgUndoResult> => {
  const stack = store.get('undoStack')
  if (stack.length === 0) return { reversed: 0, failed: [] }

  const toReverse = stack[stack.length - 1]
  const failed: Array<{ path: string; error: string }> = []
  let reversed = 0

  // Reverse in reverse order to avoid collision on re-creation
  for (const move of [...toReverse].reverse()) {
    try {
      await safeMove(move.to, move.from)
      reversed++
    } catch (err) {
      failed.push({ path: move.to, error: (err as Error).message })
    }
  }

  // Pop stack regardless of failures — partial undo is surfaced as error
  store.set('undoStack', stack.slice(0, -1))
  return { reversed, failed }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-store for Electron persistence | electron-conf (same author's electron-vite–friendly fork) | electron-store v10 (2023) dropped CJS | electron-store is now ESM-only; electron-conf is the CJS-safe successor for electron-vite projects |
| `fs.rename()` for file moves | `safeMove()` with EXDEV fallback | Always true on Windows | Windows + non-standard drive configs trigger EXDEV; bare rename is unsafe |
| `fs.promises.rename` for atomic moves | Copy+delete fallback when EXDEV | N/A | Sacrifices atomicity for cross-device compat; acceptable since Walnut targets same-device moves |

**Deprecated/outdated:**

- `electron-store` (in CJS electron-vite context): Use electron-conf instead. electron-store itself is fine for ESM-native Electron projects but not this one.

---

## Open Questions

1. **Files array in ORG_APPLY IPC payload**
   - What we know: The renderer has `FileEntry[]` in Zustand state (from scan results). The main process does not independently hold file state.
   - What's unclear: Should the renderer send the full `FileEntry[]` in the `OrgApplyRequest` payload (potentially large), or should the main process re-derive from a stored scan output?
   - Recommendation: Send the full `FileEntry[]` from renderer → main via IPC. IPC has no practical size limit for a typical file manager scan (thousands of files = small JSON). This is the simplest approach and matches the pattern used for `deleteFiles`. Confirm during planning.

2. **`undoStackSize` query for initial Undo button state**
   - What we know: On page load, the renderer needs to know if undo history exists so it can show the Undo button.
   - What's unclear: Whether to expose a separate `undoStackSize()` IPC call or include stack metadata in a single `orgGetState()` call.
   - Recommendation: Add `orgGetState(): Promise<{ undoStackSize: number; lastApplyTime: number | null }>` to the IPC API. Renderer calls this on mount to initialize `organizerUndoAvailable` and `organizerLastApplyTime`.

3. **Filename collision in preview vs. apply**
   - What we know: Collision avoidance is needed during Apply (Pitfall 4). The preview is a dry-run.
   - What's unclear: Should the preview show renamed filenames (e.g., `notes (1).txt`) or the original names?
   - Recommendation: Show original names in preview (simpler, matches D-02 spec). The rename happens transparently during Apply. Collision count could be surfaced as a preview annotation in a future version.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js fs/promises | File moves | Yes (built-in) | Node 22.16.0 | — |
| electron-conf | Undo persistence | No (not installed yet) | 1.3.0 available on npm | — |
| shadcn Tabs | Strategy picker UI | No (not installed yet) | CLI v4 | — |
| Electron | Main process | Yes | 39.2.6 | — |

**Missing dependencies with no fallback:**

- `electron-conf` — must be installed before organizer IPC handler can be implemented
- `shadcn Tabs` — must be added before OrganizerPage can render the strategy picker

**Missing dependencies with fallback:**

- None

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is skipped per configuration.

---

## Sources

### Primary (HIGH confidence)

- Existing project source (`src/main/handlers/scan.ts`, `src/preload/index.ts`, `shared/ipc-types.ts`, `src/renderer/src/store/appStore.ts`) — patterns directly inspected
- `.planning/phases/03-file-organization/03-CONTEXT.md` — locked decisions D-01 through D-06
- `.planning/phases/03-file-organization/03-UI-SPEC.md` — component inventory, category definitions, interaction contracts
- `electron-conf` GitHub (github.com/alex8088/electron-conf) — API, CJS/ESM compat, schema support

### Secondary (MEDIUM confidence)

- WebSearch + electron-vite discussions: electron-store ESM incompatibility with CJS main process — multiple sources confirm (github.com/alex8088/electron-vite/discussions/542)
- Node.js `fs.rename` EXDEV behavior on Windows — documented in Node.js issues and multiple Windows-specific bug reports

### Tertiary (LOW confidence)

- None — all critical claims verified against primary or secondary sources

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — electron-conf and shadcn Tabs both verified; all other dependencies already present in project
- Architecture: HIGH — directly modeled on Phase 2 patterns inspected in source code
- Pitfalls: HIGH (ESM/EXDEV/mkdir) — verified via official sources; MEDIUM (collision, partial apply) — based on general file system reasoning

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable ecosystem; electron-conf/shadcn unlikely to change meaningfully in 30 days)
