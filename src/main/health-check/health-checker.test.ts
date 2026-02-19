import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HealthChecker } from './health-checker'
import { EventEmitter } from 'events'

vi.mock('../staff-manager/process-utils', () => ({
  hasChildProcesses: vi.fn(() => Promise.resolve(false))
}))

describe('HealthChecker', () => {
  function createMockStaffManager(opts?: {
    runningIds?: string[]
    isRunning?: boolean
    pid?: number | null
    lastOutputAt?: number | null
  }) {
    const emitter = new EventEmitter()
    return Object.assign(emitter, {
      getRunningStaffIds: vi.fn(() => opts?.runningIds ?? ['staff-1']),
      isRunning: vi.fn(() => opts?.isRunning ?? true),
      getProcessPid: vi.fn(() => opts?.pid ?? process.pid),
      getLastOutputAt: vi.fn(() => opts?.lastOutputAt ?? Date.now())
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts and stops without error', () => {
    const manager = createMockStaffManager()
    const checker = new HealthChecker(manager as never)
    checker.start()
    checker.stop()
  })

  it('can be stopped when not started', () => {
    const manager = createMockStaffManager()
    const checker = new HealthChecker(manager as never)
    expect(() => checker.stop()).not.toThrow()
  })

  it('checks health at interval', async () => {
    const manager = createMockStaffManager({ runningIds: ['staff-1'] })
    const checker = new HealthChecker(manager as never)
    checker.start()

    // Advance past the health check interval (60s)
    await vi.advanceTimersByTimeAsync(61_000)

    expect(manager.getRunningStaffIds).toHaveBeenCalled()
    expect(manager.isRunning).toHaveBeenCalledWith('staff-1')

    checker.stop()
  })

  it('emits health_check_fail when staff is not in running map', async () => {
    const manager = createMockStaffManager({ runningIds: ['staff-1'], isRunning: false })
    const emitSpy = vi.spyOn(manager, 'emit')
    const checker = new HealthChecker(manager as never)
    checker.start()

    await vi.advanceTimersByTimeAsync(61_000)

    expect(emitSpy).toHaveBeenCalledWith('staff:health_check_fail', 'staff-1')

    checker.stop()
  })

  it('handles multiple running staffs', async () => {
    const manager = createMockStaffManager({ runningIds: ['staff-1', 'staff-2', 'staff-3'] })
    const checker = new HealthChecker(manager as never)
    checker.start()

    await vi.advanceTimersByTimeAsync(61_000)

    expect(manager.isRunning).toHaveBeenCalledTimes(3)

    checker.stop()
  })

  it('handles errors in isRunning gracefully', async () => {
    const manager = createMockStaffManager()
    manager.isRunning = vi.fn(() => { throw new Error('test error') })
    const checker = new HealthChecker(manager as never)
    checker.start()

    // Should not throw
    await expect(vi.advanceTimersByTimeAsync(61_000)).resolves.not.toThrow()

    checker.stop()
  })

  it('emits health_check_fail when PID is dead', async () => {
    const manager = createMockStaffManager({
      runningIds: ['staff-1'],
      pid: 999999 // non-existent PID
    })
    const emitSpy = vi.spyOn(manager, 'emit')
    const checker = new HealthChecker(manager as never)
    checker.start()

    await vi.advanceTimersByTimeAsync(61_000)

    expect(emitSpy).toHaveBeenCalledWith('staff:health_check_fail', 'staff-1')

    checker.stop()
  })

  it('passes health check when process is alive with recent output', async () => {
    const manager = createMockStaffManager({
      runningIds: ['staff-1'],
      pid: process.pid,
      lastOutputAt: Date.now()
    })
    const emitSpy = vi.spyOn(manager, 'emit')
    const checker = new HealthChecker(manager as never)
    checker.start()

    await vi.advanceTimersByTimeAsync(61_000)

    expect(emitSpy).not.toHaveBeenCalledWith('staff:health_check_fail', 'staff-1')

    checker.stop()
  })

  it('emits health_check_fail when process has no output and no children', async () => {
    // Set lastOutputAt to 15 minutes ago (past the 10 minute threshold)
    const staleTime = Date.now() - 15 * 60 * 1000
    const manager = createMockStaffManager({
      runningIds: ['staff-1'],
      pid: process.pid,
      lastOutputAt: staleTime
    })
    const emitSpy = vi.spyOn(manager, 'emit')
    const checker = new HealthChecker(manager as never)
    checker.start()

    await vi.advanceTimersByTimeAsync(61_000)

    expect(emitSpy).toHaveBeenCalledWith('staff:health_check_fail', 'staff-1')

    checker.stop()
  })
})
