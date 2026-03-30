// IPC Channel Constants
// Convention: 'domain:action' naming. Add new channels here as the app grows.
export const IPC_CHANNELS = {
  SELECT_DIRECTORY: 'dialog:select-directory',
  SCAN_START: 'scan:start',
  SCAN_CANCEL: 'scan:cancel',
  SCAN_PROGRESS: 'scan:progress',
  SCAN_COMPLETE: 'scan:complete',
  SCAN_ERROR: 'scan:error',
  DELETE_FILES: 'files:delete'
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
  mtime: number // millisecond timestamp
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
}

// Augment Window type so renderer code gets type-safe access
declare global {
  interface Window {
    api: IpcApi
  }
}
