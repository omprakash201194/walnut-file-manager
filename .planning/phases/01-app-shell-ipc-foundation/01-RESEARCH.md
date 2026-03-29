# Phase 1: App Shell & IPC Foundation - Research

**Researched:** 2026-03-30
**Domain:** Electron desktop app scaffolding (electron-vite + React + TypeScript + shadcn/ui + Tailwind v4)
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield scaffold: electron-vite creates the project structure, then we layer on Tailwind CSS v4, shadcn/ui, Zustand, and React Router to produce a dark-mode app shell with sidebar navigation and a working folder picker IPC channel. The stack is well-documented and all libraries are current stable releases.

The three highest-risk integration points are: (1) shadcn/ui CLI does not recognize `electron.vite.config.ts` and requires a workaround `vite.config.ts` shim, (2) Tailwind CSS v4 uses CSS-first configuration (no `tailwind.config.js`) which changes how shadcn/ui themes are defined, and (3) Electron's `file://` protocol requires `HashRouter` instead of `BrowserRouter` for React Router to function in production builds.

**Primary recommendation:** Scaffold with `npm create @quick-start/electron`, add Tailwind v4 via `@tailwindcss/vite` plugin in the renderer config only, use the shadcn manual setup path (not `shadcn init` directly due to electron-vite incompatibility), and use `HashRouter` for all routing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Pattern-setting scope -- Phase 1 implements `select-directory` as the first working channel AND establishes the project-wide IPC conventions: channel naming, `shared/ipc-types.ts` file structure, and preload bridge pattern. Future phases add channels by following the established pattern, not by inventing their own approach.
- **D-02:** Strict IPC security -- `contextIsolation: true`, `nodeIntegration: false`, no raw `ipcRenderer` exposure. Preload script exposes one typed function per operation via `contextBridge`. This is non-negotiable per CLAUDE.md.
- **D-03:** Zustand from day 1 -- Install Zustand and create an app store with a `selectedFolder` slice as the first state shape. Phases 2 and 3 add scan state and org state to the same store.
- **D-04:** Config-only in Phase 1 -- Install and configure Vitest (with happy-dom environment) and Playwright for Electron. Do NOT write tests in this phase.
- **D-05:** All visual decisions locked in the UI-SPEC -- zinc dark color scale, 220px sidebar, layout, typography, component list, copy, and interaction states. Executor must follow `01-UI-SPEC.md` exactly.
- **D-06:** shadcn/ui initialization -- use zinc color scale, dark mode default. Follow Vite manual setup (not Next.js guide). Install: button, separator, scroll-area, tooltip.
- **D-07:** Navigation with React Router `<NavLink>` -- custom styled div items, not shadcn navigation-menu component.

### Claude's Discretion
- Exact file structure within `src/` (electron-vite template conventions apply)
- ESLint flat config and Prettier setup details
- Zustand store file naming and internal slice structure (beyond the `selectedFolder` slice)
- `shared/ipc-types.ts` internal structure (channel name constants, request/response type shapes) -- should be clean and extensible, following CLAUDE.md IPC guidance

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | User can launch the app and see a dark-mode desktop window with sidebar navigation | electron-vite scaffold + shadcn/ui zinc dark theme + sidebar layout from UI-SPEC |
| SHELL-02 | User can select a target folder using the system folder picker dialog | `dialog.showOpenDialog()` via typed IPC channel `dialog:select-directory` |
| SHELL-03 | User can navigate between Duplicates and Organizer modules via the sidebar | React Router HashRouter + NavLink with active state styling |
</phase_requirements>

## Standard Stack

