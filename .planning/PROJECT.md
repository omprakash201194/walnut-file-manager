# Walnut File Manager

## What This Is

Walnut is a desktop file management application for Windows that helps users clean up and organize their personal files. It identifies duplicate files using smart content-aware detection, and reorganizes files into structured directories by type (documents, photos, music, video, and more). All destructive operations show a preview before execution — nothing happens without the user's explicit approval.

## Core Value

A user can scan any folder, instantly see their duplicate files and clutter, and take action to clean them up — with full confidence that nothing will be lost without their consent.

## Requirements

### Validated

**App Shell** — Validated in Phase 01: App Shell & IPC Foundation
- [x] Dark-mode-first UI using shadcn/ui + Tailwind (VS Code / Linear aesthetic)
- [x] Folder browser / picker to select target directory
- [x] Sidebar navigation between features (Duplicates, Organizer, future modules)

**Duplicate Detection** — Validated in Phase 02: Duplicate Detection
- [x] Scan a selected folder (and subfolders) for duplicate files
- [x] Smart detection: SHA-256 content hash + name-pattern detection (Windows "- Copy", numbered copies) with birthtime tiebreaker for same-mtime files
- [x] Display duplicates grouped by file identity with file paths, sizes, and timestamps
- [x] Allow user to select which duplicate(s) to remove (Keep Newest / Keep Oldest presets + manual selection)
- [x] Preview panel (DeletePanel) showing exactly what will happen before any deletion
- [x] Move-to-trash (not permanent delete) as the default delete action
- [x] Protected folders: prevent accidental selection of files in designated safe directories

### Validated

**File Organization** — Validated in Phase 03: File Organization
- [x] Scan folder and categorize files by type: Documents, Photos, Music, Video, Archives, Other
- [x] Show proposed reorganization as a dry-run preview before applying (SAFETY-04)
- [x] Apply reorganization: move files into type-based subdirectories
- [x] Support multiple reorganization strategies (extensible — more added in future versions)
- [x] Undo last reorganization action (reverse the moves, persistent across restart)

### Active

**App Shell** *(core validated in Phase 01 — remaining items deferred to later phases)*
- [ ] Progress indicators for long-running scans
- [ ] Persistent scan history (last scanned folders)

**Quality**
- [ ] Full testing pyramid: unit tests (Vitest), integration tests (Node/Electron), e2e tests (Playwright)
- [ ] GitHub project with labeled issues and milestone tracking

### Out of Scope

- Cloud storage integration (Google Drive, OneDrive, S3) — deferred to future version
- Mobile or web app — desktop-only for v1
- Linux / macOS support — Windows-only for v1; cross-platform can be revisited
- AI-powered file naming or content analysis — out of v1 scope
- Real-time file watching / auto-reorganize — manual, user-initiated actions only for v1

## Context

- **Developer tooling**: Codex (OpenAI CLI agent) will be used as the primary coding agent during development
- **Repo**: `walnut-file-manager` already exists on GitHub; GitHub Projects will track stories and tickets
- **Target users**: Personal use initially — a single user managing their own file system
- **Scale**: Designed for personal/medium libraries (tens of thousands of files); performance optimizations deferred unless benchmarks reveal issues
- **File safety philosophy**: Every destructive operation requires an explicit preview + confirmation step; no silent file modifications

## Constraints

- **Tech Stack**: Electron + React + TypeScript — locked in for v1
- **UI System**: shadcn/ui + Tailwind CSS — dark-mode-first, composable components
- **Platform**: Windows only — no cross-platform abstractions required in v1
- **File Operations**: Preview-first model — no destructive action executes without user confirmation
- **Testing**: Full testing pyramid required — unit (Vitest), integration, e2e (Playwright for Electron)
- **Agent**: Codex CLI used for development — plans must be Codex-friendly (clear, file-scoped tasks)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | Larger ecosystem, TypeScript throughout, simpler onboarding for Codex agent, proven for file manager UIs | — Pending |
| shadcn/ui + Tailwind over Mantine | Full design control, no vendor lock-in, composable primitives, best-in-class dark mode aesthetics | — Pending |
| Preview-first file operations | File loss is unrecoverable — user confidence requires explicit approval before any destructive action | — Pending |
| SHA-256 content hashing | Eliminates false positives from name+size matches; acceptable perf at personal scale | — Pending |
| Windows-only v1 | Reduces platform complexity; allows faster initial delivery; cross-platform is an Electron option later | — Pending |
| Move-to-trash default | System trash is recoverable; permanent delete requires additional confirmation | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 — Phase 03 (File Organization) complete*
