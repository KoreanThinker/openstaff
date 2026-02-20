import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import {
  calculateMemoryMetrics,
  parseMemAvailableBytes,
  readLinuxMemAvailableBytes
} from './memory-metrics'

describe('memory-metrics', () => {
  describe('parseMemAvailableBytes', () => {
    it('parses MemAvailable value from /proc/meminfo format', () => {
      const meminfo = `MemTotal:       32768000 kB
MemFree:         1024000 kB
MemAvailable:   12288000 kB
Buffers:          200000 kB
`
      expect(parseMemAvailableBytes(meminfo)).toBe(12_288_000 * 1024)
    })

    it('returns null when MemAvailable is missing', () => {
      const meminfo = `MemTotal:       32768000 kB
MemFree:         1024000 kB
`
      expect(parseMemAvailableBytes(meminfo)).toBeNull()
    })
  })

  describe('readLinuxMemAvailableBytes', () => {
    it('returns parsed value when meminfo file exists', () => {
      const dir = mkdtempSync(join(tmpdir(), 'openstaff-meminfo-'))
      const file = join(dir, 'meminfo')
      writeFileSync(file, 'MemAvailable:   2048 kB\n', 'utf-8')

      expect(readLinuxMemAvailableBytes(file)).toBe(2048 * 1024)

      rmSync(dir, { recursive: true, force: true })
    })

    it('returns null when file does not exist', () => {
      expect(readLinuxMemAvailableBytes('/nonexistent/meminfo')).toBeNull()
    })
  })

  describe('calculateMemoryMetrics', () => {
    const gb = 1024 * 1024 * 1024

    it('prefers MemAvailable when provided', () => {
      const metrics = calculateMemoryMetrics(
        32 * gb,
        2 * gb,
        12 * gb
      )

      expect(metrics.memory_used_mb).toBeCloseTo(20 * 1024, 0)
      expect(metrics.memory_total_mb).toBeCloseTo(32 * 1024, 0)
      expect(metrics.memory_percent).toBeCloseTo(62.5, 1)
    })

    it('falls back to free memory when MemAvailable is null', () => {
      const metrics = calculateMemoryMetrics(
        32 * gb,
        8 * gb,
        null
      )

      expect(metrics.memory_used_mb).toBeCloseTo(24 * 1024, 0)
      expect(metrics.memory_percent).toBeCloseTo(75, 1)
    })

    it('bounds invalid available values', () => {
      const metrics = calculateMemoryMetrics(
        8 * gb,
        2 * gb,
        20 * gb
      )

      expect(metrics.memory_used_mb).toBe(0)
      expect(metrics.memory_percent).toBe(0)
    })

    it('returns zeros for invalid total memory', () => {
      const metrics = calculateMemoryMetrics(0, 100, 100)
      expect(metrics).toEqual({
        memory_percent: 0,
        memory_used_mb: 0,
        memory_total_mb: 0
      })
    })
  })
})
