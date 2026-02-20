import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MonitoringEngine } from './monitoring-engine'
import { EventEmitter } from 'events'
import { join } from 'path'
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'

let tempDir: string

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants')
  return {
    ...actual,
    get STAFFS_DIR() { return join(tempDir, 'staffs') },
    get OPENSTAFF_HOME() { return tempDir }
  }
})

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

  describe('token parsing from pty output', () => {
    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'openstaff-monitoring-'))
      mkdirSync(join(tempDir, 'staffs', 'staff-1'), { recursive: true })
    })

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('writes usage.jsonl when token info appears in pty output', () => {
      const manager = createMockStaffManager()
      manager.getStaffConfig = () => ({
        id: 'staff-1',
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

      const engine = new MonitoringEngine(manager as never)
      engine.start()

      // Simulate pty output with token info
      manager.emit('staff:log', 'staff-1', '{"input_tokens":1000,"output_tokens":500}')

      // Check that usage.jsonl was written
      const usagePath = join(tempDir, 'staffs', 'staff-1', 'usage.jsonl')
      const content = readFileSync(usagePath, 'utf-8')
      const entry = JSON.parse(content.trim())
      expect(entry.input_tokens).toBe(1000)
      expect(entry.output_tokens).toBe(500)
      expect(entry.cost_usd).toBeGreaterThan(0)

      engine.stop()
    })

    it('ignores pty output without token info', () => {
      const manager = createMockStaffManager()
      const engine = new MonitoringEngine(manager as never)
      engine.start()

      // This should not throw or create files
      manager.emit('staff:log', 'staff-1', 'hello world')

      engine.stop()
    })

    it('skips recording usage when staff config is null', () => {
      const manager = createMockStaffManager()
      // getStaffConfig returns null (default), so even with valid token data
      // parseAndRecordUsage should exit early at the config check
      const engine = new MonitoringEngine(manager as never)
      engine.start()

      // Send valid token JSON that will be parsed, but config is null
      manager.emit('staff:log', 'staff-1', '{"input_tokens":500,"output_tokens":200}')

      // Should not throw and no usage file should be created
      // (staff-1 dir doesn't exist and getStaffConfig returns null, so it exits before writing)
      engine.stop()
    })

    it('stops listening to events after stop()', () => {
      const manager = createMockStaffManager()
      manager.getStaffConfig = () => ({
        id: 'staff-1',
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

      const engine = new MonitoringEngine(manager as never)
      engine.start()
      engine.stop()

      // After stop, no listener should be active
      expect(manager.listenerCount('staff:log')).toBe(0)
    })
  })

  describe('budget warning', () => {
    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'openstaff-budget-'))
      mkdirSync(join(tempDir, 'staffs', 'staff-1'), { recursive: true })
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      rmSync(tempDir, { recursive: true, force: true })
    })

    function createMockConfigStore(values: Record<string, unknown>) {
      return {
        get: (key: string, def?: unknown) => values[key] ?? def,
        set: vi.fn(),
        delete: vi.fn()
      }
    }

    it('emits budget:warning when monthly cost exceeds threshold', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => ['staff-1']
      manager.getStaffConfig = () => ({
        id: 'staff-1', name: 'Test', role: 'Test', gather: 'g',
        execute: 'e', evaluate: 'ev', kpi: '', agent: 'claude-code',
        model: 'claude-sonnet-4-5', skills: [], created_at: new Date().toISOString()
      })

      const configStore = createMockConfigStore({
        monthly_budget_usd: 100,
        budget_warning_percent: 80
      })

      // Write usage.jsonl with cost exceeding 80% of $100 = $80
      const thisMonth = new Date().toISOString().slice(0, 10)
      const usagePath = join(tempDir, 'staffs', 'staff-1', 'usage.jsonl')
      writeFileSync(usagePath, JSON.stringify({
        date: thisMonth,
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        cost_usd: 85.0
      }) + '\n')

      const emitSpy = vi.spyOn(manager, 'emit')
      const engine = new MonitoringEngine(manager as never, configStore as never)
      engine.start()

      // Advance timer to trigger collectMetrics which calls checkBudgetWarning
      vi.advanceTimersByTime(61_000)

      expect(emitSpy).toHaveBeenCalledWith('budget:warning', {
        monthly_cost: 85.0,
        budget_limit: 100,
        warning_percent: 80
      })

      engine.stop()
    })

    it('emits budget:warning only once per threshold crossing', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => ['staff-1']
      manager.getStaffConfig = () => ({
        id: 'staff-1', name: 'Test', role: 'Test', gather: 'g',
        execute: 'e', evaluate: 'ev', kpi: '', agent: 'claude-code',
        model: 'claude-sonnet-4-5', skills: [], created_at: new Date().toISOString()
      })

      const configStore = createMockConfigStore({
        monthly_budget_usd: 100,
        budget_warning_percent: 80
      })

      const thisMonth = new Date().toISOString().slice(0, 10)
      const usagePath = join(tempDir, 'staffs', 'staff-1', 'usage.jsonl')
      writeFileSync(usagePath, JSON.stringify({
        date: thisMonth, input_tokens: 1000, output_tokens: 500,
        cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 90.0
      }) + '\n')

      const emitSpy = vi.spyOn(manager, 'emit')
      const engine = new MonitoringEngine(manager as never, configStore as never)
      engine.start()

      // First tick - should emit
      vi.advanceTimersByTime(61_000)
      // Second tick - should NOT emit again
      vi.advanceTimersByTime(60_000)

      const budgetCalls = emitSpy.mock.calls.filter(c => c[0] === 'budget:warning')
      expect(budgetCalls).toHaveLength(1)

      engine.stop()
    })

    it('does not emit when cost is below threshold', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => ['staff-1']
      manager.getStaffConfig = () => ({
        id: 'staff-1', name: 'Test', role: 'Test', gather: 'g',
        execute: 'e', evaluate: 'ev', kpi: '', agent: 'claude-code',
        model: 'claude-sonnet-4-5', skills: [], created_at: new Date().toISOString()
      })

      const configStore = createMockConfigStore({
        monthly_budget_usd: 100,
        budget_warning_percent: 80
      })

      const thisMonth = new Date().toISOString().slice(0, 10)
      const usagePath = join(tempDir, 'staffs', 'staff-1', 'usage.jsonl')
      writeFileSync(usagePath, JSON.stringify({
        date: thisMonth, input_tokens: 1000, output_tokens: 500,
        cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 50.0
      }) + '\n')

      const emitSpy = vi.spyOn(manager, 'emit')
      const engine = new MonitoringEngine(manager as never, configStore as never)
      engine.start()

      vi.advanceTimersByTime(61_000)

      const budgetCalls = emitSpy.mock.calls.filter(c => c[0] === 'budget:warning')
      expect(budgetCalls).toHaveLength(0)

      engine.stop()
    })

    it('does not emit when no budget is configured', () => {
      const manager = createMockStaffManager()
      manager.getRunningStaffIds = () => []

      const configStore = createMockConfigStore({})

      const emitSpy = vi.spyOn(manager, 'emit')
      const engine = new MonitoringEngine(manager as never, configStore as never)
      engine.start()

      vi.advanceTimersByTime(61_000)

      const budgetCalls = emitSpy.mock.calls.filter(c => c[0] === 'budget:warning')
      expect(budgetCalls).toHaveLength(0)

      engine.stop()
    })
  })
})
