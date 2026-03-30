---
phase: 02-duplicate-detection
plan: 03
subsystem: renderer-ipc-bridge
tags: [ipc, preload, zustand, state-machine, utilities]
dependency_graph:
  requires: [02-01]
  provides: [window.api scan functions, useAppStore scan state, applyPreset, formatBytes]
  affects: [02-04, 02-05]
tech_stack:
  added: []
  patterns:
    - contextBridge push-event wrapper with cleanup function return
    - Zustand state machine with ScanStatus enum
    - Immutable Set updates for Zustand selections (always new Set)
    - Pure function preset selection with keep-at-least-one constraint
key_files:
  created: []
  modified:
    - src/preload/index.ts
    - src/renderer/src/store/appStore.ts
    - src/renderer/src/lib/utils.ts
decisions:
  - Push-event listeners return cleanup functions to enable safe useEffect teardown and prevent StrictMode accumulation
  - applyPreset is a named pure function export (not in store) for testability — called from click handlers, result passed to setSelections
  - toggleSelection always creates new Set instance — Zustand (and React) equality check requires reference change to trigger re-render
  - path module imported as nodePath alias to avoid conflicts in renderer context
metrics:
  duration: 8min
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 03: Renderer IPC Bridge and Scan State Machine Summary

**One-liner:** Extended preload contextBridge with six typed scan functions (invoke + push-event listeners with cleanup returns) and Zustand store with full ScanStatus state machine, applyPreset pure function, and formatBytes utility.

## What Was Built

### Task 1: src/preload/index.ts — IPC Bridge Extension

Extended the existing preload file to expose all scan-related IPC functions via `contextBridge.exposeInMainWorld`. The existing `selectDirectory` function was preserved.

Added functions:
- `scanStart(folderPath)` — invoke SCAN_START channel
- `scanCancel()` — invoke SCAN_CANCEL channel
- `deleteFiles(paths)` — invoke DELETE_FILES channel, returns `DeleteResult`
- `onScanProgress(callback)` — listens on SCAN_PROGRESS, returns `() => void` cleanup
- `onScanComplete(callback)` — listens on SCAN_COMPLETE, returns `() => void` cleanup
- `onScanError(callback)` — listens on SCAN_ERROR, returns `() => void` cleanup

Security compliance: `ipcRenderer` is never exposed directly. Each push-event listener wraps `ipcRenderer.on` and returns `() => ipcRenderer.off(channel, handler)` so callers can tear down listeners in `useEffect` cleanup.

### Task 2: appStore.ts + utils.ts — State Machine and Utilities

**appStore.ts** — extended with:
- `ScanStatus` type exported: `'idle' | 'scanning' | 'complete' | 'error' | 'cancelled'`
- `applyPreset(groups, preset, protectedFolders)` pure function exported (named export, not in store) — implements SELECT-01, SELECT-02 (keep-at-least-one), DUPE-06 (protected folder exclusion)
- Scan state fields: `scanStatus`, `scanProgress`, `duplicateGroups`, `selections` (Set), `protectedFolders`, `scanError`
- Actions: `setScanStatus`, `setScanProgress`, `setScanComplete`, `setScanError`, `toggleSelection`, `setSelections`, `clearSelections`, `addProtectedFolder`, `removeProtectedFolder`, `resetScan`
- `toggleSelection` always creates `new Set(state.selections)` before mutating — prevents Zustand/React equality false-negative

**utils.ts** — added `formatBytes(bytes: number): string` alongside existing `cn`. Handles B/KB/MB/GB with 1 decimal place.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan is purely logic/state — no UI rendering.

## Self-Check: PASSED

- src/preload/index.ts — modified, contains all 6 scan functions
- src/renderer/src/store/appStore.ts — modified, contains ScanStatus, applyPreset, full state machine
- src/renderer/src/lib/utils.ts — modified, contains formatBytes
- Commits: f74ce40 (Task 1), a613f2c (Task 2)
- `npx tsc --noEmit` — exits 0
