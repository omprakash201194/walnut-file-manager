import { Conf } from 'electron-conf/main'

interface ScanHistoryStore {
  scanHistory: string[]
}

const historyStore = new Conf<ScanHistoryStore>({
  name: 'scan-history',
  defaults: { scanHistory: [] },
})

export function addToScanHistory(folderPath: string): string[] {
  const current = historyStore.get('scanHistory') as string[]
  const deduped = current.filter((p) => p !== folderPath)
  const updated = [folderPath, ...deduped].slice(0, 5)
  historyStore.set('scanHistory', updated)
  return updated
}

export function getScanHistory(): string[] {
  return historyStore.get('scanHistory') as string[]
}
