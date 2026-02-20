import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server } from 'http'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string
let server: Server
let port: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockManager: any

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants')
  return {
    ...actual,
    get STAFFS_DIR() { return join(tempDir, 'staffs') },
    get SKILLS_DIR() { return join(tempDir, 'skills') },
    get OPENSTAFF_HOME() { return tempDir }
  }
})

// Minimal mock for StaffManager (only the status/running checks)
function createMockStaffManager() {
  const { EventEmitter } = require('events')
  const emitter = new EventEmitter()
  return {
    ...emitter,
    getStatus: () => 'stopped' as const,
    isRunning: () => false,
    createStaff: vi.fn(),
    updateStaff: vi.fn(),
    deleteStaffData: vi.fn(),
    startStaff: vi.fn(),
    stopStaff: vi.fn(),
    restartStaff: vi.fn(),
    pauseStaff: vi.fn(),
    resumeStaff: vi.fn(),
    getStaffConfig: vi.fn(),
    emit: emitter.emit.bind(emitter),
    on: emitter.on.bind(emitter)
  }
}

function createMockConfigStore() {
  const store: Record<string, unknown> = {
    default_agent: 'claude-code',
    default_model: 'claude-sonnet-4-5'
  }
  return {
    get: (key: string) => store[key] ?? '',
    set: (key: string, value: unknown) => { store[key] = value },
    getAll: () => store,
    delete: (key: string) => { delete store[key] }
  }
}

const { staffRoutes } = await import('./staffs')