### Core (verified against npm registry 2026-03-30)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | ^41.1.0 | Desktop shell | Current stable. Provides `dialog.showOpenDialog()`, `shell.moveItemToTrash()`, full Node.js main process. |
| electron-vite | ^5.0.0 | Build tooling, dev server, HMR | Vite-native Electron tooling. Separate main/preload/renderer configs in one file. |
| react | ^19.2.4 | UI rendering | Current stable. |
| typescript | ^5.9.3 | Type safety | Current stable (template ships this). |
| tailwindcss | ^4.2.2 | Utility-first CSS | CSS-first config, no `tailwind.config.js`. |
| @tailwindcss/vite | ^4.2.2 | Vite plugin for Tailwind v4 | Required for Tailwind v4 integration with Vite. Replaces PostCSS setup. |
| zustand | ^5.0.12 | Global app state | Lightweight, zero boilerplate, works with React 19. |
| react-router | ^7.13.2 | In-app navigation | Library mode (not framework). Use `HashRouter`. |
| lucide-react | ^1.7.0 | Icons | shadcn/ui default icon library. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron-toolkit/preload | ^3.0.2 | Preload utilities | Exposes `electronAPI` and `is` utilities in preload. Template dependency. |
| @electron-toolkit/utils | ^4.0.0 | Main process utilities | `optimizer` for DevTools shortcuts, `is.dev` checks. Template dependency. |
| class-variance-authority | (via shadcn) | Component variants | Installed with shadcn manual setup for variant-based component styling. |
| clsx | (via shadcn) | Class merging | Installed with shadcn manual setup. |
| tailwind-merge | (via shadcn) | Tailwind class deduplication | Installed with shadcn manual setup. Used in `cn()` utility. |
| tw-animate-css | ^1.4.0 | Animation utilities | Replaces deprecated `tailwindcss-animate`. Required by shadcn/ui components. |
| shadcn | (CLI) | Component scaffolding | Used as `npx shadcn@latest add <component>`. Not a runtime dependency. |

### Dev Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.2 | Unit + integration tests | Config only in Phase 1. |
| happy-dom | ^20.8.9 | DOM environment for Vitest | Faster than jsdom for component tests. |
| @testing-library/react | ^16.3.2 | Component testing | Config only in Phase 1. |
| @playwright/test | ^1.58.2 | E2E tests (Electron) | Config only in Phase 1. |
| electron-builder | ^26.x | Packaging (NSIS installer) | Template includes. Not actively used in Phase 1. |
| @electron-toolkit/eslint-config-ts | ^3.1.0 | ESLint rules for Electron+TS | Flat config format (ESLint 9). |
| prettier | ^3.x | Code formatting | Template includes. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HashRouter | BrowserRouter | BrowserRouter DOES NOT WORK in Electron production builds (`file://` protocol). HashRouter is mandatory. |
| shadcn CLI init | Full manual setup | shadcn CLI does not recognize electron.vite.config.ts. Workaround: create a shim vite.config.ts or do manual setup. Manual setup is cleaner. |
| tw-animate-css | tailwindcss-animate | tailwindcss-animate is deprecated in shadcn/ui v4. Use tw-animate-css. |

**Installation (after electron-vite scaffold):**
```bash
# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# shadcn dependencies (manual setup)
npm install class-variance-authority clsx tailwind-merge tw-animate-css lucide-react

# State & Routing
npm install zustand react-router

# Testing (dev)
npm install -D vitest happy-dom @testing-library/react @playwright/test
```

## Architecture Patterns

### Recommended Project Structure

The electron-vite react-ts template creates this structure. Extend it as shown:

```
walnut-file-manager/
├── src/
│   ├── main/                    # Electron main process
│   │   └── index.ts             # App lifecycle, BrowserWindow, IPC handlers
│   ├── preload/                 # Preload scripts (contextBridge)
│   │   └── index.ts             # Exposes typed API to renderer
│   └── renderer/                # React app (Vite-served)
│       ├── index.html           # Entry HTML
│       └── src/
│           ├── App.tsx          # Root component with HashRouter
│           ├── main.tsx         # React entry (createRoot)
│           ├── assets/
│           │   └── main.css     # Tailwind v4 CSS-first config + shadcn theme
│           ├── components/
│           │   ├── ui/          # shadcn/ui components (button, separator, etc.)
│           │   ├── Sidebar.tsx  # Sidebar with nav + folder picker
│           │   └── Layout.tsx   # App shell layout (sidebar + content)
│           ├── pages/
│           │   ├── DuplicatesPage.tsx  # Placeholder
│           │   └── OrganizerPage.tsx   # Placeholder
│           ├── store/
│           │   └── appStore.ts  # Zustand store (selectedFolder slice)
│           └── lib/
│               └── utils.ts     # cn() helper from shadcn
├── shared/                      # Shared types between processes
│   └── ipc-types.ts             # IPC channel names + request/response types
├── electron.vite.config.ts      # Build config (main/preload/renderer)
├── electron-builder.yml         # Packaging config
├── components.json              # shadcn/ui config
├── tsconfig.json                # Base TS config
├── tsconfig.node.json           # Node/main process TS config
├── tsconfig.web.json            # Renderer TS config
├── vitest.config.ts             # Vitest config (Phase 1: config only)
├── playwright.config.ts         # Playwright config (Phase 1: config only)
└── package.json
```

