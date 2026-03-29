# Domain Pitfalls

**Domain:** Electron desktop file manager with duplicate detection and file organization (Windows-only)
**Researched:** 2026-03-29

## Performance Pitfalls

### Critical: Blocking the Main Process with File I/O

**What goes wrong:** Calling synchronous `fs` methods (`fs.readdirSync`, `fs.statSync`, `fs.readFileSync`) or doing heavy computation (SHA-256 hashing) in Electron's main process freezes the entire application -- menus stop responding, window dragging locks up, and the OS may mark the app as "Not Responding."

**Why it happens:** Electron's main process runs a single-threaded event loop that also handles window management, IPC dispatch, and OS integration. Any blocking call starves all of these responsibilities.

**Consequences:** The app becomes unresponsive during scans of large directories. Windows will gray out the window after ~5 seconds of unresponsiveness. Users will force-kill the app, potentially mid-operation.

**Prevention:**
- All file I/O in the main process must use async `fs.promises` APIs exclusively. Lint for `Sync` method usage with an ESLint rule.
- Heavy computation (hashing, directory tree walking) should run in a Node.js `worker_threads` Worker, not the main process or renderer.
- For SHA-256 hashing of large files, use `crypto.createHash()` with streaming (`fs.createReadStream().pipe(hash)`) to maintain constant memory usage regardless of file size.
- Consider a dedicated "scanner" worker thread that handles all filesystem traversal and hashing.

**Detection:** App freezes when scanning folders with >1,000 files. Main process CPU at 100%. Window becomes unresponsive.

**Phase relevance:** Must be architected correctly from Phase 1. Retrofitting worker threads into a main-process-heavy design is a significant rewrite.

---

### Critical: Rendering Large File Lists Without Virtualization

**What goes wrong:** Rendering 5,000-50,000 file entries as real DOM nodes causes multi-second render freezes, janky scrolling, and excessive memory consumption. A folder scan returning 10,000 duplicates will crash the renderer if each gets a DOM node.

**Why it happens:** React re-renders all list items on state change. Each DOM node consumes memory and layout computation time. The browser's layout engine was not designed for tens of thousands of visible elements.

**Consequences:** UI freezes for 2-3 seconds on large scan results. Scrolling drops below 10fps. Memory usage balloons to gigabytes.

**Prevention:**
- Use `@tanstack/react-virtual` (or `react-window`) for all file lists from the start. These libraries only render items currently visible in the viewport plus a small buffer.
- Design list item components to be fixed-height where possible (variable-height virtualization is significantly more complex).
- Implement pagination or progressive loading for scan results exceeding ~10,000 items.
- Memoize list items with `React.memo` and stable keys.

**Detection:** Open a folder with 5,000+ files. Measure time-to-interactive and scroll fps. If either degrades noticeably, virtualization is missing.

**Phase relevance:** Must be in place before duplicate detection UI is built. Adding virtualization later means rewriting the entire list rendering layer.

---

### Moderate: SHA-256 Hashing Blocking the Event Loop

**What goes wrong:** Hashing files synchronously or loading entire files into memory before hashing causes event loop starvation, especially for large files (videos, disk images).

**Why it happens:** `crypto.createHash('sha256').update(entireFileBuffer)` loads the full file into memory. A 4GB video file requires 4GB of RAM just for the buffer, plus the hash computation blocks the thread.

**Consequences:** Out-of-memory crashes on large files. UI freezes during hashing. No progress feedback possible.

**Prevention:**
- Always use streaming hashes: `fs.createReadStream(path, { highWaterMark: 64 * 1024 }).pipe(crypto.createHash('sha256'))`.
- Run hashing in a worker thread, reporting progress back to the main thread via `parentPort.postMessage`.
- Implement the two-tier detection strategy from the project spec: filter by name+size first (cheap), then hash only the candidates (expensive).
- Process hash queue with concurrency limits (e.g., 4 concurrent file hashes) to avoid saturating disk I/O.

**Detection:** Hash a 1GB+ file and check if the UI remains responsive. Monitor memory usage during hashing.

**Phase relevance:** Duplicate detection phase. Get the streaming + worker architecture right before building the detection pipeline.

---

## Electron-Specific Pitfalls

### Critical: IPC Serialization Bottleneck with Large Payloads

**What goes wrong:** Sending scan results (thousands of file metadata objects) over IPC between main and renderer serializes the entire payload as JSON. Large payloads cause frame drops, garbage collection pressure, and visible stuttering.

**Why it happens:** Electron IPC uses structured clone / JSON serialization. A scan result with 10,000 file entries, each with path, size, hash, and timestamps, can be several megabytes of serialized JSON. Both the sender and receiver must serialize/deserialize, blocking their respective event loops.

