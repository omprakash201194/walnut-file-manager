import { Button } from './ui/button'
import type { OrganizerStatus } from '../store/appStore'

interface OrganizerActionBarProps {
  status: OrganizerStatus
  totalFiles: number
  undoAvailable: boolean
  lastApplyTime: number | null
  onApply: () => void
  onUndo: () => void
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function OrganizerActionBar({
  status,
  totalFiles,
  undoAvailable,
  lastApplyTime,
  onApply,
  onUndo,
}: OrganizerActionBarProps) {
  const isApplyEnabled = status === 'ready'
  const isApplying = status === 'applying'

  return (
    // UI-SPEC: fixed bottom-0 left-[220px] right-0 — matches DeletePanel pattern
    <div className="fixed bottom-0 left-[220px] right-0 z-20 bg-card border-t border-border py-4 px-6 flex items-center gap-3">
      {/* Apply button — UI-SPEC: destructive variant, "Organize N files" label */}
      <Button
        variant="destructive"
        disabled={!isApplyEnabled || isApplying}
        onClick={onApply}
        className="min-w-[140px]"
      >
        {isApplying ? 'Organizing\u2026' : `Organize ${totalFiles} ${totalFiles === 1 ? 'file' : 'files'}`}
      </Button>

      {/* Undo button — UI-SPEC: ghost variant, visible only when undoAvailable */}
      {undoAvailable && (
        <Button
          variant="ghost"
          onClick={onUndo}
          className="text-muted-foreground"
        >
          {lastApplyTime
            ? `Undo last reorganization \u00b7 ${formatTime(lastApplyTime)}`
            : 'Undo last reorganization'}
        </Button>
      )}
    </div>
  )
}
