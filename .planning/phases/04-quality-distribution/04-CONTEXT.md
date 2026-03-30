# Phase 4: Quality & Distribution - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 hardens the completed application with a full testing pyramid (unit, integration, e2e), wires up GitHub Actions CI, adds scan history to the sidebar for quick re-access, builds a Windows NSIS installer via electron-builder, automates release artifact publishing to GitHub Releases on tag push, and displays the app version in the sidebar footer.

Requirements covered: SHELL-04, QUALITY-01, QUALITY-02, QUALITY-03, QUALITY-04, DIST-01, DIST-02, DIST-03.

No new file features. No changes to the scan or organization pipeline logic.

</domain>

<decisions>
## Implementation Decisions

### Scan History (SHELL-04)
- **D-01:** History lives in the sidebar as a collapsible "Recent" section below the folder picker. Always visible, low friction to re-scan.
- **D-02:** 5 entries maximum — last 5 unique folders, newest at top, oldest auto-evicted when a new folder is added. No per-entry remove UI.
- **D-03:** Clicking a history entry sets `selectedFolder` in the Zustand store and immediately starts a scan (same as clicking "Scan Now" with that folder pre-selected). This satisfies the ROADMAP success criterion: "click one to start a new scan on that folder."
- **D-04:** Persist using `electron-conf` (already in deps, used for undo stack in Phase 3). Store as a string array under a `scanHistory` key.

### Version Display (DIST-03)
- **D-05:** Version displayed as small muted text in the sidebar footer — e.g., `Walnut v1.0.0`. Always visible, zero visual weight, no modal required.
- **D-06:** Read version from `app.getVersion()` in the Electron main process (returns the version from `package.json`), surface to renderer via a new IPC channel (e.g., `app:get-version`). Follows the existing typed IPC pattern.
- **D-07:** Fix package name from `walnut-temp` → `walnut` in `package.json` as part of this phase (required before distribution).

### Release Workflow (DIST-01, DIST-02)
- **D-08:** Tag-triggered release — pushing a tag matching `v*` (e.g., `v1.0.0`) triggers a GitHub Actions workflow that builds the Windows NSIS installer via `electron-builder --win` and attaches the artifact to a GitHub Release.
- **D-09:** CI is a separate workflow from release — CI runs on push to `main` and on all pull requests. CI runs: `npm test` (unit + integration via Vitest) and type-check. E2e tests are NOT run in CI (they require a Windows runner with a display and are expensive — local-only for v1).
- **D-10:** Release workflow runs on a `windows-latest` GitHub Actions runner. CI workflow also uses `windows-latest` since the app is Windows-only and some file operation tests are path-sensitive.

### Integration Tests (QUALITY-02)
- **D-11:** Integration tests target the main-process handler functions (`registerScanHandlers`, `registerOrganizerHandlers`) exercised against a real temp filesystem. No Electron process needed — pure Node.js, using Vitest with `// @vitest-environment node`.
- **D-12:** Integration tests live in `src/main/__tests__/integration/` — separate from existing unit tests in `src/main/__tests__/`. Same Vitest config picks them up via the existing `src/**/*.{test,spec}.{ts,tsx}` glob.
- **D-13:** Existing `scan.test.ts` and `organizer.test.ts` are unit tests for pure functions — leave them in place and extend if needed. Integration tests are additive, not replacements.

### Unit & E2e Tests (QUALITY-01, QUALITY-03)
- **D-14:** Unit tests via Vitest cover: `hashFile`, `groupBySize`, `groupByHash`, `groupByCanonicalName`, `canonicalBasename` (scan), `getCategory`, `ByTypeStrategy`, `ByExtensionStrategy`, `safeMove` (organizer), and `applyPreset` (selection). These pure functions are already partially tested — extend coverage as needed.
- **D-15:** E2e tests via Playwright for Electron cover the critical flows listed in ROADMAP UAT criteria: (1) scan + duplicate review + delete, (2) organize + undo. Use `_electron.launch()` to launch the app from source (`electron-vite dev` or built app). E2e tests live in `e2e/` (already the configured `testDir` in `playwright.config.ts`).
- **D-16:** Playwright `playwright.config.ts` needs updating — add `_electron` launch configuration pointing to the built app or dev server. This is currently a stub.

