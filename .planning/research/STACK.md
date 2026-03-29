# Technology Stack

**Project:** Walnut File Manager
**Researched:** 2026-03-29

## Overview

Walnut is a Windows desktop file manager built with Electron + React + TypeScript. The stack prioritizes Vite-based tooling for fast dev cycles, Zustand for lightweight state management, and Electron's built-in APIs for file operations. The project is Windows-only for v1, which simplifies platform decisions.

## Core Stack

### Scaffolding & Build Tool

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| electron-vite | ^5.0.0 | Build tooling, dev server, HMR | Vite-native Electron tooling with 260k+ weekly npm downloads. Provides proper main/preload/renderer process separation out of the box, blazing fast HMR, and first-class TypeScript support. Electron Forge's Vite plugin is a wrapper around similar concepts but adds unnecessary abstraction. electron-vite gives you Vite's speed directly. | HIGH |

**Scaffold command:**
```bash
npm create @quick-start/electron@latest walnut-file-manager -- --template react-ts
```

This generates a project with `src/main`, `src/preload`, and `src/renderer` directories already separated -- exactly the structure needed.

### Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Electron | ^40.x | Desktop shell, Node.js access, native APIs | Current stable (40.8.5 as of March 2026). Provides `shell.moveItemToTrash()` for safe deletion, `dialog.showOpenDialog()` for folder picking, and full Node.js access in the main process for file system operations. | HIGH |
| React | ^19.x | UI rendering | Standard choice, locked in by project constraints. React 19 is stable with improved performance. | HIGH |
| TypeScript | ^5.7 | Type safety | Required by project constraints. v5.7 has improved inference and performance. | HIGH |

### UI Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| shadcn/ui | CLI v4 (latest) | Component library | Locked in by project constraints. Copy-paste composable components, full design control, excellent dark mode support. Not a dependency -- components are owned source code. | HIGH |
| Tailwind CSS | ^4.2 | Utility-first CSS | Locked in by project constraints. v4 uses CSS-first config (no `tailwind.config.js` needed), 5x faster builds. Dark mode via `dark:` variant. | HIGH |
| Radix UI | (via shadcn/ui) | Accessible primitives | shadcn/ui is built on Radix primitives. Comes automatically with shadcn components. | HIGH |

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | ^5.0 | Global app state | Lightweight (2kb), no boilerplate, works perfectly with React 19. Ideal for Walnut's needs: scan state, selected files, UI preferences, scan history. Single-store model fits a file manager where state is interconnected (current directory, selected files, scan progress are related). 150% adoption growth in past year. | HIGH |

**Why not Jotai:** Jotai's atomic model shines for independent reactive atoms. Walnut's state is interconnected (scan results feed duplicate groups feed selection state), which maps naturally to Zustand's single-store model.

**Why not Redux:** Overkill. Zustand provides the same predictability with 90% less ceremony.

**Why not React Context:** No built-in selector optimization, causes unnecessary re-renders in complex trees.

### Routing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React Router | ^7.13 | In-app navigation | Walnut has sidebar navigation between features (Duplicates, Organizer, future modules). React Router v7 is mature, well-documented, and the de facto standard. Use as a library (not framework mode). | HIGH |

### Data Fetching / Async Operations

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TanStack Query | ^5.x | Async state for IPC calls | Manages loading/error/success states for file scanning operations, caching scan results, and invalidation. Treats IPC calls to the main process like "server" calls. Provides automatic retry, background refetching (useful for re-scanning), and devtools. | MEDIUM |

**Why TanStack Query for a desktop app:** File scans are expensive async operations. TanStack Query gives you loading states, error boundaries, caching, and deduplication for free. Without it, you'd reimplement half of it manually in Zustand.

