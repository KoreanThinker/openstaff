import { join } from 'path'
import type { StaffManager } from '../staff-manager/staff-manager'
import type { SystemResources, UsageEntry } from '@shared/types'
import { PRICING } from '@shared/constants'
import { parseTokensFromOutput, calculateCostFromTokens } from './token-parser'
import { getStaffDir } from '../data/staff-data'
import { appendJsonl } from '../data/jsonl-reader'

export class MonitoringEngine {
  private interval: ReturnType<typeof setInterval> | null = null
  private staffManager: StaffManager
  private logHandler: ((staffId: string, data: string) => void) | null = null

  constructor(staffManager: StaffManager) {
    this.staffManager = staffManager
  }

  start(): void {
    // Guard against double-start adding duplicate listeners
    if (this.interval) return

    this.interval = setInterval(() => {
      this.collectMetrics()
    }, 60_000)

    // Listen for pty output to parse token usage
    this.logHandler = (staffId: string, data: string) => {
      this.parseAndRecordUsage(staffId, data)
    }
    this.staffManager.on('staff:log', this.logHandler)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    if (this.logHandler) {
      this.staffManager.removeListener('staff:log', this.logHandler)
      this.logHandler = null
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
      memory_percent: Math.min(100, Math.round((usedMem / totalMem) * 1000) / 10),
      memory_used_mb: Math.round(usedMem / (1024 * 1024)),
      memory_total_mb: Math.round(totalMem / (1024 * 1024))
    }
  }

  private parseAndRecordUsage(staffId: string, data: string): void {
    const usage = parseTokensFromOutput(data)
    if (!usage) return

    const config = this.staffManager.getStaffConfig(staffId)
    if (!config) return

    const costUsd = calculateCostFromTokens(config.model, usage)
    const entry: UsageEntry = {
      date: new Date().toISOString().slice(0, 10),
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
      cache_write_tokens: usage.cache_write_tokens,
      cost_usd: Math.round(costUsd * 10000) / 10000
    }

    const dir = getStaffDir(staffId)
    appendJsonl(join(dir, 'usage.jsonl'), entry)
    this.staffManager.emit('staff:metrics', staffId)
  }

  private async collectMetrics(): Promise<void> {
    const runningIds = this.staffManager.getRunningStaffIds()

    for (const id of runningIds) {
      try {
        const config = this.staffManager.getStaffConfig(id)
        if (!config) continue

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
