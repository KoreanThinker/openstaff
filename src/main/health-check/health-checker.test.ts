import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HealthChecker } from './health-checker'
import { EventEmitter } from 'events'

describe('HealthChecker', () => {
  function createMockStaffManager(opts?: { runningIds?: string[], isRunning?: boolean }) {
    const emitter = new EventEmitter()
    return Object.assign(emitter, {
      getRunningStaffIds: vi.fn(() => opts?.runningIds ?? ['staff-1']),
      isRunning: vi.fn(() => opts?.isRunning ?? true)
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

  it('checks health at interval', () => {
    const manager = createMockStaffManager({ runningIds: ['staff-1'] })
    const checker = new HealthChecker(manager as never)
    checker.start()

    // Advance past the health check interval (60s)
    vi.advanceTimersByTime(61_000)

    expect(manager.getRunningStaffIds).toHaveBeenCalled()
    expect(manager.isRunning).toHaveBeenCalledWith('staff-1')

    checker.stop()
  })

  it('emits health_check_fail when staff is not alive', () => {
    const manager = createMockStaffManager({ runningIds: ['staff-1'], isRunning: false })
    const emitSpy = vi.spyOn(manager, 'emit')
    const checker = new HealthChecker(manager as never)
    checker.start()

    vi.advanceTimersByTime(61_000)

    expect(emitSpy).toHaveBeenCalledWith('staff:health_check_fail', 'staff-1')

    checker.stop()
  })

  it('handles multiple running staffs', () => {
    const manager = createMockStaffManager({ runningIds: ['staff-1', 'staff-2', 'staff-3'] })
    const checker = new HealthChecker(manager as never)
    checker.start()

    vi.advanceTimersByTime(61_000)

    expect(manager.isRunning).toHaveBeenCalledTimes(3)

    checker.stop()
  })

  it('handles errors in isRunning gracefully', () => {
    const manager = createMockStaffManager()
    manager.isRunning = vi.fn(() => { throw new Error('test error') })
    const checker = new HealthChecker(manager as never)
    checker.start()

    // Should not throw
    expect(() => vi.advanceTimersByTime(61_000)).not.toThrow()

    checker.stop()
  })
})
