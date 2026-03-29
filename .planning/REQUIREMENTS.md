# Requirements: Walnut File Manager

**Defined:** 2026-03-29
**Core Value:** A user can scan any folder, instantly see their duplicate files and clutter, and take action to clean them up — with full confidence that nothing will be lost without their consent.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### App Shell (SHELL)

- [ ] **SHELL-01**: User can launch the app and see a dark-mode desktop window with sidebar navigation
- [ ] **SHELL-02**: User can select a target folder using the system folder picker dialog
- [ ] **SHELL-03**: User can navigate between Duplicates and Organizer modules via the sidebar
- [ ] **SHELL-04**: User can see their previously scanned folders (scan history) listed for quick re-access

### Scanning Infrastructure (SCAN)

- [ ] **SCAN-01**: App recursively walks a selected directory and collects file metadata (name, path, size, modified date, extension)
- [ ] **SCAN-02**: User sees a real-time progress indicator during scanning (files scanned / total, elapsed time, current path)
- [ ] **SCAN-03**: User can cancel an in-progress scan at any time
- [ ] **SCAN-04**: Scan results stream into the UI progressively — first results appear within 2 seconds of scan start

### Duplicate Detection (DUPE)

- [ ] **DUPE-01**: App pre-filters by file size — only files sharing an identical size proceed to hashing
- [ ] **DUPE-02**: App computes SHA-256 content hash for size-colliding files to confirm true duplicates
- [ ] **DUPE-03**: Duplicate groups are displayed in a list: each group shows all copies with path, size, and modified date
- [ ] **DUPE-04**: User sees a space savings summary: "X duplicates found — you can reclaim Y GB"
- [ ] **DUPE-05**: User can select which file(s) to remove within each duplicate group using checkboxes, with "keep newest" / "keep oldest" quick-select presets
- [ ] **DUPE-06**: User can mark specific folders as protected (reference folders) — files in protected folders are never auto-selected for deletion

### Smart Selection (SELECT)

- [ ] **SELECT-01**: User can apply a smart selection rule across all groups at once (keep newest, keep oldest, keep from preferred folder path)
- [ ] **SELECT-02**: App enforces a keep-at-least-one constraint — it is impossible to queue all copies of a file for deletion

### File Safety (SAFETY)

- [ ] **SAFETY-01**: Before any deletion, user sees a preview panel listing exactly which files will be removed and their total size
- [ ] **SAFETY-02**: Files are moved to the Windows Recycle Bin by default — permanent deletion is not available in v1
- [ ] **SAFETY-03**: User must explicitly confirm the deletion action after reviewing the preview
- [ ] **SAFETY-04**: Before any reorganization, user sees a dry-run preview showing proposed moves as a before/after directory tree
- [ ] **SAFETY-05**: User can undo the last reorganization operation, reversing all file moves

### File Organization (ORG)

- [ ] **ORG-01**: App categorizes scanned files by type into: Documents, Photos, Music, Video, Archives, Other
- [ ] **ORG-02**: User can select an organization strategy (v1 ships with "By Type" and "By Extension" strategies)
- [ ] **ORG-03**: App generates and displays a dry-run preview of proposed file moves before executing
- [ ] **ORG-04**: User can apply the reorganization — files are moved into type-based subdirectories within the target folder
- [ ] **ORG-05**: Organization strategy is extensible — new strategies can be added in future versions without restructuring core logic

### Quality & Testing (QUALITY)

- [ ] **QUALITY-01**: Unit tests cover all pure logic (hash computation, size grouping, type categorization, strategy pattern) via Vitest
- [ ] **QUALITY-02**: Integration tests cover IPC handlers and file operations against a real temp filesystem (not mocked)
- [ ] **QUALITY-03**: E2e tests cover critical user flows (scan, duplicate review, delete, organize, undo) via Playwright for Electron
- [ ] **QUALITY-04**: All tests run in CI on each commit via GitHub Actions

### Distribution (DIST)

- [ ] **DIST-01**: App builds to a Windows NSIS installer via electron-builder
- [ ] **DIST-02**: Release artifacts are produced on GitHub Actions and attached to GitHub Releases
- [ ] **DIST-03**: App version is displayed in the UI (About section or window title bar)

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Detection

- **DUPE-V2-01**: Fuzzy duplicate detection — find near-duplicate files (similar names, slightly different content)
- **DUPE-V2-02**: Image similarity detection — find duplicate photos even if resized or re-encoded
- **DUPE-V2-03**: Hardlink and symlink detection

### Enhanced Organization

- **ORG-V2-01**: "By Date" organization strategy (organize photos by year/month)
- **ORG-V2-02**: Custom organization rules (user-defined patterns)
- **ORG-V2-03**: Scheduled/watched folder auto-organization

### User Experience

- **UX-V2-01**: Auto-update via electron-updater
- **UX-V2-02**: In-app file metadata preview (image thumbnail, document excerpt)
- **UX-V2-03**: Global keyboard shortcuts for scan / navigate

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cloud storage integration (Drive, OneDrive, S3) | Each provider is a separate project; local filesystem only for v1 |
| AI-powered file naming or content analysis | Unproven value, massive complexity; extension-based categorization is sufficient |
| Real-time file watching / auto-reorganize | Adds background process complexity; manual scan-and-act model is safer |
| Permanent delete option | Too dangerous for trust-building in v1; Recycle Bin is always recoverable |
| macOS / Linux support | Windows-only for v1; Electron makes cross-platform viable later |
| Network / NAS scanning | Network I/O adds timeout and permission complexity; local drives only |
| Built-in file viewer / editor | Not Walnut's purpose; open in system default app |
| Dual-pane file browser | Walnut is a cleanup utility, not a general file manager |
| Plugin / extension system | API design burden for v1; internal strategy pattern handles extensibility |
| Custom themes | Ship one polished dark theme; not a theming engine |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Pending |
| SHELL-02 | Phase 1 | Pending |
| SHELL-03 | Phase 1 | Pending |
| SHELL-04 | Phase 4 | Pending |
| SCAN-01 | Phase 2 | Pending |
| SCAN-02 | Phase 2 | Pending |
| SCAN-03 | Phase 2 | Pending |
| SCAN-04 | Phase 2 | Pending |
| DUPE-01 | Phase 2 | Pending |
| DUPE-02 | Phase 2 | Pending |
| DUPE-03 | Phase 2 | Pending |
| DUPE-04 | Phase 2 | Pending |
| DUPE-05 | Phase 2 | Pending |
| DUPE-06 | Phase 2 | Pending |
| SELECT-01 | Phase 2 | Pending |
| SELECT-02 | Phase 2 | Pending |
| SAFETY-01 | Phase 2 | Pending |
| SAFETY-02 | Phase 2 | Pending |
| SAFETY-03 | Phase 2 | Pending |
| SAFETY-04 | Phase 3 | Pending |
| SAFETY-05 | Phase 3 | Pending |
| ORG-01 | Phase 3 | Pending |
| ORG-02 | Phase 3 | Pending |
| ORG-03 | Phase 3 | Pending |
| ORG-04 | Phase 3 | Pending |
| ORG-05 | Phase 3 | Pending |
| QUALITY-01 | Phase 4 | Pending |
| QUALITY-02 | Phase 4 | Pending |
| QUALITY-03 | Phase 4 | Pending |
| QUALITY-04 | Phase 4 | Pending |
| DIST-01 | Phase 4 | Pending |
| DIST-02 | Phase 4 | Pending |
| DIST-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after roadmap creation (4-phase structure)*
