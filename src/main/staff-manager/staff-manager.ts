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
  createClaudeSettings,
  createStaffMcpConfig
} from '../data/staff-data'
import { readJsonl, appendJsonl, writeJsonl } from '../data/jsonl-reader'
import { ensureBuiltinSkill, parseSkillMd, extractRequiredEnvVars } from '../data/skill-data'
import { IDLE_TIMEOUT_MS, KEEP_GOING_PROMPT, INITIAL_PROMPT, MAX_CONSECUTIVE_FAILURES, FAILURE_WINDOW_MS, BACKOFF_DELAYS_MS } from '@shared/constants'
import type { ConfigStore } from '../store/config-store'
import { hasChildProcesses } from './process-utils'

interface RunningStaff {
  config: StaffConfig
  process: AgentProcess
  processPid: number
  generation: number
  lastOutputAt: number
  idleTimer: ReturnType<typeof setInterval> | null
  promptTimer: ReturnType<typeof setTimeout> | null
  logStream: (data: string) => void
  watchers: ReturnType<typeof watch>[]
}

export class StaffManager extends EventEmitter {
  private running: Map<string, RunningStaff> = new Map()
  private starting: Set<string> = new Set()
  private intentionalStops: Set<string> = new Set()
  private paused: Set<string> = new Set()
  private failureHistory: Map<string, number[]> = new Map()
  private generationCounter: Map<string, number> = new Map()
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
    if (this.paused.has(staffId)) return 'paused'
    const r = this.running.get(staffId)
    if (!r) return 'stopped'
    return 'running'
  }

  async startStaff(staffId: string): Promise<void> {
    if (this.running.has(staffId)) return
    if (this.starting.has(staffId)) return
    this.starting.add(staffId)

    // Clear paused state when explicitly starting
    this.paused.delete(staffId)

    // Increment generation counter for this staff to invalidate old exit callbacks
    const prevGen = this.generationCounter.get(staffId) || 0
    const generation = prevGen + 1
    this.generationCounter.set(staffId, generation)

    const entry: RunningStaff = {
      config: null!,
      process: null!,
      processPid: 0,
      generation,
      lastOutputAt: 0,
      idleTimer: null,
      promptTimer: null,
      logStream: () => {},
      watchers: []
    }

    try {
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
    createStaffMcpConfig(staffId)

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
    entry.config = config
    entry.process = proc
    entry.processPid = proc.pid
    entry.lastOutputAt = now

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
    } catch (err) { console.warn('Log rotation failed:', err) }

    // Capture output + persist session ID once extracted
    let sessionIdPersisted = !!proc.sessionId
    entry.logStream = (data: string) => {
      entry.lastOutputAt = Date.now()
      try { appendFileSync(logPath, data) } catch { /* ignore */ }
      this.emit('staff:log', staffId, data)

      // Persist session ID once the driver extracts it from output
      if (!sessionIdPersisted && proc.sessionId) {
        sessionIdPersisted = true
        writeStaffState(staffId, {
          session_id: proc.sessionId,
          last_started_at: new Date().toISOString()
        })
      }
    }
    proc.onData(entry.logStream)

    // Handle exit - capture generation to guard against stale callbacks from old processes
    const expectedGeneration = generation
    proc.onExit((code) => {
      this.handleExit(staffId, code, entry.processPid, expectedGeneration)
    })

    // Idle detection
    entry.idleTimer = setInterval(() => {
      this.checkIdle(staffId).catch((err) => {
        console.warn(`Idle check failed for ${staffId}:`, err)
      })
    }, 30_000)

    // Watch JSONL files
    this.setupFileWatchers(staffId, entry)

    this.running.set(staffId, entry)
    this.starting.delete(staffId)

    // Clear paused flag in persisted state
    writeStaffState(staffId, {
      session_id: proc.sessionId || state.session_id,
      last_started_at: new Date().toISOString(),
      paused: false
    })

    // Send initial prompt if new session
    if (!state.session_id) {
      entry.promptTimer = setTimeout(() => {
        entry.promptTimer = null
        if (this.running.has(staffId)) {
          proc.write(INITIAL_PROMPT)
        }
      }, 3000)
    }

    this.emit('staff:status', staffId, 'running')
    } catch (err) {
      // Clean up watchers created before failure
      for (const w of entry.watchers) w.close()
      this.starting.delete(staffId)
      throw err
    }
  }

  async stopStaff(staffId: string): Promise<void> {
    const entry = this.running.get(staffId)
    if (!entry) return

    this.intentionalStops.add(staffId)
    this.paused.delete(staffId)

    // Write stopped state BEFORE killing to prevent recovery race on crash
    const state = readStaffState(staffId)
    writeStaffState(staffId, { ...state, last_started_at: null, paused: false })

    if (entry.idleTimer) clearInterval(entry.idleTimer)
    if (entry.promptTimer) clearTimeout(entry.promptTimer)
    for (const w of entry.watchers) w.close()

    await entry.process.kill()
    entry.process.dispose()
    this.running.delete(staffId)
    this.failureHistory.delete(staffId)

    this.emit('staff:status', staffId, 'stopped')
  }

  async pauseStaff(staffId: string): Promise<void> {
    const entry = this.running.get(staffId)
    if (!entry) return

    this.intentionalStops.add(staffId)
    this.paused.add(staffId)

    // Write paused state BEFORE killing to prevent recovery race on crash
    const state = readStaffState(staffId)
    writeStaffState(staffId, { ...state, last_started_at: null, paused: true })

    if (entry.idleTimer) clearInterval(entry.idleTimer)
    if (entry.promptTimer) clearTimeout(entry.promptTimer)
    for (const w of entry.watchers) w.close()

    await entry.process.kill()
    entry.process.dispose()
    this.running.delete(staffId)
    this.failureHistory.delete(staffId)

    this.emit('staff:status', staffId, 'paused')
  }

  async resumeStaff(staffId: string): Promise<void> {
    this.paused.delete(staffId)
    const state = readStaffState(staffId)
    writeStaffState(staffId, { ...state, paused: false })

    // Truncate signals.jsonl so old giveup signals don't trigger immediate re-pause
    const signalsPath = join(getStaffDir(staffId), 'signals.jsonl')
    writeJsonl(signalsPath, [{ type: 'resumed', timestamp: new Date().toISOString() }])

    await this.startStaff(staffId)
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
      // Don't auto-recover paused staff
      if (state.paused) {
        this.paused.add(id)
        continue
      }
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
    // Re-symlink skills so they're ready when staff starts
    ensureStaffDir(config.id)
    const allSkills = [...new Set(['openstaff', ...config.skills])]
    symlinkSkills(config.id, allSkills)
  }

  deleteStaffData(staffId: string): void {
    deleteStaffDir(staffId)
  }

  getStaffConfig(staffId: string): StaffConfig | null {
    return readStaffConfig(staffId)
  }

  getProcessPid(staffId: string): number | null {
    const entry = this.running.get(staffId)
    return entry ? entry.process.pid : null
  }

  getLastOutputAt(staffId: string): number | null {
    const entry = this.running.get(staffId)
    return entry ? entry.lastOutputAt : null
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

  private handleExit(staffId: string, code: number, exitedPid: number, exitedGeneration: number): void {
    // Don't auto-restart if this was an intentional stop
    if (this.intentionalStops.has(staffId)) {
      this.intentionalStops.delete(staffId)
      return
    }

    const entry = this.running.get(staffId)
    if (!entry) return

    // Guard: ignore stale exit callbacks from old processes after restart
    // Use generation counter (not just PID) to handle PID reuse edge cases
    if (entry.generation !== exitedGeneration || entry.processPid !== exitedPid) return

    if (entry.idleTimer) clearInterval(entry.idleTimer)
    if (entry.promptTimer) clearTimeout(entry.promptTimer)
    for (const w of entry.watchers) w.close()
    entry.process.dispose()
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

    // Auto-recovery with backoff (tracked at class level so it persists across restarts)
    const failures = this.failureHistory.get(staffId) || []
    failures.push(Date.now())
    // Prune old failures to prevent unbounded growth
    const recentFailures = failures.filter(
      (t) => Date.now() - t < FAILURE_WINDOW_MS
    )
    this.failureHistory.set(staffId, recentFailures)

    if (recentFailures.length >= MAX_CONSECUTIVE_FAILURES) {
      this.emit('staff:status', staffId, 'error')
      this.emit('staff:stopped_backoff', staffId)
      return
    }

    const backoffIdx = Math.min(
      Math.max(recentFailures.length - 1, 0),
      Math.max(BACKOFF_DELAYS_MS.length - 1, 0)
    )
    const delay = BACKOFF_DELAYS_MS[backoffIdx] ?? 30_000

    setTimeout(() => {
      this.startStaff(staffId).catch((err) => {
        console.error(`Failed to restart staff ${staffId}:`, err)
        this.emit('staff:status', staffId, 'error')
      })
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
      // PRD: Giveup pauses the staff and alerts the user
      this.pauseStaff(staffId).catch((err) => {
        console.error(`Failed to pause staff ${staffId} on giveup:`, err)
      })
      this.emit('staff:giveup', staffId)
    }
  }
}