### Pattern 1: Typed IPC with contextBridge (ONE function per channel)

**What:** Define channel names and types in `shared/ipc-types.ts`. Main process registers handlers via `ipcMain.handle()`. Preload exposes typed functions via `contextBridge.exposeInMainWorld()`. Renderer calls `window.api.functionName()`.

**When to use:** Every IPC interaction. This is the ONLY allowed pattern (per CLAUDE.md).

**Example:**

```typescript
// shared/ipc-types.ts
export const IPC_CHANNELS = {
  SELECT_DIRECTORY: 'dialog:select-directory',
} as const;

export interface IpcApi {
  selectDirectory: () => Promise<string | null>;
}

// Extend Window type for renderer
declare global {
  interface Window {
    api: IpcApi;
  }
}
```

```typescript
// src/main/index.ts (handler registration)
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-types';

ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window!, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});
```

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-types';

contextBridge.exposeInMainWorld('api', {
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),
});
```

```typescript
// Renderer usage
const folder = await window.api.selectDirectory();
```

### Pattern 2: Zustand Store with Typed Slices

**What:** Single store with typed state and actions. Use curried `create<State>()(...)` syntax for TypeScript.

**Example:**

```typescript
// src/renderer/src/store/appStore.ts
import { create } from 'zustand';

interface AppState {
  selectedFolder: string | null;
  setSelectedFolder: (folder: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  selectedFolder: null,
  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
}));
```

### Pattern 3: HashRouter with NavLink Active Styling

**What:** Use `HashRouter` (NOT `BrowserRouter`) because Electron serves via `file://` protocol. NavLink provides `isActive` for styling active routes.

**Example:**

```typescript
// src/renderer/src/App.tsx
import { HashRouter, Routes, Route, NavLink } from 'react-router';

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DuplicatesPage />} />
          <Route path="/organizer" element={<OrganizerPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
```

```typescript
// NavLink usage in Sidebar
<NavLink
  to="/"
  className={({ isActive }) =>
    cn(
      'flex items-center gap-3 px-4 py-2 text-sm rounded-md transition-colors',
      isActive
        ? 'border-l-4 border-blue-500 text-blue-500 bg-zinc-800/50'
        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
    )
  }
>
  Duplicates
</NavLink>
```

### Pattern 4: Tailwind CSS v4 + shadcn/ui Dark Theme (CSS-first)

**What:** All theme configuration lives in CSS (no `tailwind.config.js`). shadcn/ui v4 uses OKLCH colors and `@theme inline` directive.

**Example (`src/renderer/src/assets/main.css`):**

