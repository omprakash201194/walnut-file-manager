import { create } from 'zustand'
import { DuplicateGroup, ScanProgressEvent, CategoryMap } from '../../../../shared/ipc-types'
import * as nodePath from 'path'

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error' | 'cancelled'

export type OrganizerStatus =
  | 'no-scan'     // No scan results in store
  | 'idle'        // Scan results exist, no preview generated
  | 'previewing'  // Preview IPC call in flight
  | 'ready'       // Preview returned, Apply enabled
  | 'applying'    // Apply IPC call in flight
  | 'done'        // Apply complete, Undo visible
  | 'error'       // Move failure during apply

// Pure function — SELECT-01 + SELECT-02 + DUPE-06
// preset: 'newest' keeps the file with the highest mtime; 'oldest' keeps the lowest
// protectedFolders: files whose path starts with any protected folder are never selected
// keep-at-least-one: sorted[0] (the keeper) is always excluded from the returned Set
export function applyPreset(
  groups: DuplicateGroup[],
  preset: 'newest' | 'oldest',
  protectedFolders: string[]
): Set<string> {
  const selected = new Set<string>()

  for (const group of groups) {
    const sorted = [...group.files].sort((a, b) => {
      const mtimeDiff = preset === 'newest' ? b.mtime - a.mtime : a.mtime - b.mtime
      if (mtimeDiff !== 0) return mtimeDiff
      // Tiebreaker: use birthtime (creation time) when mtime is identical
      return preset === 'newest' ? b.birthtime - a.birthtime : a.birthtime - b.birthtime
    })
    // sorted[0] is the keeper — never selected (SELECT-02)
    const candidates = sorted.slice(1)

    for (const file of candidates) {
      const isProtected = protectedFolders.some(
        (pf) => file.path.startsWith(pf + nodePath.sep) || file.path === pf
      )
      if (!isProtected) selected.add(file.path)
    }
  }

  return selected
}

interface AppState {
  // Existing state
  selectedFolder: string | null
  setSelectedFolder: (folder: string | null) => void

  // Scan state
  scanStatus: ScanStatus
  scanProgress: ScanProgressEvent | null
  duplicateGroups: DuplicateGroup[]
  selections: Set<string>
  protectedFolders: string[]
  scanError: string | null

  // Scan actions
  setScanStatus: (status: ScanStatus) => void
  setScanProgress: (p: ScanProgressEvent) => void
  setScanComplete: (groups: DuplicateGroup[]) => void
  setScanError: (msg: string) => void
  toggleSelection: (filePath: string) => void
  setSelections: (paths: Set<string>) => void
  clearSelections: () => void
  addProtectedFolder: (folder: string) => void
  removeProtectedFolder: (folder: string) => void
  resetScan: () => void

  // Organizer state (D-03 / D-04 / D-05 / D-06)
  organizerStatus: OrganizerStatus
  organizerPreview: CategoryMap | null
  organizerError: string | null
  organizerUndoAvailable: boolean
  organizerLastApplyTime: number | null      // ms timestamp for Undo button label
  activeStrategy: 'by-type' | 'by-extension'

  // Scan history (SHELL-04)
  scanHistory: string[]
  setScanHistory: (history: string[]) => void

  // Organizer actions
  setOrganizerStatus: (s: OrganizerStatus) => void
  setOrganizerPreview: (preview: CategoryMap) => void
  setOrganizerError: (msg: string | null) => void
  setOrganizerUndoAvailable: (available: boolean) => void
  setOrganizerLastApplyTime: (time: number | null) => void
  setActiveStrategy: (s: 'by-type' | 'by-extension') => void
  resetOrganizer: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  // Existing state
  selectedFolder: null,
  setSelectedFolder: (folder) => set({ selectedFolder: folder }),

  // Initial scan state
  scanStatus: 'idle' as ScanStatus,
  scanProgress: null,
  duplicateGroups: [],
  selections: new Set<string>(),
  protectedFolders: [],
  scanError: null,

  // Scan actions
  setScanStatus: (status) => set({ scanStatus: status }),
  setScanProgress: (p) => set({ scanProgress: p, scanStatus: 'scanning' }),
  setScanComplete: (groups) =>
    set({ duplicateGroups: groups, scanStatus: 'complete', scanProgress: null }),
  setScanError: (msg) => set({ scanError: msg, scanStatus: 'error' }),

  // CRITICAL: Always create new Set — mutating in-place does not trigger re-renders (Pitfall 5)
  toggleSelection: (filePath) =>
    set((state) => {
      const next = new Set(state.selections)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return { selections: next }
    }),
  setSelections: (paths) => set({ selections: paths }),
  clearSelections: () => set({ selections: new Set<string>() }),

  addProtectedFolder: (folder) =>
    set((state) => ({
      protectedFolders: state.protectedFolders.includes(folder)
        ? state.protectedFolders
        : [...state.protectedFolders, folder]
    })),
  removeProtectedFolder: (folder) =>
    set((state) => ({
      protectedFolders: state.protectedFolders.filter((f) => f !== folder)
    })),

  // Returns to idle, clears all scan state — used when starting a new scan (D-03)
  resetScan: () =>
    set({
      scanStatus: 'idle',
      scanProgress: null,
      duplicateGroups: [],
      selections: new Set<string>(),
      scanError: null
    }),

  // Organizer initial state
  organizerStatus: 'no-scan' as OrganizerStatus,
  organizerPreview: null,
  organizerError: null,
  organizerUndoAvailable: false,
  organizerLastApplyTime: null,
  activeStrategy: 'by-type' as 'by-type' | 'by-extension',

  // Organizer actions
  setOrganizerStatus: (s) => set({ organizerStatus: s }),
  setOrganizerPreview: (preview) => set({ organizerPreview: preview }),
  setOrganizerError: (msg) => set({ organizerError: msg }),
  setOrganizerUndoAvailable: (available) => set({ organizerUndoAvailable: available }),
  setOrganizerLastApplyTime: (time) => set({ organizerLastApplyTime: time }),
  setActiveStrategy: (s) => set({ activeStrategy: s }),
  resetOrganizer: () =>
    set({
      organizerStatus: 'no-scan',
      organizerPreview: null,
      organizerError: null,
      organizerUndoAvailable: false,
      organizerLastApplyTime: null,
      activeStrategy: 'by-type',
    }),

  // Scan history initial state
  scanHistory: [],
  setScanHistory: (history) => set({ scanHistory: history }),
}))
