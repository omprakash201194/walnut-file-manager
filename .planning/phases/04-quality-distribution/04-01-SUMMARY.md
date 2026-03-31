---
phase: 04-quality-distribution
plan: "01"
subsystem: testing-and-packaging
tags: [vitest, electron-builder, unit-tests, package-identity]
dependency_graph:
  requires: []
  provides: [npm-test-script, production-electron-builder-config, getCategory-tests, strategy-tests, applyPreset-tests]
  affects: [CI pipelines, distribution artifacts, QUALITY-01, DIST-01, DIST-03]
tech_stack:
  added: []
  patterns: [TDD-extend-existing-tests, path.join-for-os-compatibility]
key_files:
  created: []
  modified:
    - package.json
    - electron-builder.yml
    - src/main/index.ts
    - src/main/__tests__/scan.test.ts
    - src/main/__tests__/organizer.test.ts
decisions:
  - "applyPreset import path is ../../renderer/src/store/appStore (not ../../../) from src/main/__tests__/"
  - "Protected folder tests use path.join for OS-correct separator on Windows"
metrics:
  duration: "5 min"
  completed: "2026-03-31T04:09:49Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 04 Plan 01: Package Identity, Test Scripts, and Unit Test Gaps Summary

Package renamed to walnut, `npm test` wired to Vitest, electron-builder.yml updated with production appId/productName/executableName/publish provider, and unit test gaps for getCategory, ByTypeStrategy, ByExtensionStrategy, and applyPreset closed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix package identity and add test scripts | 199a904 | package.json, electron-builder.yml, src/main/index.ts |
| 2 | Fill unit test gaps — getCategory, strategies, applyPreset | ac436d3 | src/main/__tests__/scan.test.ts, src/main/__tests__/organizer.test.ts |

## What Was Built

**Task 1 — Package Identity:**
- `package.json` `name` changed from `walnut-temp` to `walnut`
- `scripts.test` = `"vitest run"` added (enables `npm test`)
- `scripts.test:e2e` = `"playwright test"` added
- `electron-builder.yml`: `appId: com.walnut.filemanager`, `productName: Walnut`, `win.executableName: walnut`, `publish.provider: github` (owner: walnut-app, repo: walnut)
- `src/main/index.ts`: `setAppUserModelId('com.walnut.filemanager')` updated for consistent app identity

**Task 2 — Unit Test Gaps:**
- 18 new tests added to cover `getCategory` (7 cases: all 6 categories + no-extension), `ByTypeStrategy` (2 cases), `ByExtensionStrategy` (2 cases), and `applyPreset` (5 cases)
- Total test count: 37 existing → 62 passing
- All 4 test files pass

## Decisions Made

- `applyPreset` import path from `src/main/__tests__/` is `../../renderer/src/store/appStore` (not `../../../renderer/src/store/appStore` as documented in plan — the plan's relative path was incorrect, which would resolve outside `src/`)
- Protected folder test cases use `path.join('C:', 'protected')` instead of forward-slash strings because `applyPreset` uses `nodePath.sep` (backslash on Windows) for the startsWith check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected applyPreset import path**
- **Found during:** Task 2 - first test run
- **Issue:** Plan specified `'../../../renderer/src/store/appStore'` but from `src/main/__tests__/`, three `../` levels reach project root — not `src/`. The correct relative path is `'../../renderer/src/store/appStore'`.
- **Fix:** Changed import to `'../../renderer/src/store/appStore'`
- **Files modified:** `src/main/__tests__/organizer.test.ts`
- **Commit:** ac436d3

**2. [Rule 1 - Bug] Fixed protected folder test for Windows path separator**
- **Found during:** Task 2 - test run after import fix
- **Issue:** `applyPreset` uses `nodePath.sep` (backslash `\` on Windows) in the protected folder check. Test paths using forward slashes (`/test/protected/file.txt`) would not match a protection check for `/test/protected` + `\`.
- **Fix:** Used `path.join('C:', 'protected')` to construct OS-native paths so the startsWith check works correctly
- **Files modified:** `src/main/__tests__/organizer.test.ts`
- **Commit:** ac436d3

## Known Stubs

None — this plan adds configuration and test coverage only. No UI or data-rendering code was modified.

## Verification Results

```
npm test: 62 passed (4 test files)
package.json name: walnut
package.json test script: vitest run
electron-builder.yml appId: com.walnut.filemanager
electron-builder.yml productName: Walnut
electron-builder.yml executableName: walnut
electron-builder.yml publish.provider: github
src/main/index.ts setAppUserModelId: com.walnut.filemanager
```

## Self-Check: PASSED
