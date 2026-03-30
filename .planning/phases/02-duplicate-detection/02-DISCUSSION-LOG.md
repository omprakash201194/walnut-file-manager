# Phase 2: Duplicate Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 02-duplicate-detection
**Areas discussed:** Scan trigger, Progress presentation, Duplicate groups layout, Selection & delete flow

---

## Scan Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Scan button in DuplicatesPage | Folder pick stays in sidebar; separate "Scan Now" button in page header | ✓ |
| Auto-scan on folder pick | Picking a folder immediately starts a scan | |
| Scan button in sidebar | Both folder pick and scan button in sidebar | |

**User's choice:** Explicit "Scan Now" button in DuplicatesPage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Shared — same folder everywhere | `selectedFolder` is global Zustand state | ✓ |
| Isolated per module | Each module tracks its own active folder | |

**User's choice:** Shared global folder state

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same button — scan/re-scan | One button, replaces old results | ✓ |
| Separate Re-scan button | Dedicated re-scan action after results exist | |

**User's choice:** Same button for scan and re-scan

---

## Progress Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page progress view | DuplicatesPage switches to dedicated progress screen | ✓ |
| Inline — results stream in live | Progress bar at top, groups fill in below as found | |

**User's choice:** Full-page progress view

---

| Option | Description | Selected |
|--------|-------------|----------|
| Files scanned / total | e.g. "1,204 / 2,800 files" | ✓ |
| Elapsed time | e.g. "0:12 elapsed" | ✓ |
| Current file path | Scrolling path of current file | ✓ |
| Duplicates found so far | Running count of groups found | ✓ |

**User's choice:** All four stats visible during progress

---

## Duplicate Groups Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion cards | Expandable/collapsible group cards | ✓ |
| Always expanded list | All copies always visible, no accordion | |

**User's choice:** Accordion cards

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full path | Complete file path, truncated with ellipsis | ✓ |
| File size | e.g. "2.1 MB" | ✓ |
| Modified date | e.g. "Mar 10, 2025" | ✓ |
| Keep badge | Visual "KEEP" badge on copy kept by current preset | ✓ |

**User's choice:** All four fields per row

---

| Option | Description | Selected |
|--------|-------------|----------|
| First group expanded, rest collapsed | Clean overview with one example visible | ✓ |
| All collapsed | Fully compact on load | |
| All expanded | Every file path visible immediately | |

**User's choice:** First group expanded, rest collapsed

---

| Option | Description | Selected |
|--------|-------------|----------|
| Summary bar above groups | Preset buttons in summary row, global scope | ✓ |
| Per-group context menus | Presets per group only | |
| Both — summary bar + per-group | Global + per-group presets | |

**User's choice:** Summary bar above groups

---

## Selection & Delete Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky bottom panel | Slides up when files selected; shows count/size/"Delete → Trash" button | ✓ |
| Confirmation modal | [Delete Selected] button opens a modal with file list | |

**User's choice:** Sticky bottom panel

---

| Option | Description | Selected |
|--------|-------------|----------|
| One click = final action | Panel button is the confirm step; no second dialog | ✓ |
| Button opens confirmation dialog | Two explicit steps before deletion | |

**User's choice:** One-click final action (panel IS the preview)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Managed in sidebar header area | Protected folders UI near folder path in sidebar | ✓ |
| Inline in duplicate groups | Per-file context menu to protect parent folder | |
| Settings page (defer to later) | No UI in Phase 2; logic only | |

**User's choice:** Sidebar header area

---

## Claude's Discretion

- IPC streaming implementation detail (webContents.send pattern)
- Zustand state shape for scan/duplicate/selection state
- Additional shadcn/ui components to install (checkbox, progress, badge)
- Error state handling during scanning
- Whether scan handlers live in main/index.ts or a separate handlers directory

## Deferred Ideas

None — discussion stayed within phase scope.
