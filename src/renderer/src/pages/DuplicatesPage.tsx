import DeletePanel from '@/components/DeletePanel'

function DuplicatesPage() {
  return (
    <div className="flex flex-col h-full relative">
      <h1 className="text-xl font-semibold text-foreground">Duplicate Files</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Select a folder above to scan for duplicates.
      </p>
      <DeletePanel />
    </div>
  )
}

export default DuplicatesPage
