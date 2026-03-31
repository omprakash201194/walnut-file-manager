---
phase: 04-quality-distribution
plan: "03"
subsystem: ipc-history-ui
tags: [ipc, scan-history, version, sidebar, electron-conf, zustand]
dependency_graph:
  requires: [04-01]
  provides: [scan-history-ipc, version-ipc, sidebar-recent, sidebar-version-footer]
  affects: [Sidebar.tsx, appStore.ts, scan.ts, preload/index.ts, shared/ipc-types.ts]
tech_stack:
  added: []
  patterns: [electron-conf Conf<T> for persistent history, push-event IPC with cleanup return, Zustand slice extension]
key_files:
  created:
    - src/main/handlers/scanHistory.ts
  modified:
    - shared/ipc-types.ts
    - src/preload/index.ts
    - src/main/index.ts
    - src/main/handlers/scan.ts
    - src/renderer/src/store/appStore.ts
    - src/renderer/src/components/Sidebar.tsx
    - src/main/__tests__/scan.test.ts
decisions:
  - scanHistory handler uses electron-conf following organizer.ts pattern — deduplicated, capped at 5, newest-first
  - addToScanHistory called inside scan.ts SCAN_START handler to avoid double-registering ipcMain.handle
  - scan.test.ts mocks scanHistory module to prevent electron-conf/electron import chain failure in Vitest node env
metrics:
  duration: 5min
  completed: "2026-03-31"
  tasks_completed: 2
  files_modified: 7
  files_created: 1
---

# Phase 04 Plan 03: Scan History + Version Display Summary

**One-liner:** Scan history persisted via electron-conf with deduplication and 5-entry cap; version footer and Recent section wired end-to-end via new IPC channels.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | IPC contracts + scan history handler | 66324b2 | shared/ipc-types.ts, src/preload/index.ts, src/main/handlers/scanHistory.ts, src/main/handlers/scan.ts, src/main/index.ts |
| 2 | Zustand store + Sidebar Recent section + version footer | 0c707da | src/renderer/src/store/appStore.ts, src/renderer/src/components/Sidebar.tsx |

## What Was Built

**IPC layer (Task 1):**
- Added `APP_GET_VERSION`, `SCAN_HISTORY_GET`, `SCAN_HISTORY_UPDATED` to `IPC_CHANNELS` in `shared/ipc-types.ts`
- Extended `IpcApi` interface with `getAppVersion`, `getScanHistory`, `onScanHistoryUpdated`
- Created `src/main/handlers/scanHistory.ts` — `addToScanHistory` deduplicates and caps at 5 entries (newest-first), `getScanHistory` reads from electron-conf store named `'scan-history'`
- Registered `APP_GET_VERSION` (returns `app.getVersion()`) and `SCAN_HISTORY_GET` handlers in `main/index.ts`
- Wired `addToScanHistory(folderPath)` call inside `scan.ts` SCAN_START handler — pushes `SCAN_HISTORY_UPDATED` event to renderer immediately after recording
- Exposed `getAppVersion`, `getScanHistory`, `onScanHistoryUpdated` via contextBridge in `preload/index.ts`

**UI layer (Task 2):**
- Added `scanHistory: string[]` and `setScanHistory` to `AppState` interface and Zustand store initializer in `appStore.ts`
- `Sidebar.tsx` Section E: loads history on mount via `getScanHistory()`, subscribes to `onScanHistoryUpdated` push events (returns cleanup), renders folder list hidden when empty
- Clicking a history entry calls `setSelectedFolder(folder)`, `resetScan()`, and `window.api.scanStart(folder)` — starts scan immediately per D-03
- Version footer: `getAppVersion()` on mount stored in local state, renders `Walnut v{version}` in muted text at sidebar bottom

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scan.ts SCAN_START import broke scan unit tests**
- **Found during:** Task 2 verification (npm test)
- **Issue:** scan.ts now imports `scanHistory.ts` which imports `electron-conf/main`, which transitively imports `electron`. Vitest node environment cannot resolve the `electron` CommonJS module.
- **Fix:** Added `vi.mock('../handlers/scanHistory', ...)` in `scan.test.ts` to mock the scanHistory module and isolate the unit test from Electron dependencies
- **Files modified:** `src/main/__tests__/scan.test.ts`
- **Commit:** f6b06d1

## Known Stubs

None — all data sources are wired end-to-end. `scanHistory` loads from electron-conf on mount and updates live via push events.

## Self-Check: PASSED

- src/main/handlers/scanHistory.ts: FOUND
- src/renderer/src/components/Sidebar.tsx: FOUND
- Commit 66324b2 (Task 1): FOUND
- Commit 0c707da (Task 2): FOUND
- Commit f6b06d1 (fix): FOUND