**Consequences:** UI freezes when receiving scan results. GC pauses cause visible jank. Memory spikes from duplicate data representations.

**Prevention:**
- Send results in batches (e.g., 100-500 items at a time) rather than one massive payload.
- Use `ipcRenderer.invoke` / `ipcMain.handle` (async) exclusively. Never use `sendSync`.
- Strip unnecessary data before sending -- only send what the UI needs to render, not raw internal state.
- For progress updates, send lightweight messages (e.g., `{ scanned: 4500, total: 12000 }`) rather than accumulating results.
- Consider `MessagePort` for high-frequency streaming data between main and renderer.

**Detection:** Profile IPC message sizes during a large scan. If any single message exceeds 1MB, it needs batching.

**Phase relevance:** IPC protocol design should happen in Phase 1 (app shell). Changing IPC contracts later breaks both main and renderer code.

---

### Critical: Preload Script Security -- Exposing Too Much

**What goes wrong:** Developers expose raw `ipcRenderer`, `fs`, `child_process`, or entire Node.js modules through the preload script's `contextBridge.exposeInMainWorld`. This gives any code running in the renderer full system access.

**Why it happens:** It is faster to develop with full Node access in the renderer. Developers expose broad APIs to avoid writing specific IPC handlers for each operation.

**Consequences:** Any XSS vulnerability or malicious dependency in the renderer can read/write/delete arbitrary files, execute commands, or exfiltrate data. This is the most common critical security vulnerability in Electron apps.

**Prevention:**
- Enable `contextIsolation: true` and `sandbox: true` (both are defaults in modern Electron -- never disable them).
- Disable `nodeIntegration` in renderer (default in modern Electron).
- Expose only specific, named functions via `contextBridge.exposeInMainWorld`, not modules or the ipcRenderer object itself.
- Validate all arguments in main process IPC handlers. The renderer is untrusted -- treat every IPC message like an external API request.
- Example: expose `window.walnut.scanFolder(path)` not `window.electron.ipcRenderer`.

**Detection:** Review preload script. If it exposes `ipcRenderer.send` or `ipcRenderer.on` directly, it is vulnerable. If it exposes any `require()` result, it is vulnerable.

**Phase relevance:** Phase 1 architecture. The preload API surface is the security boundary of the entire application.

---

### Moderate: Memory Leaks from IPC Listener Accumulation

**What goes wrong:** IPC listeners registered with `ipcMain.on` or `ipcRenderer.on` in React components are never cleaned up. Each component mount adds a new listener. After navigating between views multiple times, hundreds of duplicate listeners accumulate.

**Why it happens:** React components register IPC listeners in `useEffect` without returning a cleanup function. Hot module replacement during development compounds the issue.

**Consequences:** Gradual memory growth. Duplicate event handling (same event processed N times). Eventually OOM crash after extended use.

**Prevention:**
- Always pair `on` with `removeListener` in `useEffect` cleanup.
- Use a centralized IPC abstraction layer rather than scattered direct IPC calls in components.
- Prefer `ipcMain.handle` / `ipcRenderer.invoke` for request-response patterns (no manual listener cleanup needed).
- Monitor listener counts in development: `process.on('warning', ...)` will fire `MaxListenersExceededWarning`.

**Detection:** Navigate between Duplicates and Organizer views 20 times. Check memory usage trend. If it only goes up, listeners are leaking.

**Phase relevance:** Establish the IPC abstraction pattern in Phase 1. Enforce it via code review for all subsequent phases.

---

### Moderate: Using `@electron/remote` or `sendSync`

**What goes wrong:** `@electron/remote` and `ipcRenderer.sendSync` both block the renderer process while waiting for the main process to respond. If the main process is busy (e.g., doing file I/O), the renderer freezes completely.

**Why it happens:** `@electron/remote` makes main-process calls look like synchronous local calls, hiding the IPC overhead. `sendSync` is the "easy" IPC pattern that avoids callback complexity.

**Consequences:** Renderer freezes whenever main process is under load. Deadlock potential if main process tries to send to renderer while renderer is blocked on sendSync.

**Prevention:**
- Do not install `@electron/remote`. It should not be in `package.json`.
- Use `ipcRenderer.invoke` / `ipcMain.handle` for all IPC. It is async by design.
- Lint for `sendSync` usage.

**Detection:** Search codebase for `sendSync` and `@electron/remote`. If either exists, remove it.

**Phase relevance:** Phase 1 decision. Never introduce these patterns.

---

### Minor: Preload Script Import Scope Confusion

