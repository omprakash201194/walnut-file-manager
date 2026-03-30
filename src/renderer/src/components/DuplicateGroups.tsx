import { useState } from 'react'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import DuplicateGroupCard from './DuplicateGroupCard'
import { useAppStore, applyPreset } from '@/store/appStore'
import { formatBytes } from '@/lib/utils'
import type { DuplicateGroup } from '../../../shared/ipc-types'

interface DuplicateGroupsProps {
  groups: DuplicateGroup[]
}

function DuplicateGroups({ groups }: DuplicateGroupsProps) {
  const protectedFolders = useAppStore((s) => s.protectedFolders)
  const setSelections = useAppStore((s) => s.setSelections)

  // D-09: First group open on results load; rest collapsed
  const [openItems, setOpenItems] = useState<string[]>(
    groups.length > 0 ? [groups[0].hash] : []
  )

  // Space savings: sum of totalWastedBytes across all groups (DUPE-04)
  const totalWastedBytes = groups.reduce((sum, g) => sum + g.totalWastedBytes, 0)
  const duplicateCount = groups.reduce((sum, g) => sum + g.files.length - 1, 0)

  const handlePreset = (preset: 'newest' | 'oldest') => {
    const newSelections = applyPreset(groups, preset, protectedFolders)
    setSelections(newSelections)
  }

  // Space savings summary copy (DUPE-04, Copywriting Contract)
  const summaryCopy =
    duplicateCount === 1
      ? `1 duplicate found — you can reclaim ${formatBytes(totalWastedBytes)}`
      : `${duplicateCount} duplicates found — you can reclaim ${formatBytes(totalWastedBytes)}`

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar — sticky, does not scroll (D-10) */}
      <div
        className="sticky top-0 z-10 bg-background flex items-center justify-between px-6 py-3 border-b border-border shrink-0"
        aria-live="polite"
      >
        <span className="text-sm text-foreground">{summaryCopy}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
            onClick={() => handlePreset('newest')}
          >
            Keep Newest
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
            onClick={() => handlePreset('oldest')}
          >
            Keep Oldest
          </Button>
        </div>
      </div>

      {/* Scrollable accordion list — add pb-20 to clear the sticky DeletePanel (plan 02-05) */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 pb-20">
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
            {groups.map((group) => (
              <DuplicateGroupCard key={group.hash} group={group} />
            ))}
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  )
}

export default DuplicateGroups
