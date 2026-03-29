// IPC Channel Constants
// Convention: 'domain:action' naming. Add new channels here as the app grows.
export const IPC_CHANNELS = {
  SELECT_DIRECTORY: 'dialog:select-directory'
} as const

// Typed API exposed to renderer via contextBridge
export interface IpcApi {
  selectDirectory: () => Promise<string | null>
}

// Augment Window type so renderer code gets type-safe access
declare global {
  interface Window {
    api: IpcApi
  }
}
