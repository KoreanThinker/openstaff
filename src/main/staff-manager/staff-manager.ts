import { EventEmitter } from 'events'
import { join } from 'path'
import { appendFileSync, existsSync, statSync, unlinkSync } from 'fs'
import { watch } from 'fs'
import type { AgentProcess, StaffConfig, StaffStatus, ErrorEntry } from '@shared/types'
import { getDriver } from '../agent-driver/agent-registry'
import {
  readStaffConfig,
  writeStaffConfig,
  readStaffState,
  writeStaffState,
  deleteStaffDir,
  listStaffIds,
  getStaffDir,
  ensureStaffDir,
  ensureMemoryMd,
  symlinkSkills,
  createClaudeSettings
} from '../data/staff-data'
import { readJsonl, appendJsonl } from '../data/jsonl-reader'
import { ensureBuiltinSkill, parseSkillMd, extractRequiredEnvVars } from '../data/skill-data'
import { IDLE_TIMEOUT_MS, KEEP_GOING_PROMPT, INITIAL_PROMPT, MAX_CONSECUTIVE_FAILURES, FAILURE_WINDOW_MS, BACKOFF_DELAYS_MS } from '@shared/constants'
import type { ConfigStore } from '../store/config-store'
import { hasChildProcesses } from './process-utils'

interface RunningStaff {
  config: StaffConfig
  process: AgentProcess
  lastOutputAt: number
  idleTimer: ReturnType<typeof setInterval> | null
  logStream: (data: string) => void
  watchers: ReturnType<typeof watch>[]
  failures: number[]
}

export class StaffManager extends EventEmitter {
  private running: Map<string, RunningStaff> = new Map()
  private configStore: ConfigStore

  constructor(configStore: ConfigStore) {
    super()
    this.configStore = configStore
  }

  getRunningStaffIds(): string[] {
    return Array.from(this.running.keys())
  }

  isRunning(staffId: string): boolean {
    return this.running.has(staffId)
  }

  getStatus(staffId: string): StaffStatus {
    const r = this.running.get(staffId)
    if (!r) return 'stopped'
    return 'running'
  }

  async startStaff(staffId: string): Promise<void> {
    if (this.running.has(staffId)) return

    const config = readStaffConfig(staffId)
    if (!config) throw new Error(`Staff ${staffId} not found`)

    const driver = getDriver(config.agent)
    if (!driver) throw new Error(`Agent driver ${config.agent} not found`)

    const installed = await driver.isInstalled()
    if (!installed) throw new Error(`Agent ${config.agent} is not installed`)

    const dir = ensureStaffDir(staffId)
    ensureMemoryMd(staffId)
    ensureBuiltinSkill()
    // Always include the built-in openstaff skill
    const allSkills = [...new Set(['openstaff', ...config.skills])]
    symlinkSkills(staffId, allSkills)
    createClaudeSettings(staffId)

    // Build env vars
    const env: Record<string, string> = {}
    const apiKey = this.configStore.get('anthropic_api_key')
    if (apiKey) env['ANTHROPIC_API_KEY'] = apiKey

    // Add skill env vars from configStore
    for (const skillName of config.skills) {
      const frontmatter = parseSkillMd(skillName)
      if (!frontmatter?.compatibility) continue
      const requiredVars = extractRequiredEnvVars(frontmatter.compatibility)
      for (const varName of requiredVars) {
        const val = this.configStore.get(`skill_env_${varName}` as never)
        if (val && val !== '') env[varName] = val as string
      }
    }

    const state = readStaffState(staffId)
    let proc: AgentProcess

    if (state.session_id) {
      try {
        proc = driver.resume({
          workingDir: dir,
          claudeMdPath: join(dir, 'CLAUDE.md'),
          env,
          sessionId: state.session_id,
          model: config.model
        })
      } catch {
        proc = driver.spawn({
          workingDir: dir,
          claudeMdPath: join(dir, 'CLAUDE.md'),
          env,
          model: config.model
        })
      }
    } else {
      proc = driver.spawn({
        workingDir: dir,
        claudeMdPath: join(dir, 'CLAUDE.md'),
        env,
        model: config.model
      })
    }

    const now = Date.now()
    const entry: RunningStaff = {
      config,
      process: proc,
      lastOutputAt: now,
      idleTimer: null,
      logStream: () => {},
      watchers: [],
      failures: []
    }

    // Rotate output.log if older than 30 days
    const logPath = join(dir, 'output.log')
    try {
      if (existsSync(logPath)) {
        const stat = statSync(logPath)
        const ageMs = Date.now() - stat.mtimeMs
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
        if (ageMs > thirtyDaysMs) {
          unlinkSync(logPath)
        }
      }
    } catch { /* ignore rotation errors */ }

    // Capture output
    entry.logStream = (data: string) => {
      entry.lastOutputAt = Date.now()
      try { appendFileSync(logPath, data) } catch { /* ignore */ }
      this.emit('staff:log', staffId, data)
    }
    proc.onData(entry.logStream)

    // Handle exit
    proc.onExit((code) => {
      this.handleExit(staffId, code)
    })

    // Idle detection
    entry.idleTimer = setInterval(() => {
      this.checkIdle(staffId)
    }, 30_000)

    // Watch JSONL files
    this.setupFileWatchers(staffId, entry)

    this.running.set(staffId, entry)

    // Update state
    writeStaffState(staffId, {
      session_id: proc.sessionId || state.session_id,
      last_started_at: new Date().toISOString()
    })

    // Send initial prompt if new session
    if (!state.session_id) {
      setTimeout(() => {
        proc.write(INITIAL_PROMPT)
      }, 3000)
    }

    this.emit('staff:status', staffId, 'running')
  }

