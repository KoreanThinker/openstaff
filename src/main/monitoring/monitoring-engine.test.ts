import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MonitoringEngine } from './monitoring-engine'
import { EventEmitter } from 'events'

describe('MonitoringEngine', () => {
  function createMockStaffManager() {
    const emitter = new EventEmitter()
    return Object.assign(emitter, {
      getRunningStaffIds: () => [] as string[],
      getStaffConfig: () => null
    })
  }

  describe('calculateCost', () => {
    it('calculates cost for Sonnet 4.5', () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      const cost = engine.calculateCost(
        'claude-sonnet-4-5',
        1_000_000, // 1M input tokens
        500_000,   // 500K output tokens
        200_000,   // 200K cache reads
        100_000    // 100K cache writes
      )
      // (1M/1M * 3) + (500K/1M * 15) + (200K/1M * 0.3) + (100K/1M * 3.75)
      // = 3 + 7.5 + 0.06 + 0.375 = 10.935
      expect(cost).toBeCloseTo(10.935, 2)
    })

    it('calculates cost for Opus 4.6', () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      const cost = engine.calculateCost(
        'claude-opus-4-6',
        1_000_000, // 1M input
        100_000,   // 100K output
        0,         // 0 cache reads
        0          // 0 cache writes
      )
      // (1M/1M * 15) + (100K/1M * 75) = 15 + 7.5 = 22.5
      expect(cost).toBeCloseTo(22.5, 2)
    })

    it('returns 0 for unknown model', () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      expect(engine.calculateCost('unknown', 1000, 1000, 0, 0)).toBe(0)
    })
  })

  describe('getSystemResources', () => {
    it('returns CPU and memory metrics', async () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      const resources = await engine.getSystemResources()
      expect(resources.cpu_percent).toBeGreaterThanOrEqual(0)
      expect(resources.memory_percent).toBeGreaterThan(0)
      expect(resources.memory_used_mb).toBeGreaterThan(0)
      expect(resources.memory_total_mb).toBeGreaterThan(0)
    })
  })

  describe('start/stop', () => {
    it('starts and stops without error', () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      engine.start()
      engine.stop()
    })

    it('can stop when not started', () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      expect(() => engine.stop()).not.toThrow()
    })

    it('can stop multiple times', () => {
      const engine = new MonitoringEngine(createMockStaffManager() as never)
      engine.start()
      engine.stop()
      expect(() => engine.stop()).not.toThrow()
    })
  })

  describe('collectMetrics (via timer)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('calls collectMetrics at interval for running staffs', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => ['staff-1']
      manager.getStaffConfig = (id: string) => ({
        id,
        name: 'Test',
        role: 'Test',
        gather: 'g',
        execute: 'e',
        evaluate: 'ev',
        kpi: '',
        agent: 'claude-code',
        model: 'claude-sonnet-4-5',
        skills: [],
        created_at: new Date().toISOString()
      })
      const emitSpy = vi.spyOn(manager, 'emit')

      const engine = new MonitoringEngine(manager as never)
      engine.start()

      vi.advanceTimersByTime(61_000)

      expect(emitSpy).toHaveBeenCalledWith('staff:metrics', 'staff-1')

      engine.stop()
    })

    it('skips staffs with no config', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => ['nonexistent']
      manager.getStaffConfig = () => null
      const emitSpy = vi.spyOn(manager, 'emit')

      const engine = new MonitoringEngine(manager as never)
      engine.start()

      vi.advanceTimersByTime(61_000)

      expect(emitSpy).not.toHaveBeenCalledWith('staff:metrics', expect.anything())

      engine.stop()
    })

    it('handles errors in collectMetrics gracefully', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => ['staff-1']
      manager.getStaffConfig = () => { throw new Error('config error') }

      const engine = new MonitoringEngine(manager as never)
      engine.start()

      // Should not throw
      expect(() => vi.advanceTimersByTime(61_000)).not.toThrow()

      engine.stop()
    })
  })
})
