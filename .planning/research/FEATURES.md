# Feature Landscape

**Domain:** Desktop file manager / cleanup utility
**Researched:** 2026-03-29

## Table Stakes

Features users expect from a file duplicate finder / organizer. Missing any of these makes the product feel broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Folder picker | Users need to select what to scan | Low | Electron's `dialog.showOpenDialog()` handles this |
| Recursive directory scanning | Users expect subfolders to be included | Medium | Use `fs.readdir` with `recursive: true` (Node 20+) |
| Duplicate detection by content hash | Name-based matching produces false positives | Medium | SHA-256 via streaming. Pre-filter by size for speed |
| Grouped duplicate display | Must see which files are copies of each other | Medium | Group by hash, show paths/sizes/dates |
| Select which duplicates to keep/remove | User must choose, not the app | Low | Checkbox UI with "keep oldest" / "keep newest" presets |
| Preview before delete | Users will not trust a tool that deletes without confirmation | Low | Show exactly what will be deleted, with file sizes |
| Move to Recycle Bin (not permanent delete) | Permanent delete is terrifying for a cleanup tool | Low | `shell.moveItemToTrash()` -- non-negotiable default |
| Progress indicator for scans | Scans of large folders take time | Medium | Show files scanned / total, elapsed time, current path |
| Cancel long-running operations | Users panic if they can't stop a scan | Medium | AbortController pattern or worker thread cancellation |
| Dark mode UI | Modern desktop app expectation | Low | shadcn/ui + Tailwind `dark:` -- built-in |

## Differentiators

Features that elevate Walnut beyond a basic duplicate finder.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| File organization by type | Not just finding duplicates -- actively reorganizing clutter | Medium | Categorize into Documents/Photos/Music/Video/Archives/Other |
| Dry-run preview for reorganization | See proposed moves before they happen | Medium | Show tree diff: current vs proposed structure |
| Undo last reorganization | Safety net encourages users to actually use the feature | High | Must track all moves to reverse them. Persist undo state. |
| Smart selection assistant | Auto-select duplicates by rule (keep newest, keep from path X) | Medium | Saves manual clicking across dozens of groups |
| Scan history | Remember previously scanned folders, show results over time | Low | Persist to local JSON or SQLite |
| Sidebar navigation between modules | Feels like a real app, not a one-shot tool | Low | React Router with sidebar layout |
| Size-based duplicate pre-filtering | Skip hashing files that can't possibly be duplicates | Low | Massive perf win: only hash files with matching sizes |
| Space savings summary | Show "You can reclaim 2.3 GB" -- motivating | Low | Sum sizes of selected duplicates |
| Reference folder / "protected" directory | Mark a folder as "never delete from here" (dupeGuru pattern) | Low | Prevents accidental deletion of originals |

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Cloud storage integration | Scope explosion; each provider is a project | Keep to local filesystem only |
| AI-powered file naming/analysis | Unproven value, massive complexity | Simple extension-based categorization |
| Real-time file watching | Adds background process complexity, battery drain | Manual scan only |
| Permanent delete option | Too dangerous for v1 trust-building | Always Recycle Bin; maybe add later with extra confirmation |
| Cross-platform support | Windows-specific APIs simplify everything | Can revisit with Electron's cross-platform layer later |
| Custom themes / theming engine | Time sink with no user value | Ship one polished dark theme |
| File content preview (images, docs) | Image/video/document preview is a rabbit hole | Show file metadata only (name, size, date, type) for v1 |
| Network/NAS scanning | Network I/O adds timeout/permission complexity | Local drives only |
| Built-in file viewer / editor | Enormous feature surface, not Walnut's purpose | Open files in system default app |
| Dual-pane file browser | Total Commander pattern; Walnut is not a general file manager | Single-pane views focused on task at hand |
| Plugin/extension system | Massive API design burden for v1 | Internal strategy pattern for extensibility |

## Feature Dependencies

```
Folder Picker --> Directory Scanner --> File Stats Collection
                                           |
                                    +------+------+
                                    |             |
                              Size Grouping   Type Categorization
                                    |             |
                              Content Hashing   Organization Preview
                                    |             |
                              Duplicate Groups   Apply Reorganization
                                    |             |
                              Select & Delete    Undo Reorganization
                                    |
                              Move to Trash
```

Key dependency: Directory scanning and file stats collection is the foundation for BOTH features (duplicates and organization). Build this shared infrastructure first.

## MVP Recommendation

**Phase 1 -- Foundation:**
1. App shell with sidebar navigation (scaffold)
2. Folder picker
3. Directory scanner with progress

**Phase 2 -- Duplicate Detection (core value):**
1. Size-based pre-filtering
2. SHA-256 content hashing
3. Grouped duplicate display
4. Selection UI with keep/remove presets
5. Preview before delete
6. Move to Recycle Bin

**Phase 3 -- File Organization:**
1. Type categorization engine
2. Dry-run preview
3. Apply reorganization
4. Undo capability

**Defer:**
- Smart selection assistant: High value but not blocking; manual selection works for v1
- Scan history: Nice-to-have, add after core features work
- Auto-update: Add when ready to distribute
- Space savings summary: Low effort, add alongside duplicate display
- Reference directories: Add when users request it

## Sources

- [Walnut PROJECT.md](../../.planning/PROJECT.md) -- requirements and constraints
- Competitive analysis: dupeGuru, AllDup, Duplicate Cleaner Pro, fdupes, Directory Opus, Files (community), Total Commander
