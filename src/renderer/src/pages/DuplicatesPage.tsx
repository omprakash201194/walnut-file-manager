import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import ScanEmpty from '@/components/ScanEmpty'
import ScanProgress from '@/components/ScanProgress'
import DuplicateGroups from '@/components/DuplicateGroups'
import DeletePanel from '@/components/DeletePanel'
import { Button } from '@/components/ui/button'

function DuplicatesPage() {
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const scanStatus = useAppStore((s) => s.scanStatus)
  const scanProgress = useAppStore((s) => s.scanProgress)
  const duplicateGroups = useAppStore((s) => s.duplicateGroups)
  const { setScanProgress, setScanComplete, setScanError, setScanStatus, clearSelections, resetScan } = useAppStore()

  // Register IPC push-event listeners on mount — cleanup on unmount (Pattern 7, Pitfall 3)
  useEffect(() => {
    const unsubProgress = window.api.onScanProgress((data) => {
      setScanProgress(data)
    })
    const unsubComplete = window.api.onScanComplete((groups) => {
      setScanComplete(groups)
    })
    const unsubError = window.api.onScanError((msg) => {
      setScanError(msg)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, []) // Mount once — handlers read latest Zustand state, not stale closures

  const handleScanStart = async () => {
    if (!selectedFolder) return
    clearSelections()
    resetScan()
    setScanStatus('scanning')
    try {
      await window.api.scanStart(selectedFolder)
    } catch (err) {
      setScanError((err as Error).message ?? 'Failed to start scan')
    }
  }

  const handleScanCancel = async () => {
    setScanStatus('cancelled')
    await window.api.scanCancel()
  }

  // Derive which state to show
  const isScanning = scanStatus === 'scanning'
  const hasResults = scanStatus === 'complete' && duplicateGroups.length > 0
  const hasNoResults = scanStatus === 'complete' && duplicateGroups.length === 0
  const hasError = scanStatus === 'error'

  return (
    <div className="flex flex-col h-full relative">
      {/* Page header — always visible */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-foreground">Duplicate Files</h1>
        {selectedFolder && !isScanning && (
          <Button
            className="bg-blue-500 hover:bg-blue-500/90 active:bg-blue-500/80"
            onClick={handleScanStart}
          >
            {hasResults || hasNoResults ? 'Scan Again' : 'Scan Now'}
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {isScanning && selectedFolder && (
          <ScanProgress
            folderPath={selectedFolder}
            progress={scanProgress}
            onCancel={handleScanCancel}
          />
        )}

        {hasResults && (
          <DuplicateGroups groups={duplicateGroups} />
        )}

        {(hasNoResults || (!isScanning && !hasResults) || hasError) && (
          <div className="flex flex-col h-full">
            {hasError && (
              <div className="mx-6 mt-4 p-3 rounded-md bg-destructive/10 text-sm text-destructive border border-destructive/20">
                <ErrorMessage />
              </div>
            )}
            <ScanEmpty hasFolder={!!selectedFolder && hasNoResults} />
          </div>
        )}
      </div>

      {/* Sticky delete confirmation panel — mounts when selections exist */}
      <DeletePanel />
    </div>
  )
}

// Inline helper to read scanError from store
function ErrorMessage() {
  const scanError = useAppStore((s) => s.scanError)
  return <>{scanError ?? 'Scan failed. Check that the folder exists and you have read permission.'}</>
}

export default DuplicatesPage
