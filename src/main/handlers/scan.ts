import { BrowserWindow, ipcMain, shell } from 'electron'
import { promises as fs, createReadStream } from 'fs'
import * as crypto from 'crypto'
import * as path from 'path'
import {
  IPC_CHANNELS,
  FileEntry,
  DuplicateGroup,
  ScanProgressEvent,
  DeleteResult
} from '../../../shared/ipc-types'

// Module-level controller — allows SCAN_CANCEL to abort an in-progress scan
let scanController: AbortController | null = null

/**
 * PASS 1: Iterative (not recursive) directory walk — avoids call stack overflow on deep trees.
 * Uses a stack array instead of recursion; emits onFile callback for each file found.
 * Skips entries on stat/readdir error (permission denied, locked files, etc.)
 */
export async function walkDirectory(
  dirPath: string,
  signal: AbortSignal,
  onFile: (entry: FileEntry, count: number) => void
): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  const stack: string[] = [dirPath]
  let count = 0

  while (stack.length > 0) {
    // Check abort at the top of each iteration
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const currentDir = stack.pop()!

    let entries
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch {
      // Skip directories we can't read (permission denied, etc.)
      continue
    }

    for (const dirent of entries) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const fullPath = path.join(currentDir, dirent.name)

      if (dirent.isDirectory()) {
        stack.push(fullPath)
      } else if (dirent.isFile()) {
        let stat
        try {
          stat = await fs.stat(fullPath)
        } catch {
          // Skip files we can't stat (permission denied, etc.)
          continue
        }

        count++
        const entry: FileEntry = {
          path: fullPath,
          size: stat.size,
          mtime: stat.mtimeMs,
          birthtime: stat.birthtimeMs,
          name: dirent.name
        }
        results.push(entry)
        onFile(entry, count)
      }
    }
  }

  return results
}

/**
 * DUPE-01: Group collected files by size; return only groups with 2+ files.
 * Files with unique sizes are not duplicate candidates and are discarded.
 */
export function groupBySize(files: FileEntry[]): Map<number, FileEntry[]> {
  const sizeMap = new Map<number, FileEntry[]>()

  for (const file of files) {
    const existing = sizeMap.get(file.size)
    if (existing) {
      existing.push(file)
    } else {
      sizeMap.set(file.size, [file])
    }
  }

  // Filter out singletons — only size-colliding candidates proceed to hashing
  for (const [size, group] of sizeMap) {
    if (group.length < 2) {
      sizeMap.delete(size)
    }
  }

  return sizeMap
}

/**
 * NAME-PATTERN: Strip Windows copy suffixes from a filename basename.
 * Handles:
 *   - "file - Copy.txt"         → "file"
 *   - "file - Copy (2).txt"     → "file"
 *   - "file (1).txt"            → "file"
 *   - "file (2).txt"            → "file"
 * Returns lowercased canonical name (with extension) for case-insensitive grouping.
 */
export function canonicalBasename(filename: string): string {
  const ext = path.extname(filename)
  let base = path.basename(filename, ext)

  // Strip "- Copy (N)" and "- Copy" suffixes (case-insensitive, optional spaces)
  base = base.replace(/\s*-\s*copy(\s*\(\d+\))?$/i, '')

  // Strip trailing " (N)" numbered suffixes like "(1)", "(2)", etc.
  base = base.replace(/\s*\(\d+\)$/, '')

  return (base + ext).toLowerCase()
}

/**
 * NAME-PATTERN: Group files by canonical basename; return only groups with 2+ files.
 * This catches "file.txt" + "file - Copy.txt" + "file (1).txt" even when sizes differ.
 */
export function groupByCanonicalName(files: FileEntry[]): Map<string, FileEntry[]> {
  const nameMap = new Map<string, FileEntry[]>()

  for (const file of files) {
    const canonical = canonicalBasename(file.name)
    const existing = nameMap.get(canonical)
    if (existing) {
      existing.push(file)
    } else {
      nameMap.set(canonical, [file])
    }
  }

  // Filter out singletons — only name-colliding candidates proceed to hashing
  for (const [canonical, group] of nameMap) {
    if (group.length < 2) {
      nameMap.delete(canonical)
    }
  }

  return nameMap
}

/**
 * DUPE-02: Stream SHA-256 hash via createReadStream — non-blocking, handles large files.
 * Wraps in try/catch — returns null on permission error or any I/O failure.
 */
export async function hashFile(filePath: string): Promise<string | null> {
  try {
    return await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = createReadStream(filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', (err) => reject(err))
    })
  } catch {
    // Permission denied, file locked, or any other I/O error
    return null
  }
}

/**
 * DUPE-02: Hash all candidates; group by hash; filter out singletons.
 * Calls onProgress for each file hashed.
 */