**What goes wrong:** Importing renderer-side code (React, CSS) or main-side code (Electron `app`, `BrowserWindow`) in the preload script. Preload has a unique execution context -- it is neither fully main nor renderer.

**Why it happens:** The preload script runs in a special context that has access to `require` but is not the main process. Developers incorrectly try to import from both sides.

**Consequences:** Build errors, runtime crashes, or subtle bugs where code behaves differently than expected.

**Prevention:** Preload should ONLY import from `electron` (`contextBridge`, `ipcRenderer`) and from shared type definitions. Nothing else.

**Detection:** Check preload script imports. If it imports React components, main process modules, or CSS, it is wrong.

**Phase relevance:** Phase 1 scaffolding. Get the preload boundary right immediately.

---

## File Operation Safety

### Critical: Cross-Device Move Failures (EXDEV)

**What goes wrong:** `fs.rename()` fails with `EXDEV: cross-device link not permitted` when moving files between different drives, partitions, or virtual filesystems. On Windows, this is common because users often have files on D:, E: drives or network-mapped drives.

**Why it happens:** `fs.rename()` wraps the OS `rename(2)` syscall, which only works within a single filesystem/mount point. Moving between C: and D: requires copy-then-delete, not rename.

**Consequences:** File organization feature silently fails or crashes when the target directory is on a different drive than the source files. Users see cryptic EXDEV errors.

**Prevention:**
- Use `fs-extra`'s `move()` function, which handles EXDEV automatically (copy + delete fallback).
- Or implement the pattern manually: try `fs.promises.rename()` first; on EXDEV error, fall back to `fs.promises.copyFile()` + `fs.promises.unlink()`.
- Ensure the copy completes successfully before deleting the source (verify with stat or checksum).
- For the file organizer feature: if source and target are on different drives, warn the user that the operation will be slower (copy vs. rename).

**Detection:** Test file organization where source folder is on C: and target is on D:. If it fails, EXDEV handling is missing.

**Phase relevance:** File organization phase. Must be handled before any move operations are implemented.

---

### Critical: Partial Moves Leaving Inconsistent State

**What goes wrong:** A batch file move operation (reorganizing 500 files) fails partway through (disk full, permission denied, file locked). Some files are moved, others are not. The user has no way to know what succeeded and what failed, and the undo operation cannot reverse a partial move.

**Why it happens:** Batch file operations are not atomic. Each individual move can fail independently. Without tracking, the operation state is lost.

**Consequences:** Files are in an unknown state -- some moved, some not. Undo is impossible because the operation log is incomplete. User must manually figure out what happened.

**Prevention:**
- Maintain an operation journal/log: before each move, write `{ source, destination, status: 'pending' }` to a persistent log file. After each move, update to `status: 'complete'`. On failure, update to `status: 'failed'`.
- On any failure, stop the batch and report: "Moved 347/500 files. 153 files were not moved. Failed file: X (reason: Y)."
- The undo feature should read the operation journal to know exactly which files were moved and reverse only those.
- Consider a two-phase approach: first create all target directories and verify write permissions, then perform moves.
- Never delete source files until the copy is verified (for cross-device moves).

**Detection:** Simulate a failure mid-batch (e.g., lock a file before reorganization). Verify the app reports the failure clearly and undo works for the partial operation.

**Phase relevance:** File organization phase. The journal pattern must be designed before implementing batch operations.

---

### Critical: Trash API Failures on Windows

**What goes wrong:** Electron's `shell.trashItem()` can fail silently or throw on Windows in specific scenarios: files on network drives, files in OneDrive/cloud-synced folders, files on `subst`-created drives, or when the Recycle Bin is corrupted/full.

**Why it happens:** `shell.trashItem()` wraps Windows' `IFileOperation` COM interface, which has its own quirks. Cloud storage providers (OneDrive) intercept file operations and may redirect them. Network drives often do not support the Recycle Bin (files are permanently deleted, not trashed).

**Consequences:** Users expect "move to trash" to be safe and recoverable. On network drives, the file may be permanently deleted instead. On OneDrive, the file may end up in an unexpected location. The operation may fail entirely with an unhelpful error.

**Prevention:**
- Before trashing, check if the file is on a local drive vs. network drive. Warn the user if trash may not be recoverable on non-local drives.
- Wrap `shell.trashItem()` in a try-catch and provide a meaningful error message on failure.
- For cloud-synced folders (OneDrive, Dropbox), document the limitation or consider copying to a Walnut-specific "deleted" staging folder as a fallback.
- Test trash operations on network drives and OneDrive specifically.
- Always use native Windows backslash paths with `shell.trashItem()` -- it has known issues with POSIX-style forward-slash paths on Windows.

