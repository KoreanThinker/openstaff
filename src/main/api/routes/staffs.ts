import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { extname, join, relative, resolve, sep } from 'path'
import type { ApiContext } from '../server'
import type {
  StaffConfig,
  StaffSummary,
  StaffDetail,
  CycleEntry,
  KpiEntry,
  ErrorEntry,
  UsageEntry,
  StaffArtifact,
  StaffArtifactType
} from '@shared/types'
import { readStaffConfig, readStaffState, listStaffIds, readMemoryMd, getStaffDir } from '../../data/staff-data'
import { readJsonl, countJsonlLines } from '../../data/jsonl-reader'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'

function sanitizeString(str: string, maxLength = 500): string {
  // Strip control characters, limit length
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, maxLength)
}

function toMemoryPreview(staffId: string): string | null {
  try {
    const content = readMemoryMd(staffId)
    if (!content.trim()) return null

    // Parse only the tail to keep preview extraction cheap for large memory files.
    const tail = content.slice(-4000)
    const lines = tail
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const preview =
      [...lines].reverse().find((line) => !line.startsWith('#')) ??
      lines.at(-1) ??
      ''

    if (!preview) return null
    return sanitizeString(preview, 140)
  } catch {
    return null
  }
}

const ARTIFACT_IGNORE_FILES = new Set([
  'staff.json',
  'state.json',
  'memory.md',
  'output.log',
  'usage.jsonl',
  'cycles.jsonl',
  'kpi.jsonl',
  'errors.jsonl',
  'signals.jsonl',
  'staff-mcp.json'
])

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'])
const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.json',
  '.jsonl',
  '.csv',
  '.tsv',
  '.yml',
  '.yaml',
  '.log',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.xml'
])

function classifyArtifactType(fileName: string): StaffArtifactType {
  const ext = extname(fileName).toLowerCase()
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (TEXT_EXTENSIONS.has(ext)) return 'text'
  return 'other'
}

function isAllowedArtifactPath(staffDir: string, rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null
  if (rawPath.includes('\0')) return null

  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const absolute = resolve(staffDir, normalized)
  const rel = relative(staffDir, absolute)
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null
  return absolute
}

function listStaffArtifacts(staffId: string): StaffArtifact[] {
  const staffDir = getStaffDir(staffId)
  if (!existsSync(staffDir)) return []

  const artifacts: StaffArtifact[] = []
  const maxDepth = 3
  const maxItems = 300

  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || artifacts.length >= maxItems) return
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (ARTIFACT_IGNORE_FILES.has(entry.name)) continue

      const absolute = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(absolute, depth + 1)
        continue
      }
      if (!entry.isFile()) continue

      const relPath = relative(staffDir, absolute).split(sep).join('/')
      const stat = statSync(absolute)
      artifacts.push({
        path: relPath,
        name: entry.name,
        type: classifyArtifactType(entry.name),
        size_bytes: stat.size,
        modified_at: stat.mtime.toISOString()
      })
      if (artifacts.length >= maxItems) return
    }
  }

  walk(staffDir, 0)
  return artifacts.sort((a, b) => b.modified_at.localeCompare(a.modified_at))
}

function validateStringField(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required: boolean,
  disallowEmptyWhenProvided = false
): string | null {
  if (value === undefined) {
    if (required) return `${fieldName} is required`
    return null
  }
  if (typeof value !== 'string') return `${fieldName} must be a string`
  if (value.trim().length === 0 && (required || disallowEmptyWhenProvided)) return `${fieldName} is required`
  if (value.length > maxLength) return `${fieldName} must be ${maxLength} characters or less`
  return null
}

