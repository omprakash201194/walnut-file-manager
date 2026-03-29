import { useState } from 'react'
import { NavLink } from 'react-router'
import { Files, FolderTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

function Sidebar() {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder)

  const handleChooseFolder = async () => {
    setIsPickerOpen(true)
    try {
      const folder = await window.api.selectDirectory()
      if (folder) {
        setSelectedFolder(folder)
      }
    } catch {
      // IPC error — could show toast, but for Phase 1 just log
      console.error('Failed to open folder picker.')
    } finally {
      setIsPickerOpen(false)
    }
  }

  return (
    <div className="w-[220px] h-screen bg-card flex flex-col border-r border-border">
      {/* Section A: App Identity */}
      <div className="px-6 py-4 h-16 flex items-center">
        <span className="text-2xl font-semibold text-foreground">Walnut</span>
      </div>

      {/* Section B: Navigation */}
      <ScrollArea className="flex-1">
        <nav className="px-2 py-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2 text-sm rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500',
                isActive
                  ? 'border-l-4 border-blue-500 text-blue-500 bg-zinc-800/50'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )
            }
          >
            <Files className="size-4 shrink-0" />
            Duplicates
          </NavLink>
          <NavLink
            to="/organizer"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2 text-sm rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500',
                isActive
                  ? 'border-l-4 border-blue-500 text-blue-500 bg-zinc-800/50'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )
            }
          >
            <FolderTree className="size-4 shrink-0" />
            Organizer
          </NavLink>
        </nav>
      </ScrollArea>

      {/* Section C: Folder Picker */}
      <div className="px-4 pb-4">
        <Separator className="mb-4" />
        <Button
          className="w-full bg-blue-500 hover:bg-blue-500/90 active:bg-blue-500/80"
          aria-label="Choose folder to scan"
          disabled={isPickerOpen}
          onClick={handleChooseFolder}
        >
          Choose Folder
        </Button>
        <p aria-live="polite" className="mt-2 text-xs">
          {selectedFolder ? (
            <span
              className="text-zinc-200 block truncate"
              style={{ direction: 'rtl', textAlign: 'left' }}
              title={selectedFolder}
            >
              {selectedFolder}
            </span>
          ) : (
            <span className="text-muted-foreground italic">No folder selected</span>
          )}
        </p>
      </div>
    </div>
  )
}

export default Sidebar
