# Phase 1: App Shell & IPC Foundation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the Electron application scaffold: project setup via electron-vite, a dark-mode UI shell (sidebar navigation + main content area), a folder picker backed by IPC, and the typed IPC architecture that all subsequent phases depend on.

No scanning, no file operations, no data-driven lists. Placeholder content for Duplicates and Organizer modules is acceptable.

Requirements covered: SHELL-01, SHELL-02, SHELL-03.

</domain>

<decisions>
## Implementation Decisions

### IPC Architecture
- **D-01:** Pattern-setting scope — Phase 1 implements `select-directory` as the first working channel AND establishes the project-wide IPC conventions: channel naming, `shared/ipc-types.ts` file structure, and preload bridge pattern. Future phases add channels by following the established pattern, not by inventing their own approach.
- **D-02:** Strict IPC security — `contextIsolation: true`, `nodeIntegration: false`, no raw `ipcRenderer` exposure. Preload script exposes one typed function per operation via `contextBridge`. This is non-negotiable per CLAUDE.md.

### State Management
- **D-03:** Zustand from day 1 — Install Zustand and create an app store (`src/renderer/src/store/appStore.ts` or equivalent) with a `selectedFolder` slice as the first state shape. Phases 2 and 3 add scan state and org state to the same store. No refactor step needed later.

### Testing Infrastructure
- **D-04:** Config-only in Phase 1 — Install and configure Vitest (with happy-dom environment) and Playwright for Electron in Phase 1. Do NOT write tests in this phase. Phase 4 writes the full test suite against this config. Goal: Phase 4 can add tests without wrestling with setup.

### UI Implementation
- **D-05:** All visual decisions are locked in the UI-SPEC — zinc dark color scale, 220px sidebar, layout, typography, component list, copy, and interaction states. Executor must follow `01-UI-SPEC.md` exactly.
- **D-06:** shadcn/ui initialization — run `npx shadcn init` as the first UI step; use zinc color scale, dark mode default. Follow Vite manual setup (not Next.js guide). Install: button, separator, scroll-area, tooltip.
- **D-07:** Navigation with React Router `<NavLink>` — custom styled div items, not shadcn navigation-menu component.

### Claude's Discretion
- Exact file structure within `src/` (electron-vite template conventions apply)
- ESLint flat config and Prettier setup details
- Zustand store file naming and internal slice structure (beyond the `selectedFolder` slice)
- `shared/ipc-types.ts` internal structure (channel name constants, request/response type shapes) — should be clean and extensible, following CLAUDE.md IPC guidance

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Design Contract
- `.planning/phases/01-app-shell-ipc-foundation/01-UI-SPEC.md` — Complete visual and interaction spec: layout, colors, typography, components, copywriting, interaction states. All visual decisions are locked here.

### Project & Tech Stack
- `CLAUDE.md` — Tech stack versions, IPC security rules (contextBridge, no nodeIntegration), testing stack, what NOT to use. Authoritative reference for all tooling choices.

### Requirements
- `.planning/REQUIREMENTS.md` §App Shell — SHELL-01, SHELL-02, SHELL-03 acceptance criteria
- `.planning/ROADMAP.md` §Phase 1 — Goal, success criteria, UAT criteria, Codex-agent notes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Only `CLAUDE.md` and `LICENSE` exist. No src directory.

### Established Patterns
- None yet — Phase 1 establishes the patterns.

### Integration Points
- Phase 1 creates the foundation. Phase 2 connects to: Zustand store (adds scan state), IPC bridge (adds scan channels), router (adds scan routes to placeholder views).

</code_context>

<specifics>
## Specific Ideas

- IPC channel naming: use descriptive strings (e.g., `'dialog:select-directory'`) rather than short codes — readability matters when Phase 2 adds 4+ channels
- Shared types location: `shared/` directory at project root level (not inside `src/`) per ROADMAP Codex notes
- Folder picker: while OS dialog is open, disable the "Choose Folder" button to prevent duplicate IPC calls (per UI-SPEC)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-app-shell-ipc-foundation*
*Context gathered: 2026-03-30*
