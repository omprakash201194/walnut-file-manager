import { FileText, Image, Music, Video, Archive, File } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import type { CategoryMap, FileEntry } from '../../../../shared/ipc-types'

// Category icon mapping — ORG-01 / UI-SPEC Category Definitions
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Documents: FileText,
  Photos: Image,
  Music: Music,
  Video: Video,
  Archives: Archive,
}

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  return CATEGORY_ICONS[category] ?? File
}

interface PreviewAccordionProps {
  preview: CategoryMap
}

export function PreviewAccordion({ preview }: PreviewAccordionProps) {
  // Filter out empty categories — UI-SPEC: "Omit section entirely" for empty categories
  const categories = Object.entries(preview).filter(([, files]) => files.length > 0)

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No files to organize.
      </p>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <Accordion type="multiple" className="w-full">
        {categories.map(([category, files]: [string, FileEntry[]]) => {
          const Icon = getCategoryIcon(category)
          return (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger className="hover:no-underline px-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold text-foreground">
                    {category}
                  </span>
                  {/* UI-SPEC: "Documents — 14 files" header format */}
                  <Badge variant="secondary" className="text-xs">
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1 pb-2">
                  {files.map((file: FileEntry) => (
                    <li
                      key={file.path}
                      className="text-sm text-muted-foreground truncate pl-6"
                      title={file.path}
                    >
                      {file.name}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </ScrollArea>
  )
}
