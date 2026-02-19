import { HEALTH_CHECK_INTERVAL_MS } from '@shared/constants'
import type { StaffManager } from '../staff-manager/staff-manager'
import { hasChildProcesses } from '../staff-manager/process-utils'

// Consider process unresponsive if no output for 10 minutes
const RESPONSIVE_TIMEOUT_MS = 10 * 60 * 1000

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

  private async check(): Promise<void> {
    const runningIds = this.staffManager.getRunningStaffIds()
    for (const id of runningIds) {
      try {
        // 1. Is the process still in our running map?
        if (!this.staffManager.isRunning(id)) {
          this.staffManager.emit('staff:health_check_fail', id)
          continue
        }

        // 2. Is the PID alive?
        const pid = this.staffManager.getProcessPid(id)
        if (pid) {
          try {
            process.kill(pid, 0) // signal 0 = test if process exists
          } catch {
            this.staffManager.emit('staff:health_check_fail', id)
            continue
          }
        }

        // 3. Is the process responsive? (recent output OR active child processes)
        const lastOutput = this.staffManager.getLastOutputAt(id)
        if (lastOutput && pid) {
          const elapsed = Date.now() - lastOutput
          if (elapsed > RESPONSIVE_TIMEOUT_MS) {
            const hasChildren = await hasChildProcesses(pid)
            if (!hasChildren) {
              this.staffManager.emit('staff:health_check_fail', id)
            }
          }
        }
      } catch (err) {
        console.error(`Health check failed for ${id}:`, err)
      }
    }
  }
}
