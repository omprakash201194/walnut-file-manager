# Phase 1: App Shell & IPC Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 01-app-shell-ipc-foundation
**Areas discussed:** IPC contract depth, State management setup, Testing infrastructure

---

## IPC Contract Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — select-directory only | Only the folder picker channel. Phase 2 defines scan channels when it needs them. | |
| Pattern-setting | select-directory + channel naming convention + shared/ipc-types.ts structure. Future phases add channels to the existing pattern. | ✓ |
| Pre-scaffolded — stub Phase 2 channels too | Define select-directory + stub scan-start, scan-progress, scan-cancel, trash-files channels with typed placeholders. | |

**User's choice:** Pattern-setting
**Notes:** Establish the IPC conventions (channel naming, shared types file) in Phase 1 so Phase 2 just adds channels to an existing pattern.

---

## State Management Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand from day 1 | Install Zustand and create app store with selectedFolder slice. Phases 2-3 add to the same store. | ✓ |
| Local useState for now | Keep selectedFolder in component useState. Phase 2 lifts to Zustand when scan state is needed. | |

**User's choice:** Zustand from day 1
**Notes:** Avoid a refactor step in Phase 2. CLAUDE.md already specifies Zustand as the state management choice.

---

## Testing Infrastructure

| Option | Description | Selected |
|--------|-------------|----------|
| Config only in Phase 1 | Install and configure Vitest + Playwright in Phase 1. No tests written yet. Phase 4 writes tests against this config. | ✓ |
| Defer entirely to Phase 4 | Don't touch testing until Phase 4. | |
| Config + Phase 1 smoke tests | Set up config and write a basic smoke test (app launches, sidebar renders, IPC bridge exposed). | |

**User's choice:** Config only in Phase 1
**Notes:** Prevents integration pain when Phase 4 tries to add tests to a working app.

---

## Claude's Discretion

- Exact file structure within `src/` (follow electron-vite template conventions)
- ESLint flat config and Prettier setup details
- Zustand store file naming and slice internals
- `shared/ipc-types.ts` internal structure

## Deferred Ideas

None — discussion stayed within phase scope.
