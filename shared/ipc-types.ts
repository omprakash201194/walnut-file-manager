// IPC Channel Constants
// Convention: 'domain:action' naming. Add new channels here as the app grows.
export const IPC_CHANNELS = {
  SELECT_DIRECTORY: 'dialog:select-directory',
  SCAN_START: 'scan:start',
  SCAN_CANCEL: 'scan:cancel',
  SCAN_PROGRESS: 'scan:progress',
  SCAN_COMPLETE: 'scan:complete',
  SCAN_ERROR: 'scan:error',
  DELETE_FILES: 'files:delete',
  ORG_PREVIEW: 'org:preview',
  ORG_APPLY: 'org:apply',
  ORG_UNDO: 'org:undo',
  ORG_GET_STATE: 'org:get-state',
  APP_GET_VERSION: 'app:get-version',
  SCAN_HISTORY_GET: 'scan-history:get',
  SCAN_HISTORY_UPDATED: 'scan-history:updated',
} as const

// --- Scan pipeline types ---

export interface ScanProgressEvent {
  filesScanned: number
  totalFiles: number // 0 during Pass 1 walk (total unknown until walk completes)
  currentPath: string
  duplicatesFound: number
  elapsedMs: number
}

export interface FileEntry {
  path: string
  size: number
  mtime: number     // millisecond timestamp — last modified
  birthtime: number // millisecond timestamp — created (used as tiebreaker when mtime equal)
  name: string
}

export interface DuplicateGroup {
  hash: string
  files: FileEntry[]
  totalWastedBytes: number // size * (files.length - 1)
}

export interface DeleteResult {
  succeeded: string[]
  failed: Array<{ path: string; error: string }>
}

// Typed API exposed to renderer via contextBridge
export interface IpcApi {
  selectDirectory: () => Promise<string | null>
  scanStart: (folderPath: string) => Promise<void>
  scanCancel: () => Promise<void>
  deleteFiles: (paths: string[]) => Promise<DeleteResult>
  onScanProgress: (cb: (e: ScanProgressEvent) => void) => () => void
  onScanComplete: (cb: (groups: DuplicateGroup[]) => void) => () => void
  onScanError: (cb: (message: string) => void) => () => void
  orgPreview: (req: OrgPreviewRequest) => Promise<CategoryMap>
  orgApply: (req: OrgApplyRequest) => Promise<OrgApplyResult>
  orgUndo: () => Promise<OrgUndoResult>
  orgGetState: () => Promise<OrgStateResult>
  getAppVersion: () => Promise<string>
  getScanHistory: () => Promise<string[]>
  onScanHistoryUpdated: (cb: (history: string[]) => void) => () => void
}

// Augment Window type so renderer code gets type-safe access
declare global {
  interface Window {
    api: IpcApi
  }
}

// --- Organizer pipeline types ---

export type CategoryMap = Record<string, FileEntry[]>

export interface OrganizationStrategy {
  readonly name: string
  categorize(files: FileEntry[], targetDir: string): CategoryMap
}

export interface MoveRecord {
  from: string
  to: string
}

export interface OrgPreviewRequest {
  strategy: 'by-type' | 'by-extension'
  targetDir: string
  files: FileEntry[]
}

export interface OrgApplyRequest {
  strategy: 'by-type' | 'by-extension'
  targetDir: string
  files: FileEntry[]
}

export interface OrgApplyResult {
  succeeded: MoveRecord[]
  failed: Array<{ path: string; error: string }>
}

export interface OrgUndoResult {
  reversed: number
  failed: Array<{ path: string; error: string }>
}

export interface OrgStateResult {
  undoStackSize: number
  lastApplyTime: number | null
}
