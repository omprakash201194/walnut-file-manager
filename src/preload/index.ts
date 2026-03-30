import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, ScanProgressEvent, DuplicateGroup, DeleteResult } from '../../shared/ipc-types'

contextBridge.exposeInMainWorld('api', {
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),

  scanStart: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_START, folderPath),

  scanCancel: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_CANCEL),

  deleteFiles: (paths: string[]): Promise<DeleteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_FILES, paths),

  // Push event listeners — each returns an unsubscribe cleanup function
  // Pattern: never expose ipcRenderer.on directly — wrap it and return () => off
  onScanProgress: (callback: (event: ScanProgressEvent) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: ScanProgressEvent) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SCAN_PROGRESS, handler)
    return () => ipcRenderer.off(IPC_CHANNELS.SCAN_PROGRESS, handler)
  },

  onScanComplete: (callback: (groups: DuplicateGroup[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: DuplicateGroup[]) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SCAN_COMPLETE, handler)
    return () => ipcRenderer.off(IPC_CHANNELS.SCAN_COMPLETE, handler)
  },

  onScanError: (callback: (message: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.SCAN_ERROR, handler)
    return () => ipcRenderer.off(IPC_CHANNELS.SCAN_ERROR, handler)
  }
})
