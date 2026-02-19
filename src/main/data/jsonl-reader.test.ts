import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readJsonl, appendJsonl, writeJsonl, countJsonlLines } from './jsonl-reader'

describe('jsonl-reader', () => {
  let tempDir: string
  let testFile: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openstaff-test-'))
    testFile = join(tempDir, 'test.jsonl')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('readJsonl', () => {
    it('returns empty array for non-existent file', () => {
      expect(readJsonl(testFile)).toEqual([])
    })

    it('reads entries from JSONL file', () => {
      const entries = [
        { cycle: 1, date: '2026-01-01' },
        { cycle: 2, date: '2026-01-02' }
      ]
      writeJsonl(testFile, entries)

      const result = readJsonl<{ cycle: number; date: string }>(testFile)
      expect(result).toEqual(entries)
    })

    it('handles empty file', () => {
      require('fs').writeFileSync(testFile, '')
      expect(readJsonl(testFile)).toEqual([])
    })

    it('handles file with only whitespace', () => {
      require('fs').writeFileSync(testFile, '  \n  \n  ')
      expect(readJsonl(testFile)).toEqual([])
    })
  })

  describe('appendJsonl', () => {
    it('creates file and appends entry', () => {
      appendJsonl(testFile, { cycle: 1 })
      const content = readFileSync(testFile, 'utf-8')
      expect(content).toBe('{"cycle":1}\n')
    })

    it('appends multiple entries', () => {
      appendJsonl(testFile, { cycle: 1 })
      appendJsonl(testFile, { cycle: 2 })
      const result = readJsonl<{ cycle: number }>(testFile)
      expect(result).toHaveLength(2)
      expect(result[0]!.cycle).toBe(1)
      expect(result[1]!.cycle).toBe(2)
    })
  })

  describe('writeJsonl', () => {
    it('writes entries overwriting existing content', () => {
      appendJsonl(testFile, { old: true })
      writeJsonl(testFile, [{ new: true }])
      const result = readJsonl<{ new: boolean }>(testFile)
      expect(result).toEqual([{ new: true }])
    })

    it('writes empty array', () => {
      writeJsonl(testFile, [])
      expect(readFileSync(testFile, 'utf-8')).toBe('')
    })
  })

  describe('countJsonlLines', () => {
    it('returns 0 for non-existent file', () => {
      expect(countJsonlLines(testFile)).toBe(0)
    })

    it('returns 0 for empty file', () => {
      require('fs').writeFileSync(testFile, '')
      expect(countJsonlLines(testFile)).toBe(0)
    })

    it('returns 0 for whitespace-only file', () => {
      require('fs').writeFileSync(testFile, '   \n   \n')
      expect(countJsonlLines(testFile)).toBe(0)
    })

    it('counts lines correctly', () => {
      appendJsonl(testFile, { a: 1 })
      appendJsonl(testFile, { b: 2 })
      appendJsonl(testFile, { c: 3 })
      expect(countJsonlLines(testFile)).toBe(3)
    })
  })
})
