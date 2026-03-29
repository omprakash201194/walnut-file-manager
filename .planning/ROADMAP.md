# Roadmap: Walnut File Manager

## Overview

Walnut delivers a Windows desktop file cleanup utility in four phases: scaffold the Electron app shell with IPC foundation, build the core duplicate detection pipeline (the primary value proposition), add file organization with undo support, then harden with testing, scan history, and distribution packaging. Each phase delivers a coherent, verifiable capability that builds on the previous.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: App Shell & IPC Foundation** - Electron scaffold with dark-mode UI, folder picker, sidebar navigation, and typed IPC bridge
- [ ] **Phase 2: Duplicate Detection** - Full scan-to-delete pipeline with content hashing, grouped display, smart selection, and preview-first deletion
- [ ] **Phase 3: File Organization** - Type-based categorization, strategy pattern, dry-run preview, apply, and undo
- [ ] **Phase 4: Quality & Distribution** - Testing pyramid, CI pipeline, scan history, installer packaging, and release automation

## Phase Details

### Phase 1: App Shell & IPC Foundation
**Goal**: User can launch a polished dark-mode Electron app, pick a folder, and navigate between feature modules -- establishing the IPC patterns everything else depends on
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, SHELL-02, SHELL-03
**Success Criteria** (what must be TRUE):
  1. User launches the app and sees a dark-mode window with a sidebar showing Duplicates and Organizer navigation items
  2. User clicks a folder picker button and selects a directory via the native Windows folder dialog, and the selected path is displayed in the UI
  3. User clicks sidebar items and the main content area switches between Duplicates and Organizer views (placeholder content is acceptable)
  4. The Electron main process, preload bridge, and renderer communicate through typed IPC contracts -- no raw ipcRenderer exposure
**Plans**: TBD
**UI hint**: yes

**UAT criteria:**
- Launch app from dev server -- dark-mode window renders with sidebar
- Use folder picker -- selected path appears in the UI
- Click each sidebar item -- content area switches without errors
- DevTools console shows no security warnings about nodeIntegration or contextBridge

**Codex-agent notes:**
- Use electron-vite 5.0 for project scaffolding
- Set up shared TypeScript types for IPC channels in a `shared/` directory
- shadcn/ui components need adaptation for pure Vite/React (not Next.js) -- follow shadcn CLI v4 manual setup
- Tailwind CSS 4.2 uses CSS-first config -- may need minor adjustments for electron-vite

### Phase 2: Duplicate Detection
**Goal**: User can scan a folder for duplicate files, review grouped results with space savings, select duplicates to remove using smart presets, and safely delete them to the Recycle Bin after previewing the operation
**Depends on**: Phase 1
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, DUPE-01, DUPE-02, DUPE-03, DUPE-04, DUPE-05, DUPE-06, SELECT-01, SELECT-02, SAFETY-01, SAFETY-02, SAFETY-03
**Success Criteria** (what must be TRUE):
  1. User initiates a scan on a folder and sees a progress indicator updating in real-time (files scanned, elapsed time, current path), with first results appearing within 2 seconds
  2. User can cancel an in-progress scan and the operation stops promptly without leaving partial state
  3. After scan completes, user sees duplicate groups listed with all copies showing path, size, and modified date, plus a summary like "X duplicates found -- you can reclaim Y GB"
  4. User can select files for deletion using per-file checkboxes or bulk presets (keep newest, keep oldest, keep from preferred folder), with protected folders excluded from auto-selection and at least one copy always retained
  5. User sees a preview panel listing exactly which files will be removed and their total size, confirms the action, and files are moved to the Windows Recycle Bin
**Plans**: TBD
**UI hint**: yes

**UAT criteria:**
- Create a test folder with known duplicates (same content, different names/locations) and unique files
- Scan the folder -- progress bar updates, results stream in progressively
- Cancel a scan mid-way -- UI returns to ready state cleanly
- Verify duplicate groups match expected results (no false positives from size-only matching)
- Mark a folder as protected -- files in that folder are never pre-selected for deletion
- Use "keep newest" preset -- only older copies are selected
- Attempt to select all copies in a group -- app prevents it (keep-at-least-one constraint)
- Review preview panel -- confirm it shows correct files and sizes
- Confirm deletion -- verify files appear in Windows Recycle Bin

