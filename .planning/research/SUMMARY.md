# Research Summary: Walnut File Manager

**Domain:** Desktop file cleanup utility (duplicate detection + file organization)
**Researched:** 2026-03-29
**Overall confidence:** HIGH

## Executive Summary

Walnut is a Windows desktop file manager built with Electron + React + TypeScript. The 2026 ecosystem for this stack is mature and well-documented. The recommended toolchain centers on **electron-vite** (v5.0) for scaffolding and builds, **Zustand** (v5.0) for state management, and **Electron's built-in APIs** for all file system and OS operations. No exotic dependencies are required -- the entire stack is battle-tested.

The core architectural challenge is Electron's process model: all file system operations (scanning, hashing, trash) must run in the main process, while React runs in an isolated renderer. This is solved through typed IPC contracts using `contextBridge` with the invoke/handle pattern. Security is paramount -- never expose raw `ipcRenderer` or enable `nodeIntegration`.

The file manager domain has well-established UX patterns (grouped duplicates, preview-before-delete, move-to-trash defaults) validated by competitors like dupeGuru, AllDup, and Duplicate Cleaner Pro. Walnut's differentiator is combining duplicate detection with file organization in a single polished, dark-mode-first interface.

The testing stack is straightforward: **Vitest** (v4.1) for unit and component tests, **Playwright** (v1.58) for Electron e2e tests. Both are current stable versions with first-class support for the chosen build tooling.

## Key Findings

**Stack:** electron-vite 5.0 + React 19 + TypeScript 5.7 + Zustand 5.0 + shadcn/ui (CLI v4) + Tailwind CSS 4.2
**Architecture:** Main process (Node.js services) -> Preload (contextBridge) -> Renderer (React), with typed IPC contracts in shared types
**Critical pitfall:** Never expose raw `ipcRenderer` or use `nodeIntegration: true` -- any XSS becomes a full system compromise

## Implications for Roadmap

Based on research, suggested phase structure:

1. **App Shell + IPC Foundation** - Everything depends on the Electron scaffold, preload bridge, and shared types. Build the skeleton first.
   - Addresses: folder picker, sidebar navigation, dark mode shell
   - Avoids: starting features before IPC patterns are established

2. **Duplicate Detection** - Primary value proposition. Exercises the full pipeline: scanning, hashing, IPC streaming, UI rendering.
   - Addresses: content hashing, grouped display, selection, preview, delete
   - Avoids: premature optimization (sequential async is fine for v1 scale)

3. **File Organization** - Second pillar. Reuses scanning infrastructure from Phase 2 but adds type categorization and undo.
   - Addresses: type categorization, dry-run preview, apply, undo
   - Avoids: building undo before the core move operations work

4. **Polish + Quality** - Testing, error handling hardening, scan history, performance profiling.
   - Addresses: testing pyramid, permission error handling, scan history
   - Avoids: polishing features that may change during earlier phases

5. **Distribution** - Packaging with electron-builder, NSIS installer, auto-update.
   - Addresses: build pipeline, installer, updates
   - Avoids: setting up distribution before the product is functional

**Phase ordering rationale:**
- IPC bridge and shared types are the foundation -- everything flows through them
- Duplicate detection is the core value prop and exercises the full technical pipeline
- File organization reuses scanning infrastructure, so it naturally follows
- Testing and polish are most efficient after features stabilize
- Distribution is last because there's nothing to distribute until features work

**Research flags for phases:**
- Phase 1: Standard patterns, unlikely to need additional research
- Phase 2: Worker threads for hashing may need research if sequential performance is insufficient
- Phase 3: Undo tracking persistence strategy may need deeper investigation
- Phase 5: NSIS installer configuration and code signing may need platform-specific research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via web search against npm/official sites. Mature ecosystem. |
| Features | HIGH | Well-established domain with clear competitor patterns. PROJECT.md requirements are realistic. |
| Architecture | HIGH | Electron process model and IPC patterns are thoroughly documented by Electron team. |
| Pitfalls | HIGH | Security and performance pitfalls are well-known in the Electron community. |
| Testing | HIGH | Vitest + Playwright both have explicit Electron support documented. |
| Packaging | MEDIUM | electron-builder + NSIS is standard, but code signing and auto-update may have Windows-specific nuances. |

## Gaps to Address

- **Worker threads for hashing:** Training data suggests this is straightforward, but should be validated with benchmarks during Phase 2 if sequential hashing is too slow on 50K+ files
- **Tailwind CSS v4 + electron-vite integration:** v4's CSS-first config is new; may need minor config adjustments for the electron-vite template
- **shadcn/ui in Electron:** shadcn/ui is designed for Next.js primarily; some component setup may need adaptation for a pure Vite/React environment
- **NSIS installer configuration:** Specific options for Windows installer (shortcuts, registry entries, uninstall) may need phase-specific research
- **Undo persistence format:** Whether to use JSON files, SQLite, or electron-store for persisting undo state across sessions needs investigation during Phase 3
