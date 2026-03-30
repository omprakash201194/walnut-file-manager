// @vitest-environment node
/**
 * Unit tests for src/main/handlers/scan.ts pure functions.
 * Tests walkDirectory, groupBySize, hashFile, and groupByHash.
 * IPC registration (registerScanHandlers) is integration-level and not tested here.
 *
 * Uses node environment because tests exercise Node.js fs/crypto APIs directly.
 */

import { describe, it, expect, vi } from 'vitest'
import { resolve, join } from 'path'
import { walkDirectory, groupBySize, hashFile, groupByHash, canonicalBasename, groupByCanonicalName } from '../handlers/scan'
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
      birthtime: Date.now(),
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
      { path: join(FIXTURES_DIR, 'file-a.txt'), size: fileSize, mtime: Date.now(), birthtime: Date.now(), name: 'file-a.txt' },
      { path: join(FIXTURES_DIR, 'file-b.txt'), size: fileSize, mtime: Date.now(), birthtime: Date.now(), name: 'file-b.txt' },
      { path: join(FIXTURES_DIR, 'file-c.txt'), size: 23, mtime: Date.now(), birthtime: Date.now(), name: 'file-c.txt' }
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
      { path: join(FIXTURES_DIR, 'file-a.txt'), size: 12, mtime: Date.now(), birthtime: Date.now(), name: 'file-a.txt' },
      { path: join(FIXTURES_DIR, 'file-c.txt'), size: 23, mtime: Date.now(), birthtime: Date.now(), name: 'file-c.txt' }
    ]
    const signal = new AbortController().signal
    const groups = await groupByHash(entries, signal, vi.fn())
    expect(groups.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// canonicalBasename
// ─────────────────────────────────────────────────────────────
describe('canonicalBasename', () => {
  it('returns the filename lowercased when no copy suffix is present', () => {
    expect(canonicalBasename('photo.jpg')).toBe('photo.jpg')
    expect(canonicalBasename('Document.pdf')).toBe('document.pdf')
  })

  it('strips "- Copy" suffix (case-insensitive)', () => {
    expect(canonicalBasename('photo - Copy.jpg')).toBe('photo.jpg')
    expect(canonicalBasename('photo - copy.jpg')).toBe('photo.jpg')
    expect(canonicalBasename('photo - COPY.jpg')).toBe('photo.jpg')
  })

  it('strips "- Copy (N)" numbered copy suffix', () => {
    expect(canonicalBasename('photo - Copy (1).jpg')).toBe('photo.jpg')
    expect(canonicalBasename('photo - Copy (2).jpg')).toBe('photo.jpg')
    expect(canonicalBasename('photo - copy (10).jpg')).toBe('photo.jpg')
  })

  it('strips trailing "(N)" numbered suffix', () => {
    expect(canonicalBasename('photo (1).jpg')).toBe('photo.jpg')
    expect(canonicalBasename('photo (2).jpg')).toBe('photo.jpg')
    expect(canonicalBasename('document (3).pdf')).toBe('document.pdf')
  })

  it('preserves the file extension', () => {
    expect(canonicalBasename('report - Copy.pdf')).toBe('report.pdf')
    expect(canonicalBasename('archive (1).zip')).toBe('archive.zip')
  })

  it('does not strip numbers that are part of the original filename', () => {
    // "notes2" should stay "notes2", not be stripped
    expect(canonicalBasename('notes2.txt')).toBe('notes2.txt')
  })
})

// ─────────────────────────────────────────────────────────────
// groupByCanonicalName
// ─────────────────────────────────────────────────────────────
describe('groupByCanonicalName', () => {
  const makeEntry = (name: string, size = 100): FileEntry => ({
    path: `/test/${name}`,
    size,
    mtime: Date.now(),
    birthtime: Date.now(),
    name
  })

  it('groups "photo.jpg" with "photo - Copy.jpg"', () => {
    const files = [makeEntry('photo.jpg'), makeEntry('photo - Copy.jpg')]
    const result = groupByCanonicalName(files)
    expect(result.size).toBe(1)
    const group = [...result.values()][0]
    expect(group.length).toBe(2)
    const names = group.map((f) => f.name)
    expect(names).toContain('photo.jpg')
    expect(names).toContain('photo - Copy.jpg')
  })

  it('groups "doc.pdf" with "doc (1).pdf" and "doc (2).pdf"', () => {
    const files = [makeEntry('doc.pdf'), makeEntry('doc (1).pdf'), makeEntry('doc (2).pdf')]
    const result = groupByCanonicalName(files)
    expect(result.size).toBe(1)
    const group = [...result.values()][0]
    expect(group.length).toBe(3)
  })

  it('does not group files with different canonical names', () => {
    const files = [makeEntry('photo.jpg'), makeEntry('vacation.jpg')]
    const result = groupByCanonicalName(files)
    // Both are singletons after canonical stripping — no groups returned
    expect(result.size).toBe(0)
  })

  it('returns empty Map for empty input', () => {
    const result = groupByCanonicalName([])
    expect(result.size).toBe(0)
  })

  it('groups files with different sizes (Windows copy size drift)', () => {
    // Simulate Windows copy where metadata changes slightly increase file size
    const files = [makeEntry('photo.jpg', 1000), makeEntry('photo - Copy.jpg', 1002)]
    const result = groupByCanonicalName(files)
    expect(result.size).toBe(1)
    const group = [...result.values()][0]
    expect(group.length).toBe(2)
  })

  it('matches case-insensitively across filenames', () => {
    const files = [makeEntry('Photo.jpg'), makeEntry('photo - Copy.jpg')]
    const result = groupByCanonicalName(files)
    expect(result.size).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────
// applyPreset birthtime tiebreaker
// ─────────────────────────────────────────────────────────────
describe('applyPreset birthtime tiebreaker', () => {
  // Inline sort logic mirrors appStore.applyPreset to verify the tiebreaker contract.
  // Both files have identical mtime — birthtime must determine the keeper.
  const now = Date.now()

  const makeFile = (name: string, mtime: number, birthtime: number): FileEntry => ({
    path: `/test/${name}`,
    size: 100,
    mtime,
    birthtime,
    name
  })

  function sortByPreset(files: FileEntry[], preset: 'newest' | 'oldest'): FileEntry[] {
    return [...files].sort((a, b) => {
      const mtimeDiff = preset === 'newest' ? b.mtime - a.mtime : a.mtime - b.mtime
      if (mtimeDiff !== 0) return mtimeDiff
      return preset === 'newest' ? b.birthtime - a.birthtime : a.birthtime - b.birthtime
    })
  }

  it('keeps the newer birthtime as keeper when mtime is equal (newest preset)', () => {
    const older = makeFile('original.txt', now, now - 5000) // created earlier
    const newer = makeFile('copy.txt',     now, now - 1000) // created later

    const sorted = sortByPreset([older, newer], 'newest')
    // sorted[0] is the keeper — should be newer (created later)
    expect(sorted[0].name).toBe('copy.txt')
    expect(sorted[1].name).toBe('original.txt')
  })

  it('keeps the older birthtime as keeper when mtime is equal (oldest preset)', () => {
    const older = makeFile('original.txt', now, now - 5000)
    const newer = makeFile('copy.txt',     now, now - 1000)

    const sorted = sortByPreset([older, newer], 'oldest')
    // sorted[0] is the keeper — should be older (created earlier)
    expect(sorted[0].name).toBe('original.txt')
    expect(sorted[1].name).toBe('copy.txt')
  })

  it('keeps newest and oldest consistently different when mtime equal', () => {
    const f1 = makeFile('a.txt', now, now - 3000)
    const f2 = makeFile('b.txt', now, now - 1000)

    const keeperNewest = sortByPreset([f1, f2], 'newest')[0]
    const keeperOldest = sortByPreset([f1, f2], 'oldest')[0]

    // The two presets should pick different keepers
    expect(keeperNewest.name).not.toBe(keeperOldest.name)
  })
})
