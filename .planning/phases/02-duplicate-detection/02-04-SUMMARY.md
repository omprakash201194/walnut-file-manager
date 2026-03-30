---
phase: 02-duplicate-detection
plan: 04
subsystem: ui
tags: [react, electron, shadcn, zustand, ipc, accordion, tailwind]

# Dependency graph
requires:
  - phase: 02-duplicate-detection/02-02
    provides: scan engine IPC handlers, ScanProgressEvent push events
  - phase: 02-duplicate-detection/02-03
    provides: appStore scan state machine, applyPreset function, formatBytes utility

provides:
  - DuplicatesPage three-state orchestrator (idle/scanning/results) with IPC listener lifecycle
  - ScanProgress full-page progress view with indeterminate/determinate bar and Cancel Scan
  - ScanEmpty idle and no-results empty states
  - DuplicateGroups scrollable results view with sticky summary bar and preset buttons
  - DuplicateGroupCard accordion item with group header
  - FileRow checkbox + path + size + date + KEEP badge with keep-at-least-one constraint

affects:
  - 02-05 (DeletePanel needs DuplicateGroups pb-20 clearance already in place)
  - 02-06 (e2e tests for the full duplicate detection flow target these components)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC listener cleanup: useEffect with named unsub functions for onScanProgress/onScanComplete/onScanError"
    - "Three-state page orchestrator: derive boolean flags from scanStatus + duplicateGroups.length"
    - "Zustand selector pattern: useAppStore((s) => s.field) for individual state slices"
    - "Keep-at-least-one: disabled checkbox when uncheckedFiles.length === 1"
    - "applyPreset called from click handler, result passed to setSelections (pure function pattern)"

key-files:
  created:
    - src/renderer/src/components/ScanEmpty.tsx
    - src/renderer/src/components/ScanProgress.tsx
    - src/renderer/src/components/DuplicateGroups.tsx
    - src/renderer/src/components/DuplicateGroupCard.tsx
    - src/renderer/src/components/FileRow.tsx
  modified:
    - src/renderer/src/pages/DuplicatesPage.tsx

key-decisions:
  - "DuplicateGroups stub created first so DuplicatesPage TypeScript compilation succeeded before Task 2 filled in the full implementation"

patterns-established:
  - "IPC cleanup pattern: const unsubX = window.api.onX(handler); return () => { unsubX() } in useEffect"
  - "Three-state page: isScanning / hasResults / (hasNoResults || !isScanning && !hasResults || hasError)"

requirements-completed:
  - SCAN-02
  - SCAN-03
  - SCAN-04
  - DUPE-03
  - DUPE-04
  - DUPE-05
  - SELECT-01
  - SELECT-02

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 02 Plan 04: DuplicatesPage Component Tree Summary

**React component tree for duplicate detection UI: three-state page orchestrator, full-page scan progress view, accordion results list with Keep Newest/Keep Oldest preset selection, and per-file KEEP badge with keep-at-least-one constraint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T07:06:34Z
- **Completed:** 2026-03-30T07:09:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- DuplicatesPage registers IPC push-event listeners on mount with cleanup (Pattern 7), shows exactly one of three states based on scanStatus + duplicateGroups length
- ScanProgress shows folder path, indeterminate animated bar during Pass 1 walk then determinate Progress during Pass 2 hashing, four stats (files scanned, elapsed, duplicates found, current file), and Cancel Scan button
- DuplicateGroups renders sticky summary bar with space-savings copy and Keep Newest/Keep Oldest buttons that call applyPreset and update all selections in real-time, plus scrollable accordion list with first group expanded by default (D-09)
- FileRow renders checkbox with blue-500 checked state, truncated path, size, date, KEEP badge in emerald, and keep-at-least-one tooltip when the last unchecked copy is about to be checked

## Task Commits

1. **Task 1: Build ScanEmpty, ScanProgress, and DuplicatesPage** - `a12c53d` (feat)
2. **Task 2: Build DuplicateGroups, DuplicateGroupCard, and FileRow** - `772c81b` (feat)

## Files Created/Modified

- `src/renderer/src/components/ScanEmpty.tsx` - Empty state with Files icon, two copy variants (no folder / no duplicates)
- `src/renderer/src/components/ScanProgress.tsx` - Full-page progress view: folder path, indeterminate/determinate bar, 4 stats, Cancel Scan button
- `src/renderer/src/pages/DuplicatesPage.tsx` - Three-state orchestrator: IPC listener lifecycle, Scan Now/Scan Again button, error banner
- `src/renderer/src/components/DuplicateGroups.tsx` - Scrollable results with sticky summary bar, preset buttons, controlled Accordion type=multiple
- `src/renderer/src/components/DuplicateGroupCard.tsx` - Single AccordionItem: collapsed group header with count/size, expanded FileRow list
- `src/renderer/src/components/FileRow.tsx` - Horizontal file row: checkbox, truncated path, size, date, KEEP badge, keep-at-least-one tooltip

## Decisions Made

- DuplicateGroups stub created first (Task 1) to allow DuplicatesPage TypeScript compilation, then replaced with full implementation in Task 2 within the same plan execution.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DuplicatesPage component tree is complete and wired to the store and IPC bridge
- pb-20 padding already in DuplicateGroups scroll area to clear the sticky DeletePanel from plan 02-05
- Ready for plan 02-05: DeletePanel + protected folders sidebar section

---
*Phase: 02-duplicate-detection*
*Completed: 2026-03-30*
