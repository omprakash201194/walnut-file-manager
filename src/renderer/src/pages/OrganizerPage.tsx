import { useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PreviewAccordion } from '@/components/PreviewAccordion'
import { OrganizerActionBar } from '@/components/OrganizerActionBar'
import { useAppStore } from '@/store/appStore'

function OrganizerPage() {
  const {
    // Scan state (D-01: shared scan — OrganizerPage reads from existing scan results)
    duplicateGroups,
    selectedFolder,
    // Organizer state
    organizerStatus,
    organizerPreview,
    organizerError,
    organizerUndoAvailable,
    organizerLastApplyTime,
    activeStrategy,
    // Organizer actions
    setOrganizerStatus,
    setOrganizerPreview,
    setOrganizerError,
    setOrganizerUndoAvailable,
    setOrganizerLastApplyTime,
    setActiveStrategy,
    resetOrganizer,
  } = useAppStore()

  // Derive all files from scan results (D-01: no second walkDirectory call)
  const allFiles = duplicateGroups.flatMap((g) => g.files)

  // Determine if scan results are available
  const hasScanResults = duplicateGroups.length > 0 || allFiles.length > 0

  // On mount: initialize undo button state from electron-conf (persistent across restarts)
  useEffect(() => {
    window.api.orgGetState().then((state) => {
      setOrganizerUndoAvailable(state.undoStackSize > 0)
      setOrganizerLastApplyTime(state.lastApplyTime)
    }).catch(() => {
      // Handler not yet registered (Plan 05 wires it) — silent fail in dev
    })
  }, [])

  // Update status based on scan results availability
  useEffect(() => {
    if (organizerStatus === 'no-scan' && hasScanResults) {
      setOrganizerStatus('idle')
    } else if (organizerStatus === 'idle' && !hasScanResults) {
      setOrganizerStatus('no-scan')
    }
  }, [hasScanResults, organizerStatus])

  // Handle strategy tab switch — D-04: auto-regenerate after first preview
  function handleStrategyChange(strategy: 'by-type' | 'by-extension') {
    setActiveStrategy(strategy)
    // Auto-regenerate only if a preview has already been shown (D-04)
    const hasPreview = organizerStatus === 'ready' || organizerStatus === 'done' || organizerStatus === 'error'
    if (hasPreview) {
      runPreview(strategy)
    }
  }

  async function runPreview(strategy: 'by-type' | 'by-extension') {
    if (!selectedFolder) return
    setOrganizerStatus('previewing')
    setOrganizerError(null)
    try {
      const preview = await window.api.orgPreview({
        strategy,
        targetDir: selectedFolder,
        files: allFiles,
      })
      setOrganizerPreview(preview)
      setOrganizerStatus('ready')
    } catch (err) {
      setOrganizerError((err as Error).message ?? 'Preview failed')
      setOrganizerStatus('error')
    }
  }

  async function handlePreview() {
    await runPreview(activeStrategy)
  }

  async function handleApply() {
    if (!selectedFolder) return
    setOrganizerStatus('applying')
    setOrganizerError(null)
    try {
      const result = await window.api.orgApply({
        strategy: activeStrategy,
        targetDir: selectedFolder,
        files: allFiles,
      })

      const now = Date.now()
      setOrganizerUndoAvailable(true)
      setOrganizerLastApplyTime(now)
      setOrganizerStatus('done')

      // Surface partial failure — UI-SPEC Copywriting: "Moved X of Y files. N file(s) could not be moved."
      if (result.failed.length > 0) {
        const total = result.succeeded.length + result.failed.length
        if (result.succeeded.length > 0) {
          setOrganizerError(
            `Moved ${result.succeeded.length} of ${total} files. ${result.failed.length} file(s) could not be moved \u2014 check for open files or permission issues.`
          )
        } else {
          setOrganizerError(
            `Could not move ${result.failed.length} file(s). Check that the files are not open in another program.`
          )
        }
      }
    } catch (err) {
      setOrganizerError((err as Error).message ?? 'Apply failed')
      setOrganizerStatus('error')
    }
  }

  async function handleUndo() {
    setOrganizerError(null)
    try {
      const result = await window.api.orgUndo()

      // Update undo availability from fresh state
      const state = await window.api.orgGetState()
      setOrganizerUndoAvailable(state.undoStackSize > 0)
      setOrganizerLastApplyTime(state.lastApplyTime)

      // Return to idle — reset preview so user can run a fresh preview
      resetOrganizer()
      // Re-apply undo state since resetOrganizer clears it
      setOrganizerUndoAvailable(state.undoStackSize > 0)
      setOrganizerLastApplyTime(state.lastApplyTime)
      // Restore correct status based on scan availability
      setOrganizerStatus(hasScanResults ? 'idle' : 'no-scan')

      if (result.failed.length > 0) {
        setOrganizerError(
          `Undo reversed ${result.reversed} move(s). ${result.failed.length} file(s) could not be moved back.`
        )
      }
    } catch (err) {
      setOrganizerError((err as Error).message ?? 'Undo failed')
    }
  }

  // Compute total files for Apply button label
  const totalPreviewFiles = organizerPreview
    ? Object.values(organizerPreview).reduce((sum, files) => sum + files.length, 0)
    : 0

  // --- Empty state: no scan results (D-01) ---
  if (organizerStatus === 'no-scan') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Scan a folder first</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Switch to Duplicates and run a scan — the results will be available here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Strategy tabs — D-03: By Type (default) | By Extension */}
      <div className="px-6 pt-4">
        <Tabs
          value={activeStrategy}
          onValueChange={(v) => handleStrategyChange(v as 'by-type' | 'by-extension')}
        >
          <TabsList>
            <TabsTrigger value="by-type">By Type</TabsTrigger>
            <TabsTrigger value="by-extension">By Extension</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Separator className="mt-4" />

      {/* Preview trigger — D-04: manual first time */}
      <div className="px-6 py-4 flex items-center gap-3">
        <Button
          variant="default"
          onClick={handlePreview}
          disabled={organizerStatus === 'previewing' || organizerStatus === 'applying'}
        >
          {organizerStatus === 'previewing' ? 'Previewing\u2026' : 'Preview'}
        </Button>

        {/* Idle state guidance — shown before first preview */}
        {organizerStatus === 'idle' && (
          <p className="text-sm text-muted-foreground">
            Choose a strategy and click Preview to see how your files will be arranged.
          </p>
        )}
      </div>

      <Separator />

      {/* Preview area — flex-1, scrollable */}
      <div className="flex-1 px-6 py-4">
        {organizerPreview && (
          <PreviewAccordion preview={organizerPreview} />
        )}

        {/* Error area — UI-SPEC: dismissible, below preview */}
        {organizerError && (
          <div className="mt-4 bg-destructive/10 border border-destructive/30 text-sm text-destructive rounded-md px-4 py-3 flex items-start justify-between gap-2">
            <span>{organizerError}</span>
            <button
              onClick={() => setOrganizerError(null)}
              className="shrink-0 text-destructive/70 hover:text-destructive cursor-pointer"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Action bar — fixed bottom, matches DeletePanel positioning */}
      <OrganizerActionBar
        status={organizerStatus}
        totalFiles={totalPreviewFiles}
        undoAvailable={organizerUndoAvailable}
        lastApplyTime={organizerLastApplyTime}
        onApply={handleApply}
        onUndo={handleUndo}
      />
    </div>
  )
}

export default OrganizerPage
