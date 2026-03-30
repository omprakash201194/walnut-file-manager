import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import FileRow from './FileRow'
import { formatBytes } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import type { DuplicateGroup } from '../../../shared/ipc-types'

interface DuplicateGroupCardProps {
  group: DuplicateGroup
}

function DuplicateGroupCard({ group }: DuplicateGroupCardProps) {
  const selections = useAppStore((s) => s.selections)
  const toggleSelection = useAppStore((s) => s.toggleSelection)

  // Determine which file is the KEEP candidate: the one not checked for deletion
  // If no preset applied yet, no file has KEEP badge (isKeep = false for all)
  const checkedCount = group.files.filter((f) => selections.has(f.path)).length
  const uncheckedFiles = group.files.filter((f) => !selections.has(f.path))

  // keep-at-least-one: the last unchecked file in a group is disabled (SELECT-02)
  const isLastUnchecked = (filePath: string) =>
    uncheckedFiles.length === 1 && uncheckedFiles[0].path === filePath && !selections.has(filePath)

  const totalSize = group.files.reduce((sum, f) => sum + f.size, 0)
  const fileName = group.files[0]?.name ?? 'Unknown file'

  return (
    <AccordionItem
      value={group.hash}
      className="border border-border rounded-lg mb-2 overflow-hidden data-[state=open]:border-blue-500/30"
    >
      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
        <div className="flex items-center gap-2 text-left">
          <span className="text-sm font-semibold text-foreground">{fileName}</span>
          <span className="text-xs text-muted-foreground">
            · {group.files.length} copies · {formatBytes(totalSize)}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <div className="border-t border-border">
          {group.files.map((file) => {
            const isChecked = selections.has(file.path)
            // KEEP badge: show on unchecked files when at least one in the group is checked
            const isKeep = !isChecked && checkedCount > 0
            const isDisabled = isLastUnchecked(file.path)

            return (
              <FileRow
                key={file.path}
                file={file}
                isChecked={isChecked}
                isKeep={isKeep}
                isDisabled={isDisabled}
                onToggle={toggleSelection}
              />
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default DuplicateGroupCard