## File System & OS Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js `fs/promises` | (built-in) | File reading, stats, directory listing | Built into Node.js, available in Electron main process. Use async APIs exclusively (`readdir`, `stat`, `readFile`). | HIGH |
| Node.js `crypto` | (built-in) | SHA-256 content hashing | Built-in `createHash('sha256')` for duplicate detection. No external dependency needed. Stream files with `createReadStream` to hash large files without loading into memory. | HIGH |
| `shell.moveItemToTrash()` | (Electron API) | Move to Recycle Bin | Built-in Electron API. Cross-platform but on Windows uses the system Recycle Bin. This is the correct way -- no third-party `trash` package needed since Walnut runs inside Electron. | HIGH |
| `dialog.showOpenDialog()` | (Electron API) | Folder picker | Built-in Electron API. Use `properties: ['openDirectory']` for folder selection. | HIGH |
| Node.js `path` | (built-in) | Path manipulation | Always use `path.resolve()` / `path.join()` for Windows path compatibility. Never concatenate paths with string operations. | HIGH |

**Not using chokidar:** File watching is explicitly out of scope for v1 (no real-time file watching). If needed later, chokidar v5 (ESM-only, Node 20+) is the standard.

## IPC Architecture

This is the most important architectural decision in any Electron app.

### Pattern: Typed invoke/handle with contextBridge

```
Renderer (React) --invoke--> Preload (contextBridge) --ipcRenderer.invoke--> Main (ipcMain.handle)
Main --return Promise--> Preload --> Renderer
```

**Channel naming convention:** Namespace with colons: `fs:scan-directory`, `fs:get-file-stats`, `duplicates:find`, `organize:preview`, `organize:apply`.

**Preload script exposes typed API:**
```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('api', {
  scanDirectory: (path: string) => ipcRenderer.invoke('fs:scan-directory', path),
  findDuplicates: (path: string) => ipcRenderer.invoke('duplicates:find', path),
  moveToTrash: (paths: string[]) => ipcRenderer.invoke('fs:move-to-trash', paths),
  // ... one method per operation, never expose ipcRenderer directly
})
```

**Type sharing:** Define shared types in a `src/shared/` directory importable by both main and renderer. electron-vite supports this out of the box.

**Security rules:**
- NEVER expose `ipcRenderer` directly
- NEVER use `nodeIntegration: true`
- ALWAYS use `contextIsolation: true` (default since Electron 12)
- ONE function per IPC channel in preload (no generic `send(channel, ...args)`)

## Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ESLint | ^9.x | Linting | Flat config format. Use `@electron-toolkit/eslint-config-ts` for Electron+TS rules. | HIGH |
| Prettier | ^3.x | Code formatting | Standard. Configure once, forget. | HIGH |
| electron-devtools-installer | ^3.x | React DevTools in Electron | Installs Chrome DevTools extensions into Electron's dev mode. | MEDIUM |

## Testing Stack

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | ^4.1 | Unit + integration tests | Native Vite integration (electron-vite uses Vite), so zero config needed. v4.1 is current stable (released March 2026). Use for testing main process logic (hashing, scanning, organizing) and React components. | HIGH |
| @playwright/test | ^1.58 | E2E tests (Electron) | Playwright has first-class Electron support via `_electron.launch()`. Test the actual packaged app behavior. Current stable is 1.58.2. | HIGH |
| @testing-library/react | ^16.x | Component testing | Complements Vitest for testing React components with user-centric queries. | HIGH |
| happy-dom | (latest) | DOM environment for Vitest | Faster than jsdom, sufficient for component tests. Configure as Vitest environment. | MEDIUM |

### Testing Strategy

```
Unit (Vitest)           -- Pure functions: hashing, file categorization, duplicate grouping
Integration (Vitest)    -- IPC handlers with mocked fs, Zustand store logic
Component (Vitest + RTL)-- React components with mocked IPC
E2E (Playwright)        -- Full app launch, folder selection, scan, delete flow
```

## Build & Packaging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| electron-builder | ^26.x | Packaging & distribution | electron-vite integrates with electron-builder out of the box. Produces NSIS installer for Windows. 1.1M weekly downloads, mature, well-documented. Supports auto-update via electron-updater. | HIGH |
| electron-updater | ^6.8 | Auto-updates | Pairs with electron-builder. Supports GitHub Releases as update server (free). Staged rollouts available. | MEDIUM |

**Why not Electron Forge for packaging:** electron-vite's default template uses electron-builder, and the two integrate seamlessly. Mixing electron-vite (build) with Electron Forge (packaging) adds complexity for no benefit. electron-builder has 7x the weekly downloads and more Windows-specific packaging options.

