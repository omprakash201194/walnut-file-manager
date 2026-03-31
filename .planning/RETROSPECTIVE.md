# Retrospective: Walnut File Manager

## Milestone: v1.0 MVP

**Shipped:** 2026-03-31
**Phases:** 4 | **Plans:** 19 | **Tasks:** 27
**Timeline:** 3 days (2026-03-29 → 2026-03-31)

### What Was Built

1. **App Shell & IPC** — Electron + Vite + React + TypeScript scaffold, dark-mode UI with shadcn/ui + Tailwind v4, HashRouter navigation, typed contextBridge IPC
2. **Duplicate Detection** — SHA-256 + name-pattern pipeline, real-time streaming progress, Keep Newest/Oldest presets, protected folders, Recycle Bin delete
3. **File Organization** — ByType + ByExtension strategies, dry-run preview accordion, apply + undo with electron-conf persistence
4. **Quality & Distribution** — 62 Vitest unit+integration tests, 7 Playwright e2e, GitHub Actions CI (windows-latest), NSIS installer + GitHub Releases, scan history

### What Worked

- **GSD wave-based execution** — Parallelizing plan tasks in waves cut execution time significantly vs sequential task-by-task approach
- **Phase verification gates** — Each phase produced a VERIFICATION.md with explicit success criteria; caught the SC-3 e2e gap before milestone close
- **shadcn/ui copy-paste model** — No dependency churn; components owned in repo; dark mode worked without configuration
- **electron-conf for persistence** — Typed, validated storage prevented the class of bugs common with raw JSON files
- **contextBridge security model** — One function per IPC channel kept the security surface small and auditable
- **Size pre-filter before hashing** — Dramatic performance improvement: only size-colliding files go through SHA-256

### What Was Inefficient

- **shadcn CLI creates `@/` literal directory** — Happened in phases 01, 02, and 03; required the same recovery each time (move files, delete `@/`). Not fixed upstream because it's a CLI limitation.
- **SC-3 e2e gap** — The original Phase 04 plan excluded `Apply` from e2e to avoid touching developer files, but this conflicted with the ROADMAP success criterion. Required a gap-closure plan (04-06). Should have been designed for temp folder isolation from the start.
- **STATE.md progress tracker** — The progress `percent: 0` was stale throughout; the tracker never auto-updated. Cosmetic issue but adds noise.

### Patterns Established

- **HashRouter for Electron** — Always use HashRouter (not BrowserRouter) in Electron; file:// protocol breaks history API
- **AbortController at module level** — Allows SCAN_CANCEL handler to reach the controller across separate `ipcMain.handle` calls
- **Push-event listeners return cleanup functions** — Prevents StrictMode double-subscription; return from `contextBridge.exposeInMainWorld` methods
- **`electronApp.evaluate(fn, arg)`** — Pass data into main-process evaluation via second arg; separate V8 contexts don't share closures
- **e2e isolation via `electronApp.evaluate`** — Create temp files/folders in main process for e2e tests; no real user files touched

### Key Lessons

- Design e2e tests for isolation from the start — if a flow requires file mutation, use temp dirs created in the main process
- shadcn CLI quirks (literal `@/` dir) are deterministic — document the recovery pattern once, apply confidently on repeat
- Phase verification before milestone close is valuable — caught a real gap that would have been tech debt
- electron-conf > electron-store for typed Electron persistence in TypeScript projects (schema enforcement)

### Cost Observations

- Sessions: 4 (one per day, plus gap-closure session)
- Notable: All 4 phases + gap closure completed in 3 calendar days using GSD autonomous execution

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 4 |
| Plans | 19 |
| Days | 3 |
| Tests shipped | 69 (62 unit/integration + 7 e2e) |
| e2e gaps at verification | 1 (SC-3, closed same session) |
| LOC | ~3,600 TypeScript/TSX |