describe('staffs API routes', () => {
  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'openstaff-api-test-'))

    const app = express()
    app.use(express.json())

    mockManager = createMockStaffManager()
    const mockConfig = createMockConfigStore()

    // Make createStaff actually write config
    const { writeStaffConfig: writeConfig, ensureMemoryMd } = await import('../../data/staff-data')
    mockManager.createStaff = vi.fn((config) => {
      writeConfig(config)
      ensureMemoryMd(config.id)
    })
    mockManager.updateStaff = vi.fn((config) => writeConfig(config))
    const { deleteStaffDir } = await import('../../data/staff-data')
    mockManager.deleteStaffData = vi.fn((id) => {
      deleteStaffDir(id)
    })

    app.use('/api/staffs', staffRoutes({
      staffManager: mockManager as never,
      configStore: mockConfig as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    server = createServer(app)
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address()
        port = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    server.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  async function apiGet(path: string) {
    const res = await fetch(`http://localhost:${port}${path}`)
    return { status: res.status, data: await res.json() }
  }

  async function apiPost(path: string, body?: unknown) {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })
    return { status: res.status, data: await res.json() }
  }

  async function apiPut(path: string, body: unknown) {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return { status: res.status, data: await res.json() }
  }

  async function apiDelete(path: string) {
    const res = await fetch(`http://localhost:${port}${path}`, { method: 'DELETE' })
    return { status: res.status }
  }

  it('GET /api/staffs returns empty array initially', async () => {
    const { status, data } = await apiGet('/api/staffs')
    expect(status).toBe(200)
    expect(data).toEqual([])
  })

  it('POST /api/staffs creates a new staff', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: 'Test Staff',
      role: 'Test role',
      gather: 'Gather data',
      execute: 'Execute tasks',
      evaluate: 'Evaluate results'
    })
    expect(status).toBe(201)
    expect(data.name).toBe('Test Staff')
    expect(data.id).toBeTruthy()
  })

  it('GET /api/staffs returns created staff', async () => {
    const { data } = await apiGet('/api/staffs')
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].name).toBe('Test Staff')
  })

  it('GET /api/staffs/:id returns staff detail', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}`)
    expect(status).toBe(200)
    expect(data.name).toBe('Test Staff')
    expect(data.status).toBe('stopped')
  })

  it('PUT /api/staffs/:id updates staff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPut(`/api/staffs/${id}`, {
      name: 'Updated Staff'
    })
    expect(status).toBe(200)
    expect(data.name).toBe('Updated Staff')
  })

  it('GET /api/staffs/:id/kpi returns empty array initially', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/kpi`)
    expect(status).toBe(200)
    expect(data).toEqual([])
  })

  it('GET /api/staffs/:id/memory returns empty content', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/memory`)
    expect(status).toBe(200)
    expect(data.content).toBe('')
  })

  it('GET /api/staffs includes memory preview from latest non-heading line', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { getStaffDir } = await import('../../data/staff-data')
    const { writeFileSync } = await import('fs')
    const staffDir = getStaffDir(id)

    writeFileSync(
      join(staffDir, 'memory.md'),
      '# Memory\n\n- started run\nLatest stable insight from evaluation\n'
    )

    const { status, data } = await apiGet('/api/staffs')
    const target = data.find((s: { id: string }) => s.id === id)
    expect(status).toBe(200)
    expect(target.memory_preview).toBe('Latest stable insight from evaluation')
  })

  it('GET /api/staffs falls back to null memory preview when memory file is unreadable', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync, rmSync, writeFileSync } = await import('fs')
    const staffDir = getStaffDir(id)
    const memoryPath = join(staffDir, 'memory.md')

    try { rmSync(memoryPath) } catch {}
    mkdirSync(memoryPath, { recursive: true })

    const { status, data } = await apiGet('/api/staffs')
    const target = data.find((s: { id: string }) => s.id === id)
    expect(status).toBe(200)
    expect(target.memory_preview).toBeNull()

    // Restore memory file for subsequent tests.
    rmSync(memoryPath, { recursive: true, force: true })
    writeFileSync(memoryPath, '')
  })

  it('GET /api/staffs/:id/artifacts returns discovered output files', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync, writeFileSync } = await import('fs')
    const staffDir = getStaffDir(id)

    mkdirSync(join(staffDir, 'outputs'), { recursive: true })
    writeFileSync(join(staffDir, 'outputs', 'report.txt'), 'hello output')

    const { status, data } = await apiGet(`/api/staffs/${id}/artifacts`)
    const artifact = data.find((a: { path: string }) => a.path === 'outputs/report.txt')
    expect(status).toBe(200)
    expect(artifact).toBeTruthy()
    expect(artifact.type).toBe('text')
  })

  it('GET /api/staffs/:id/artifacts/text returns text preview', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/artifacts/text?path=outputs%2Freport.txt`)
    expect(status).toBe(200)
    expect(data.content).toContain('hello output')
    expect(data.truncated).toBe(false)
  })

  it('GET /api/staffs/:id/artifacts/file streams artifact bytes', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const res = await fetch(`http://localhost:${port}/api/staffs/${id}/artifacts/file?path=outputs%2Freport.txt`)
    const body = await res.text()
    expect(res.status).toBe(200)
    expect(body).toContain('hello output')
  })

  it('GET /api/staffs/:id/artifacts/text rejects traversal path', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/artifacts/text?path=..%2F..%2Fetc%2Fpasswd`)
    expect(status).toBe(400)
    expect(data.error).toContain('Invalid artifact path')
  })

  it('POST /api/staffs/:id/artifacts/open rejects traversal path', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPost(`/api/staffs/${id}/artifacts/open`, {
      path: '../../etc/passwd'
    })
    expect(status).toBe(400)
    expect(data.error).toContain('Invalid artifact path')
  })

  it('GET /api/staffs/:id returns 404 for non-existent', async () => {
    const { status } = await apiGet('/api/staffs/nonexistent')
    expect(status).toBe(404)
  })

  it('POST /api/staffs/:id/start calls startStaff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPost(`/api/staffs/${id}/start`)
    expect(status).toBe(200)
    expect(data.status).toBe('running')
  })

  it('POST /api/staffs/:id/stop calls stopStaff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPost(`/api/staffs/${id}/stop`)
    expect(status).toBe(200)
    expect(data.status).toBe('stopped')
  })

  it('POST /api/staffs/:id/restart calls restartStaff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPost(`/api/staffs/${id}/restart`)
    expect(status).toBe(200)
    expect(data.status).toBe('running')
  })

  it('POST /api/staffs/:id/pause calls pauseStaff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPost(`/api/staffs/${id}/pause`)
    expect(status).toBe(200)
    expect(data.status).toBe('paused')
    expect(mockManager.pauseStaff).toHaveBeenCalledWith(id)
  })

  it('POST /api/staffs/:id/resume calls resumeStaff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiPost(`/api/staffs/${id}/resume`)
    expect(status).toBe(200)
    expect(data.status).toBe('running')
    expect(mockManager.resumeStaff).toHaveBeenCalledWith(id)
  })

  it('GET /api/staffs/:id/metrics returns empty array', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/metrics`)
    expect(status).toBe(200)
    expect(data).toEqual([])
  })

  it('GET /api/staffs/:id/errors returns paginated empty result', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/errors`)
    expect(status).toBe(200)
    expect(data).toEqual({ items: [], total: 0 })
  })

  it('GET /api/staffs/:id/cycles returns empty array', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/cycles`)
    expect(status).toBe(200)
    expect(data).toEqual([])
  })

  it('GET /api/staffs/:id/logs returns empty lines', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/logs`)
    expect(status).toBe(200)
    expect(data.lines).toEqual([])
  })

  it('PUT /api/staffs/:id returns 404 for non-existent', async () => {
    const { status } = await apiPut('/api/staffs/nonexistent', { name: 'test' })
    expect(status).toBe(404)
  })

  it('DELETE /api/staffs/:id deletes staff', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status } = await apiDelete(`/api/staffs/${id}`)
    expect(status).toBe(204)
    const { data: afterList } = await apiGet('/api/staffs')
    expect(afterList.length).toBe(list.length - 1)
  })

  it('POST /api/staffs creates staff with default agent/model from config', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: 'Defaults Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })
    expect(status).toBe(201)
    expect(data.agent).toBe('claude-code')
    expect(data.model).toBe('claude-sonnet-4-5')
    // Clean up
    await apiDelete(`/api/staffs/${data.id}`)
  })

  it('GET /api/staffs/:id includes cycles, restarts, kpi_summary', async () => {
    // Create a staff and populate its data
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Data Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Write some cycle and KPI data
    const { appendJsonl } = await import('../../data/jsonl-reader')
    const { getStaffDir } = await import('../../data/staff-data')
    const staffDir = getStaffDir(created.id)
    const { join } = await import('path')

    appendJsonl(join(staffDir, 'cycles.jsonl'), { cycle: 1, date: '2024-01-01', summary: 'Test' })
    appendJsonl(join(staffDir, 'kpi.jsonl'), {
      date: '2024-01-01',
      metrics: { accuracy: 0.85 }
    })
    appendJsonl(join(staffDir, 'kpi.jsonl'), {
      date: '2024-01-02',
      metrics: { accuracy: 0.90 }
    })

    const { data } = await apiGet(`/api/staffs/${created.id}`)
    expect(data.cycles).toBe(1)
    expect(data.kpi_summary.length).toBeGreaterThan(0)
    expect(data.kpi_summary[0].name).toBe('accuracy')
    expect(data.kpi_summary[0].value).toBe(0.90)
    expect(data.kpi_summary[0].trend).toBeCloseTo(5.88, 0) // (0.90-0.85)/0.85 * 100

    // Clean up
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs list shows uptime, tokens, cost fields', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'List Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { data: list } = await apiGet('/api/staffs')
    const staff = list.find((s: { id: string }) => s.id === created.id)
    expect(staff).toBeTruthy()
    expect(staff.uptime).toBeNull()
    expect(staff.tokens_today).toBe(0)
    expect(staff.cost_today).toBe(0)
    expect(staff.kpi_summary).toEqual([])

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/logs returns lines from output.log', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Log Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Write some log data
    const { getStaffDir } = await import('../../data/staff-data')
    const { writeFileSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    writeFileSync(join(staffDir, 'output.log'), 'Line 1\nLine 2\nLine 3\n')

    const { status, data } = await apiGet(`/api/staffs/${created.id}/logs`)
    expect(status).toBe(200)
    expect(data.lines.length).toBeGreaterThan(0)
    expect(data.lines).toContain('Line 1')

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id shows uptime when running', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Uptime Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Write state with last_started_at and change mock to return 'running'
    const { writeStaffState } = await import('../../data/staff-data')
    writeStaffState(created.id, {
      session_id: 'test-session',
      last_started_at: new Date(Date.now() - 60_000).toISOString()
    })
    const originalGetStatus = mockManager.getStatus
    mockManager.getStatus = (id: string) => id === created.id ? 'running' : 'stopped'

    const { status, data } = await apiGet(`/api/staffs/${created.id}`)
    expect(status).toBe(200)
    expect(data.uptime).toBeGreaterThan(0)

    // Restore and clean up
    mockManager.getStatus = originalGetStatus
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('DELETE /api/staffs/:id stops running staff before deleting', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Running Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalIsRunning = mockManager.isRunning
    mockManager.isRunning = (id: string) => id === created.id

    const { status } = await apiDelete(`/api/staffs/${created.id}`)
    expect(status).toBe(204)
    expect(mockManager.stopStaff).toHaveBeenCalledWith(created.id)

    mockManager.isRunning = originalIsRunning
  })

  it('GET /api/staffs/:id/export returns exportable config', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Export Staff',
      role: 'Exporter',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV',
      kpi: 'KPI target'
    })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/export`)
    expect(status).toBe(200)
    expect(data.openstaff_version).toBe('1.0.0')
    expect(data.type).toBe('staff')
    expect(data.name).toBe('Export Staff')
    expect(data.role).toBe('Exporter')
    expect(data.recommended_agent).toBe('claude-code')

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/export returns 404 for nonexistent', async () => {
    const { status } = await apiGet('/api/staffs/nonexistent/export')
    expect(status).toBe(404)
  })

  it('POST /api/staffs/import creates staff from exported config', async () => {
    const importData = {
      name: 'Imported Staff',
      role: 'Imported Role',
      gather: 'Import G',
      execute: 'Import E',
      evaluate: 'Import EV',
      kpi: 'Import KPI',
      required_skills: [],
      recommended_agent: 'claude-code',
      recommended_model: 'claude-sonnet-4-5'
    }

    const { status, data } = await apiPost('/api/staffs/import', importData)
    expect(status).toBe(201)
    expect(data.name).toBe('Imported Staff')
    expect(data.agent).toBe('claude-code')
    expect(data.id).toBeTruthy()

    await apiDelete(`/api/staffs/${data.id}`)
  })

  it('POST /api/staffs/import uses defaults when no recommended_agent/model', async () => {
    const importData = {
      name: 'Defaults Import',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    }

    const { status, data } = await apiPost('/api/staffs/import', importData)
    expect(status).toBe(201)
    expect(data.name).toBe('Defaults Import')
    expect(data.agent).toBe('claude-code')
    expect(data.model).toBe('claude-sonnet-4-5')
    expect(data.skills).toEqual([])

    await apiDelete(`/api/staffs/${data.id}`)
  })

  it('POST /api/staffs/:id/start returns 500 when startStaff throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalStart = mockManager.startStaff
    mockManager.startStaff = vi.fn().mockRejectedValue(new Error('Start failed'))

    const { status, data } = await apiPost(`/api/staffs/${created.id}/start`)
    expect(status).toBe(500)
    expect(data.error).toContain('Start failed')

    mockManager.startStaff = originalStart
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs/:id/stop returns 500 when stopStaff throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Stop Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalStop = mockManager.stopStaff
    mockManager.stopStaff = vi.fn().mockRejectedValue(new Error('Stop failed'))

    const { status, data } = await apiPost(`/api/staffs/${created.id}/stop`)
    expect(status).toBe(500)
    expect(data.error).toContain('Stop failed')

    mockManager.stopStaff = originalStop
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs/:id/restart returns 500 when restartStaff throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Restart Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalRestart = mockManager.restartStaff
    mockManager.restartStaff = vi.fn().mockRejectedValue(new Error('Restart failed'))

    const { status, data } = await apiPost(`/api/staffs/${created.id}/restart`)
    expect(status).toBe(500)
    expect(data.error).toContain('Restart failed')

    mockManager.restartStaff = originalRestart
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs/:id/pause returns 500 when pauseStaff throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Pause Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalPause = mockManager.pauseStaff
    mockManager.pauseStaff = vi.fn().mockRejectedValue(new Error('Pause failed'))

    const { status, data } = await apiPost(`/api/staffs/${created.id}/pause`)
    expect(status).toBe(500)
    expect(data.error).toContain('Pause failed')

    mockManager.pauseStaff = originalPause
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs/:id/resume returns 500 when resumeStaff throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Resume Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalResume = mockManager.resumeStaff
    mockManager.resumeStaff = vi.fn().mockRejectedValue(new Error('Resume failed'))

    const { status, data } = await apiPost(`/api/staffs/${created.id}/resume`)
    expect(status).toBe(500)
    expect(data.error).toContain('Resume failed')

    mockManager.resumeStaff = originalResume
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs list includes kpi_summary with trend from usage/kpi data', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'KPI List Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { appendJsonl } = await import('../../data/jsonl-reader')
    const { getStaffDir } = await import('../../data/staff-data')
    const staffDir = getStaffDir(created.id)
    const { join } = await import('path')

    // Add KPI data with only 1 entry (no prevKpi → trend should be null)
    appendJsonl(join(staffDir, 'kpi.jsonl'), {
      date: '2024-01-01',
      metrics: { accuracy: 0.95 }
    })

    // Add usage data for today
    const today = new Date().toISOString().slice(0, 10)
    appendJsonl(join(staffDir, 'usage.jsonl'), {
      date: today,
      input_tokens: 1000,
      output_tokens: 500,
      cost_usd: 0.05
    })
    appendJsonl(join(staffDir, 'usage.jsonl'), {
      date: today,
      input_tokens: 2000,
      output_tokens: 1000,
      cost_usd: 0.10
    })
    // Add usage entry for a different date (should not be counted)
    appendJsonl(join(staffDir, 'usage.jsonl'), {
      date: '2023-01-01',
      input_tokens: 9999,
      output_tokens: 9999,
      cost_usd: 99.99
    })

    const { data: list } = await apiGet('/api/staffs')
    const staff = list.find((s: { id: string }) => s.id === created.id)
    expect(staff).toBeTruthy()
    expect(staff.kpi_summary.length).toBe(1)
    expect(staff.kpi_summary[0].name).toBe('accuracy')
    expect(staff.kpi_summary[0].trend).toBeNull() // Only 1 KPI entry, no prevKpi
    expect(staff.tokens_today).toBe(4500) // 1000+500+2000+1000
    expect(staff.cost_today).toBe(0.15) // 0.05+0.10

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id detail with single KPI entry has null trend', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Single KPI Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { appendJsonl } = await import('../../data/jsonl-reader')
    const { getStaffDir } = await import('../../data/staff-data')
    const staffDir = getStaffDir(created.id)
    const { join } = await import('path')

    appendJsonl(join(staffDir, 'kpi.jsonl'), {
      date: '2024-01-01',
      metrics: { score: 42 }
    })

    const { data } = await apiGet(`/api/staffs/${created.id}`)
    expect(data.kpi_summary.length).toBe(1)
    expect(data.kpi_summary[0].name).toBe('score')
    expect(data.kpi_summary[0].value).toBe(42)
    expect(data.kpi_summary[0].trend).toBeNull()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('PUT /api/staffs/:id restarts running staff after update', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Restart On Update Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalIsRunning = mockManager.isRunning
    mockManager.isRunning = (id: string) => id === created.id

    const { status, data } = await apiPut(`/api/staffs/${created.id}`, {
      name: 'Updated Running Staff'
    })
    expect(status).toBe(200)
    expect(data.name).toBe('Updated Running Staff')
    expect(mockManager.restartStaff).toHaveBeenCalledWith(created.id)

    mockManager.isRunning = originalIsRunning
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs ignores explicit id (always generates UUID)', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      id: 'custom-id-123',
      name: 'Custom ID Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV',
      kpi: 'My KPI',
      agent: 'claude-code',
      model: 'claude-sonnet-4-5',
      skills: ['openstaff']
    })
    expect(status).toBe(201)
    // Should NOT use the user-provided id (security: prevents directory traversal)
    expect(data.id).not.toBe('custom-id-123')
    expect(data.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(data.kpi).toBe('My KPI')
    expect(data.skills).toEqual(['openstaff'])

    await apiDelete(`/api/staffs/${data.id}`)
  })

  it('POST /api/staffs/import returns 500 when createStaff throws', async () => {
    const originalCreateStaff = mockManager.createStaff
    mockManager.createStaff = vi.fn(() => { throw new Error('createStaff import failed') })

    const importData = {
      name: 'Failing Import',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    }

    const { status, data } = await apiPost('/api/staffs/import', importData)
    expect(status).toBe(500)
    expect(data.error).toContain('createStaff import failed')

    mockManager.createStaff = originalCreateStaff
  })

  it('GET /api/staffs/:id/logs returns 500 when output.log is a directory', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Log Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Create output.log as a directory instead of a file to trigger EISDIR
    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    mkdirSync(join(staffDir, 'output.log'), { recursive: true })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/logs`)
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('PUT /api/staffs/:id returns 500 when updateStaff throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Update Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalUpdate = mockManager.updateStaff
    mockManager.updateStaff = vi.fn(() => { throw new Error('update exploded') })

    const { status, data } = await apiPut(`/api/staffs/${created.id}`, { name: 'Boom' })
    expect(status).toBe(500)
    expect(data.error).toContain('update exploded')

    mockManager.updateStaff = originalUpdate
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('DELETE /api/staffs/:id returns 500 when deleteStaffData throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Delete Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const originalDelete = mockManager.deleteStaffData
    mockManager.deleteStaffData = vi.fn(() => { throw new Error('delete exploded') })

    const res = await fetch(`http://localhost:${port}/api/staffs/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('delete exploded')

    mockManager.deleteStaffData = originalDelete
    // Clean up manually since delete mock was broken
    const { deleteStaffDir } = await import('../../data/staff-data')
    deleteStaffDir(created.id)
  })

  it('GET /api/staffs/:id/metrics returns 500 when usage.jsonl is corrupt', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Metrics Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    mkdirSync(join(staffDir, 'usage.jsonl'), { recursive: true })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/metrics`)
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/kpi returns 500 when kpi.jsonl is corrupt', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'KPI Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    mkdirSync(join(staffDir, 'kpi.jsonl'), { recursive: true })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/kpi`)
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/memory returns 500 when readMemoryMd throws', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Memory Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Make memory.md a directory to trigger EISDIR
    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync, rmSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    // Remove the memory.md file first if exists, then create directory
    try { rmSync(join(staffDir, 'memory.md')) } catch {}
    mkdirSync(join(staffDir, 'memory.md'), { recursive: true })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/memory`)
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/errors returns 500 when errors.jsonl is corrupt', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Errors Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Create errors.jsonl as a directory to trigger EISDIR
    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    mkdirSync(join(staffDir, 'errors.jsonl'), { recursive: true })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/errors`)
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/cycles returns 500 when staff dir is corrupt', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Cycle Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Create cycles.jsonl as a directory to trigger EISDIR
    const { getStaffDir } = await import('../../data/staff-data')
    const { mkdirSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    mkdirSync(join(staffDir, 'cycles.jsonl'), { recursive: true })

    const { status, data } = await apiGet(`/api/staffs/${created.id}/cycles`)
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id/export returns 404 when staff.json is corrupt', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Export Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Corrupt the staff.json - readStaffConfig returns null for invalid JSON
    const { getStaffDir } = await import('../../data/staff-data')
    const { writeFileSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    writeFileSync(join(staffDir, 'staff.json'), 'not valid json')

    const { status, data } = await apiGet(`/api/staffs/${created.id}/export`)
    expect(status).toBe(404)
    expect(data.error).toBe('Staff not found')

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs/:id returns 404 when staff.json is corrupt', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Detail Error Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    // Corrupt staff.json - readStaffConfig returns null for invalid JSON
    const { getStaffDir } = await import('../../data/staff-data')
    const { writeFileSync } = await import('fs')
    const { join } = await import('path')
    const staffDir = getStaffDir(created.id)
    writeFileSync(join(staffDir, 'staff.json'), '{bad json}')

    const { status, data } = await apiGet(`/api/staffs/${created.id}`)
    expect(status).toBe(404)
    expect(data.error).toBe('Staff not found')

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs returns 500 when createStaff throws', async () => {
    const originalCreateStaff = mockManager.createStaff
    mockManager.createStaff = vi.fn(() => { throw new Error('create exploded') })

    const { status, data } = await apiPost('/api/staffs', {
      name: 'Failing Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })
    expect(status).toBe(500)
    expect(data.error).toContain('create exploded')

    mockManager.createStaff = originalCreateStaff
  })

  it('GET /api/staffs list shows KPI trend when two kpi entries exist', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'KPI Trend Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { getStaffDir } = await import('../../data/staff-data')
    const { appendJsonl } = await import('../../data/jsonl-reader')
    const { join } = await import('path')
    const dir = getStaffDir(created.id)
    // Two KPI entries with same metric to trigger trend calculation (line 35)
    appendJsonl(join(dir, 'kpi.jsonl'), { date: '2026-01-01', cycle: 1, metrics: { ctr: 2.0 } })
    appendJsonl(join(dir, 'kpi.jsonl'), { date: '2026-01-02', cycle: 2, metrics: { ctr: 3.0 } })

    const { data: list } = await apiGet('/api/staffs')
    const staff = list.find((s: { id: string }) => s.id === created.id)
    expect(staff).toBeTruthy()
    expect(staff.kpi_summary.length).toBe(1)
    expect(staff.kpi_summary[0].name).toBe('ctr')
    expect(staff.kpi_summary[0].value).toBe(3.0)
    expect(staff.kpi_summary[0].trend).toBe(50) // (3-2)/2 * 100

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('KPI trend is null when previous value is zero (division by zero guard)', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Zero KPI Staff',
      role: 'Tester',
      gather: 'g',
      execute: 'e',
      evaluate: 'ev',
      agent: 'claude-code',
      model: 'claude-sonnet-4-5',
      skills: []
    })

    const { appendJsonl } = await import('../../data/jsonl-reader')
    const { getStaffDir } = await import('../../data/staff-data')
    const { join } = await import('path')
    const dir = getStaffDir(created.id)
    // Previous KPI value of 0 should not cause division by zero
    appendJsonl(join(dir, 'kpi.jsonl'), { date: '2026-01-01', cycle: 1, metrics: { score: 0 } })
    appendJsonl(join(dir, 'kpi.jsonl'), { date: '2026-01-02', cycle: 2, metrics: { score: 5 } })

    const { data: list } = await apiGet('/api/staffs')
    const staff = list.find((s: { id: string }) => s.id === created.id)
    expect(staff.kpi_summary[0].name).toBe('score')
    expect(staff.kpi_summary[0].value).toBe(5)
    expect(staff.kpi_summary[0].trend).toBeNull() // Previous was 0, no division

    // Also check detail endpoint
    const { data: detail } = await apiGet(`/api/staffs/${created.id}`)
    expect(detail.kpi_summary[0].trend).toBeNull()

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('GET /api/staffs list returns 500 when listStaffIds throws', async () => {
    // Corrupt the staffs directory to trigger the list catch block
    const { mkdirSync, rmSync, writeFileSync } = await import('fs')
    const { join } = await import('path')

    // Temporarily replace staffs dir with a file to cause readdirSync to throw
    const staffsDir = join(tempDir, 'staffs')
    rmSync(staffsDir, { recursive: true, force: true })
    writeFileSync(staffsDir, 'not a directory')

    const { status, data } = await apiGet('/api/staffs')
    expect(status).toBe(500)
    expect(data.error).toBeTruthy()

    // Restore the directory
    try { rmSync(staffsDir) } catch {}
    mkdirSync(staffsDir, { recursive: true })
  })

  it('GET /api/staffs list skips staffs with no valid config', async () => {
    // Create a staff dir with no staff.json to trigger !config return null
    const { ensureStaffDir } = await import('../../data/staff-data')
    ensureStaffDir('orphan-staff-no-config')

    const { data: list } = await apiGet('/api/staffs')
    // Should not include the orphan staff
    const orphan = list.find((s: { id: string }) => s.id === 'orphan-staff-no-config')
    expect(orphan).toBeUndefined()

    // Clean up
    const { deleteStaffDir } = await import('../../data/staff-data')
    deleteStaffDir('orphan-staff-no-config')
  })

  it('POST /api/staffs rejects empty body (required loop fields)', async () => {
    const { status, data } = await apiPost('/api/staffs', {})
    expect(status).toBe(400)
    expect(data.error).toBe('name is required')
  })

  it('POST /api/staffs/import rejects empty body (name required)', async () => {
    const { status, data } = await apiPost('/api/staffs/import', {})
    expect(status).toBe(400)
    expect(data.error).toBe('name is required')
  })

  it('POST /api/staffs/import rejects payload with missing loop fields', async () => {
    const { status, data } = await apiPost('/api/staffs/import', { name: 'Imported Staff' })
    expect(status).toBe(400)
    expect(data.error).toBe('role is required')
  })

  it('GET /api/staffs list shows uptime for running staffs', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Running List Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { writeStaffState } = await import('../../data/staff-data')
    writeStaffState(created.id, {
      session_id: 'test-session',
      last_started_at: new Date(Date.now() - 120_000).toISOString()
    })
    const originalGetStatus = mockManager.getStatus
    mockManager.getStatus = (id: string) => id === created.id ? 'running' : 'stopped'

    const { data: list } = await apiGet('/api/staffs')
    const staff = list.find((s: { id: string }) => s.id === created.id)
    expect(staff).toBeTruthy()
    expect(staff.uptime).toBeGreaterThan(0)

    mockManager.getStatus = originalGetStatus
    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('POST /api/staffs rejects empty name', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: '',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })
    expect(status).toBe(400)
    expect(data.error).toContain('name is required')
  })

  it('POST /api/staffs rejects when core loop fields are missing', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: 'Missing Core Fields',
      role: 'Role',
      gather: 'G'
    })
    expect(status).toBe(400)
    expect(data.error).toBe('execute is required')
  })

  it('POST /api/staffs rejects name over 100 chars', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: 'A'.repeat(101),
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })
    expect(status).toBe(400)
    expect(data.error).toContain('100 characters')
  })

  it('POST /api/staffs sanitizes control characters', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: 'Test\x00\x01Staff',
      role: 'Role\x7f',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })
    expect(status).toBe(201)
    expect(data.name).toBe('TestStaff')
    expect(data.role).toBe('Role')

    await apiDelete(`/api/staffs/${data.id}`)
  })

  it('POST /api/staffs rejects skills with non-string elements', async () => {
    const { status, data } = await apiPost('/api/staffs', {
      name: 'Test',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV',
      skills: ['valid', 123]
    })
    expect(status).toBe(400)
    expect(data.error).toContain('skills must contain only strings')
  })

  it('POST /api/staffs/import rejects non-array required_skills', async () => {
    const { status, data } = await apiPost('/api/staffs/import', {
      name: 'Test Import',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV',
      required_skills: 'not-an-array'
    })
    expect(status).toBe(400)
    expect(data.error).toContain('required_skills must be an array')
  })

  it('POST /api/staffs/import rejects required_skills with non-string elements', async () => {
    const { status, data } = await apiPost('/api/staffs/import', {
      name: 'Test Import',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV',
      required_skills: ['valid', 42]
    })
    expect(status).toBe(400)
    expect(data.error).toContain('required_skills must contain only strings')
  })

  it('PUT /api/staffs/:id rejects invalid skills type', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Skills Validation Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { status, data } = await apiPut(`/api/staffs/${created.id}`, {
      skills: 'not-an-array'
    })
    expect(status).toBe(400)
    expect(data.error).toContain('skills must be an array')

    await apiDelete(`/api/staffs/${created.id}`)
  })

  it('PUT /api/staffs/:id rejects empty role update', async () => {
    const { data: created } = await apiPost('/api/staffs', {
      name: 'Update Validation Staff',
      role: 'Role',
      gather: 'G',
      execute: 'E',
      evaluate: 'EV'
    })

    const { status, data } = await apiPut(`/api/staffs/${created.id}`, {
      role: ''
    })
    expect(status).toBe(400)
    expect(data.error).toBe('role is required')

    await apiDelete(`/api/staffs/${created.id}`)
  })
})
