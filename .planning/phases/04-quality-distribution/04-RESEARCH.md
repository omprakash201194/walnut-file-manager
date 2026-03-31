# Phase 4: Quality & Distribution - Research

**Researched:** 2026-03-31
**Domain:** Testing (Vitest + Playwright/Electron), GitHub Actions CI, electron-builder NSIS, scan history (electron-conf), version display (Electron IPC)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scan History (SHELL-04)**
- D-01: History lives in the sidebar as a collapsible "Recent" section below the folder picker. Always visible, low friction to re-scan.
- D-02: 5 entries maximum — last 5 unique folders, newest at top, oldest auto-evicted when a new folder is added. No per-entry remove UI.
- D-03: Clicking a history entry sets `selectedFolder` in Zustand store and immediately starts a scan (same as clicking "Scan Now" with that folder pre-selected).
- D-04: Persist using `electron-conf` (already in deps, used for undo stack in Phase 3). Store as a string array under a `scanHistory` key.

**Version Display (DIST-03)**
- D-05: Version displayed as small muted text in the sidebar footer — e.g., `Walnut v1.0.0`. Always visible, zero visual weight, no modal required.
- D-06: Read version from `app.getVersion()` in the Electron main process (returns the version from `package.json`), surface to renderer via a new IPC channel (e.g., `app:get-version`). Follows the existing typed IPC pattern.
- D-07: Fix package name from `walnut-temp` → `walnut` in `package.json` as part of this phase (required before distribution).

**Release Workflow (DIST-01, DIST-02)**
- D-08: Tag-triggered release — pushing a tag matching `v*` triggers a GitHub Actions workflow that builds the Windows NSIS installer via `electron-builder --win` and attaches the artifact to a GitHub Release.
- D-09: CI is a separate workflow from release — CI runs on push to `main` and on all pull requests. CI runs: `npm test` (unit + integration via Vitest) and type-check. E2e tests are NOT run in CI (local-only for v1).
- D-10: Release workflow runs on `windows-latest`. CI workflow also uses `windows-latest` since the app is Windows-only and some file operation tests are path-sensitive.

**Integration Tests (QUALITY-02)**
- D-11: Integration tests target main-process handler functions (`registerScanHandlers`, `registerOrganizerHandlers`) exercised against a real temp filesystem. No Electron process needed — pure Node.js, using Vitest with `// @vitest-environment node`.
- D-12: Integration tests live in `src/main/__tests__/integration/` — separate from existing unit tests in `src/main/__tests__/`. Same Vitest config picks them up via the existing `src/**/*.{test,spec}.{ts,tsx}` glob.
- D-13: Existing `scan.test.ts` and `organizer.test.ts` are unit tests for pure functions — leave them in place and extend if needed. Integration tests are additive, not replacements.

**Unit & E2e Tests (QUALITY-01, QUALITY-03)**
- D-14: Unit tests via Vitest cover: `hashFile`, `groupBySize`, `groupByHash`, `groupByCanonicalName`, `canonicalBasename` (scan), `getCategory`, `ByTypeStrategy`, `ByExtensionStrategy`, `safeMove` (organizer), and `applyPreset` (selection).
- D-15: E2e tests via Playwright for Electron cover: (1) scan + duplicate review + delete, (2) organize + undo. Use `_electron.launch()` to launch the app. E2e tests live in `e2e/`.
- D-16: `playwright.config.ts` needs updating — add `_electron` launch configuration pointing to the built app or dev server. Currently a stub.

### Claude's Discretion
- Exact IPC channel name for version (`app:get-version` or similar)
- GitHub Actions workflow YAML structure (job names, steps, caching strategy for `node_modules`)
- Exact Playwright e2e test file structure and assertion depth (happy path only for v1)
- `electron-builder` config details in `package.json` (app ID, product name, NSIS options, output directory)
- Whether scan history empty state shows "No recent folders" text or simply hides the section

