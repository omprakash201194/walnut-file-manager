# Milestones

## v1.0 MVP (Shipped: 2026-03-31)

**Phases completed:** 4 phases, 19 plans, 27 tasks
**Timeline:** 2026-03-29 → 2026-03-31 (3 days) · ~3,600 TypeScript/TSX LOC

**Key accomplishments:**

1. Scaffolded Electron + Vite + React + TypeScript app shell with dark-mode UI (shadcn/ui + Tailwind v4), typed IPC bridge via contextBridge, and HashRouter navigation
2. Built full duplicate detection pipeline: SHA-256 content hashing with size pre-filter, real-time IPC streaming, smart presets (Keep Newest/Oldest), protected folders, Recycle Bin delete
3. Implemented file organization module: ByType and ByExtension strategies, dry-run preview accordion, apply+undo with electron-conf persistence across restarts
4. Established testing pyramid: 62 unit+integration tests via Vitest, Playwright e2e covering all critical flows (scan, delete, organize, undo)
5. Shipped CI/CD: GitHub Actions on windows-latest, NSIS installer via electron-builder, GitHub Releases on v* tag push
6. Added scan history: recent folders in sidebar with one-click re-scan, version footer via IPC, electron-conf persistence

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
