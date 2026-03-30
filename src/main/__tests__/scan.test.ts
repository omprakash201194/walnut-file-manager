/**
 * Unit tests for src/main/handlers/scan.ts pure functions.
 * Tests walkDirectory, groupBySize, hashFile, and groupByHash.
 * IPC registration (registerScanHandlers) is integration-level and not tested here.
 */

import { describe, it, expect, vi } from 'vitest'
import { resolve, join } from 'path'
import { walkDirectory, groupBySize, hashFile, groupByHash } from '../handlers/scan'
import type { FileEntry } from '../../../shared/ipc-types'

const FIXTURES_DIR = resolve(__dirname, 'fixtures')

// ─────────────────────────────────────────────────────────────
// walkDirectory
// ─────────────────────────────────────────────────────────────
describe('walkDirectory', () => {
  it('returns FileEntry[] with path, size, mtime, name for all files recursively', async () => {
    const signal = new AbortController().signal
    const entries: FileEntry[] = []
    const result = await walkDirectory(FIXTURES_DIR, signal, (entry) => entries.push(entry))

    // Should find at least 4 fixture files (file-a, file-b, file-c, subdir/file-d)
    expect(result.length).toBeGreaterThanOrEqual(4)

    const fileA = result.find((e) => e.name === 'file-a.txt')
    expect(fileA).toBeDefined()
    expect(fileA!.path).toContain('file-a.txt')
    expect(typeof fileA!.size).toBe('number')
    expect(fileA!.size).toBeGreaterThan(0)
    expect(typeof fileA!.mtime).toBe('number')
    expect(fileA!.mtime).toBeGreaterThan(0)
    expect(fileA!.name).toBe('file-a.txt')

    // Verify subdirectory file is included
    const fileD = result.find((e) => e.name === 'file-d.txt')
    expect(fileD).toBeDefined()

    // onFile callbacks should match result length
    expect(entries.length).toBe(result.length)
  })

  it('aborts cleanly when signal is aborted', async () => {
    const controller = new AbortController()
    // Abort immediately before walk starts
    controller.abort()
    const onFile = vi.fn()

    await expect(
      walkDirectory(FIXTURES_DIR, controller.signal, onFile)
    ).rejects.toMatchObject({ name: 'AbortError' })

    // onFile should not be called after abort
    expect(onFile).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// groupBySize
// ─────────────────────────────────────────────────────────────
describe('groupBySize', () => {
  it('returns empty Map for empty input', () => {
    const result = groupBySize([])
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('groups files by size and discards singletons', () => {
    const makeEntry = (name: string, size: number): FileEntry => ({
      path: `/test/${name}`,
      size,
      mtime: Date.now(),
      name
    })

    const files = [
      makeEntry('a.txt', 100),
      makeEntry('b.txt', 200),
      makeEntry('c.txt', 100),
      makeEntry('d.txt', 300),
      makeEntry('e.txt', 200)
    ]

    const result = groupBySize(files)

    // size 300 has only one file — should be filtered out
    expect(result.has(300)).toBe(false)
    // size 100 and 200 each have 2+ files
    expect(result.has(100)).toBe(true)
    expect(result.has(200)).toBe(true)
    expect(result.get(100)!.length).toBe(2)
    expect(result.get(200)!.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────
// hashFile
// ─────────────────────────────────────────────────────────────
describe('hashFile', () => {
  it('returns identical SHA-256 hash for two files with identical content', async () => {
    const hashA = await hashFile(join(FIXTURES_DIR, 'file-a.txt'))
    const hashB = await hashFile(join(FIXTURES_DIR, 'file-b.txt'))
    expect(hashA).toBe(hashB)
    expect(typeof hashA).toBe('string')
    expect(hashA!.length).toBe(64) // SHA-256 hex = 64 chars
  })

  it('returns different hashes for files with different content', async () => {
    const hashA = await hashFile(join(FIXTURES_DIR, 'file-a.txt'))
    const hashC = await hashFile(join(FIXTURES_DIR, 'file-c.txt'))
    expect(hashA).not.toBe(hashC)
  })

  it('returns null for a non-existent file (error handling)', async () => {
    const result = await hashFile(join(FIXTURES_DIR, 'does-not-exist.txt'))
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// groupByHash / totalWastedBytes
// ─────────────────────────────────────────────────────────────
describe('groupByHash', () => {
  it('produces DuplicateGroup[] with correct totalWastedBytes = size * (count - 1)', async () => {
    // file-a and file-b have identical content, file-c is different
    const fileSize = 12 // "hello world\n" is 12 bytes on Unix

    const entries: FileEntry[] = [
      { path: join(FIXTURES_DIR, 'file-a.txt'), size: fileSize, mtime: Date.now(), name: 'file-a.txt' },
      { path: join(FIXTURES_DIR, 'file-b.txt'), size: fileSize, mtime: Date.now(), name: 'file-b.txt' },
      { path: join(FIXTURES_DIR, 'file-c.txt'), size: 23, mtime: Date.now(), name: 'file-c.txt' }
    ]

    const signal = new AbortController().signal
    const groups = await groupByHash(entries, signal, vi.fn())

    // Only file-a and file-b should form a duplicate group
    expect(groups.length).toBe(1)
    expect(groups[0].files.length).toBe(2)
    // totalWastedBytes = size * (2 - 1)
    expect(groups[0].totalWastedBytes).toBe(fileSize * 1)
    expect(typeof groups[0].hash).toBe('string')
    expect(groups[0].hash.length).toBe(64)
  })

  it('returns empty array when no duplicates found', async () => {
    const entries: FileEntry[] = [
      { path: join(FIXTURES_DIR, 'file-a.txt'), size: 12, mtime: Date.now(), name: 'file-a.txt' },
      { path: join(FIXTURES_DIR, 'file-c.txt'), size: 23, mtime: Date.now(), name: 'file-c.txt' }
    ]
    const signal = new AbortController().signal
    const groups = await groupByHash(entries, signal, vi.fn())
    expect(groups.length).toBe(0)
  })
})