### Deferred Ideas (OUT OF SCOPE)
- Auto-update via electron-updater (v2 — UX-V2-01)
- macOS / Linux builds
- Code signing for the Windows installer
- E2e tests in CI (too expensive on hosted runners for v1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-04 | User can see previously scanned folders for quick re-access | electron-conf `scanHistory` key; Sidebar "Recent" section; Zustand store extension |
| QUALITY-01 | Unit tests cover all pure logic via Vitest | 37 tests already pass; gaps identified: `getCategory`, `ByTypeStrategy`, `ByExtensionStrategy`, `applyPreset` coverage |
| QUALITY-02 | Integration tests cover IPC handlers against real temp filesystem | `os.tmpdir()` + `fs.mkdtemp`; Vitest node env; `registerScanHandlers`/`registerOrganizerHandlers` pattern |
| QUALITY-03 | E2e tests cover critical flows via Playwright for Electron | `_electron.launch({args: ['./out/main/index.js']})` against built output; `firstWindow()` for UI interaction |
| QUALITY-04 | All tests run in CI on each commit via GitHub Actions | `windows-latest` runner; `actions/setup-node` with npm cache; `npm test` + `npm run typecheck` |
| DIST-01 | App builds to Windows NSIS installer via electron-builder | `electron-builder.yml` already configured for NSIS; needs name fix + appId update |
| DIST-02 | Release artifacts published to GitHub Releases on tag push | `publish: { provider: 'github' }` in electron-builder.yml; `GH_TOKEN`; `--publish onTag` |
| DIST-03 | App version displayed in UI | `app.getVersion()` → IPC channel `app:get-version` → sidebar footer text |
</phase_requirements>

---

## Summary

Phase 4 has three independent workstreams: (1) testing, (2) CI/release automation, and (3) two UI features (scan history + version display). All workstreams build on a stable, fully-tested Phase 3 codebase.

**Testing state going in:** 37 Vitest unit tests already pass across `scan.test.ts` and `organizer.test.ts`. The Vitest config (`vitest.config.ts`) picks up all `src/**/*.{test,spec}.{ts,tsx}` — integration tests added to `src/main/__tests__/integration/` will be picked up automatically. The `e2e/` directory is empty and `playwright.config.ts` is a stub (no `_electron` launch config). There is no `test` script in `package.json` — one must be added.

**electron-builder state going in:** `electron-builder.yml` exists with NSIS target configured but uses placeholder values (`appId: com.electron.app`, `productName: walnut-temp`, `executableName: walnut-temp`, `publish.provider: generic`). The `build:win` script exists and works. D-07 requires renaming `package.json` `name` from `walnut-temp` to `walnut` and updating `electron-builder.yml` to match.

**Primary recommendation:** Tackle the workstreams in this order: (1) package rename + npm test script + unit test gaps, (2) integration tests, (3) scan history + version IPC, (4) Playwright e2e stub, (5) GitHub Actions CI workflow, (6) GitHub Actions release workflow. Each step is independently verifiable.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| vitest | ^4.1.2 | Unit + integration tests | Installed, 37 tests passing |
| @playwright/test | ^1.58.2 | E2e tests for Electron | Installed, no tests written yet |
| @testing-library/react | ^16.3.2 | Component tests (renderer) | Installed, unused so far |
| happy-dom | ^20.8.9 | DOM environment for Vitest renderer tests | Installed, configured in vitest.config.ts |
| electron-conf | ^1.3.0 | Persist scan history + undo stack | Installed, used for undo stack |
| electron-builder | ^26.0.12 | Windows NSIS packaging | Installed, electron-builder.yml exists |

### No New Dependencies
All required libraries are already in `package.json`. Phase 4 is purely configuration, test writing, and feature implementation using the existing stack.

**Verification:** `npm install` not required. `npx vitest run` already passes 37 tests.

---

## Architecture Patterns

### Existing Test Infrastructure (what to extend)

```
src/main/__tests__/
├── fixtures/                   # Static test files (file-a.txt = file-b.txt content, file-c.txt different)
│   ├── file-a.txt              # Duplicate of file-b
│   ├── file-b.txt              # Duplicate of file-a
│   ├── file-c.txt              # Unique content
│   └── subdir/
│       └── file-d.txt          # Subdirectory traversal fixture
├── scan.test.ts                # 26 unit tests — walkDirectory, groupBySize, hashFile, groupByHash, canonicalBasename, groupByCanonicalName, applyPreset tiebreaker
├── organizer.test.ts           # 11 unit tests — safeMove, fileExists, resolveDestPath, buildCategoryMap
└── integration/                # CREATE THIS DIRECTORY — integration tests live here
    ├── scan.integration.test.ts
    └── organizer.integration.test.ts
e2e/                            # CREATE TESTS HERE — currently empty
    ├── app.spec.ts             # Core flow: launch, scan, duplicate review
    └── organize.spec.ts        # Organize + undo flow
```

### Pattern 1: Vitest Node Environment (established — extend this)
```typescript
// @vitest-environment node
/**
 * Integration tests for registerScanHandlers — exercises real filesystem.
 * Uses os.tmpdir() + fs.mkdtemp for isolation; cleanup in afterEach.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock electron and electron-conf before importing handler code
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => os.tmpdir()) },
}))
vi.mock('electron-conf/main', () => {
  // ... same mock pattern as organizer.test.ts
})

let tmpDir: string
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'walnut-integration-'))
})
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})
```

**Key insight:** The existing `organizer.test.ts` already demonstrates the full mock pattern for `electron` and `electron-conf/main`. Integration tests follow exactly the same mock setup — the difference is they create real files in `tmpDir` and test the full pipeline (e.g., `walkDirectory` → `groupBySize` → `groupByHash` on files created in tmpDir) rather than pure function logic.

### Pattern 2: Integration Test — Scan Pipeline Against Real FS
```typescript
// Source: established pattern from scan.test.ts + organizer.test.ts
it('detects duplicate files in a temp directory', async () => {
  // Create known duplicates in tmpDir
  await fs.writeFile(path.join(tmpDir, 'original.txt'), 'hello world\n')
  await fs.writeFile(path.join(tmpDir, 'copy.txt'), 'hello world\n')
  await fs.writeFile(path.join(tmpDir, 'unique.txt'), 'different content')

  const signal = new AbortController().signal
  const allFiles = await walkDirectory(tmpDir, signal, vi.fn())
  const bySize = groupBySize(allFiles)
  const groups = await groupByHash([...bySize.values()].flat(), signal, vi.fn())

  expect(groups).toHaveLength(1)
  expect(groups[0].files).toHaveLength(2)
  const names = groups[0].files.map(f => f.name).sort()
  expect(names).toEqual(['copy.txt', 'original.txt'])
})
```

### Pattern 3: Playwright for Electron E2e
```typescript
// Source: https://playwright.dev/docs/api/class-electron
// e2e/app.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import * as path from 'path'

let electronApp: ElectronApplication
let window: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../out/main/index.js')],
  })
  window = await electronApp.firstWindow()
  // Give app time to render
  await window.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await electronApp.close()
})

test('app launches with dark-mode sidebar', async () => {
  await expect(window.locator('text=Duplicates')).toBeVisible()
  await expect(window.locator('text=Organizer')).toBeVisible()
})
```

**Critical:** The `args` path must point to the built output at `out/main/index.js` (relative to repo root). The `out/` directory already exists with a built copy. A `pretest:e2e` or build step must ensure `out/` is current before running e2e.

### Pattern 4: electron-conf Scan History Store
```typescript
// Source: electron-conf README + existing organizer.ts pattern
// src/main/handlers/scanHistory.ts (new file) or inline in main/index.ts

import { Conf } from 'electron-conf/main'

interface ScanHistoryStore {
  scanHistory: string[]  // string array, newest first, max 5 entries
}

const historyStore = new Conf<ScanHistoryStore>({
  name: 'scan-history',
  defaults: { scanHistory: [] },
})

export function addToScanHistory(folderPath: string): string[] {
  const current = historyStore.get('scanHistory') as string[]
  // Deduplicate: remove existing entry if present (move to top)
  const deduped = current.filter(p => p !== folderPath)
  // Prepend new entry, cap at 5
  const updated = [folderPath, ...deduped].slice(0, 5)
  historyStore.set('scanHistory', updated)
  return updated
}

export function getScanHistory(): string[] {
  return historyStore.get('scanHistory') as string[]
}
```

**Note:** Using a separate `Conf` instance with `name: 'scan-history'` follows the same pattern as `organizer.ts` which uses `name: 'organizer'`. Keeps concerns separate. The `organizer.ts` precedent (D-06 from Phase 3) already shows electron-conf stores are per-feature.

### Pattern 5: Version IPC Channel
```typescript
// shared/ipc-types.ts — add to IPC_CHANNELS:
APP_GET_VERSION: 'app:get-version'

// src/main/index.ts — add to registerIpcHandlers():
ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
  return app.getVersion()  // reads from package.json automatically
})

// src/preload/index.ts — add to contextBridge.exposeInMainWorld:
getAppVersion: (): Promise<string> =>
  ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),

// src/renderer/src/components/Sidebar.tsx — sidebar footer:
const [version, setVersion] = useState<string>('')
useEffect(() => {
  window.api.getAppVersion().then(setVersion)
}, [])
// Render: <span className="text-xs text-muted-foreground">Walnut v{version}</span>
```

**Existing component `Versions.tsx`** reads `window.electron.process.versions` for Electron/Chromium/Node versions — this is the electron-toolkit built-in, not `app.getVersion()`. Do not reuse that component; follow the IPC pattern per D-06 to expose the app's own package.json version.

### Pattern 6: electron-builder.yml Updates (DIST-01, DIST-02)
```yaml
# electron-builder.yml — changes required
appId: com.walnut.filemanager        # was: com.electron.app
productName: Walnut                  # was: walnut-temp
# ...
win:
  executableName: walnut             # was: walnut-temp
nsis:
  artifactName: ${name}-${version}-setup.${ext}  # unchanged, correct
  shortcutName: ${productName}       # becomes "Walnut"
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
publish:
  provider: github                   # was: generic url: https://example.com/auto-updates
```

### Recommended Project Structure After Phase 4

```
src/main/__tests__/
├── fixtures/                        # Existing static fixtures (keep)
├── scan.test.ts                     # Existing unit tests (extend if gaps found)
├── organizer.test.ts                # Existing unit tests (extend if gaps found)
└── integration/
    ├── scan.integration.test.ts     # NEW — full pipeline against tmpDir
    └── organizer.integration.test.ts  # NEW — safeMove + undo against tmpDir
e2e/
    ├── app.spec.ts                  # NEW — launch, scan, delete flow
    └── organize.spec.ts             # NEW — organize + undo flow
.github/
└── workflows/
    ├── ci.yml                       # NEW — push/PR, vitest + typecheck
    └── release.yml                  # NEW — tag push, electron-builder --win, GitHub Release
```

### Anti-Patterns to Avoid
- **Don't use `npm run build` inside integration tests:** Integration tests import handler functions directly. The build step is only needed for e2e (Playwright needs the bundled output).
- **Don't run e2e in CI:** D-09 is locked. E2e tests require a real display on Windows; GitHub Actions `windows-latest` does not provide one reliably. They run locally before releases.
- **Don't write a `test` script that includes `playwright test`:** The CI `npm test` command must run only Vitest. Add a separate `test:e2e` script for Playwright.
- **Don't call `ipcRenderer` directly from Playwright tests:** Playwright interacts through the rendered UI (clicks, form fills), not by calling IPC directly.
- **Don't mock `electron-conf` in integration tests if you want to test persistence:** The existing mock in `organizer.test.ts` is correct for unit tests. Integration tests that test undo stack persistence need a real `Conf` instance pointing to `tmpDir`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temp directory cleanup after tests | Manual `fs.rm` orchestration | `os.tmpdir()` + `fs.mkdtemp` in `beforeEach` + `fs.rm` in `afterEach` | Already the established pattern in `organizer.test.ts` — consistent |
| Electron launch in tests | Custom process spawning | `_electron.launch()` from `@playwright/test` | Playwright manages the lifecycle including cleanup |
| App version reading | Parsing `package.json` in renderer | `app.getVersion()` via IPC | Electron's `app.getVersion()` reads the `version` field from `package.json` in both dev and packaged builds |
| Windows installer creation | Nsis scripting | `electron-builder --win` with existing `electron-builder.yml` NSIS config | Already configured; just needs name/appId fixes |
| GitHub Release uploads | Custom upload scripts | `electron-builder --publish onTag` with `GH_TOKEN` | electron-builder handles draft creation, asset upload, and release finalization |

---

## Common Pitfalls

### Pitfall 1: Missing `test` Script in package.json
**What goes wrong:** `npm test` fails in CI with "Missing script: test".
**Why it happens:** Phase 1–3 never needed a CI-runnable test command; `package.json` has no `test` script.
**How to avoid:** Add `"test": "vitest run"` to `package.json` scripts as the first task of Phase 4. CI workflow calls `npm test`.
**Warning signs:** Running `npm test` locally produces "Missing script" error.

### Pitfall 2: Playwright Needs Built Output, Not Source
**What goes wrong:** `_electron.launch({ args: ['src/main/index.ts'] })` fails — Electron runs JS, not TypeScript.
**Why it happens:** electron-vite compiles TypeScript; source files cannot be launched directly by Electron.
**How to avoid:** Point `args` to `['./out/main/index.js']` (the electron-vite compiled output). Add a `build:e2e` or use `globalSetup` in `playwright.config.ts` to run `electron-vite build` before e2e. Since `out/` already exists, a simpler approach is to ensure tests assume a pre-built app (document that `npm run build` must run before `npm run test:e2e`).
**Warning signs:** `Error: electron.launch: Process failed to launch!` or TypeScript-related Node.js errors.

### Pitfall 3: electron-builder Name Mismatch Causes NSIS Installer Naming Issues
**What goes wrong:** Installer is named `walnut-temp-1.0.0-setup.exe` instead of `walnut-1.0.0-setup.exe`.
**Why it happens:** `package.json` `name` field is still `walnut-temp`; electron-builder uses `${name}` in the `artifactName` template.
**How to avoid:** D-07 is locked — rename `package.json` `name` to `walnut` AND update `electron-builder.yml` `productName`, `win.executableName` to match. Do this before any build or release task.
**Warning signs:** Built installer file name contains "walnut-temp".

### Pitfall 4: GitHub Actions `windows-latest` and npm Path Length
**What goes wrong:** `makensis.exe` not found, or deep pnpm path errors.
**Why it happens:** This project uses npm (not pnpm), so the pnpm MAX_PATH issue does not apply. However, `node_modules/.cache` paths can still be long on Windows. Use `npm ci` rather than `npm install` in CI for reproducibility.
**How to avoid:** Use `npm ci` in CI workflow (not `npm install`). Access electron-builder via `npm run build:win` (which calls `electron-builder` from local `node_modules`), not `npx electron-builder`.
**Warning signs:** Build step fails with path-related errors on `windows-latest`.

### Pitfall 5: electron-conf Mock in Integration Tests May Need Adjustment
**What goes wrong:** Integration tests that test scan history persistence fail because `Conf` is mocked to return empty arrays.
**Why it happens:** `organizer.test.ts` uses a shared in-memory mock. If scan history integration tests also need to verify round-trip persistence, they need a real `Conf` backed by `tmpDir`.
**How to avoid:** For scan history integration tests, either (a) pass `historyStore` as a parameter to `addToScanHistory()` for testability, or (b) mock `electron-conf/main` with a `tmpDir`-backed real file path. The simpler approach is (a) — accept the store as an argument or use dependency injection.
**Warning signs:** Integration test for `addToScanHistory` always returns the mock's empty default.

### Pitfall 6: Scan History `setSelectedFolder` + Scan Start Sequence
**What goes wrong:** Clicking history entry sets `selectedFolder` but the scan does not auto-start.
**Why it happens:** The existing `DuplicatesPage` scan trigger listens for a button click, not for `selectedFolder` changes.
**How to avoid:** D-03 is locked — scan history click must both set `selectedFolder` AND call `window.api.scanStart(folder)` directly (same as the "Scan Now" button does). Do not rely on a reactive `useEffect` watching `selectedFolder` — that would also trigger scan on folder picker selection, breaking the existing UX.
**Warning signs:** History entry click updates sidebar display but no scan progress appears.

### Pitfall 7: Playwright E2e Test Timeout
**What goes wrong:** E2e test times out waiting for scan results on large test folders.
**Why it happens:** Playwright's default timeout is 30 seconds; scanning a large directory for content hashing can take longer.
**How to avoid:** Use small, controlled temp directories for e2e tests (create them in `test.beforeAll` with a known 3-5 file structure). Set `test.setTimeout(60000)` for scan-heavy tests. Use `waitForSelector` on specific UI elements rather than arbitrary `waitForTimeout`.
**Warning signs:** Tests pass locally but occasionally fail on CI with "Timeout 30000ms exceeded".

---

## Existing Codebase: What Is Already Tested vs. What Needs Tests

### Already Covered (37 passing tests)
| Function | File | Tests |
|----------|------|-------|
| `walkDirectory` | scan.ts | recursive traversal, AbortController |
| `groupBySize` | scan.ts | empty input, singleton filtering, grouping |
| `hashFile` | scan.ts | identical/different content, missing file → null |
| `groupByHash` | scan.ts | duplicate groups, totalWastedBytes, no-dupe case |
| `canonicalBasename` | scan.ts | "- Copy", "- Copy (N)", "(N)" patterns |
| `groupByCanonicalName` | scan.ts | size-agnostic matching, case-insensitive |
| `applyPreset` (tiebreaker) | appStore.ts | birthtime tiebreaker when mtime equal |
| `safeMove` | organizer.ts | same-device rename, non-EXDEV error re-throw |
| `fileExists` | organizer.ts | true/false cases |
| `resolveDestPath` | organizer.ts | no collision, (1)/(2)/(3) suffix, no-ext file |
| `buildCategoryMap` | organizer.ts | by-type, by-extension, no-extension key, empty list, no disk write |

### Unit Test Gaps (QUALITY-01 — D-14 requires these)
| Function | File | Gap |
|----------|------|-----|
| `getCategory` | strategies/byType.ts | Not tested: `.jpg`→Photos, `.pdf`→Documents, `.mp3`→Music, `.mp4`→Video, `.zip`→Archives, `.xyz`→Other |
| `ByTypeStrategy.categorize()` | strategies/byType.ts | Not tested: full categorize() output structure |
| `ByExtensionStrategy.categorize()` | strategies/byExtension.ts | Not tested: extension grouping, `no-extension` key |
| `applyPreset` (main function) | appStore.ts | Only tiebreaker tested; need: keep-at-least-one, protected folder exclusion, newest/oldest selection |

**Note:** `buildCategoryMap` in `organizer.ts` calls `ByTypeStrategy` and `ByExtensionStrategy` internally, so `buildCategoryMap` tests provide indirect coverage. Direct strategy tests are still worthwhile to isolate the strategies.

### Integration Test Targets (QUALITY-02 — D-11/D-12)
| Test | What It Exercises | Key Assertion |
|------|-------------------|---------------|
| Full scan pipeline | `walkDirectory` → `groupBySize` → `groupByHash` on tmpDir files | Correct duplicate groups from real files |
| Organize pipeline | `buildCategoryMap` → `safeMove` all files → verify new paths exist | Files at expected destinations |
| Undo pipeline | Apply moves → `safeMove` undo → verify original paths restored | Files back at original locations |
| Scan abort mid-walk | Start `walkDirectory`, abort mid-flight | `AbortError` thrown, no partial state |

---

## GitHub Actions Workflow Patterns

### CI Workflow (`.github/workflows/ci.yml`)
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

**Why `windows-latest`:** File path tests in `walkDirectory` and `safeMove` use Windows path separators. Running on Ubuntu would mask Windows-specific path bugs.

**Why `npm ci` not `npm install`:** `npm ci` uses `package-lock.json` for reproducible installs and is faster on CI due to the lock file.

**`npm test` must be added to `package.json`:** Currently missing. Add `"test": "vitest run"`.

### Release Workflow (`.github/workflows/release.yml`)
```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    permissions:
      contents: write    # Required for creating GitHub Releases
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}   # GITHUB_TOKEN is auto-provided
```

**Token:** `secrets.GITHUB_TOKEN` is automatically available in every GitHub Actions workflow — no manual secret setup needed for public repos. For private repos, the default token works when `permissions.contents: write` is set.

**`--publish onTag`:** electron-builder detects the CI tag push automatically when `GH_TOKEN` is available and creates/updates a GitHub Release draft with the NSIS artifact. No explicit `--publish onTag` flag needed in the script — `GH_TOKEN` presence is sufficient for `provider: github`.

**`npm run build:win`** already calls `npm run build && electron-builder --win` per existing `package.json`. This is correct.

---

## electron-builder Configuration (DIST-01, DIST-02)

### Required Changes to `electron-builder.yml`
The existing file has these placeholder values that must change before distribution:

| Field | Current Value | Required Value |
|-------|--------------|----------------|
| `appId` | `com.electron.app` | `com.walnut.filemanager` |
| `productName` | `walnut-temp` | `Walnut` |
| `win.executableName` | `walnut-temp` | `walnut` |
| `publish.provider` | `generic` | `github` |
| `publish.url` | `https://example.com/auto-updates` | (remove — not needed) |

### `package.json` Changes
| Field | Current | Required |
|-------|---------|----------|
| `name` | `walnut-temp` | `walnut` |
| `scripts.test` | (missing) | `"vitest run"` |
| `scripts.test:e2e` | (missing) | `"playwright test"` |

### NSIS Artifact Output
With `name: walnut` and `version: 1.0.0`, the NSIS installer will be named `walnut-1.0.0-setup.exe` per the `artifactName: ${name}-${version}-setup.${ext}` template. This is the correct output.

---

## Scan History Feature Implementation Guide

### Data Model
```typescript
// In electron-conf store — `scan-history.json` in userData
{
  scanHistory: string[]  // e.g. ["C:\\Users\\me\\Downloads", "C:\\Projects", ...]
}
```

### IPC Channel Required
Add `SCAN_HISTORY_GET: 'scan:history-get'` and `SCAN_HISTORY_ADD: 'scan:history-add'` to `IPC_CHANNELS`.

**Alternative (simpler, matches D-04):** Rather than a dedicated IPC channel, the scan history can be read/written directly within the existing `SCAN_START` handler — when a scan starts, add the folder to history and return the updated history list as part of the scan start response. Or expose a `getScanHistory` IPC method called once on app startup.

### Sidebar Integration
The sidebar currently has four sections: App Identity, Navigation, Folder Picker, Protected Folders. Phase 4 adds:
- Section E: Recent Folders (collapsible, between Navigation and Folder Picker, or below Folder Picker per D-01)
- Section F: Version footer (at the very bottom, below Protected Folders)

The sidebar uses `ScrollArea` + `flex-col h-screen` layout. The version footer should be outside the `ScrollArea` (pinned to bottom) — use `mt-auto` or a separate fixed footer div.

### Empty State Decision (Claude's Discretion)
Per CONTEXT.md: show "No recent folders" text when history is empty (same pattern as Protected Folders "None" state). Hide the section only makes sense if history is truly optional; since D-01 says "always visible, low friction", show the section with empty state text.

---

## Version Display

### Why Not `window.electron.process.versions`
The existing `Versions.tsx` component reads `window.electron.process.versions` which exposes Electron/Chromium/Node runtime versions. D-05 wants the **app** version (from `package.json`), which is `app.getVersion()` in the main process. These are different values.

### Pattern (HIGH confidence)
```typescript
// Main process
app.getVersion()  // Returns package.json "version" field in both dev and packaged builds
```

`app.getVersion()` is the canonical Electron way to expose the app version — it works identically in development (reads from `package.json`) and in a packaged installer (reads from `app.asar`'s embedded `package.json`). No parsing, no `__dirname` tricks.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, build scripts | Yes | v22.16.0 | — |
| Electron | Playwright e2e (built app) | Yes | ^39.2.6 (39.8.5 actual) | — |
| `out/main/index.js` | Playwright `_electron.launch` | Yes | Built | Run `npm run build` before e2e |
| GitHub Actions | CI/Release | Remote only | — | Local `npm test` for vitest |
| `npm test` script | CI and local test runs | No — MISSING | — | Must add to `package.json` |
| `vitest run` | All unit/integration tests | Yes | 4.1.2 | — |
| `playwright test` | E2e tests | Yes (binary installed) | 1.58.2 | — |

**Missing with no fallback:** `npm test` script in `package.json` — must be added before CI workflow can work.

**Pre-e2e requirement:** `out/main/index.js` exists (built), but may be stale after code changes. E2e tests should be preceded by `npm run build`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| electron-store for persistence | electron-conf (installed, in use) | Already done; no migration needed |
| Jest for unit tests | Vitest ^4.1 (Vite-native) | Already done; zero-config with electron-vite |
| Electron Forge for packaging | electron-vite + electron-builder | Already done; `build:win` script exists |
| Custom NSIS scripts | electron-builder NSIS target | Already configured in electron-builder.yml |
| webdriver.io for Electron e2e | Playwright `_electron` namespace | Already installed; needs configuration |

---

## Open Questions

1. **Does `electron-conf` require mocking in integration tests for scan history?**
   - What we know: `organizer.test.ts` mocks `electron-conf/main` with an in-memory store. This works for unit tests.
   - What's unclear: For scan history integration tests, should we use a real `Conf` backed by a `tmpDir` path, or keep the in-memory mock?
   - Recommendation: Use the same in-memory mock pattern from `organizer.test.ts` — this tests the logic without disk I/O and avoids requiring `electron` context. The mock already demonstrates the correct pattern.

2. **Should scan history be added on `SCAN_START` or as a separate IPC call?**
   - What we know: D-04 says persist using `electron-conf`. D-03 says clicking a history entry calls `setSelectedFolder` + starts scan.
   - What's unclear: Whether the renderer calls a new `addScanHistory(folder)` IPC channel before/after `scanStart`, or if `scanStart` itself handles history recording.
   - Recommendation: Record history server-side inside `registerScanHandlers` when `SCAN_START` fires — no new IPC channel needed. Return the updated history list or fire a `scan:history-updated` push event. This keeps history recording atomic with scan start.

3. **Playwright test isolation — shared app instance vs per-test launch?**
   - What we know: `electron.launch()` spins up a full Electron process (takes 3-8 seconds). Launching per test would make the suite very slow.
   - Recommendation: Use `test.beforeAll` / `test.afterAll` with one shared `ElectronApplication` instance per test file. Reset app state between tests using Playwright page navigation or Zustand store reset via `electronApp.evaluate()`.

---

## Sources

### Primary (HIGH confidence)
- Playwright API: https://playwright.dev/docs/api/class-electron — `_electron.launch()` API
- Playwright API: https://playwright.dev/docs/api/class-electronapplication — `firstWindow()`, `evaluate()`, `close()`
- electron-conf README: https://github.com/alex8088/electron-conf — Conf constructor, get/set, TypeScript generics (verified locally from `node_modules/electron-conf/README.md`)
- electron-builder publish docs: https://www.electron.build/publish.html — `provider: github`, `GH_TOKEN`, `--publish onTag`
- Existing test infrastructure: `src/main/__tests__/scan.test.ts`, `src/main/__tests__/organizer.test.ts` — verified patterns (37 tests passing)
- Electron `app.getVersion()`: https://www.electronjs.org/docs/latest/api/app#appgetversion — canonical version reading

### Secondary (MEDIUM confidence)
- GitHub Actions electron-builder Windows workflow: https://dev.to/supersuman/multi-os-electron-build-release-with-github-actions-f3n — confirmed workflow structure
- GitHub Actions caching: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows — `actions/setup-node` `cache: 'npm'`
- Electron 36.x Playwright issue: https://github.com/electron/electron/issues/47419 — Windows-only, Linux dependency issue (not relevant to this project)

### Tertiary (LOW confidence — for awareness only)
- NSIS MAX_PATH issue: https://github.com/electron-userland/electron-builder/issues/8613 — pnpm-specific, not applicable (this project uses npm)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in `package.json` and `node_modules`
- Architecture: HIGH — patterns derived from existing passing test infrastructure
- Pitfalls: HIGH (items 1-3, 6) / MEDIUM (items 4-5, 7) — derived from codebase analysis and official docs
- GitHub Actions YAML: MEDIUM — based on official docs + community examples, exact YAML not verified against this repo's GitHub state
- electron-builder NSIS: HIGH — existing `electron-builder.yml` analyzed; required changes are field value updates only

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable ecosystem — Vitest, Playwright, electron-builder change slowly)
