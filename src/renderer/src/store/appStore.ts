import { create } from 'zustand'

interface AppState {
  selectedFolder: string | null
  setSelectedFolder: (folder: string | null) => void
}

export const useAppStore = create<AppState>()((set) => ({
  selectedFolder: null,
  setSelectedFolder: (folder) => set({ selectedFolder: folder })
}))