  async stopStaff(staffId: string): Promise<void> {
    const entry = this.running.get(staffId)
    if (!entry) return

    if (entry.idleTimer) clearInterval(entry.idleTimer)
    for (const w of entry.watchers) w.close()

    await entry.process.kill()
    this.running.delete(staffId)
    this.emit('staff:status', staffId, 'stopped')
  }

  async restartStaff(staffId: string): Promise<void> {
    await this.stopStaff(staffId)
    await this.startStaff(staffId)
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.running.keys())
    await Promise.all(ids.map((id) => this.stopStaff(id)))
  }

  async recoverRunningStaffs(): Promise<void> {
    const ids = listStaffIds()
    for (const id of ids) {
      const state = readStaffState(id)
      if (state.last_started_at && state.session_id) {
        try {
          await this.startStaff(id)
        } catch (err) {
          console.error(`Failed to recover staff ${id}:`, err)
        }
      }
    }
  }

  createStaff(config: StaffConfig): void {
    writeStaffConfig(config)
    ensureMemoryMd(config.id)
  }

  updateStaff(config: StaffConfig): void {
    writeStaffConfig(config)
  }

  deleteStaffData(staffId: string): void {
    deleteStaffDir(staffId)
  }

  getStaffConfig(staffId: string): StaffConfig | null {
    return readStaffConfig(staffId)
  }

  private async checkIdle(staffId: string): Promise<void> {
    const entry = this.running.get(staffId)
    if (!entry) return

    const elapsed = Date.now() - entry.lastOutputAt
    if (elapsed >= IDLE_TIMEOUT_MS) {
      // PRD: Only send keep-going prompt if no pty output AND no child processes
      const hasChildren = await hasChildProcesses(entry.process.pid)
      if (hasChildren) return

      entry.process.write(KEEP_GOING_PROMPT)
      entry.lastOutputAt = Date.now()
      this.emit('staff:idle_nudge', staffId)
    }
  }

  private handleExit(staffId: string, code: number): void {
    const entry = this.running.get(staffId)
    if (!entry) return

    if (entry.idleTimer) clearInterval(entry.idleTimer)
    for (const w of entry.watchers) w.close()
    this.running.delete(staffId)

    // Log error
    const errorEntry: ErrorEntry = {
      timestamp: new Date().toISOString(),
      type: 'process_crash',
      message: `Process exited with code ${code}`
    }
    const errorsPath = join(getStaffDir(staffId), 'errors.jsonl')
    appendJsonl(errorsPath, errorEntry)

    this.emit('staff:error', staffId, errorEntry)

    // Auto-recovery with backoff
    entry.failures.push(Date.now())
    const recentFailures = entry.failures.filter(
      (t) => Date.now() - t < FAILURE_WINDOW_MS
    )

    if (recentFailures.length >= MAX_CONSECUTIVE_FAILURES) {
      this.emit('staff:status', staffId, 'error')
      this.emit('staff:stopped_backoff', staffId)
      return
    }

    const backoffIdx = Math.min(recentFailures.length - 1, BACKOFF_DELAYS_MS.length - 1)
    const delay = BACKOFF_DELAYS_MS[backoffIdx] || 30_000

    setTimeout(async () => {
      try {
        await this.startStaff(staffId)
      } catch (err) {
        console.error(`Failed to restart staff ${staffId}:`, err)
        this.emit('staff:status', staffId, 'error')
      }
    }, delay)
  }

  private setupFileWatchers(staffId: string, entry: RunningStaff): void {
    const dir = getStaffDir(staffId)
    const files = ['cycles.jsonl', 'kpi.jsonl', 'signals.jsonl', 'errors.jsonl']

    for (const file of files) {
      const path = join(dir, file)
      try {
        const watcher = watch(path, () => {
          this.emit(`staff:file_change`, staffId, file)
          if (file === 'signals.jsonl') {
            this.checkGiveupSignal(staffId)
          }
        })
        entry.watchers.push(watcher)
      } catch {
        // File might not exist yet
      }
    }
  }

  private checkGiveupSignal(staffId: string): void {
    const signalsPath = join(getStaffDir(staffId), 'signals.jsonl')
    const signals = readJsonl<{ type: string }>(signalsPath)
    const lastSignal = signals[signals.length - 1]
    if (lastSignal?.type === 'giveup') {
      this.stopStaff(staffId).catch(() => {})
      this.emit('staff:giveup', staffId)
    }
  }
}
