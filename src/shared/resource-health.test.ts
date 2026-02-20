import { describe, expect, it } from 'vitest'
import { clampPercent, formatResourcePercent, getResourceHealth } from './resource-health'

describe('resource-health', () => {
  describe('clampPercent', () => {
    it('clamps invalid and out-of-range values', () => {
      expect(clampPercent(Number.NaN)).toBe(0)
      expect(clampPercent(-20)).toBe(0)
      expect(clampPercent(135)).toBe(100)
    })
  })

  describe('getResourceHealth', () => {
    it('returns normal below warning threshold', () => {
      expect(getResourceHealth(74.9)).toBe('normal')
    })

    it('returns warning between warning and critical thresholds', () => {
      expect(getResourceHealth(75)).toBe('warning')
      expect(getResourceHealth(89.9)).toBe('warning')
    })

    it('returns critical at and above critical threshold', () => {
      expect(getResourceHealth(90)).toBe('critical')
      expect(getResourceHealth(120)).toBe('critical')
    })
  })

  describe('formatResourcePercent', () => {
    it('keeps decimal for very low and very high percentages', () => {
      expect(formatResourcePercent(2.34)).toBe('2.3%')
      expect(formatResourcePercent(99.7)).toBe('99.7%')
    })

    it('uses whole number for regular ranges', () => {
      expect(formatResourcePercent(56.2)).toBe('56%')
    })

    it('uses clamped values when formatting', () => {
      expect(formatResourcePercent(140)).toBe('100.0%')
      expect(formatResourcePercent(-4)).toBe('0.0%')
    })
  })
})
