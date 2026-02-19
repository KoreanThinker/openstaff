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

  it('GET /api/staffs/:id/metrics returns empty array', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/metrics`)
    expect(status).toBe(200)
    expect(data).toEqual([])
  })

  it('GET /api/staffs/:id/errors returns empty array', async () => {
    const { data: list } = await apiGet('/api/staffs')
    const id = list[0].id
    const { status, data } = await apiGet(`/api/staffs/${id}/errors`)
    expect(status).toBe(200)
    expect(data).toEqual([])
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

  it('POST /api/staffs with explicit id uses provided id', async () => {
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
    expect(data.id).toBe('custom-id-123')
    expect(data.kpi).toBe('My KPI')
    expect(data.skills).toEqual(['openstaff'])

    await apiDelete(`/api/staffs/${data.id}`)
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
})
