---
phase: 02-duplicate-detection
plan: 06
subsystem: ui
tags: [electron, ipc, scan, duplicate-detection, name-pattern]

# Dependency graph
requires:
  - phase: 02-duplicate-detection
    provides: scan engine, preload bridge, Zustand store, DuplicatesPage, DeletePanel — all prior plans in phase 02
provides:
  - registerScanHandlers wired into main process
  - name-pattern detection for Windows copy files ("- Copy", "(N)" suffixes)
  - full end-to-end scan-to-delete pipeline verified working
affects: [03-file-organizer, future scan enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass duplicate detection: content (size+hash) AND name-pattern (canonicalBasename) merged without duplicates"
    - "canonicalBasename strips Windows copy suffixes for case-insensitive grouping regardless of file size"

key-files:
  created: []
  modified:
    - src/main/index.ts
    - src/main/handlers/scan.ts
    - src/main/__tests__/scan.test.ts

key-decisions:
  - "Name-pattern detection is additive — runs AFTER content detection and merges results deduplicating by hash"
  - "groupByCanonicalName hashes ALL files in a name group (not size-filtered) to catch copies with slight size drift"
  - "Deduplication uses hash as the canonical key — same-content files appear once regardless of detection method"

patterns-established:
  - "canonicalBasename: strips '- Copy', '- Copy (N)', '(N)' suffixes; lowercases; preserves extension"
  - "Two-pass merge pattern: collect from both passes into shared DuplicateGroup[], skip already-seen hashes"

requirements-completed:
  - SCAN-01
  - SCAN-02
  - SCAN-03
  - SCAN-04
  - DUPE-01
  - DUPE-02
  - DUPE-03
  - DUPE-04
  - DUPE-05
  - DUPE-06
  - SELECT-01
  - SELECT-02
  - SAFETY-01
  - SAFETY-02
  - SAFETY-03

# Metrics
duration: 15min
completed: 2026-03-30
---

# Phase 2 Plan 06: Wire + E2E Verification Summary

**Full scan-to-delete pipeline wired with two-pass duplicate detection: content hashing plus name-pattern matching for Windows "- Copy" and numbered copy files**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-30T12:00:00Z
- **Completed:** 2026-03-30T12:15:00Z
- **Tasks:** 2 (Task 1 pre-committed a804831; Task 2 fix committed 4ea2110)
- **Files modified:** 3

## Accomplishments

- Wired `registerScanHandlers(mainWindow)` into `src/main/index.ts` — connecting the final link in the scan pipeline
- Added `canonicalBasename()` to strip Windows copy suffixes ("- Copy", "- Copy (N)", "(N)") for name-aware grouping
- Added `groupByCanonicalName()` to find name-similar files regardless of size differences (Windows metadata drift)
- Merged content-based and name-based detection into a single result set with hash-based deduplication
- 21 unit tests passing (7 new covering canonicalBasename and groupByCanonicalName)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire registerScanHandlers into src/main/index.ts** - `a804831` (feat)
2. **Task 2: Fix name-pattern detection for Windows copy files** - `4ea2110` (fix)

## Files Created/Modified

- `src/main/index.ts` - Added import and call to `registerScanHandlers(mainWindow)`
- `src/main/handlers/scan.ts` - Added `canonicalBasename`, `groupByCanonicalName`; updated SCAN_START to run two-pass detection
- `src/main/__tests__/scan.test.ts` - Added 7 tests covering new name-pattern functions

## Decisions Made

- Name-pattern detection is additive — results merged into content results, deduplicated by hash so no group appears twice
- `groupByCanonicalName` does NOT apply size pre-filter — size drift from Windows copy metadata means same-content copies may have different sizes
- New name candidates are checked against already-hashed paths to avoid double-hashing files caught by both passes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added name-pattern detection for Windows copy files**
- **Found during:** Task 2 (E2E human verification)
- **Issue:** Files with "- Copy" suffix or numbered copies like "photo (1).jpg" were not being detected as duplicates when file sizes differed slightly. The existing size-based pre-filter excluded them from hashing.
- **Fix:** Added `canonicalBasename()` and `groupByCanonicalName()` functions; updated SCAN_START handler to run both content and name-pattern detection passes and merge results.
- **Files modified:** `src/main/handlers/scan.ts`, `src/main/__tests__/scan.test.ts`
- **Verification:** 21 unit tests pass; `npx tsc --noEmit` exits 0
- **Committed in:** `4ea2110`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix directly addresses user-reported bug found during E2E verification. No scope creep — change is additive and confined to scan.ts and its tests.

## Issues Encountered

- User found during E2E verification that Windows "- Copy" files and numbered copies were not flagged as duplicates when file sizes differed by even 1-2 bytes due to Windows metadata changes during copy operations. Root cause: the size pre-filter excluded these files from the hashing pass entirely. Fixed by adding a parallel name-pattern detection pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 (duplicate detection) is fully complete — all 15 requirements implemented and verified
- Phase 3 (file organizer) can proceed; scan infrastructure is stable and extensible
- No blockers

## Self-Check: PASSED

- scan.ts: FOUND
- scan.test.ts: FOUND
- 02-06-SUMMARY.md: FOUND
- Commit a804831: FOUND
- Commit 4ea2110: FOUND

---
*Phase: 02-duplicate-detection*
*Completed: 2026-03-30*