```css
@import "tailwindcss";
@import "tw-animate-css";

/*
 * shadcn/ui zinc dark theme
 * Dark-mode-only: apply dark tokens directly on :root
 */
:root {
  --radius: 0.625rem;
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(0.369 0 0);
  --input: oklch(0.369 0 0);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);

  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.369 0 0);
  --sidebar-ring: oklch(0.556 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

**Critical note:** Since Walnut is dark-mode-only, we put the dark tokens directly on `:root` (no `.dark` class toggle needed). No light-mode tokens are defined.

### Anti-Patterns to Avoid

- **BrowserRouter in Electron:** Will break in production (`file://` protocol). Always use `HashRouter`.
- **`nodeIntegration: true`:** Critical security vulnerability. Never enable.
- **Exposing raw `ipcRenderer`:** Security footgun. Only expose one typed function per channel.
- **`tailwind.config.js` with Tailwind v4:** v4 uses CSS-first config. The JS config file is a v3 pattern.
- **`@layer base` for CSS variables:** Tailwind v4 with shadcn/ui v4 puts variables directly on `:root` and `.dark`, NOT inside `@layer base`.
- **`forwardRef` in custom components:** React 19 + shadcn/ui v4 no longer uses `forwardRef`. Use `React.ComponentProps<>` pattern instead.
- **`default` style for shadcn:** Deprecated. Use `new-york` style.
- **`tailwindcss-animate` plugin:** Deprecated. Use `tw-animate-css` import instead.
- **Generic `send(channel, ...args)` in preload:** Violates security model. One function per operation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS class merging | Custom string concatenation | `cn()` from `clsx` + `tailwind-merge` | Tailwind class conflicts are subtle; `tailwind-merge` handles precedence correctly |
| Component variants | Switch statements on props | `class-variance-authority` (cva) | shadcn components use cva; consistency matters |
| IPC channel name constants | Inline strings | `shared/ipc-types.ts` with `as const` | Typos in channel names cause silent failures |
| Window type augmentation | Ad-hoc `(window as any).api` | `declare global { interface Window { api: IpcApi } }` | Type safety across renderer codebase |
| Dark mode theme tokens | Inline hex/hsl values | CSS custom properties via shadcn theme | Consistent palette, single source of truth |
| Icon system | Raw SVG imports | `lucide-react` | shadcn default, tree-shakeable, consistent sizing |

**Key insight:** shadcn/ui is not a dependency -- it copies component source code into your project. This means you own the code, but you must follow its conventions (`cn()`, `cva`, OKLCH colors, `@theme inline`) for components to work correctly when added via `npx shadcn add`.

## Common Pitfalls

### Pitfall 1: shadcn CLI Cannot Find Vite Config

**What goes wrong:** Running `npx shadcn@latest init` fails because it looks for `vite.config.ts` or `vite.config.js` in the project root, but electron-vite uses `electron.vite.config.ts`.
**Why it happens:** shadcn CLI has a hardcoded list of framework config file names.
**How to avoid:** Two options:
1. **Preferred:** Create a temporary `vite.config.ts` shim that re-exports the renderer config, run `npx shadcn init`, then delete the shim. OR:
2. **Manual setup:** Skip `npx shadcn init` entirely. Manually create `components.json`, `lib/utils.ts`, and the CSS theme. Then use `npx shadcn add <component>` which only reads `components.json`.
**Warning signs:** Error message about unsupported framework during `shadcn init`.

### Pitfall 2: Path Alias Mismatch Between electron-vite and shadcn

**What goes wrong:** shadcn components import from `@/components/ui/button` but electron-vite template uses `@renderer/` alias, not `@/`.
**Why it happens:** electron-vite template configures `@renderer` -> `src/renderer/src`. shadcn expects `@` -> `src` (or `src/renderer/src` in our case).
**How to avoid:** Add BOTH aliases to `electron.vite.config.ts` renderer section:
```typescript
resolve: {
  alias: {
    '@renderer': resolve('src/renderer/src'),
    '@': resolve('src/renderer/src'),
  }
}
```
Also update `tsconfig.web.json` to include the `@/*` path mapping alongside `@renderer/*`.
**Warning signs:** Module not found errors when importing shadcn components.

### Pitfall 3: Tailwind v4 CSS Not Applied

**What goes wrong:** Tailwind utility classes render as plain text (no styles applied).
**Why it happens:** The `@tailwindcss/vite` plugin must be added to the renderer section of `electron.vite.config.ts`, not globally. Also, the CSS file must use `@import "tailwindcss"` (not `@tailwind base/components/utilities` which is v3 syntax).
**How to avoid:**
1. Add `tailwindcss()` plugin to `renderer.plugins` array only (not main or preload).
2. Use `@import "tailwindcss"` as the first line in `main.css`.
3. Ensure `main.css` is imported in your renderer entry point.
**Warning signs:** Unstyled HTML elements, no Tailwind classes in DevTools.

