import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { formatBytes, cn } from '@/lib/utils'
import type { DuplicateGroup } from '../../../../shared/ipc-types'

function DeletePanel() {
  const selections = useAppStore((s) => s.selections)
  const duplicateGroups = useAppStore((s) => s.duplicateGroups)
  const clearSelections = useAppStore((s) => s.clearSelections)
  const setScanComplete = useAppStore((s) => s.setScanComplete)
  const [isDeleting, setIsDeleting] = useState(false)

  // Compute total size of selected files
  const allFiles = duplicateGroups.flatMap((g) => g.files)
  const selectedFiles = allFiles.filter((f) => selections.has(f.path))
  const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0)
  const count = selections.size

  const isVisible = count > 0

  const handleDelete = async () => {
    if (isDeleting || count === 0) return
    setIsDeleting(true)

    try {
      const paths = Array.from(selections)
      const result = await window.api.deleteFiles(paths)

      // Remove successfully deleted files from the duplicate groups
      const deletedSet = new Set(result.succeeded)
      const updatedGroups: DuplicateGroup[] = duplicateGroups
        .map((group) => ({
          ...group,
          files: group.files.filter((f) => !deletedSet.has(f.path)),
          totalWastedBytes: 0 // Will recalculate below
        }))
        .map((group) => ({
          ...group,
          totalWastedBytes:
            group.files.length > 1 ? group.files[0].size * (group.files.length - 1) : 0
        }))
        // Remove groups with fewer than 2 files (no longer duplicates)
        .filter((group) => group.files.length >= 2)

      setScanComplete(updatedGroups)
      clearSelections()

      // If some files failed, keep those paths selected for user to retry or investigate
      if (result.failed.length > 0) {
        const failedPaths = new Set(result.failed.map((f) => f.path))
        // Re-add failed paths to selections so user can see what failed
        const failedStillPresent = allFiles
          .filter((f) => failedPaths.has(f.path))
          .map((f) => f.path)
        if (failedStillPresent.length > 0) {
          useAppStore.getState().setSelections(new Set(failedStillPresent))
        }
      }
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Panel copy (Copywriting Contract from UI-SPEC)
  const panelCopy =
    count === 1
      ? `1 file selected · ${formatBytes(totalBytes)} to free`
      : `${count} files selected · ${formatBytes(totalBytes)} to free`

  const buttonLabel = count === 1 ? 'Delete 1 file → Trash' : `Delete ${count} files → Trash`

  return (
    // Position: fixed, left-[220px] matches sidebar width, right-0
    // Animation: translate-y-full when hidden (off-screen), translate-y-0 when visible
    <div
      className={cn(
        'fixed bottom-0 left-[220px] right-0 z-20',
        'bg-card border-t border-border',
        'px-6 py-4',
        'flex items-center justify-between',
        'transition-transform duration-200',
        isVisible ? 'translate-y-0' : 'translate-y-full'
      )}
      aria-live="polite"
    >
      <span className="text-sm text-foreground">{panelCopy}</span>
      <Button
        variant="destructive"
        size="default"
        className="h-9"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting…' : buttonLabel}
      </Button>
    </div>
  )
}

export default DeletePanel
