// @vitest-environment node
/**
 * Unit tests for src/main/handlers/organizer.ts pure/exported functions.
 * Tests safeMove, fileExists, resolveDestPath, buildCategoryMap, and handler behaviors.
 *
 * IPC registration (registerOrganizerHandlers) is integration-level and not tested here.
 * electron-conf store is mocked to avoid writing to disk during tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock electron-conf/main before importing organizer
vi.mock('electron-conf/main', () => {
  const store: Record<string, unknown> = {
    undoStack: [],
    lastApplyTimes: [],
  }
  class MockConf {
    get(key: string) { return store[key] }
    set(key: string, value: unknown) { store[key] = value }
  }
  return { Conf: MockConf }
})

// Mock electron ipcMain to avoid requiring a running Electron app
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}))

// Import after mocks are set up
import {
  safeMove,
  fileExists,
  resolveDestPath,
  buildCategoryMap,
} from '../handlers/organizer'
import { applyPreset } from '../../renderer/src/store/appStore'
import type { FileEntry, DuplicateGroup } from '../../../shared/ipc-types'

// ─────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────

function makeEntry(name: string, overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    path: `/tmp/${name}`,
    size: 1024,
    mtime: Date.now(),
    birthtime: Date.now(),
    name,
    ...overrides,
  }
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'walnut-organizer-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ─────────────────────────────────────────────────────────────
// safeMove
// ─────────────────────────────────────────────────────────────
describe('safeMove', () => {
  it('renames file on same device (fs.rename path)', async () => {
    const src = path.join(tmpDir, 'source.txt')
    const dest = path.join(tmpDir, 'dest.txt')
    await fs.writeFile(src, 'hello')

    await safeMove(src, dest)

    await expect(fs.access(dest)).resolves.toBeUndefined()
    await expect(fs.access(src)).rejects.toThrow()
  })

  it('re-throws non-EXDEV errors', async () => {
    const src = path.join(tmpDir, 'nonexistent.txt')
    const dest = path.join(tmpDir, 'dest.txt')

    await expect(safeMove(src, dest)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────
// fileExists
// ─────────────────────────────────────────────────────────────
describe('fileExists', () => {
  it('returns true for existing file', async () => {
    const filePath = path.join(tmpDir, 'exists.txt')
    await fs.writeFile(filePath, 'data')
    expect(await fileExists(filePath)).toBe(true)
  })

  it('returns false for non-existing file', async () => {
    const filePath = path.join(tmpDir, 'missing.txt')
    expect(await fileExists(filePath)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// resolveDestPath
// ─────────────────────────────────────────────────────────────
describe('resolveDestPath', () => {
  it('returns original path when no collision', async () => {
    const result = await resolveDestPath(tmpDir, 'report.pdf')
    expect(result).toBe(path.join(tmpDir, 'report.pdf'))
  })

  it('appends (1) suffix on first collision', async () => {
    await fs.writeFile(path.join(tmpDir, 'report.pdf'), 'data')

    const result = await resolveDestPath(tmpDir, 'report.pdf')
    expect(result).toBe(path.join(tmpDir, 'report (1).pdf'))
  })

  it('increments suffix until free slot found', async () => {
    await fs.writeFile(path.join(tmpDir, 'report.pdf'), 'data')
    await fs.writeFile(path.join(tmpDir, 'report (1).pdf'), 'data')
    await fs.writeFile(path.join(tmpDir, 'report (2).pdf'), 'data')

    const result = await resolveDestPath(tmpDir, 'report.pdf')
    expect(result).toBe(path.join(tmpDir, 'report (3).pdf'))
  })

  it('handles files without extension', async () => {
    await fs.writeFile(path.join(tmpDir, 'README'), 'data')

    const result = await resolveDestPath(tmpDir, 'README')
    expect(result).toBe(path.join(tmpDir, 'README (1)'))
  })
})

// ─────────────────────────────────────────────────────────────
// buildCategoryMap
// ─────────────────────────────────────────────────────────────
describe('buildCategoryMap', () => {
  const targetDir = '/some/target'

  it('by-type: groups files by MIME category', () => {
    const files: FileEntry[] = [
      makeEntry('photo.jpg'),
      makeEntry('doc.pdf'),
      makeEntry('song.mp3'),
      makeEntry('unknown.xyz'),
    ]

    const map = buildCategoryMap(files, 'by-type', targetDir)

    expect(Object.keys(map)).toContain('Photos')
    expect(Object.keys(map)).toContain('Documents')
    expect(Object.keys(map)).toContain('Music')
    expect(Object.keys(map)).toContain('Other')

    expect(map['Photos'].map(f => f.name)).toContain('photo.jpg')
    expect(map['Documents'].map(f => f.name)).toContain('doc.pdf')
    expect(map['Music'].map(f => f.name)).toContain('song.mp3')
    expect(map['Other'].map(f => f.name)).toContain('unknown.xyz')
  })

  it('by-extension: groups files by file extension', () => {
    const files: FileEntry[] = [
      makeEntry('report.pdf'),
      makeEntry('notes.pdf'),
      makeEntry('image.png'),
    ]

    const map = buildCategoryMap(files, 'by-extension', targetDir)

    expect(Object.keys(map)).toContain('pdf')
    expect(Object.keys(map)).toContain('png')
    expect(map['pdf']).toHaveLength(2)
    expect(map['png']).toHaveLength(1)
  })

  it('by-extension: uses no-extension key for files without extension', () => {
    const files: FileEntry[] = [makeEntry('Makefile')]

    const map = buildCategoryMap(files, 'by-extension', targetDir)

    expect(Object.keys(map)).toContain('no-extension')
  })

  it('returns empty map for empty file list', () => {
    const map = buildCategoryMap([], 'by-type', targetDir)
    expect(Object.keys(map)).toHaveLength(0)
  })

  it('does not write to disk (preview is read-only)', async () => {
    const files: FileEntry[] = [makeEntry('photo.jpg', { path: path.join(tmpDir, 'photo.jpg') })]
    await fs.writeFile(files[0].path, 'fake image data')

    buildCategoryMap(files, 'by-type', tmpDir)

    // Verify no subdirectories were created (no disk writes)
    const entries = await fs.readdir(tmpDir)
    expect(entries).not.toContain('Photos')
  })
})

// ─────────────────────────────────────────────────────────────
// applyPreset
// ─────────────────────────────────────────────────────────────
describe('applyPreset', () => {
  const now = Date.now()

  function makeFileEntry(name: string, mtime: number, overrides: Partial<FileEntry> = {}): FileEntry {
    return {
      path: `/test/${name}`,
      size: 100,
      mtime,
      birthtime: mtime - 1000,
      name,
      ...overrides,
    }
  }

  function makeGroup(files: FileEntry[]): DuplicateGroup {
    return { hash: 'abc123', files, totalWastedBytes: 100 * (files.length - 1) }
  }

  it('newest preset: keeps file with highest mtime, selects all others', () => {
    const older = makeFileEntry('old.txt', now - 5000)
    const newer = makeFileEntry('new.txt', now)
    const group = makeGroup([older, newer])

    const result = applyPreset([group], 'newest', [])

    // newer is the keeper (highest mtime), older is selected for deletion
    expect(result.has(older.path)).toBe(true)
    expect(result.has(newer.path)).toBe(false)
  })

  it('oldest preset: keeps file with lowest mtime, selects all others', () => {
    const older = makeFileEntry('old.txt', now - 5000)
    const newer = makeFileEntry('new.txt', now)
    const group = makeGroup([older, newer])

    const result = applyPreset([group], 'oldest', [])

    // older is the keeper (lowest mtime), newer is selected for deletion
    expect(result.has(newer.path)).toBe(true)
    expect(result.has(older.path)).toBe(false)
  })

  it('keep-at-least-one: single-file group returns empty Set (nothing to delete)', () => {
    const file = makeFileEntry('only.txt', now)
    const group = makeGroup([file])

    const result = applyPreset([group], 'newest', [])

    expect(result.size).toBe(0)
  })

  it('protected folder: file in protected folder excluded even if it would normally be selected', () => {
    const protectedDir = path.join('C:', 'protected')
    const normalDir = path.join('C:', 'normal')
    const protectedFolders = [protectedDir]
    const keeper = makeFileEntry('newest.txt', now, { path: path.join(normalDir, 'newest.txt') })
    const protectedFile = makeFileEntry('protected.txt', now - 1000, { path: path.join(protectedDir, 'protected.txt') })
    const normalFile = makeFileEntry('normal.txt', now - 2000, { path: path.join(normalDir, 'normal.txt') })

    const group = makeGroup([keeper, protectedFile, normalFile])

    const result = applyPreset([group], 'newest', protectedFolders)

    // keeper is kept (highest mtime), protectedFile excluded by protection, normalFile selected
    expect(result.has(keeper.path)).toBe(false)
    expect(result.has(protectedFile.path)).toBe(false)
    expect(result.has(normalFile.path)).toBe(true)
  })

  it('multiple groups: works correctly across multiple groups simultaneously', () => {
    const fileA1 = makeFileEntry('a1.txt', now, { path: '/test/a1.txt' })
    const fileA2 = makeFileEntry('a2.txt', now - 1000, { path: '/test/a2.txt' })
    const fileB1 = makeFileEntry('b1.txt', now, { path: '/test/b1.txt' })
    const fileB2 = makeFileEntry('b2.txt', now - 2000, { path: '/test/b2.txt' })

    const groupA = makeGroup([fileA1, fileA2])
    const groupB = makeGroup([fileB1, fileB2])

    const result = applyPreset([groupA, groupB], 'newest', [])

    // Each group: newer is keeper, older is selected
    expect(result.has(fileA2.path)).toBe(true)
    expect(result.has(fileA1.path)).toBe(false)
    expect(result.has(fileB2.path)).toBe(true)
    expect(result.has(fileB1.path)).toBe(false)
    expect(result.size).toBe(2)
  })
})
