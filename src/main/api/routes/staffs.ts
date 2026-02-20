import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import type { ApiContext } from '../server'
import type { StaffConfig, StaffSummary, StaffDetail, CycleEntry, KpiEntry, ErrorEntry, UsageEntry } from '@shared/types'
import { readStaffConfig, readStaffState, listStaffIds, readMemoryMd, getStaffDir } from '../../data/staff-data'
import { readJsonl, countJsonlLines } from '../../data/jsonl-reader'
import { readFileSync, existsSync } from 'fs'

function sanitizeString(str: string, maxLength = 500): string {
  // Strip control characters, limit length
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, maxLength)
}

function validateStaffInput(body: Partial<StaffConfig>): string | null {
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return 'name must be a string'
    if (body.name.trim().length === 0) return 'name is required'
    if (body.name.length > 100) return 'name must be 100 characters or less'
  }
  if (body.skills !== undefined && !Array.isArray(body.skills)) {
    return 'skills must be an array'
  }
  return null
}

export function staffRoutes(ctx: ApiContext): Router {
  const router = Router()

  // List all staffs
  router.get('/', (_req, res) => {
    try {
      const ids = listStaffIds()
      const staffs: StaffSummary[] = ids.map((id) => {
        const config = readStaffConfig(id)
        if (!config) return null
        const state = readStaffState(id)
        const status = ctx.staffManager.getStatus(id)
        const dir = getStaffDir(id)
        const cycles = countJsonlLines(join(dir, 'cycles.jsonl'))
        const errors = readJsonl<ErrorEntry>(join(dir, 'errors.jsonl'))
        const restarts = errors.filter((e) => e.type === 'process_crash').length
        const kpiEntries = readJsonl<KpiEntry>(join(dir, 'kpi.jsonl'))
        const lastKpi = kpiEntries[kpiEntries.length - 1]
        const prevKpi = kpiEntries[kpiEntries.length - 2]

        const kpiSummary = lastKpi
          ? Object.entries(lastKpi.metrics).map(([name, value]) => ({
            name,
            value,
            trend: prevKpi?.metrics[name] != null && prevKpi.metrics[name] !== 0
              ? ((value - prevKpi.metrics[name]!) / Math.abs(prevKpi.metrics[name]!) * 100)
              : null
          }))
          : []

        const uptime = status === 'running' && state.last_started_at
          ? Date.now() - new Date(state.last_started_at).getTime()
          : null

        // Calculate today's token and cost from usage.jsonl
        const usage = readJsonl<UsageEntry>(join(dir, 'usage.jsonl'))
        const today = new Date().toISOString().slice(0, 10)
        let tokensToday = 0
        let costToday = 0
        for (const entry of usage) {
          if (entry.date === today) {
            tokensToday += entry.input_tokens + entry.output_tokens
            costToday += entry.cost_usd
          }
        }

        return {
          id,
          name: config.name,
          role: config.role,
          status,
          agent: config.agent,
          model: config.model,
          uptime,
          restarts,
          tokens_today: tokensToday,
          cost_today: Math.round(costToday * 100) / 100,
          cycles,
          kpi_summary: kpiSummary
        } satisfies StaffSummary
      }).filter(Boolean) as StaffSummary[]

      res.json(staffs)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get single staff
  router.get('/:id', (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })

      const state = readStaffState(req.params.id!)
      const status = ctx.staffManager.getStatus(req.params.id!)
      const dir = getStaffDir(req.params.id!)
      const cycleEntries = readJsonl<CycleEntry>(join(dir, 'cycles.jsonl'))
      const errors = readJsonl<ErrorEntry>(join(dir, 'errors.jsonl'))
      const kpiEntries = readJsonl<KpiEntry>(join(dir, 'kpi.jsonl'))
      const lastKpi = kpiEntries[kpiEntries.length - 1]
      const prevKpi = kpiEntries[kpiEntries.length - 2]

      const detail: StaffDetail = {
        ...config,
        status,
        state,
        uptime: status === 'running' && state.last_started_at
          ? Date.now() - new Date(state.last_started_at).getTime()
          : null,
        restarts: errors.filter((e) => e.type === 'process_crash').length,
        cycles: cycleEntries.length,
        latest_cycle: cycleEntries[cycleEntries.length - 1] || null,
        kpi_summary: lastKpi
          ? Object.entries(lastKpi.metrics).map(([name, value]) => ({
            name,
            value,
            trend: prevKpi?.metrics[name] != null && prevKpi.metrics[name] !== 0
              ? ((value - prevKpi.metrics[name]!) / Math.abs(prevKpi.metrics[name]!) * 100)
              : null
          }))
          : []
      }

      res.json(detail)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Create staff
  router.post('/', (req, res) => {
    try {
      const body = req.body as Partial<StaffConfig>
      const validationError = validateStaffInput(body)
      if (validationError) return res.status(400).json({ error: validationError })

      const config: StaffConfig = {
        id: uuidv4(),
        name: sanitizeString(body.name || '', 100),
        role: sanitizeString(body.role || '', 200),
        gather: sanitizeString(body.gather || '', 2000),
        execute: sanitizeString(body.execute || '', 2000),
        evaluate: sanitizeString(body.evaluate || '', 2000),
        kpi: sanitizeString(body.kpi || '', 1000),
        agent: body.agent || ctx.configStore.get('default_agent'),
        model: body.model || ctx.configStore.get('default_model'),
        skills: (body.skills || []).map((s) => sanitizeString(s, 100)),
        created_at: new Date().toISOString()
      }

      ctx.staffManager.createStaff(config)
      res.status(201).json(config)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Update staff
  router.put('/:id', async (req, res) => {
    try {
      const existing = readStaffConfig(req.params.id!)
      if (!existing) return res.status(404).json({ error: 'Staff not found' })

      const body = req.body as Partial<StaffConfig>
      const validationError = validateStaffInput(body)
      if (validationError) return res.status(400).json({ error: validationError })

      const updated: StaffConfig = {
        ...existing,
        ...body,
        id: existing.id,
        name: body.name !== undefined ? sanitizeString(body.name, 100) : existing.name,
        role: body.role !== undefined ? sanitizeString(body.role, 200) : existing.role,
        gather: body.gather !== undefined ? sanitizeString(body.gather, 2000) : existing.gather,
        execute: body.execute !== undefined ? sanitizeString(body.execute, 2000) : existing.execute,
        evaluate: body.evaluate !== undefined ? sanitizeString(body.evaluate, 2000) : existing.evaluate,
        kpi: body.kpi !== undefined ? sanitizeString(body.kpi, 1000) : existing.kpi,
        skills: body.skills !== undefined ? body.skills.map((s) => sanitizeString(s, 100)) : existing.skills,
        created_at: existing.created_at
      }
      ctx.staffManager.updateStaff(updated)

      // Restart if running so changes take effect immediately
      if (ctx.staffManager.isRunning(req.params.id!)) {
        await ctx.staffManager.restartStaff(req.params.id!)
      }

      res.json(updated)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Delete staff
  router.delete('/:id', async (req, res) => {
    try {
      if (ctx.staffManager.isRunning(req.params.id!)) {
        await ctx.staffManager.stopStaff(req.params.id!)
      }
      ctx.staffManager.deleteStaffData(req.params.id!)
      res.status(204).send()
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Start staff
  router.post('/:id/start', async (req, res) => {
    try {
      await ctx.staffManager.startStaff(req.params.id!)
      res.json({ status: 'running' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Stop staff
  router.post('/:id/stop', async (req, res) => {
    try {
      await ctx.staffManager.stopStaff(req.params.id!)
      res.json({ status: 'stopped' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Pause staff (giveup signal or manual)
  router.post('/:id/pause', async (req, res) => {
    try {
      await ctx.staffManager.pauseStaff(req.params.id!)
      res.json({ status: 'paused' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Resume paused staff
  router.post('/:id/resume', async (req, res) => {
    try {
      await ctx.staffManager.resumeStaff(req.params.id!)
      res.json({ status: 'running' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Restart staff
  router.post('/:id/restart', async (req, res) => {
    try {
      await ctx.staffManager.restartStaff(req.params.id!)
      res.json({ status: 'running' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get metrics (returns last 1000 by default, configurable via ?limit=N)
  router.get('/:id/metrics', (req, res) => {
    try {
      const dir = getStaffDir(req.params.id!)
      const usage = readJsonl<UsageEntry>(join(dir, 'usage.jsonl'))
      const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 10000)
      res.json(usage.slice(-limit))
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get KPI
  router.get('/:id/kpi', (req, res) => {
    try {
      const dir = getStaffDir(req.params.id!)
      const kpi = readJsonl<KpiEntry>(join(dir, 'kpi.jsonl'))
      res.json(kpi)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get memory
  router.get('/:id/memory', (req, res) => {
    try {
      const content = readMemoryMd(req.params.id!)
      res.json({ content })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get errors
  router.get('/:id/errors', (req, res) => {
    try {
      const dir = getStaffDir(req.params.id!)
      const errors = readJsonl<ErrorEntry>(join(dir, 'errors.jsonl'))
      res.json(errors.reverse())
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get cycles (returns last 1000 by default, configurable via ?limit=N)
  router.get('/:id/cycles', (req, res) => {
    try {
      const dir = getStaffDir(req.params.id!)
      const cycles = readJsonl<CycleEntry>(join(dir, 'cycles.jsonl'))
      const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 10000)
      res.json(cycles.slice(-limit))
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Export staff config
  router.get('/:id/export', (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })

      const exportData = {
        openstaff_version: '1.0.0',
        type: 'staff',
        name: config.name,
        role: config.role,
        gather: config.gather,
        execute: config.execute,
        evaluate: config.evaluate,
        kpi: config.kpi,
        required_skills: config.skills,
        recommended_agent: config.agent,
        recommended_model: config.model
      }
      res.json(exportData)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Import staff from exported config
  router.post('/import', (req, res) => {
    try {
      const body = req.body as {
        name?: string
        role?: string
        gather?: string
        execute?: string
        evaluate?: string
        kpi?: string
        required_skills?: string[]
        recommended_agent?: string
        recommended_model?: string
      }

      const config: StaffConfig = {
        id: uuidv4(),
        name: sanitizeString(body.name || '', 100),
        role: sanitizeString(body.role || '', 200),
        gather: sanitizeString(body.gather || '', 2000),
        execute: sanitizeString(body.execute || '', 2000),
        evaluate: sanitizeString(body.evaluate || '', 2000),
        kpi: sanitizeString(body.kpi || '', 1000),
        agent: body.recommended_agent || ctx.configStore.get('default_agent'),
        model: body.recommended_model || ctx.configStore.get('default_model'),
        skills: (body.required_skills || []).map((s) => sanitizeString(s, 100)),
        created_at: new Date().toISOString()
      }

      ctx.staffManager.createStaff(config)
      res.status(201).json(config)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get logs
  router.get('/:id/logs', (req, res) => {
    try {
      const dir = getStaffDir(req.params.id!)
      const logPath = join(dir, 'output.log')
      if (!existsSync(logPath)) return res.json({ lines: [] })
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').slice(-500)
      res.json({ lines })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
