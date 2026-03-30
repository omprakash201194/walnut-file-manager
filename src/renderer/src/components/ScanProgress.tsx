import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'
import type { ScanProgressEvent } from '../../../shared/ipc-types'

interface ScanProgressProps {
  folderPath: string
  progress: ScanProgressEvent | null
  onCancel: () => void
}

function ScanProgress({ folderPath, progress, onCancel }: ScanProgressProps) {
  // totalFiles = 0 during Pass 1 walk (indeterminate) — show pulse animation
  const isIndeterminate = !progress || progress.totalFiles === 0
  const percent = isIndeterminate
    ? 0
    : Math.round((progress.filesScanned / progress.totalFiles) * 100)

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-[480px] flex flex-col gap-6 px-8">
        {/* Folder path */}
        <p className="text-xs text-muted-foreground truncate" title={folderPath}>
          {folderPath}
        </p>

        {/* Progress bar — indeterminate uses animate-pulse gradient, determinate fills blue-500 */}
        {isIndeterminate ? (
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-blue-500/40 via-blue-500 to-blue-500/40 bg-[length:200%_100%]" />
          </div>
        ) : (
          <Progress
            value={percent}
            className="h-2"
            aria-label="Scan progress"
          />
        )}

        {/* Stats */}
        <div className="flex flex-col gap-1 text-sm text-foreground">
          {progress ? (
            <>
              <span>Files scanned: {progress.filesScanned.toLocaleString()}{progress.totalFiles > 0 ? ` / ${progress.totalFiles.toLocaleString()}` : ''}</span>
              <span>Elapsed: {formatElapsed(progress.elapsedMs)}</span>
              <span className={progress.duplicatesFound > 0 ? 'text-blue-500' : ''}>
                Duplicates found: {progress.duplicatesFound}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Preparing scan…</span>
          )}
        </div>

        {/* Current file */}
        {progress?.currentPath && (
          <p className="text-xs text-muted-foreground truncate" dir="ltr" title={progress.currentPath}>
            {progress.currentPath}
          </p>
        )}

        {/* Cancel button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={onCancel}
          aria-label="Cancel current scan"
        >
          Cancel Scan
        </Button>
      </div>
    </div>
  )
}

export default ScanProgress
