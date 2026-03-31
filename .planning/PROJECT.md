# Walnut File Manager

## What This Is

Walnut is a Windows desktop file management application that helps users clean up and organize their personal files. It identifies duplicate files using content-aware SHA-256 detection, reorganizes files into structured directories by type, and provides scan history for quick re-access. All destructive operations show a preview before execution — nothing happens without the user's explicit approval.

**Current state:** v1.0 shipped. Full feature set from scaffold to distribution is complete.

## Core Value

A user can scan any folder, instantly see their duplicate files and clutter, and take action to clean them up — with full confidence that nothing will be lost without their consent.

## Requirements

### Validated (v1.0)

**App Shell** — Phase 01
- ✓ Dark-mode-first UI using shadcn/ui + Tailwind v4 (OKLCH zinc theme) — v1.0
- ✓ Folder browser / picker to select target directory — v1.0
- ✓ Sidebar navigation between Duplicates and Organizer modules — v1.0
- ✓ Scan history: previously scanned folders listed for quick re-access — v1.0

**Duplicate Detection** — Phase 02
- ✓ Scan a selected folder recursively with real-time streaming progress — v1.0
- ✓ SHA-256 content hash + name-pattern detection (Windows "- Copy" files) — v1.0
- ✓ Duplicate groups displayed with paths, sizes, modified dates, space savings summary — v1.0
- ✓ Smart presets (Keep Newest/Oldest) + per-file manual selection with keep-at-least-one constraint — v1.0
- ✓ Preview panel showing exactly what will be removed before deletion — v1.0
- ✓ Move-to-Recycle-Bin (not permanent delete) as the default action — v1.0
- ✓ Protected folders: exclude designated directories from auto-selection — v1.0

**File Organization** — Phase 03
- ✓ Categorize files by type: Documents, Photos, Music, Video, Archives, Other — v1.0
- ✓ Dry-run preview as before/after accordion tree before any moves — v1.0
- ✓ Apply reorganization: move files into type-based subdirectories — v1.0
- ✓ ByType and ByExtension strategies (extensible strategy pattern) — v1.0
- ✓ Undo last reorganization with persistence via electron-conf — v1.0

**Quality & Distribution** — Phase 04
- ✓ 62 unit + integration tests via Vitest (all passing) — v1.0
- ✓ Playwright e2e tests covering scan, delete, organize, and undo flows — v1.0
- ✓ GitHub Actions CI on windows-latest blocking PRs on failure — v1.0
- ✓ NSIS Windows installer via electron-builder + GitHub Releases on v* tags — v1.0
- ✓ App version displayed in sidebar footer via IPC — v1.0

### Active

*(No active requirements — v1.0 shipped all planned features. Start next milestone with `/gsd:new-milestone`.)*

### Out of Scope

- Cloud storage integration (Google Drive, OneDrive, S3) — deferred to future version
- Mobile or web app — desktop-only for v1
- Linux / macOS support — Windows-only for v1; cross-platform is an Electron option later
- AI-powered file naming or content analysis — out of v1 scope
- Real-time file watching / auto-reorganize — manual, user-initiated only for v1
- Fuzzy/image duplicate detection — v2 candidate

## Context

- **Shipped:** v1.0 on 2026-03-31 · 3 days · ~3,600 TypeScript/TSX LOC
- **Tech stack:** Electron 40.x + React 19 + TypeScript 5.7 + Vite (electron-vite) + shadcn/ui + Tailwind v4 + Zustand + electron-conf
- **Test coverage:** 62 Vitest tests (unit + integration) + 7 Playwright e2e tests
- **CI:** GitHub Actions on windows-latest; NSIS installer released via GitHub Releases
- **Target users:** Personal use — single user managing their own filesystem
- **Scale:** Designed for personal libraries (tens of thousands of files)
- **Agent tooling:** Codex CLI used as primary coding agent with GSD workflow

## Constraints

- **Tech Stack**: Electron + React + TypeScript — locked in for v1
- **UI System**: shadcn/ui + Tailwind CSS — dark-mode-first, composable components
- **Platform**: Windows only — no cross-platform abstractions required in v1
- **File Operations**: Preview-first model — no destructive action executes without user confirmation
- **Testing**: Full testing pyramid — unit (Vitest), integration, e2e (Playwright for Electron)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | Larger ecosystem, TypeScript throughout, simpler onboarding for Codex agent | ✓ Good — no blockers hit |
| shadcn/ui + Tailwind over Mantine | Full design control, no vendor lock-in, composable primitives | ✓ Good — dark mode aesthetics delivered |
| Preview-first file operations | File loss is unrecoverable — user confidence requires explicit approval | ✓ Good — delete + organize both preview-gated |
| SHA-256 content hashing | Eliminates false positives from name+size matches | ✓ Good — zero false positives observed |
| Windows-only v1 | Reduces platform complexity; faster initial delivery | ✓ Good — all file ops are Windows-tested |
| Move-to-trash default | System trash is recoverable; permanent delete not offered | ✓ Good — `shell.trashItem()` works reliably |
| HashRouter over BrowserRouter | Electron file:// protocol has no server for history API navigation | ✓ Good — correct solution for Electron renderer |
| electron-conf for undo persistence | Typed, schema-validated storage vs raw electron-store | ✓ Good — undo stack survives app restart |
| contextBridge + one-fn-per-channel | Security: no raw ipcRenderer exposure | ✓ Good — no nodeIntegration needed |
| AbortController at module level | SCAN_CANCEL handler must reach controller across separate ipcMain.handle calls | ✓ Good — cancel works reliably |
| SCAN_COMPLETE via webContents.send | Avoids IPC message size limits for large result sets | ✓ Good — large folder scans work |
| E2e excluded from CI | Playwright tests require built app; CI runs unit+integration only | ✓ Good — fast CI, e2e run locally |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-03-31 after v1.0 milestone*