**Detection:** Try trashing a file on a network-mapped drive. Try trashing a file inside an OneDrive folder. If either fails or behaves unexpectedly, this needs handling.

**Phase relevance:** Duplicate detection phase (delete action). Must be robust before any destructive action is exposed to users.

---

### Moderate: Symlink and Junction Point Handling

**What goes wrong:** Directory traversal follows symlinks and Windows junction points, potentially scanning the same files multiple times (inflating duplicate counts), traversing into system directories, or creating infinite loops with circular symlinks.

**Why it happens:** `fs.readdir` with `{ recursive: true }` and `fs.stat` follow symlinks by default. Windows junction points (e.g., `C:\Users\Name\Documents` pointing to OneDrive) are common and invisible to naive traversal.

**Consequences:** False duplicate detection (same file reached via two paths). Infinite loops causing hangs. Scanning system directories the user did not intend. Performance degradation from scanning the same tree multiple times.

**Prevention:**
- Use `fs.lstat()` instead of `fs.stat()` to detect symlinks without following them.
- Skip symlinks and junction points by default during scanning. Make following them an opt-in setting.
- Maintain a visited `Set` of resolved real paths (`fs.realpath()`) to detect circular references.
- Use `fs.readdir` with `withFileTypes: true` to get `Dirent` objects, which have `isSymbolicLink()` without an extra stat call.

**Detection:** Create a junction point that creates a cycle (A -> B -> A). Scan the parent directory. If the scan never completes or reports false duplicates, symlink handling is broken.

**Phase relevance:** Scanning infrastructure phase. Must be handled before duplicate detection or file organization scanning is built.

---

### Moderate: Race Conditions in Scan + Delete

**What goes wrong:** User scans a folder, then leaves the app idle for a while. Meanwhile, files are moved, renamed, or deleted externally (by the user, antivirus, cloud sync, or another program). User returns and tries to delete "duplicates" that no longer exist, or the kept copy has been removed leaving only the "duplicate."

**Why it happens:** Scan results are a point-in-time snapshot. The filesystem is mutable. There is no file watcher invalidating stale results.

**Consequences:** Delete operations fail with "file not found." Worse: the user deletes what they think is a duplicate, but the original was already removed externally, so they lose the file entirely.

**Prevention:**
- Verify file existence and metadata (size, modification time) before executing any destructive operation. If the file has changed since scan, warn the user.
- Show "last scanned" timestamp prominently. Offer a "re-scan" button.
- Before deleting a duplicate group, verify that at least the "kept" file still exists and matches its scan-time metadata.
- Disable stale results after a configurable timeout (e.g., 30 minutes) and prompt re-scan.

**Detection:** Scan a folder, externally delete one of the results, then try to perform a delete operation via the app. If it crashes or silently does nothing, race condition handling is missing.

**Phase relevance:** Duplicate detection phase. File verification must be part of the delete operation, not a separate step.

---

### Moderate: File Locking and Permission Errors

**What goes wrong:** Files in use by other programs (open in Word, locked by antivirus, system files) cannot be moved, deleted, or sometimes even read. The scanner may encounter files it lacks permission to read (e.g., `System Volume Information`, `$Recycle.Bin`).

**Why it happens:** Windows uses mandatory file locking. Antivirus software often holds read locks on recently accessed files. System directories have restrictive ACLs.

**Consequences:** Batch operations fail on locked files. Scans crash when encountering permission-denied errors. Users see confusing "access denied" errors for files they "own."

**Prevention:**
- Wrap every file operation in try-catch. Log and skip inaccessible files rather than aborting the entire operation.
- During scanning, collect errors in a separate list and show them to the user: "3 files could not be scanned (access denied)."
- Exclude known system directories by default: `$Recycle.Bin`, `System Volume Information`, `pagefile.sys`, `hiberfil.sys`.
- For move/delete operations, test accessibility before showing the file in the preview (a file that cannot be operated on should be marked as such in the UI).