**Windows output:** NSIS installer (`.exe`) is the standard for Windows distribution. Also consider portable mode (no install required) for power users.

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **Electron Forge** (as scaffolding) | Adds abstraction over Vite with no benefit. electron-vite is leaner and faster. Forge's Vite plugin ports experimental features from electron-vite anyway. |
| **Webpack** | Slower than Vite by orders of magnitude. No reason to use in 2026 for a new project. |
| **Redux / Redux Toolkit** | Massive boilerplate for a desktop app. Zustand provides the same guarantees with 5% of the code. |
| **Jotai / Recoil** | Atomic model doesn't fit Walnut's interconnected state (scan results -> duplicate groups -> selections). |
| **`nodeIntegration: true`** | Critical security vulnerability. Any renderer code (or XSS) gets full Node.js access. Always use contextBridge. |
| **Exposing raw `ipcRenderer`** | Security footgun. Renderer can send arbitrary messages to main process. Expose one function per operation. |
| **`trash` npm package** | Unnecessary. Electron's `shell.moveItemToTrash()` does the same thing natively with zero dependencies. |
| **`fs.watch` / `fs.watchFile`** | Unreliable on Windows (known Node.js issues). If file watching is ever needed, use chokidar. But it's out of scope for v1. |
| **Create React App** | Dead project. No longer maintained. |
| **Tailwind CSS v3** | v4 is a ground-up rewrite with CSS-first config and dramatically better performance. No reason to start new with v3. |
| **Jest** | Vitest is faster, has native Vite/ESM support, and Jest-compatible API. Zero reason to choose Jest for a Vite-based project. |

## Installation

```bash
# Scaffold
npm create @quick-start/electron@latest walnut-file-manager -- --template react-ts

# Core UI (after scaffold)
npx shadcn@latest init
npm install tailwindcss @tailwindcss/vite

# State & Routing
npm install zustand react-router
npm install @tanstack/react-query

# Testing
npm install -D vitest @vitest/coverage-v8 happy-dom
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
npx playwright install

# Build (likely already included by electron-vite template)
npm install -D electron-builder electron-updater

# Dev tools
npm install -D prettier eslint @electron-toolkit/eslint-config-ts
```

## Version Summary

| Package | Version | Verified |
|---------|---------|----------|
| Electron | ^40.x (40.8.5 current) | WebSearch: releases.electronjs.org |
| electron-vite | ^5.0 | WebSearch: electron-vite.org |
| React | ^19.x | Training data (stable) |
| TypeScript | ^5.7 | Training data (stable) |
| Tailwind CSS | ^4.2 (4.2.2 current) | WebSearch: github.com/tailwindlabs |
| shadcn/ui | CLI v4 | WebSearch: ui.shadcn.com changelog |
| Zustand | ^5.0 (5.0.12 current) | WebSearch: npmjs.com |
| React Router | ^7.13 (7.13.1 current) | WebSearch: npmjs.com |
| TanStack Query | ^5.x | Training data (stable) |
| Vitest | ^4.1 (4.1.2 current) | WebSearch: vitest.dev |
| Playwright | ^1.58 (1.58.2 current) | WebSearch: npmjs.com |
| electron-builder | ^26.x | WebSearch: npmjs.com |
| electron-updater | ^6.8 (6.8.3 current) | WebSearch: npmjs.com |

## Sources

- [Electron Releases](https://releases.electronjs.org/)
- [electron-vite Official Site](https://electron-vite.org/)
- [electron-vite Getting Started](https://electron-vite.org/guide/)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron Security Guide](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron shell API (moveItemToTrash)](https://www.electronjs.org/docs/latest/api/shell)
- [Vitest 4.0 Release](https://vitest.dev/blog/vitest-4)
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [shadcn/ui Changelog - CLI v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [Zustand on npm](https://www.npmjs.com/package/zustand)
- [React Router Changelog](https://reactrouter.com/changelog)
- [electron-builder Auto Update](https://www.electron.build/auto-update.html)
- [State Management in 2025 Comparison](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [Electron Forge vs electron-builder](https://www.electronforge.io/core-concepts/why-electron-forge)
