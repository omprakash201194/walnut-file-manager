# Architecture Patterns

**Domain:** Electron desktop file manager
**Researched:** 2026-03-29

## Recommended Architecture

### Process Model

Electron apps run two process types. This separation is non-negotiable for security.

```
+------------------+     IPC (invoke/handle)     +-------------------+
|   Main Process   | <=========================> |  Renderer Process |
|   (Node.js)      |                             |  (Chromium)       |
|                  |                             |                   |
|  - File system   |     contextBridge           |  - React UI       |
|  - OS APIs       | <------(preload)--------->  |  - Zustand store  |
|  - Hashing       |                             |  - TanStack Query |
|  - Trash ops     |                             |  - React Router   |
|  - Window mgmt   |                             |  - shadcn/ui      |
+------------------+                             +-------------------+
```

### Directory Structure

```
src/
  main/              -- Main process (Node.js)
    index.ts          -- App lifecycle, window creation
    ipc/              -- IPC handlers organized by domain
      fs.handlers.ts        -- File system operations
      duplicates.handlers.ts -- Duplicate detection logic
      organize.handlers.ts   -- File organization logic
    services/         -- Business logic (testable, no Electron deps)
      scanner.ts      -- Directory scanning
      hasher.ts       -- SHA-256 content hashing
      duplicates.ts   -- Duplicate grouping algorithm
      organizer.ts    -- File categorization + move logic
      undo.ts         -- Undo tracking for reorganization
  preload/            -- Preload scripts
    index.ts          -- contextBridge API definition
  renderer/           -- React app
    src/
      app/            -- App shell, routing, providers
      features/       -- Feature modules
        duplicates/   -- Duplicate detection UI
        organizer/    -- File organization UI
      components/     -- Shared UI components (shadcn/ui)
      hooks/          -- Custom React hooks
      stores/         -- Zustand stores
      lib/            -- Utilities
  shared/             -- Types shared between main and renderer
    types/
      fs.types.ts     -- File, Directory, ScanResult types
      duplicates.types.ts
      organize.types.ts
      ipc.types.ts    -- IPC channel names and payload types
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Main/IPC Handlers | Receive IPC calls, delegate to services, return results | Services, Preload (via IPC) |
| Main/Services | Pure business logic: scanning, hashing, grouping, organizing | Node.js fs, crypto (no Electron APIs) |
| Preload | Bridge between main and renderer. Exposes typed API. | Main (ipcRenderer.invoke), Renderer (contextBridge) |
| Renderer/Stores | UI state: selections, scan progress, preferences | React components (via hooks) |
| Renderer/Features | Feature-specific UI: duplicate list, organization preview | Stores, IPC API (via TanStack Query), Components |
| Renderer/Components | Reusable UI primitives (shadcn/ui based) | Nothing -- pure presentational |
| Shared/Types | TypeScript interfaces shared across processes | Imported by main, preload, and renderer |

### Data Flow

**Duplicate Detection Flow:**
```
1. User clicks "Scan" in React UI
2. TanStack Query calls window.api.findDuplicates(path)
3. Preload forwards via ipcRenderer.invoke('duplicates:find', path)
4. Main handler receives, calls DuplicateService
5. DuplicateService:
   a. ScannerService.scan(path) -> FileInfo[]
   b. Group by file size (pre-filter)
   c. HasherService.hash(files) -> hashes (streaming SHA-256)
   d. Group by hash -> DuplicateGroup[]
   e. Return DuplicateGroup[] via Promise
6. Result flows back through IPC to TanStack Query
7. React renders duplicate groups
8. User selects files to delete -> Zustand selection state
9. User confirms -> window.api.moveToTrash(selectedPaths)
10. Main handler calls shell.moveItemToTrash() for each path
```

**Progress Reporting:**
```
Main process sends progress updates via:
  mainWindow.webContents.send('scan:progress', { scanned: 1500, total: 8000 })

Renderer listens via preload-exposed callback:
  window.api.onScanProgress((progress) => updateStore(progress))
```

This is the one case where main-to-renderer communication is needed (push, not pull). Use `ipcMain.handle` for request/response, `webContents.send` for progress streaming.

## Patterns to Follow

### Pattern 1: Service Layer Separation

**What:** Keep business logic in plain TypeScript classes/functions with no Electron dependencies.

**When:** All file operations, hashing, categorization, duplicate grouping.

**Why:** Services are testable with Vitest without mocking Electron. IPC handlers are thin wrappers.

```typescript
// services/hasher.ts -- pure Node.js, no Electron
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

