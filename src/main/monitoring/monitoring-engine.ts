import { join } from 'path'
import type { StaffManager } from '../staff-manager/staff-manager'
import type { ConfigStore } from '../store/config-store'
import type { SystemResources, UsageEntry } from '@shared/types'
import { PRICING } from '@shared/constants'
import { parseTokensFromOutput, calculateCostFromTokens } from './token-parser'
import { getStaffDir, listStaffIds } from '../data/staff-data'
import { appendJsonl, readJsonl } from '../data/jsonl-reader'

export class MonitoringEngine {
  private interval: ReturnType<typeof setInterval> | null = null
  private staffManager: StaffManager
  private configStore: ConfigStore | null = null
  private logHandler: ((staffId: string, data: string) => void) | null = null
  private budgetWarningEmitted = false
  private budgetWarningMonth: string | null = null
  private prevCpuTimes: { idle: number; total: number }[] | null = null

  constructor(staffManager: StaffManager, configStore?: ConfigStore) {
    this.staffManager = staffManager
    this.configStore = configStore ?? null
  }

  start(): void {
    // Guard against double-start adding duplicate listeners
    if (this.interval) return

    this.interval = setInterval(() => {
      this.collectMetrics().catch(() => {})
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
    const cpus: { times: { user: number; nice: number; sys: number; idle: number } }[] = os.cpus()

    // Calculate CPU percent using delta from previous sample
    const currentTimes = cpus.map((cpu) => {
      const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle
      return { idle: cpu.times.idle, total }
    })

    let cpuPercent = 0
    if (this.prevCpuTimes && this.prevCpuTimes.length === currentTimes.length) {
      let totalDelta = 0
      let idleDelta = 0
      for (let i = 0; i < currentTimes.length; i++) {
        totalDelta += currentTimes[i].total - this.prevCpuTimes[i].total
        idleDelta += currentTimes[i].idle - this.prevCpuTimes[i].idle
      }
      cpuPercent = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0
    }
    this.prevCpuTimes = currentTimes

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

    // Check budget after recording new usage
    this.checkBudgetWarning()
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

    // Check budget periodically
    this.checkBudgetWarning()
  }

  private checkBudgetWarning(): void {
    if (!this.configStore) return

    const budgetLimit = this.configStore.get('monthly_budget_usd') as number
    if (!budgetLimit || budgetLimit <= 0) return

    const warningPercent = (this.configStore.get('budget_warning_percent') as number) || 80
    const warningThreshold = budgetLimit * (warningPercent / 100)

    // Calculate total monthly cost across all staff
    const thisMonth = new Date().toISOString().slice(0, 7)
    let monthCost = 0
    for (const id of listStaffIds()) {
      const dir = getStaffDir(id)
      const usage = readJsonl<UsageEntry>(join(dir, 'usage.jsonl'))
      for (const entry of usage) {
        if (entry.date.startsWith(thisMonth)) {
          monthCost += entry.cost_usd
        }
      }
    }

    // Reset warning flag at the start of each new month
    if (this.budgetWarningMonth !== thisMonth) {
      this.budgetWarningEmitted = false
      this.budgetWarningMonth = thisMonth
    }

    // Emit warning only once per threshold crossing per month
    if (monthCost >= warningThreshold && !this.budgetWarningEmitted) {
      this.budgetWarningEmitted = true
      this.staffManager.emit('budget:warning', {
        monthly_cost: Math.round(monthCost * 100) / 100,
        budget_limit: budgetLimit,
        warning_percent: warningPercent
      })
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
