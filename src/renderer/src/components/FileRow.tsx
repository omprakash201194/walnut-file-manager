import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, formatBytes } from '@/lib/utils'
import type { FileEntry } from '../../../../shared/ipc-types'

interface FileRowProps {
  file: FileEntry
  isChecked: boolean
  isKeep: boolean
  isDisabled: boolean // keep-at-least-one: true when this is the last unchecked copy
  onToggle: (path: string) => void
}

function FileRow({ file, isChecked, isKeep, isDisabled, onToggle }: FileRowProps) {
  const formattedDate = new Date(file.mtime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  const checkbox = (
    <Checkbox
      checked={isChecked}
      disabled={isDisabled}
      onCheckedChange={() => !isDisabled && onToggle(file.path)}
      aria-label={file.path}
      className={cn(
        'size-5',
        isChecked && 'data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500'
      )}
    />
  )

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm',
        isDisabled && 'opacity-50',
        !isDisabled && 'hover:bg-muted/50'
      )}
    >
      {/* Checkbox — wrap in tooltip if disabled */}
      {isDisabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{checkbox}</span>
            </TooltipTrigger>
            <TooltipContent>Cannot remove last copy</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        checkbox
      )}

      {/* Path — truncate with ellipsis */}
      <span
        className={cn('flex-1 truncate', isChecked ? 'text-foreground' : 'text-muted-foreground')}
        title={file.path}
      >
        {file.path}
      </span>

      {/* Size */}
      <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
        {formatBytes(file.size)}
      </span>

      {/* Modified date */}
      <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
        {formattedDate}
      </span>

      {/* KEEP badge or spacer — green semantic color per UI-SPEC */}
      <div className="w-12 flex justify-end shrink-0">
        {isKeep ? (
          <Badge
            className="bg-emerald-500/20 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full border-0"
            aria-label="This copy will be kept"
          >
            KEEP
          </Badge>
        ) : (
          <span className="w-12" />
        )}
      </div>
    </div>
  )
}

export default FileRow