### Pitfall 4: BrowserRouter Blank Screen in Production

**What goes wrong:** App works in dev mode but shows blank screen in production build.
**Why it happens:** electron-vite dev server uses HTTP, so `BrowserRouter` works. Production builds use `file://` protocol which `BrowserRouter` cannot handle (no server to resolve routes).
**How to avoid:** Use `HashRouter` from day one. URLs will look like `file:///path/index.html#/organizer` which works correctly.
**Warning signs:** White screen after `npm run build` + `electron-vite preview`.

### Pitfall 5: shared/ Directory Not Resolved by TypeScript

**What goes wrong:** Imports from `../../shared/ipc-types` fail with TypeScript errors.
**Why it happens:** The `shared/` directory is outside `src/` and may not be included in any `tsconfig` project references.
**How to avoid:** Ensure all three tsconfig files (`tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`) include the `shared/` directory in their `include` arrays or reference it via `paths`. The main and preload configs need it for handler registration; the web config needs it for the `Window` type augmentation.
**Warning signs:** TypeScript errors on shared imports, red squiggles in IDE.

### Pitfall 6: Electron Security Defaults Changed

**What goes wrong:** `nodeIntegration` defaults vary across Electron versions. Developers may copy old tutorial code that explicitly sets `nodeIntegration: true`.
**Why it happens:** Old tutorials and Stack Overflow answers predate Electron's security model changes.
**How to avoid:** In the `BrowserWindow` webPreferences, explicitly set: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The electron-vite template already does this correctly.
**Warning signs:** Console warnings about security, or renderer code having unexpected access to Node APIs.

### Pitfall 7: shadcn `default` Style Deprecated

**What goes wrong:** Using `"style": "default"` in `components.json` causes issues with new component additions.
**Why it happens:** shadcn/ui v4 deprecated the `default` style in favor of `new-york`.
**How to avoid:** Always use `"style": "new-york"` in `components.json`.
**Warning signs:** CLI warnings during `npx shadcn add`.

## Code Examples

### electron.vite.config.ts (Complete for Phase 1)

```typescript
// Source: electron-vite docs + shadcn/ui Vite guide adaptation
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
```

### components.json (shadcn/ui for electron-vite)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/assets/main.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "rsc": false,
  "tsx": true,
  "aliases": {
    "utils": "@/lib/utils",
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### cn() Utility (lib/utils.ts)

```typescript
// Source: shadcn/ui manual installation guide
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### BrowserWindow Configuration (Secure Defaults)

```typescript
// Source: Electron security docs + electron-vite template
import { BrowserWindow } from 'electron';
import { join } from 'path';

const mainWindow = new BrowserWindow({
  width: 1100,
  height: 700,
  minWidth: 900,
  minHeight: 600,
  show: false,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
});

mainWindow.on('ready-to-show', () => {
  mainWindow.show();
});
```

### Vitest Configuration (Config Only)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@renderer': resolve('src/renderer/src'),
    },
  },
});
```

### Playwright Configuration (Config Only)

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
  },
});
```

Note: Playwright Electron tests use `_electron.launch()` directly in test files, not the config's `webServer` option. The config provides shared settings only.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwindcss-animate` plugin | `tw-animate-css` CSS import | shadcn/ui v4 (2025) | Replace `@plugin 'tailwindcss-animate'` with `@import "tw-animate-css"` |
| HSL color values | OKLCH color values | shadcn/ui v4 (2025) | More perceptually uniform. All theme tokens use oklch() |
| `@layer base { :root { } }` | `:root { }` + `@theme inline { }` | Tailwind v4 (2025) | CSS variables outside layers, theme mapping via `@theme inline` |
| `React.forwardRef<>` | `React.ComponentProps<>` function components | React 19 + shadcn/ui v4 | No more `forwardRef` boilerplate in component definitions |
| `react-router-dom` package | `react-router` single package | React Router v7 (2025) | Single import source: `import { HashRouter } from 'react-router'` |
| `"style": "default"` in shadcn | `"style": "new-york"` | shadcn/ui v4 (2025) | `default` style deprecated |
| `tailwind.config.js` | CSS-first config in `.css` file | Tailwind v4 (2025) | Config via `@theme` directive in CSS, no JS config file |

