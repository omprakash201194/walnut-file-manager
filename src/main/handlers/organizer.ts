import { BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
import { Conf } from 'electron-conf/main'
import {
  IPC_CHANNELS,
  FileEntry,
  CategoryMap,
  MoveRecord,
  OrgPreviewRequest,
  OrgApplyRequest,
  OrgApplyResult,
  OrgUndoResult,
  OrgStateResult,
} from '../../../shared/ipc-types'
import { ByTypeStrategy } from '../strategies/byType'
import { ByExtensionStrategy } from '../strategies/byExtension'

// --- electron-conf persistent undo stack ---
// Stored in {userData}/organizer.json — survives app restarts (D-06 / SAFETY-05)
interface OrganizerStore {
  undoStack: MoveRecord[][]          // Each entry = one Apply operation
  lastApplyTimes: number[]           // Parallel array: ms timestamp per apply
}

const store = new Conf<OrganizerStore>({
  name: 'organizer',
  defaults: {
    undoStack: [],
    lastApplyTimes: [],
  },
})

// --- safeMove: EXDEV-safe file rename (Research Pattern 2) ---
export async function safeMove(src: string, dest: string): Promise<void> {
  try {
    await fs.rename(src, dest)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EXDEV') {
      // Cross-device: copy then delete (atomicity sacrificed for compat)
      await fs.copyFile(src, dest)
      await fs.unlink(src)
    } else {
      throw err
    }
  }
}

// --- fileExists helper for collision detection ---
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// --- Resolve destination path with collision avoidance (Research Pitfall 4) ---
export async function resolveDestPath(destDir: string, filename: string): Promise<string> {
  let destPath = path.join(destDir, filename)
  let counter = 1
  while (await fileExists(destPath)) {
    const ext = path.extname(filename)
    const base = path.basename(filename, ext)
    destPath = path.join(destDir, `${base} (${counter})${ext}`)
    counter++
  }
  return destPath
}

// --- Strategy factory ---
function getStrategy(strategyKey: 'by-type' | 'by-extension') {
  return strategyKey === 'by-type' ? new ByTypeStrategy() : new ByExtensionStrategy()
}

// --- Categorize files into a plain CategoryMap safe for IPC serialization ---
// CategoryMap values are plain FileEntry objects — no class instances
export function buildCategoryMap(files: FileEntry[], strategyKey: 'by-type' | 'by-extension', targetDir: string): CategoryMap {
  const strategy = getStrategy(strategyKey)
  return strategy.categorize(files, targetDir)
}

/**
 * Register all organizer IPC handlers.
 * Call once from src/main/index.ts after createWindow().
 * mainWindow is accepted for API symmetry with registerScanHandlers.
 */
export function registerOrganizerHandlers(_mainWindow: BrowserWindow): void {

  // ORG_PREVIEW — dry-run: return CategoryMap without touching disk (SAFETY-04 / ORG-03)
  ipcMain.handle(IPC_CHANNELS.ORG_PREVIEW, async (_, req: OrgPreviewRequest): Promise<CategoryMap> => {
    return buildCategoryMap(req.files, req.strategy, req.targetDir)
  })

  // ORG_APPLY — move files into category subdirectories (ORG-04)
  ipcMain.handle(IPC_CHANNELS.ORG_APPLY, async (_, req: OrgApplyRequest): Promise<OrgApplyResult> => {
    const categoryMap = buildCategoryMap(req.files, req.strategy, req.targetDir)
    const succeeded: MoveRecord[] = []
    const failed: Array<{ path: string; error: string }> = []

    for (const [category, categoryFiles] of Object.entries(categoryMap)) {
      const destDir = path.join(req.targetDir, category)

      // Pitfall 3: always mkdir before moving — destination dirs don't exist yet
      try {
        await fs.mkdir(destDir, { recursive: true })
      } catch (err) {
        // mkdir failure: skip entire category, mark all files as failed
        for (const file of categoryFiles) {
          failed.push({ path: file.path, error: (err as Error).message })
        }
        continue
      }

      for (const file of categoryFiles) {
        try {
          const destPath = await resolveDestPath(destDir, file.name)
          await safeMove(file.path, destPath)
          succeeded.push({ from: file.path, to: destPath })
        } catch (err) {
          failed.push({ path: file.path, error: (err as Error).message })
        }
      }
    }

    // Pitfall 6: push undo record for succeeded moves even when some files failed
    // This ensures partial operations are always undoable
    if (succeeded.length > 0) {
      const now = Date.now()
      const undoStack = store.get('undoStack')
      const lastApplyTimes = store.get('lastApplyTimes')
      store.set('undoStack', [...undoStack, succeeded])
      store.set('lastApplyTimes', [...lastApplyTimes, now])
    }

    return { succeeded, failed }
  })

  // ORG_UNDO — reverse last apply operation (SAFETY-05 / D-06)
  ipcMain.handle(IPC_CHANNELS.ORG_UNDO, async (): Promise<OrgUndoResult> => {
    const undoStack = store.get('undoStack')
    const lastApplyTimes = store.get('lastApplyTimes')

    if (undoStack.length === 0) return { reversed: 0, failed: [] }

    const toReverse = undoStack[undoStack.length - 1]
    const failed: Array<{ path: string; error: string }> = []
    let reversed = 0

    // Reverse in reverse order to avoid collision on path re-creation
    for (const move of [...toReverse].reverse()) {
      // Ensure the original directory exists (it may have been emptied)
      const srcDir = path.dirname(move.from)
      try {
        await fs.mkdir(srcDir, { recursive: true })
      } catch {
        // Best-effort — proceed to move attempt
      }

      try {
        await safeMove(move.to, move.from)
        reversed++
      } catch (err) {
        failed.push({ path: move.to, error: (err as Error).message })
      }
    }

    // Pop stack regardless of failures — partial undo is surfaced as error to renderer
    store.set('undoStack', undoStack.slice(0, -1))
    store.set('lastApplyTimes', lastApplyTimes.slice(0, -1))

    return { reversed, failed }
  })

  // ORG_GET_STATE — renderer calls on mount to initialize undo button state
  ipcMain.handle(IPC_CHANNELS.ORG_GET_STATE, async (): Promise<OrgStateResult> => {
    const undoStack = store.get('undoStack')
    const lastApplyTimes = store.get('lastApplyTimes')
    const lastApplyTime =
      lastApplyTimes.length > 0 ? lastApplyTimes[lastApplyTimes.length - 1] : null
    return {
      undoStackSize: undoStack.length,
      lastApplyTime,
    }
  })
}
