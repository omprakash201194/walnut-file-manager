// @vitest-environment node
/**
 * Integration tests for the scan pipeline — exercises walkDirectory, groupBySize,
 * and groupByHash against a real temp filesystem. No mocked fs.
 * Cleans up temp directory in afterEach.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock electron-conf/main before importing scan handlers
vi.mock('electron-conf/main', () => {
  const store: Record<string, unknown> = { undoStack: [], lastApplyTimes: [] }
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
  shell: {
    trashItem: vi.fn(),
  },
}))

import { walkDirectory, groupBySize, groupByHash } from '../../handlers/scan'
import type { FileEntry } from '../../../../shared/ipc-types'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'walnut-scan-integration-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('Scan pipeline integration', () => {
  it('detects real duplicate files on disk (full walk → size group → hash pipeline)', async () => {
    // Create two files with identical content and one unique file
    await fs.writeFile(path.join(tmpDir, 'original.txt'), 'hello world\n')
    await fs.writeFile(path.join(tmpDir, 'copy.txt'), 'hello world\n')
    await fs.writeFile(path.join(tmpDir, 'unique.txt'), 'different content')

    const signal = new AbortController().signal

    // PASS 1: Walk
    const files: FileEntry[] = await walkDirectory(tmpDir, signal, vi.fn())
    expect(files.length).toBe(3)

    // PASS 2: Group by size — only size-colliding candidates proceed
    const bySize = groupBySize(files)
    const candidates = [...bySize.values()].flat()

    // PASS 3: Hash to find true duplicates
    const groups = await groupByHash(candidates, signal, vi.fn())

    expect(groups.length).toBe(1)
    expect(groups[0].files.length).toBe(2)

    const fileNames = groups[0].files.map((f: FileEntry) => f.name).sort()
    expect(fileNames).toEqual(['copy.txt', 'original.txt'])

    expect(groups[0].totalWastedBytes).toBeGreaterThan(0)
  })

  it('returns no duplicate groups when all files have unique content', async () => {
    // Create 3 files with distinct content
    await fs.writeFile(path.join(tmpDir, 'alpha.txt'), 'unique content alpha')
    await fs.writeFile(path.join(tmpDir, 'beta.txt'), 'unique content beta')
    await fs.writeFile(path.join(tmpDir, 'gamma.txt'), 'unique content gamma')

    const signal = new AbortController().signal

    const files = await walkDirectory(tmpDir, signal, vi.fn())
    const bySize = groupBySize(files)
    const candidates = [...bySize.values()].flat()
    const groups = await groupByHash(candidates, signal, vi.fn())

    expect(groups.length).toBe(0)
  })

  it('rejects with AbortError when controller is aborted before walk starts', async () => {
    await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'some content')
    await fs.writeFile(path.join(tmpDir, 'file2.txt'), 'other content')

    const controller = new AbortController()
    // Abort before calling walkDirectory
    controller.abort()

    await expect(
      walkDirectory(tmpDir, controller.signal, vi.fn())
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
