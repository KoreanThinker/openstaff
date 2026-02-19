import type { StaffManager } from '../staff-manager/staff-manager'
import type { SystemResources } from '@shared/types'
import { PRICING } from '@shared/constants'

export class MonitoringEngine {
  private interval: ReturnType<typeof setInterval> | null = null
  private staffManager: StaffManager

  constructor(staffManager: StaffManager) {
    this.staffManager = staffManager
  }

  start(): void {
    this.interval = setInterval(() => {
      this.collectMetrics()
    }, 60_000)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  async getSystemResources(): Promise<SystemResources> {
    const os = require('os')
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const cpus = os.cpus()
    const cpuPercent = cpus.reduce((acc: number, cpu: { times: { user: number; nice: number; sys: number; idle: number } }) => {
      const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle
      const used = total - cpu.times.idle
      return acc + (used / total) * 100
    }, 0) / cpus.length

    return {
      cpu_percent: Math.round(cpuPercent * 10) / 10,
      memory_percent: Math.round((usedMem / totalMem) * 1000) / 10,
      memory_used_mb: Math.round(usedMem / (1024 * 1024)),
      memory_total_mb: Math.round(totalMem / (1024 * 1024))
    }
  }

  private async collectMetrics(): Promise<void> {
    const runningIds = this.staffManager.getRunningStaffIds()

    for (const id of runningIds) {
      try {
        const config = this.staffManager.getStaffConfig(id)
        if (!config) continue

        // Usage is tracked by parsing Claude Code's output for token info
        // For now, we emit a metrics event for real-time display
        this.staffManager.emit('staff:metrics', id)
      } catch (err) {
        console.error(`Monitoring failed for ${id}:`, err)
      }
    }
  }

  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number,
    cacheWriteTokens: number
  ): number {
    const prices = PRICING[model]
    if (!prices) return 0

    return (
      (inputTokens / 1_000_000) * prices.input +
      (outputTokens / 1_000_000) * prices.output +
      (cacheReadTokens / 1_000_000) * prices.cache_read +
      (cacheWriteTokens / 1_000_000) * prices.cache_write
    )
  }
}
