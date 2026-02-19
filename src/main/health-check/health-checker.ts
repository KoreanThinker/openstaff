import { HEALTH_CHECK_INTERVAL_MS } from '@shared/constants'
import type { StaffManager } from '../staff-manager/staff-manager'

export class HealthChecker {
  private interval: ReturnType<typeof setInterval> | null = null
  private staffManager: StaffManager

  constructor(staffManager: StaffManager) {
    this.staffManager = staffManager
  }

  start(): void {
    this.interval = setInterval(() => {
      this.check()
    }, HEALTH_CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private check(): void {
    const runningIds = this.staffManager.getRunningStaffIds()
    for (const id of runningIds) {
      try {
        const isAlive = this.staffManager.isRunning(id)
        if (!isAlive) {
          this.staffManager.emit('staff:health_check_fail', id)
        }
      } catch (err) {
        console.error(`Health check failed for ${id}:`, err)
      }
    }
  }
}