**Detection:** Scan `C:\` root directory. If the scanner crashes instead of gracefully skipping system files, error handling is missing.

**Phase relevance:** Scanning infrastructure phase. Error handling patterns must be established early.

---

## Testing Pitfalls

### Critical: Mocking fs Instead of Testing Real Filesystem Operations

**What goes wrong:** Unit tests mock `fs` module calls (e.g., `vi.mock('fs')`) and test against the mocked behavior. The mocks do not capture real filesystem semantics: case sensitivity, path length limits, permission errors, locked files, EXDEV, or encoding issues. Tests pass but production breaks.

**Why it happens:** Mocking is easier and faster than setting up real filesystem fixtures. Developers test their logic, not the filesystem integration.

**Consequences:** Tests provide false confidence. Critical bugs (EXDEV, long paths, permission errors) are never caught because mocks do not reproduce them. The testing pyramid has a hollow integration layer.

**Prevention:**
- Use a temp directory (`os.tmpdir()` + unique subdirectory) for integration tests that perform real filesystem operations.
- Use `fs.mkdtemp()` to create isolated test directories. Clean up in `afterEach`.
- Mock `fs` only in pure unit tests where filesystem behavior is irrelevant to the test (e.g., testing UI state logic).
- Write specific integration tests for edge cases: long paths, special characters in filenames, empty files, very large files, symlinks, locked files.
- Test the EXDEV path explicitly by creating a temp dir on a different drive if available, or by mocking only the EXDEV error (not the entire fs module).

**Detection:** Review test suite. If >80% of file operation tests use mocked fs, coverage is illusory. Check if any test creates real files on disk.

**Phase relevance:** Testing infrastructure should be established in Phase 1 with both unit test and integration test patterns and fixtures.

---

### Moderate: Electron E2E Test Complexity

**What goes wrong:** Playwright's Electron support is experimental. Tests are flaky because the app must be fully built before testing, startup is slow, and there is no hot reload during test development. Tests that interact with native dialogs (folder picker, confirmation dialogs) require special handling.

**Why it happens:** Electron apps are not web apps -- they require launching a separate process, connecting via CDP, and dealing with native OS integration that Playwright cannot directly interact with.

**Consequences:** E2E test suite is slow, flaky, and eventually abandoned. Native dialog interactions cannot be tested. CI pipeline takes too long.

**Prevention:**
- Use Playwright Electron support (`electron.launch()`) but keep the E2E test count small and focused on critical user flows only.
- Mock native dialogs in E2E tests: override `dialog.showOpenDialog` in the main process to return predetermined paths.
- Use the testing pyramid correctly: most coverage from Vitest unit/integration tests, minimal E2E tests for smoke testing critical paths.
- Set up a CI-specific test configuration that builds the app once and runs all E2E tests against that build.
- Test renderer UI components separately with Vitest + React Testing Library (no Electron needed for component-level tests).

**Detection:** If E2E tests take >5 minutes or have >10% flake rate, the approach needs revision.

**Phase relevance:** E2E testing setup in a later phase. Do not block initial development on E2E test infrastructure. Get unit and integration tests right first.

---

## Packaging Pitfalls

### Critical: Windows SmartScreen Warnings Without Code Signing

**What goes wrong:** Unsigned Electron apps trigger Windows SmartScreen warnings ("Windows protected your PC"), which most users will not bypass. Without code signing, the app appears malicious. Even with a new certificate, SmartScreen requires reputation building.

**Why it happens:** Windows requires Authenticode signatures for executables to be trusted. SmartScreen uses certificate reputation -- a new certificate starts with zero reputation and triggers warnings even when signed, until enough users have installed the app.

**Consequences:** Users cannot install the app without dismissing scary warnings. Enterprise users may be blocked entirely by group policy. Auto-update may fail if the new version has a different or expired certificate.

**Prevention:**
- Budget for a code signing certificate early. Options: traditional OV certificate ($200-500/year), or Azure Trusted Signing (available to US/Canada developers as of late 2025).
- EV (Extended Validation) certificates provide immediate SmartScreen reputation but require a hardware token (USB dongle), which complicates CI/CD.
- For initial development and testing, accept SmartScreen warnings. Plan to add signing before any public distribution.
- Configure electron-builder's `win.sign` configuration early in the packaging setup so the pipeline is ready when a certificate is obtained.
- Test the signed installer on a clean Windows VM to verify SmartScreen does not trigger.

**Detection:** Install the unsigned app on a clean Windows machine. If SmartScreen blocks it, signing is needed for distribution.

**Phase relevance:** Packaging/distribution phase. Not needed for development, but plan for it before any user-facing release.

---

### Moderate: asar Packaging Breaks File Paths at Runtime

**What goes wrong:** electron-builder packages the app into an `asar` archive by default. Code that constructs paths assuming a real filesystem directory structure (e.g., `path.join(__dirname, 'assets', 'icon.png')`) breaks because `asar` is a virtual filesystem with limitations.

**Why it happens:** `asar` archives look like directories to Node.js's `fs` module (Electron patches `fs`), but native modules and some operations do not understand asar paths. Paths containing `.asar` in them are treated specially by the patched fs.

**Consequences:** Assets not found at runtime. Native modules fail to load. File paths that worked in development break in production builds.

**Prevention:**
- Test with a production build (`electron-builder --dir`) early and often, not just `electron .` in development.
- Use `app.getAppPath()` and `app.getPath('userData')` for path resolution instead of `__dirname` where possible.
- Place native modules and binaries that cannot be asar-packed in the `asarUnpack` configuration.
- Add a CI step that builds and launches the packaged app to catch asar-related issues.

**Detection:** Build the app with electron-builder and run it. If anything that worked in development mode breaks, it is likely an asar path issue.

**Phase relevance:** First packaging milestone. Catch this early by building a packaged version as soon as the app shell is functional.

---

### Moderate: Native Module ABI Mismatch

**What goes wrong:** Native Node modules (if any are used, e.g., for database access or file watching) compiled against the system Node.js version crash in Electron because Electron uses a different Node.js ABI version.

**Why it happens:** Electron bundles its own version of Node.js with a specific ABI. Native modules must be compiled against Electron's Node headers, not the system Node headers.

**Consequences:** App crashes on startup with "module was compiled against a different Node.js version" errors.

**Prevention:**
- Use `electron-rebuild` or electron-builder's `postinstall` script (`electron-builder install-app-deps`) to rebuild native modules against Electron's Node version.
- Prefer pure JavaScript alternatives to native modules where possible (e.g., `better-sqlite3` requires native compilation; consider if JSON file storage suffices for scan history).
- Pin Electron version and test native module compatibility after every Electron upgrade.

**Detection:** Run `npx electron .` after `npm install`. If native modules crash, they need rebuilding.

**Phase relevance:** Phase 1 dependency setup. If native modules are needed, set up rebuild scripts immediately.

---

## UX Pitfalls

### Critical: Allowing Deletion of All Copies in a Duplicate Group

**What goes wrong:** The UI allows the user to select all files in a duplicate group for deletion, leaving zero copies. The user loses the file entirely, which directly violates the project's file safety philosophy.

**Why it happens:** A simple "select all" checkbox or individual checkboxes without a constraint naturally allows selecting every file in a group.

**Consequences:** Permanent data loss. The one scenario the app must absolutely prevent.

**Prevention:**
- Enforce a hard constraint: at least one file in every duplicate group must remain unselected for deletion. Disable the delete checkbox on the last remaining unselected file.
- Show a clear visual indicator of which file will be "kept" (primary) vs. which are candidates for removal.
- Default to keeping the file with the oldest modification date or the one in the shallowest directory path.
- The "Select All" action in a duplicate group should select all-but-one, never all.

**Detection:** Try selecting every file in a duplicate group for deletion. If the UI allows it, the safety constraint is missing.

**Phase relevance:** Duplicate detection UI phase. This constraint must be implemented before the deletion action is wired up.

---

### Moderate: Overwhelming Users with Scan Results

**What goes wrong:** A scan of a large folder returns thousands of duplicate groups. The UI dumps all results at once with no filtering, sorting, or summarization. Users are overwhelmed and abandon the tool.

**Why it happens:** Developers build the scan engine first and the results UI second, defaulting to "show everything." No thought is given to progressive disclosure or actionable summarization.

**Consequences:** Users do not know where to start. They cannot find the high-value duplicates (large files wasting space) among thousands of small file matches. The tool feels useless despite working correctly.

**Prevention:**
- Show a summary dashboard first: "Found 1,247 duplicate groups totaling 34.2 GB of recoverable space."
- Sort by space savings (largest duplicate groups first) as the default view.
- Provide filters: by file type, by size range, by location.
- Group results meaningfully: "Photos (847 groups, 12.1 GB)", "Documents (234 groups, 1.3 GB)", etc.
- Implement progressive loading: show top 50 groups, load more on scroll.

**Detection:** Scan a large folder (10,000+ files). If the results view is a flat, unsorted, unpaginated list, the UX needs redesign.

**Phase relevance:** Duplicate detection UI phase. Design the results experience before building the results list.

---

### Moderate: Unclear Preview Before Destructive Operations

**What goes wrong:** The "preview" step before deletion or reorganization does not clearly communicate what will happen. Users click "Apply" without understanding the consequences. Or the preview is so detailed it is unreadable.

**Why it happens:** Preview UI is treated as an afterthought -- a simple list of file paths. No visual differentiation between what will be deleted, moved, or kept.

**Consequences:** Users accidentally delete or move files they intended to keep. Trust in the tool is destroyed after one bad experience.

**Prevention:**
- Use color coding: green = keep, red = delete, blue = will be moved.
- Show before/after state, not just a list of actions: "These 3 files will be deleted. This 1 file will be kept at [path]."
- For file organization: show a tree diff -- current structure vs. proposed structure.
- Require explicit confirmation with a summary: "Delete 47 files (2.3 GB). Keep 47 files. This action moves files to the Recycle Bin."
- Add a "dry run" mode that saves the plan to a text file for review.

**Detection:** Show the preview to a non-developer. If they cannot immediately understand what will happen, the preview needs improvement.

**Phase relevance:** Both duplicate detection and file organization phases. Preview design should be prioritized alongside the action engine.

---

## Windows-Specific Issues

### Critical: Windows Path Separator and Normalization

**What goes wrong:** Code uses hardcoded `/` separators, `path.posix` methods, or string manipulation for paths instead of `path.win32` / `path.join`. Paths break when they contain backslashes, or comparisons fail because `C:\Users\foo` and `C:/Users/foo` are treated as different paths.

**Why it happens:** Developers following macOS/Linux tutorials use `/` everywhere. Node.js's `path` module defaults to the OS convention, but raw string operations do not.

**Consequences:** File operations fail with "file not found." Path comparisons fail, causing duplicate paths in results. IPC messages contain inconsistent path formats. `shell.trashItem()` has known issues with POSIX separators on Windows.

**Prevention:**
- Always use `path.join()`, `path.resolve()`, `path.normalize()` for path construction. Never concatenate path strings manually.
- Normalize all paths to a canonical form on ingestion (e.g., `path.resolve(inputPath)`) before storing or comparing.
- Use `path.parse()` for extracting drive letters, directories, and filenames.
- In path comparison logic, normalize both sides before comparing: `path.resolve(a) === path.resolve(b)`.
- Create a shared `normalizePath()` utility and enforce its use project-wide.

**Detection:** Test with paths containing spaces, special characters, and mixed separators. If operations fail on paths like `C:\Users\My Documents\file (1).txt`, path handling is broken.

**Phase relevance:** Phase 1 utility layer. Create a path normalization utility and use it everywhere from the start.

---

### Critical: Windows Long Path Limitation (260 Characters)

**What goes wrong:** Windows has a legacy `MAX_PATH` limit of 260 characters. Deep directory hierarchies or long filenames cause `ENAMETOOLONG` errors during scanning, hashing, moving, or deleting. Electron's own `node_modules` path can hit this limit during development.

**Why it happens:** The Win32 API defaults to 260-character path limits. While Windows 10+ can lift this restriction via registry key or group policy, it is not enabled by default on all systems.

**Consequences:** Files in deep directories are silently skipped or cause crashes. Users with deeply nested folder structures cannot use the app. The Electron installer itself may fail during build if `node_modules` paths are too deep.

**Prevention:**
- Use the `\\?\` prefix for Win32 extended-length paths in critical file operations, or rely on Node.js APIs that handle this automatically (most modern Node.js versions support long paths on Windows when the OS setting is enabled).
- Catch `ENAMETOOLONG` errors gracefully and report them to the user: "3 files could not be scanned due to path length limitations."
- Keep the project root path short during development (e.g., `C:\dev\walnut` not `C:\Users\Username\Documents\Projects\...`).
- Test with paths that exceed 260 characters to verify behavior.

**Detection:** Create a file nested 10+ directories deep with long directory names (total path >260 chars). Attempt to scan it. If it fails silently or crashes, long path handling is missing.

**Phase relevance:** Scanning infrastructure phase. Must be handled in the file traversal code.

---

### Moderate: Case-Insensitive but Case-Preserving Filesystem

**What goes wrong:** Windows filenames are case-insensitive (`Photo.JPG` and `photo.jpg` are the same file) but case-preserving (the original casing is retained). Code that uses case-sensitive string comparison for paths will treat these as different files, producing false duplicates or failing to find files.

**Why it happens:** JavaScript string comparison (`===`) is case-sensitive. Developers may not think about case-insensitive path matching.

**Consequences:** The duplicate detector may report `Photo.JPG` and `photo.jpg` in different directories as separate files when they should be matched by name. Path lookups may fail when casing does not match exactly.

**Prevention:**
- Use `path.resolve()` and `.toLowerCase()` for all path comparisons and map/set keys.
- Be aware that `fs.existsSync('Photo.JPG')` returns true even if the file is stored as `photo.jpg` on Windows.
- When deduplicating by filename, normalize case before comparison.
- Document the assumption: Walnut operates on Windows (case-insensitive) filesystems only for v1.

**Detection:** Create two references to the same file with different casing. Verify the app treats them as the same file, not different ones.

**Phase relevance:** Utility layer (Phase 1). Establish case-insensitive comparison helpers early.

---

### Moderate: Unicode and Special Characters in Filenames

**What goes wrong:** Files with Unicode characters (emoji, CJK characters, accented letters), or special characters (parentheses, brackets, ampersands) in their names cause issues in path construction, display, or shell operations.

**Why it happens:** String manipulation that does not account for multi-byte characters, or shell-escaping that mishandles special characters. Windows allows almost any Unicode character in filenames.

**Consequences:** Files with special characters are skipped, misnamed, or cause crashes. International users cannot use the app effectively.

**Prevention:**
- Always use Node.js `path` module for path manipulation (it handles Unicode correctly).
- Test with filenames containing: spaces, parentheses, brackets, ampersands, accented characters (e.g., `resume.txt`), CJK characters, emoji.
- Ensure the UI renders Unicode filenames correctly (React handles this natively, but verify with RTL text and combining characters).
- Use `encodeURIComponent` only for display/URL contexts, never for filesystem operations.

**Detection:** Create test files with emoji and CJK characters in their names. Scan the folder. If these files do not appear in results or display incorrectly, Unicode handling is broken.

**Phase relevance:** Scanning infrastructure phase. Include Unicode filenames in the integration test fixture set from the start.

---

### Minor: DevTools and Debug Features in Production

**What goes wrong:** Shipping with DevTools accessible or debug logging enabled. Users can inspect internal state, execute arbitrary JS, or see noisy console output.

**Prevention:** Only open DevTools in development mode. Disable in production builds with `webPreferences: { devTools: false }` or an environment check. Remove or gate console.log statements for production.

**Detection:** Launch the production build and try Ctrl+Shift+I. If DevTools opens, it needs to be disabled.

**Phase relevance:** Packaging phase. Add the production guard before any distribution.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Project scaffold | Wrong template setup, missing electron-vite/Vite config | Use proven electron-vite template: `npm create @quick-start/electron@latest -- --template react-ts` |
| App shell / UI | Tailwind v4 config-in-CSS confusion, theme inconsistency | Follow Tailwind v4 docs exactly; establish design tokens early |
| IPC layer | Exposing raw ipcRenderer, sync IPC, no batching | Design typed IPC protocol with contextBridge wrappers from day one |
| Scanning infrastructure | Permission errors, symlinks, long paths, Unicode | Try-catch every fs call, use lstat, normalize all paths, test edge cases |
| SHA-256 hashing | Memory explosion, event loop blocking | Stream with `createReadStream` in a worker thread; never `readFile` for hashing |
| Duplicate display | Slow rendering with many results, overwhelming UX | Virtualized list from day one; summary dashboard before raw results |
| File deletion | All-copies deletion, trash API failures, stale results | Enforce keep-one constraint; wrap trashItem; verify files before delete |
| File organization | EXDEV cross-device, partial failures, no undo persistence | Use fs-extra move; implement operation journal; persist undo to disk |
| Packaging | asar path breakage, unsigned exe SmartScreen warnings | Build packaged version early; plan signing before distribution |
| Testing | Over-mocked fs, flaky E2E, no integration tests | Real temp dirs for integration tests; minimal focused E2E |

## Sources

- [Electron Performance Documentation](https://www.electronjs.org/docs/latest/tutorial/performance) -- official guidelines for performant Electron apps
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) -- official security best practices
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) -- preload and contextBridge patterns
- [Electron Automated Testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing) -- official testing guidance
- [The Horror of Blocking Electron's Main Process](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c) -- real-world case study of main process blocking
- [Node.js fs.rename EXDEV Issue](https://github.com/nodejs/node/issues/19077) -- official Node.js issue documenting cross-device rename limitation
- [Electron shell.trashItem Windows Bugs](https://github.com/electron/electron/issues/29598) -- known Windows trash API failures
- [Electron shell.trashItem OneDrive Bug](https://github.com/electron/electron/issues/38541) -- cloud storage interaction issues
- [Electron shell.trashItem Path Format Bug](https://github.com/electron/electron/issues/28831) -- POSIX separator issues on Windows
- [Windows MAX_PATH Limitation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation) -- Microsoft documentation on 260-character limit
- [electron-builder Code Signing](https://www.electron.build/code-signing.html) -- electron-builder signing documentation
- [electron-builder Native Module Signing Issue](https://github.com/electron-userland/electron-builder/issues/7655) -- native module rebuild + signing interaction
- [Efficient File Deduplication with SHA-256](https://transloadit.com/devtips/efficient-file-deduplication-with-sha-256-and-node-js/) -- streaming hash implementation patterns
- [Electron IPC Memory Leak Issue](https://github.com/electron/electron/issues/27039) -- contextBridge memory leak reports
- [Duplicate Finder Evaluation Methodology](https://nektony.com/resources/duplicate-finder-methodology) -- 53 criteria for evaluating duplicate finders
- [Node.js fs.symlink Windows Issue](https://github.com/nodejs/node/issues/18518) -- symlink creation limitations on Windows