function validateStaffInput(body: Partial<StaffConfig>, opts: { requireName: boolean; requireCoreFields: boolean }): string | null {
  const required = opts.requireCoreFields
  const checks: Array<[keyof StaffConfig, number, boolean, boolean]> = [
    ['name', 100, opts.requireName, true],
    ['role', 200, required, true],
    ['gather', 2000, required, true],
    ['execute', 2000, required, true],
    ['evaluate', 2000, required, true],
    ['kpi', 1000, false, false],
    ['agent', 100, false, false],
    ['model', 150, false, false]
  ]

  for (const [field, maxLength, isRequired, disallowEmptyWhenProvided] of checks) {
    const error = validateStringField(body[field], field, maxLength, isRequired, disallowEmptyWhenProvided)
    if (error) return error
  }

  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills)) return 'skills must be an array'
    if (body.skills.some((s) => typeof s !== 'string')) return 'skills must contain only strings'
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
        const lastKpi = kpiEntries.at(-1)
        const prevKpi = kpiEntries.at(-2)

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
          memory_preview: toMemoryPreview(id),
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
      const lastKpi = kpiEntries.at(-1)
      const prevKpi = kpiEntries.at(-2)

      const detail: StaffDetail = {
        ...config,
        status,
        state,
        uptime: status === 'running' && state.last_started_at
          ? Date.now() - new Date(state.last_started_at).getTime()
          : null,
        restarts: errors.filter((e) => e.type === 'process_crash').length,
        cycles: cycleEntries.length,
        latest_cycle: cycleEntries.at(-1) ?? null,
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
      const validationError = validateStaffInput(body, { requireName: true, requireCoreFields: true })
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
      const validationError = validateStaffInput(body, { requireName: false, requireCoreFields: false })
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

  // List output artifacts under the staff workspace
  router.get('/:id/artifacts', (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })
      res.json(listStaffArtifacts(req.params.id!))
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Read text artifact preview
  router.get('/:id/artifacts/text', (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })

      const relativePath = String(req.query.path || '')
      const staffDir = getStaffDir(req.params.id!)
      const absolute = isAllowedArtifactPath(staffDir, relativePath)
      if (!absolute) return res.status(400).json({ error: 'Invalid artifact path' })
      if (!existsSync(absolute)) return res.status(404).json({ error: 'Artifact not found' })
      if (!statSync(absolute).isFile()) return res.status(400).json({ error: 'Artifact must be a file' })
      if (classifyArtifactType(absolute) !== 'text') {
        return res.status(400).json({ error: 'Artifact is not a text file' })
      }

      const raw = readFileSync(absolute, 'utf-8')
      const maxChars = 20_000
      const sliced = raw.slice(0, maxChars)
      res.json({
        content: sanitizeString(sliced, maxChars),
        truncated: raw.length > maxChars
      })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Stream artifact file content (for image/video preview)
  router.get('/:id/artifacts/file', (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })

      const relativePath = String(req.query.path || '')
      const staffDir = getStaffDir(req.params.id!)
      const absolute = isAllowedArtifactPath(staffDir, relativePath)
      if (!absolute) return res.status(400).json({ error: 'Invalid artifact path' })
      if (!existsSync(absolute)) return res.status(404).json({ error: 'Artifact not found' })
      if (!statSync(absolute).isFile()) return res.status(400).json({ error: 'Artifact must be a file' })

      res.sendFile(absolute)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Open artifact with the OS default handler (Finder/Explorer integration)
  router.post('/:id/artifacts/open', async (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })

      const relativePath = String((req.body as { path?: string } | undefined)?.path || '')
      const staffDir = getStaffDir(req.params.id!)
      const absolute = isAllowedArtifactPath(staffDir, relativePath)
      if (!absolute) return res.status(400).json({ error: 'Invalid artifact path' })
      if (!existsSync(absolute)) return res.status(404).json({ error: 'Artifact not found' })
      if (!statSync(absolute).isFile()) return res.status(400).json({ error: 'Artifact must be a file' })

      const { shell } = await import('electron')
      const result = await shell.openPath(absolute)
      if (result) return res.status(500).json({ error: result })
      res.json({ status: 'opened' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Reveal artifact in OS file manager (Finder/Explorer integration)
  router.post('/:id/artifacts/reveal', async (req, res) => {
    try {
      const config = readStaffConfig(req.params.id!)
      if (!config) return res.status(404).json({ error: 'Staff not found' })

      const relativePath = String((req.body as { path?: string } | undefined)?.path || '')
      const staffDir = getStaffDir(req.params.id!)
      const absolute = isAllowedArtifactPath(staffDir, relativePath)
      if (!absolute) return res.status(400).json({ error: 'Invalid artifact path' })
      if (!existsSync(absolute)) return res.status(404).json({ error: 'Artifact not found' })
      if (!statSync(absolute).isFile()) return res.status(400).json({ error: 'Artifact must be a file' })

      const { shell } = await import('electron')
      shell.showItemInFolder(absolute)
      res.json({ status: 'revealed' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get errors (returns last 50 by default, configurable via ?limit=N&offset=M)
  router.get('/:id/errors', (req, res) => {
    try {
      const dir = getStaffDir(req.params.id!)
      const errors = readJsonl<ErrorEntry>(join(dir, 'errors.jsonl'))
      const reversed = errors.reverse()
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 10000)
      const offset = Math.max(Number(req.query.offset) || 0, 0)
      const page = reversed.slice(offset, offset + limit)
      res.json({ items: page, total: reversed.length })
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

      const validationError = validateStaffInput({
        name: body.name,
        role: body.role,
        gather: body.gather,
        execute: body.execute,
        evaluate: body.evaluate,
        kpi: body.kpi,
        agent: body.recommended_agent,
        model: body.recommended_model
      }, { requireName: true, requireCoreFields: true })
      if (validationError) return res.status(400).json({ error: validationError })

      if (body.required_skills !== undefined && !Array.isArray(body.required_skills)) {
        return res.status(400).json({ error: 'required_skills must be an array' })
      }
      if (body.required_skills?.some((s) => typeof s !== 'string')) {
        return res.status(400).json({ error: 'required_skills must contain only strings' })
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
