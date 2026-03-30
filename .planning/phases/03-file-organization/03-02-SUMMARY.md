---
phase: 03-file-organization
plan: "02"
subsystem: api
tags: [electron, ipc, file-system, electron-conf, safeMove, undo, organizer]

# Dependency graph
requires:
  - phase: 03-file-organization/03-01
    provides: "IPC channel types, ByTypeStrategy, ByExtensionStrategy, shared/ipc-types organizer types"
provides:
  - "src/main/handlers/organizer.ts with all four IPC handlers: ORG_PREVIEW, ORG_APPLY, ORG_UNDO, ORG_GET_STATE"
  - "safeMove utility with EXDEV-safe fallback (copy+delete)"
  - "resolveDestPath collision avoidance with (N) suffixes"
  - "buildCategoryMap delegation to strategy classes"
  - "electron-conf persistent undo stack across app restarts"
  - "registerOrganizerHandlers() ready to wire into main/index.ts (Plan 05)"
affects:
  - "03-03 (preload): needs channel names and handler signatures"
  - "03-04 (renderer): organizer page calls orgApply/orgUndo/orgPreview/orgGetState"
  - "03-05 (wiring): calls registerOrganizerHandlers in main/index.ts"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "safeMove: EXDEV-catching rename-then-copy+delete pattern for cross-device file moves"
    - "electron-conf Conf<T> module-level singleton for persistent JSON storage in userData"
    - "Parallel undoStack/lastApplyTimes arrays — same index = one Apply operation"
    - "Push partial undo record even on Apply failure (Pitfall 6 defense)"
    - "resolveDestPath loop with fs.access for collision detection before move"

key-files:
  created:
    - src/main/handlers/organizer.ts
    - src/main/__tests__/organizer.test.ts
  modified: []

key-decisions:
  - "safeMove exports are public (not private) to enable unit testing without IPC wiring"
  - "buildCategoryMap exports are public for unit testing; strategy factory remains private"
  - "lastApplyTimes is a parallel array (not embedded in undoStack entries) for O(1) last-time lookup"
  - "ORG_UNDO pops stack even on partial failure — partial undo surfaced as renderer error, not silent retry"

patterns-established:
  - "Pattern: Export pure helper functions from handler modules to enable unit testing without Electron"
  - "Pattern: Mock electron-conf with class-based constructor in vi.mock for Vitest compatibility"

requirements-completed: [ORG-03, ORG-04, SAFETY-04, SAFETY-05]

# Metrics
duration: 10min
completed: 2026-03-30
---

# Phase 03 Plan 02: Organizer IPC Handler Summary

**Main-process organizer with EXDEV-safe safeMove, collision-avoiding resolveDestPath, four IPC handlers (preview/apply/undo/get-state), and electron-conf persistent undo stack**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-30T14:40:00Z
- **Completed:** 2026-03-30T14:50:22Z
- **Tasks:** 1 (TDD: test commit + implementation commit)
- **Files modified:** 2

## Accomplishments

- `safeMove()` with EXDEV fallback implements safe cross-device file moves — bare `fs.rename` would crash on Windows drive junctions
- `ORG_PREVIEW` returns CategoryMap dry-run with zero disk writes (SAFETY-04 / ORG-03 satisfied)
- `ORG_APPLY` creates destination subdirs via `mkdir {recursive: true}`, avoids collisions with `(N)` suffix, pushes partial undo record even when some files fail (Pitfall 6 defense, ORG-04 / SAFETY-05)
- `ORG_UNDO` reverses last apply in reverse order, pops stack even on partial failure
- `ORG_GET_STATE` surfaces `undoStackSize` and `lastApplyTime` for renderer mount initialization
- electron-conf `Conf<OrganizerStore>` stores undo stack at `{userData}/organizer.json` — survives app restarts (D-06)
- 13 unit tests covering safeMove, fileExists, resolveDestPath, and buildCategoryMap — all passing

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing organizer tests** - `ad2c2a9` (test)
2. **Task 1 (TDD GREEN): Organizer handler implementation** - `e789185` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD task has two commits — failing test (RED) then implementation (GREEN)._

## Files Created/Modified

- `src/main/handlers/organizer.ts` - All four IPC handlers + safeMove + resolveDestPath + buildCategoryMap + registerOrganizerHandlers
- `src/main/__tests__/organizer.test.ts` - 13 unit tests for pure-function exports; mocks electron-conf and Electron ipcMain

## Decisions Made

- Exported `safeMove`, `fileExists`, `resolveDestPath`, and `buildCategoryMap` as public functions instead of keeping them private — required for unit testing without a running Electron instance
- `lastApplyTimes` is a parallel array (not nested inside `undoStack` entries) — simpler `store.get('lastApplyTimes')[stack.length - 1]` lookup vs embedding per-record timestamps
- Used class-based `MockConf` in vi.mock instead of `vi.fn().mockImplementation(() => ...)` — Vitest requires function keyword or class syntax for constructor mocks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest mock for electron-conf Conf constructor**
- **Found during:** TDD GREEN phase (running tests after writing implementation)
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` produces an arrow function, which cannot be used with `new` — Vitest threw "not a constructor" error
- **Fix:** Replaced arrow function mock with class-based `MockConf` using `get`/`set` methods
- **Files modified:** `src/main/__tests__/organizer.test.ts`
- **Verification:** All 13 tests pass (vitest run output shows 13 passed)
- **Committed in:** `e789185` (Task 1 GREEN commit, updated test alongside implementation)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test mock)
**Impact on plan:** Fix was necessary for test suite to run. No scope creep.

## Issues Encountered

None beyond the mock constructor bug documented above.

## User Setup Required

None - no external service configuration required. `electron-conf` was already installed in Phase 03 Plan 01.

## Next Phase Readiness

- `registerOrganizerHandlers` is exported and ready for Plan 05 to wire into `src/main/index.ts`
- All four IPC channels (`ORG_PREVIEW`, `ORG_APPLY`, `ORG_UNDO`, `ORG_GET_STATE`) are implemented and TypeScript-valid
- Plan 03 (preload) can expose the channels via contextBridge; Plan 04 (renderer) can call them
- No changes required to this file when wiring in Plan 05

## Known Stubs

None — all handlers are fully implemented. No hardcoded empty returns or placeholders.

---
*Phase: 03-file-organization*
*Completed: 2026-03-30*
