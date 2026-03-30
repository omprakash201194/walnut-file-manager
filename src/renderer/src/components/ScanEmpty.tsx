import { Files } from 'lucide-react'

interface ScanEmptyProps {
  hasFolder: boolean
}

function ScanEmpty({ hasFolder }: ScanEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <Files className="size-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold text-foreground">
        {hasFolder ? 'No duplicates found' : 'No folder selected'}
      </h2>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        {hasFolder
          ? 'All files in this folder are unique. Try scanning a different folder.'
          : 'Choose a folder from the sidebar to scan for duplicate files.'}
      </p>
    </div>
  )
}

export default ScanEmpty
