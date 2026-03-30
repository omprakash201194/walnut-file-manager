# Phase 4: Quality & Distribution - Discussion Log

**Session:** 2026-03-30
**Mode:** Interactive discuss-phase

---

## Area: Scan History UI

**Q: Where should scan history live in the UI?**
Options: Sidebar (Recommended) | Top of DuplicatesPage | Shared across both pages
**Selected:** Sidebar (Recommended)

**Q: How many history entries, and can users remove them?**
Options: 5 entries no remove (Recommended) | 10 entries with remove | Unlimited with clear all
**Selected:** 5 entries, no remove (Recommended)

---

## Area: Version Display

**Q: Where should the app version number be displayed?**
Options: Sidebar footer (Recommended) | Window title bar | About modal
**Selected:** Sidebar footer (Recommended)

---

## Area: Release Workflow

**Q: How should Windows installer artifacts reach GitHub Releases?**
Options: Tag-triggered auto release (Recommended) | Manual workflow dispatch | Merge-to-main auto release
**Selected:** Tag-triggered auto release (Recommended)

**Q: What should the CI workflow run on?**
Options: Push to main + all PRs (Recommended) | Push to main only | All branches + PRs
**Selected:** Push to main + all PRs (Recommended)

---

## Area: Integration Tests Scope

**Q: How deep should integration tests go?**
Options: IPC handler level (Recommended) | Full end-to-end IPC | File operations only
**Selected:** IPC handler level (Recommended)

**Q: Should integration tests live alongside unit tests or in a separate directory?**
Options: Separate src/main/__tests__/integration/ (Recommended) | Same directory different naming
**Selected:** Separate `src/main/__tests__/integration/` (Recommended)