### Claude's Discretion
- Exact IPC channel name for version (`app:get-version` or similar)
- GitHub Actions workflow YAML structure (job names, steps, caching strategy for `node_modules`)
- Exact Playwright e2e test file structure and assertion depth (happy path only for v1)
- `electron-builder` config details in `package.json` (app ID, product name, NSIS options, output directory)
- Whether scan history empty state shows "No recent folders" text or simply hides the section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §App Shell (SHELL-04) — scan history acceptance criteria
- `.planning/REQUIREMENTS.md` §Quality & Testing (QUALITY-01–04) — test pyramid and CI requirements
- `.planning/REQUIREMENTS.md` §Distribution (DIST-01–03) — installer, releases, version display

### Roadmap
- `.planning/ROADMAP.md` §Phase 4 — Goal, success criteria, UAT criteria, Codex-agent notes (Vitest unit, integration against temp fs, Playwright Electron, GitHub Actions Windows runner, electron-builder NSIS, electron-store scan history, version from package.json)

### Project & Tech Stack
- `CLAUDE.md` — IPC security rules (contextBridge), testing stack versions (Vitest ^4.1, Playwright ^1.58, electron-builder ^26), what NOT to use

### Existing Code to Extend
- `src/renderer/src/components/Sidebar.tsx` — Phase 4 adds scan history section and version footer here
- `src/main/__tests__/scan.test.ts` — Existing unit tests for scan pure functions; extend or reference
- `src/main/__tests__/organizer.test.ts` — Existing unit tests for organizer pure functions; extend or reference
- `vitest.config.ts` — Existing Vitest config (happy-dom environment, globals: true, src/**/*.{test,spec} glob)
- `playwright.config.ts` — Existing Playwright stub; needs `_electron` launch config added
- `package.json` — `build:win` script already exists; `name` field needs fix from `walnut-temp` → `walnut`

### Prior Context (relevant decisions)
- `.planning/phases/01-app-shell-ipc-foundation/01-CONTEXT.md` D-04 — Test infra configured in Phase 1; Phase 4 writes the full suite
- `.planning/phases/03-file-organization/03-CONTEXT.md` D-06 — electron-conf used for undo stack; Phase 4 reuses same library for scan history

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `electron-conf` — already installed and used for undo stack; scan history is a second key in the same store
- `src/renderer/src/components/Sidebar.tsx` — existing sidebar component; Phase 4 extends with history section and version footer
- `src/main/handlers/scan.ts` — `walkDirectory`, `hashFile`, `groupBySize`, `groupByHash` all available for integration testing
- `src/main/handlers/organizer.ts` — `safeMove`, `buildCategoryMap` exported public for testability (Phase 3 D-06 decision)
- `shared/ipc-types.ts` — add `APP_GET_VERSION` channel; follow existing pattern

### Established Patterns
- IPC: typed `ipcMain.handle()` + `contextBridge` one-function-per-operation pattern (CLAUDE.md)
- State: Zustand store in `src/renderer/src/store/appStore.ts`; Phase 4 adds `scanHistory` slice
- Tests: `// @vitest-environment node` header for main-process tests (established in scan.test.ts)
- Handlers: registered via `registerXxxHandlers()` in `src/main/index.ts` `app.whenReady()` block

### Integration Points
- New IPC channel `app:get-version` — main process reads `app.getVersion()`, renderer displays in sidebar footer
- Sidebar scan history click → sets `selectedFolder` (existing Zustand action) + triggers scan start
- Phase 4 adds no new pages — all UI changes are within the existing Sidebar component

</code_context>

<specifics>
## Specific Decisions

- Package name fix: `walnut-temp` → `walnut` in `package.json` is a prerequisite for electron-builder producing correctly named installer artifacts
- CI uses `windows-latest` runner (not `ubuntu-latest`) — file path tests are Windows-sensitive
- E2e tests: NOT run in CI for v1 (too expensive on hosted runners); run locally before releases
- Release tag format: `v*` glob (e.g., `v1.0.0`) — conventional semver tags trigger the release workflow
- Integration test isolation: use `os.tmpdir()` + unique subdirectories per test; clean up in `afterEach`

</specifics>