## Project Constraints (from CLAUDE.md)

These directives from CLAUDE.md are authoritative and must be followed:

- **Tech Stack:** Electron + React + TypeScript (locked)
- **UI System:** shadcn/ui + Tailwind CSS, dark-mode-first (locked)
- **Platform:** Windows only (no cross-platform abstractions)
- **IPC Security:** NEVER expose `ipcRenderer` directly. NEVER use `nodeIntegration: true`. ALWAYS use `contextIsolation: true`. ONE function per IPC channel in preload.
- **Testing:** Vitest for unit/integration, Playwright for E2E (config only in Phase 1)
- **Agent:** Plans must be Codex-friendly (clear, file-scoped tasks)
- **Forbidden:** Electron Forge, Webpack, Redux, Jotai/Recoil, `trash` npm package, `fs.watch`/`fs.watchFile`, Create React App, Tailwind v3, Jest

## Open Questions

1. **shadcn CLI init vs manual setup in electron-vite**
   - What we know: The CLI fails to detect electron-vite as a framework. A `vite.config.ts` shim workaround exists, and manual setup is well-documented.
   - What's unclear: Whether the shim approach introduces any config conflicts when electron-vite starts.
   - Recommendation: Use manual setup (create `components.json`, `lib/utils.ts`, CSS manually), then add components with `npx shadcn add`. This is more predictable than the shim workaround.

2. **shared/ directory TypeScript resolution**
   - What we know: electron-vite templates do not include a `shared/` directory by default. The project has three tsconfig files.
   - What's unclear: Whether all three tsconfigs need explicit `shared/` include or if project references handle it.
   - Recommendation: Add `"shared/**/*.ts"` to the `include` array of all three tsconfig files. Test that imports resolve in all three process contexts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite, npm | Yes | 22.16.0 | -- |
| npm | Package installation | Yes | 11.11.1 | -- |
| Git | Version control | Yes | (repo exists) | -- |

No missing dependencies. All tools required for Phase 1 are available.

## Sources

### Primary (HIGH confidence)
- [electron-vite Getting Started](https://electron-vite.org/guide/) - Scaffold commands, project structure, config format
- [electron-vite Development Guide](https://electron-vite.org/guide/dev) - Entry point conventions, process separation
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) - Manual setup steps, Tailwind v4 integration
- [shadcn/ui components.json](https://ui.shadcn.com/docs/components-json) - Full configuration specification
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) - OKLCH colors, CSS variable structure, dark mode
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) - Migration guide, `@theme inline`, tw-animate-css
- [shadcn/ui Manual Installation](https://ui.shadcn.com/docs/installation/manual) - Dependencies, cn() utility, CSS setup
- [npm registry](https://www.npmjs.com/) - All package versions verified 2026-03-30

### Secondary (MEDIUM confidence)
- [DEV.to: Adding ShadCN to electron-vite](https://dev.to/nedwize/how-to-add-shadcn-to-an-electron-vite-project-dn) - Path alias workaround, vite.config.ts shim pattern
- [GitHub Discussion: BrowserRouter vs HashRouter in Electron](https://github.com/remix-run/react-router/discussions/10724) - Confirms BrowserRouter fails with `file://`
- [React Router Modes](https://reactrouter.com/start/modes) - Library mode documentation
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron) - `_electron.launch()` pattern
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - Official IPC patterns

### Tertiary (LOW confidence)
- None. All findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified against npm registry, official docs consulted
- Architecture: HIGH - electron-vite structure is well-documented, IPC pattern follows Electron official guide
- Pitfalls: HIGH - Multiple sources confirm each pitfall (especially HashRouter requirement and shadcn CLI issue)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable ecosystem, no major releases expected)