**Codex-agent notes:**
- File scanning runs in main process; stream results to renderer via IPC
- SHA-256 hashing: use Node.js crypto module; consider worker threads if sequential hashing is too slow on large folders
- Size pre-filter first (group by size), then hash only size-colliding files
- Use Electron's `shell.trashItem()` for Recycle Bin integration
- IPC streaming pattern: use `webContents.send()` for progressive results, `ipcMain.handle()` for request/response

### Phase 3: File Organization
**Goal**: User can categorize scanned files by type, choose an organization strategy, preview proposed file moves as a before/after tree, apply the reorganization, and undo it if needed
**Depends on**: Phase 2
**Requirements**: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, SAFETY-04, SAFETY-05
**Success Criteria** (what must be TRUE):
  1. User scans a folder and sees files categorized into Documents, Photos, Music, Video, Archives, and Other based on file extension
  2. User selects between "By Type" and "By Extension" organization strategies and sees the proposed moves update accordingly
  3. User sees a dry-run preview showing a before/after directory tree of where files will be moved, before any files are touched
  4. User applies the reorganization and files are moved into type-based subdirectories within the target folder
  5. User can undo the last reorganization and all file moves are reversed to their original locations
**Plans**: TBD
**UI hint**: yes

**UAT criteria:**
- Scan a folder with mixed file types -- verify categorization matches expected types
- Switch between "By Type" and "By Extension" strategies -- preview updates reflect different directory structures
- Review dry-run preview -- verify before/after tree accurately represents proposed moves
- Apply reorganization -- verify files are in new locations on disk
- Undo reorganization -- verify all files return to original locations
- Apply, close app, reopen -- undo should still work (undo state persists)

**Codex-agent notes:**
- Reuse scanning infrastructure from Phase 2 (file walking, metadata collection)
- Strategy pattern: define an `OrganizationStrategy` interface so new strategies can be added without restructuring
- Undo state persistence: investigate electron-store vs JSON file vs SQLite for storing move history across sessions
- Before/after tree visualization: consider a simple tree component or text-based diff view

### Phase 4: Quality & Distribution
**Goal**: User can trust the app through comprehensive test coverage and CI, access scan history for quick re-scans, and install the app via a proper Windows installer from GitHub Releases
**Depends on**: Phase 3
**Requirements**: SHELL-04, QUALITY-01, QUALITY-02, QUALITY-03, QUALITY-04, DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. User sees previously scanned folders listed in the app for quick re-access, and can click one to start a new scan on that folder
  2. All unit tests pass covering pure logic (hash computation, size grouping, type categorization, strategy pattern) and all integration tests pass against a real temp filesystem
  3. E2e tests cover the critical user flows (scan, duplicate review, delete, organize, undo) and pass via Playwright for Electron
  4. All tests run automatically on every commit via GitHub Actions CI, and failures block the build
  5. User can download a Windows NSIS installer from GitHub Releases, install the app, and see the version number displayed in the UI
**Plans**: TBD

**UAT criteria:**
- Scan several folders, close and reopen app -- scan history shows previously scanned folders
- Click a history entry -- scan starts on that folder
- Run `npm test` locally -- all unit and integration tests pass
- Push a commit -- GitHub Actions runs all tests and reports status
- Download installer artifact from GitHub Releases -- install on a clean Windows machine
- Installed app launches, shows version number, and all features work as expected

**Codex-agent notes:**
- Vitest for unit tests; test pure functions in isolation (hash, grouping, categorization, strategy)
- Integration tests: use Node.js `fs` to create temp directories with known file structures, run scanning/hashing/organizing against them
- Playwright for Electron e2e: configure Playwright to launch the Electron app, automate full user flows
- GitHub Actions: set up workflow for Windows runner, install dependencies, run all test suites
- electron-builder with NSIS target for Windows installer
- Version display: read from package.json, show in title bar or About dialog
- Scan history: persist with electron-store or similar; load on app start

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. App Shell & IPC Foundation | 0/0 | Not started | - |
| 2. Duplicate Detection | 0/0 | Not started | - |
| 3. File Organization | 0/0 | Not started | - |
| 4. Quality & Distribution | 0/0 | Not started | - |