export async function groupByHash(
  candidates: FileEntry[],
  signal: AbortSignal,
  onProgress: (hashed: number, total: number, currentPath: string) => void
): Promise<DuplicateGroup[]> {
  const hashMap = new Map<string, FileEntry[]>()
  const total = candidates.length

  for (let i = 0; i < candidates.length; i++) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const file = candidates[i]
    const hash = await hashFile(file.path)

    if (hash === null) {
      // Skip files that failed to hash (permission denied, locked, etc.)
      continue
    }

    const existing = hashMap.get(hash)
    if (existing) {
      existing.push(file)
    } else {
      hashMap.set(hash, [file])
    }

    onProgress(i + 1, total, file.path)
  }

  // Build DuplicateGroup[] — only groups with 2+ files are duplicates
  const groups: DuplicateGroup[] = []
  for (const [hash, files] of hashMap) {
    if (files.length >= 2) {
      groups.push({
        hash,
        files,
        // size * (count - 1) = bytes that could be freed by keeping one copy
        totalWastedBytes: files[0].size * (files.length - 1)
      })
    }
  }

  return groups
}

/**
 * Register all scan IPC handlers on the mainWindow.
 * Call this once from src/main/index.ts after createWindow().
 */
export function registerScanHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.SCAN_START, async (_, folderPath: string) => {
    // Abort any in-progress scan first
    scanController?.abort()
    scanController = new AbortController()
    const { signal } = scanController
    const startTime = Date.now()

    try {
      // PASS 1: Walk directory, emit progress every ~100 files
      const files: FileEntry[] = []
      await walkDirectory(folderPath, signal, (entry, count) => {
        files.push(entry)
        if (count % 100 === 0) {
          const progressEvent: ScanProgressEvent = {
            filesScanned: count,
            totalFiles: 0, // Unknown during walk
            currentPath: entry.path,
            duplicatesFound: 0,
            elapsedMs: Date.now() - startTime
          }
          mainWindow.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, progressEvent)
        }
      })

      // CONTENT DETECTION: Size pre-filter → hash to find true content duplicates
      const sizeGroups = groupBySize(files)
      const sizeCandidates = [...sizeGroups.values()].flat()
      const contentGroups = await groupByHash(sizeCandidates, signal, (hashed, total, currentPath) => {
        const progressEvent: ScanProgressEvent = {
          filesScanned: files.length,
          totalFiles: total,
          currentPath,
          duplicatesFound: 0, // Running total sent in final event
          elapsedMs: Date.now() - startTime
        }
        mainWindow.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, progressEvent)
      })

      // NAME-PATTERN DETECTION: Group by canonical name → hash each group regardless of size
      // Catches "file - Copy.txt", "file (1).jpg", etc. even when sizes differ slightly
      const nameGroups = groupByCanonicalName(files)
      const nameCandidates = [...nameGroups.values()].flat()

      // Deduplicate name candidates against already-hashed files to avoid double hashing
      const alreadyHashedPaths = new Set(sizeCandidates.map((f) => f.path))
      const newNameCandidates = nameCandidates.filter((f) => !alreadyHashedPaths.has(f.path))
      const nameGroups2 = await groupByHash(newNameCandidates, signal, () => {})

      // Merge name-based groups into content groups, deduplicating by hash
      const seenHashes = new Set(contentGroups.map((g) => g.hash))
      for (const group of nameGroups2) {
        if (!seenHashes.has(group.hash)) {
          contentGroups.push(group)
          seenHashes.add(group.hash)
        }
      }

      // Push results via webContents.send — handle resolves void (NOT return value)
      mainWindow.webContents.send(IPC_CHANNELS.SCAN_COMPLETE, contentGroups)
    } catch (err: unknown) {
      const isAbort = (err as { name?: string }).name === 'AbortError'
      if (!isAbort) {
        mainWindow.webContents.send(
          IPC_CHANNELS.SCAN_ERROR,
          (err as Error).message ?? 'Unknown scan error'
        )
      }
      // AbortError = user cancelled — no SCAN_ERROR event emitted
    } finally {
      scanController = null
    }
    // CRITICAL: Do NOT return duplicateGroups — results delivered via webContents.send
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_CANCEL, async () => {
    scanController?.abort()
  })

  ipcMain.handle(
    IPC_CHANNELS.DELETE_FILES,
    async (_, paths: string[]): Promise<DeleteResult> => {
      const succeeded: string[] = []
      const failed: Array<{ path: string; error: string }> = []

      for (const filePath of paths) {
        try {
          // path.resolve() converts forward slashes to backslashes on Windows (Pitfall 1)
          await shell.trashItem(path.resolve(filePath))
          succeeded.push(filePath)
        } catch (err) {
          failed.push({
            path: filePath,
            error: (err as Error).message ?? 'Unknown error'
          })
        }
      }

      return { succeeded, failed }
    }
  )
}
