import { Router } from 'express'
import { join } from 'path'
import type { ApiContext } from '../server'
import type { DashboardStats, UsageEntry } from '@shared/types'
import { listStaffIds, getStaffDir } from '../../data/staff-data'
import { readJsonl, countJsonlLines } from '../../data/jsonl-reader'

export function systemRoutes(ctx: ApiContext): Router {
  const router = Router()

  // System resources
  router.get('/resources', async (_req, res) => {
    try {
      const resources = await ctx.monitoringEngine.getSystemResources()
      res.json(resources)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Dashboard stats summary
  router.get('/stats', (_req, res) => {
    try {
      const ids = listStaffIds()
      let activeCount = 0
      let errorCount = 0
      let totalCycles = 0
      let costToday = 0
      let costMonth = 0
      let tokensToday = 0
      let tokensMonth = 0

      for (const id of ids) {
        const status = ctx.staffManager.getStatus(id)
        if (status === 'running') activeCount++
        if (status === 'error') errorCount++

        const dir = getStaffDir(id)
        totalCycles += countJsonlLines(join(dir, 'cycles.jsonl'))

        const usage = readJsonl<UsageEntry>(join(dir, 'usage.jsonl'))
        const today = new Date().toISOString().slice(0, 10)
        const thisMonth = today.slice(0, 7)
        for (const entry of usage) {
          const entryTokens = (entry.input_tokens || 0) + (entry.output_tokens || 0)
          if (entry.date === today) {
            costToday += entry.cost_usd
            tokensToday += entryTokens
          }
          if (entry.date.startsWith(thisMonth)) {
            costMonth += entry.cost_usd
            tokensMonth += entryTokens
          }
        }
      }

      const stats: DashboardStats = {
        active_staffs: activeCount,
        total_staffs: ids.length,
        error_staffs: errorCount,
        cost_today: Math.round(costToday * 100) / 100,
        cost_today_trend: null,
        cost_month: Math.round(costMonth * 100) / 100,
        cost_month_trend: null,
        total_cycles: totalCycles,
        cycles_trend: null,
        tokens_today: tokensToday,
        tokens_month: tokensMonth
      }

      res.json(stats)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Ngrok status
  router.get('/ngrok', (_req, res) => {
    try {
      const ngrok = ctx.ngrokManager
      if (!ngrok) {
        return res.json({ ngrok_status: 'not_configured', ngrok_url: null })
      }
      res.json({
        ngrok_status: ngrok.isActive() ? 'connected' : ngrok.getError() ? 'error' : 'disconnected',
        ngrok_url: ngrok.getUrl(),
        ngrok_error: ngrok.getError()
      })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
