// @vitest-environment node
/**
 * Integration tests for organizer handlers — exercises safeMove and buildCategoryMap
 * against a real temp filesystem. No mocked fs. electron-conf and electron mocked.
 * Cleans up temp directory in afterEach.
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
import { safeMove, buildCategoryMap } from '../../handlers/organizer'
import type { FileEntry } from '../../../../shared/ipc-types'

// ─────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────

function makeEntry(name: string, overrides: Partial<FileEntry> = {}): FileEntry {
  return { path: `/fake/${name}`, size: 100, mtime: Date.now(), birthtime: Date.now(), name, ...overrides }
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'walnut-organizer-integration-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ─────────────────────────────────────────────────────────────
// safeMove
// ─────────────────────────────────────────────────────────────
describe('safeMove integration', () => {
  it('moves a real file to a new location on the same device', async () => {
    const srcPath = path.join(tmpDir, 'src.txt')
    const destDir = path.join(tmpDir, 'dest')
    const destPath = path.join(destDir, 'src.txt')

    // Create source file and destination directory
    await fs.writeFile(srcPath, 'test')
    await fs.mkdir(destDir, { recursive: true })

    await safeMove(srcPath, destPath)

    // Destination should now exist
    await expect(fs.stat(destPath)).resolves.toBeDefined()

    // Source should no longer exist
    await expect(fs.stat(srcPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('moves a file to a flat destination in the same temp directory', async () => {
    const srcPath = path.join(tmpDir, 'input.txt')
    const destPath = path.join(tmpDir, 'output.txt')

    await fs.writeFile(srcPath, 'file content here')

    await safeMove(srcPath, destPath)

    const content = await fs.readFile(destPath, 'utf8')
    expect(content).toBe('file content here')

    await expect(fs.stat(srcPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('re-throws ENOENT when source file does not exist', async () => {
    const srcPath = path.join(tmpDir, 'nonexistent.txt')
    const destPath = path.join(tmpDir, 'dest.txt')

    await expect(safeMove(srcPath, destPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

// ─────────────────────────────────────────────────────────────
// buildCategoryMap
// ─────────────────────────────────────────────────────────────
describe('buildCategoryMap integration (by-type strategy)', () => {
  it('groups real FileEntry list by type into correct categories', () => {
    const entries: FileEntry[] = [
      makeEntry('resume.pdf'),
      makeEntry('photo.jpg'),
      makeEntry('song.mp3'),
      makeEntry('video.mp4'),
      makeEntry('archive.zip'),
      makeEntry('unknown.xyz'),
    ]

    const result = buildCategoryMap(entries, 'by-type', tmpDir)

    expect(result['Documents']).toHaveLength(1)
    expect(result['Documents'][0].name).toBe('resume.pdf')

    expect(result['Photos']).toHaveLength(1)
    expect(result['Photos'][0].name).toBe('photo.jpg')

    expect(result['Music']).toHaveLength(1)
    expect(result['Music'][0].name).toBe('song.mp3')

    expect(result['Video']).toHaveLength(1)
    expect(result['Video'][0].name).toBe('video.mp4')

    expect(result['Archives']).toHaveLength(1)
    expect(result['Archives'][0].name).toBe('archive.zip')

    expect(result['Other']).toHaveLength(1)
    expect(result['Other'][0].name).toBe('unknown.xyz')
  })

  it('returns empty map for empty input', () => {
    const result = buildCategoryMap([], 'by-type', tmpDir)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('does not create any directories on disk (preview is read-only)', async () => {
    const entries: FileEntry[] = [
      makeEntry('photo.jpg'),
      makeEntry('doc.pdf'),
    ]

    buildCategoryMap(entries, 'by-type', tmpDir)

    const dirEntries = await fs.readdir(tmpDir)
    expect(dirEntries).not.toContain('Photos')
    expect(dirEntries).not.toContain('Documents')
    expect(dirEntries).toHaveLength(0)
  })
})