```typescript
// ipc/duplicates.handlers.ts -- thin wrapper
import { ipcMain } from 'electron'
import { findDuplicates } from '../services/duplicates'

export function registerDuplicateHandlers() {
  ipcMain.handle('duplicates:find', async (_event, path: string) => {
    return findDuplicates(path)
  })
}
```

### Pattern 2: Typed IPC Contracts

**What:** Define IPC channel names and payload types in `src/shared/` so main, preload, and renderer all agree on the contract.

**When:** Every IPC channel.

```typescript
// shared/types/ipc.types.ts
export interface IpcApi {
  scanDirectory: (path: string) => Promise<ScanResult>
  findDuplicates: (path: string) => Promise<DuplicateGroup[]>
  previewOrganization: (path: string) => Promise<OrganizePlan>
  applyOrganization: (plan: OrganizePlan) => Promise<void>
  undoOrganization: () => Promise<void>
  moveToTrash: (paths: string[]) => Promise<TrashResult>
  selectDirectory: () => Promise<string | null>
  onScanProgress: (callback: (progress: ScanProgress) => void) => void
}
```

### Pattern 3: Streaming Hash for Large Files

**What:** Never load entire files into memory for hashing. Use `createReadStream` to stream file content through SHA-256.

**When:** Any file hashing operation.

**Why:** Users may have multi-GB video files. Loading into memory would crash the app.

### Pattern 4: AbortController for Cancellation

**What:** Pass AbortSignal through scanning operations to support user cancellation.

**When:** Any long-running scan or hash operation.

```typescript
async function scanDirectory(path: string, signal?: AbortSignal): Promise<FileInfo[]> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  // ... scan logic, check signal.aborted periodically
}
```

### Pattern 5: Virtualized Lists for File Display

**What:** Use `@tanstack/react-virtual` for rendering file lists instead of raw DOM elements.

**When:** Any list that could contain more than ~100 items (all file lists in Walnut).

**Why:** A 50,000-file scan result rendered as DOM nodes will crash the browser. Virtualization renders only visible rows.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fat Preload Script

**What:** Putting business logic in the preload script.

**Why bad:** Preload runs in a restricted context. Logic becomes untestable and unmaintainable.

**Instead:** Preload should contain ONLY `contextBridge.exposeInMainWorld()` calls that forward to `ipcRenderer.invoke()`. Zero business logic.

### Anti-Pattern 2: Synchronous File Operations

**What:** Using `fs.readFileSync`, `fs.readdirSync`, etc.

**Why bad:** Blocks the main process event loop. UI freezes. Electron becomes unresponsive.

**Instead:** Always use `fs/promises` or streaming APIs. For CPU-heavy work (hashing thousands of files), consider worker threads.

### Anti-Pattern 3: God Store

**What:** Putting all state in one massive Zustand store with 50 properties.

**Why bad:** Hard to reason about, components re-render on unrelated changes.

**Instead:** Split into focused stores: `useScanStore`, `useDuplicateStore`, `useOrganizeStore`, `usePreferencesStore`. Zustand supports multiple stores cleanly.

### Anti-Pattern 4: Exposing Raw IPC

**What:** Passing `ipcRenderer.send` or `ipcRenderer.on` through contextBridge.

**Why bad:** Renderer can listen to any channel, send to any channel. Total security bypass.

**Instead:** One wrapper function per allowed operation. No dynamic channel names.

### Anti-Pattern 5: Synchronous IPC

**What:** Using `ipcRenderer.sendSync()` for any reason.

**Why bad:** Blocks the entire renderer process. UI freezes.

**Instead:** Always use `ipcRenderer.invoke()` (async) for request-response patterns.

## Scalability Considerations

| Concern | At 1K files | At 50K files | At 500K files |
|---------|-------------|--------------|---------------|
| Scanning | Instant (<1s) | 2-5 seconds | Worker thread recommended |
| Hashing | Fast, sequential OK | Batch with concurrency limit (5-10 parallel) | Worker thread + progress essential |
| UI rendering | Direct render | Virtualized list required | Virtualized list + pagination |
| Memory | Negligible | ~50MB for metadata | Stream results, don't hold all in memory |
| IPC payload | Single message | Single message OK | Chunked/streaming responses |

**Worker threads:** For v1, sequential async operations in the main process should suffice for the target scale (tens of thousands of files). If benchmarks show bottlenecks, move hashing to a worker thread. Don't prematurely optimize.

## Sources

- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [electron-vite Development Guide](https://electron-vite.org/guide/dev)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
