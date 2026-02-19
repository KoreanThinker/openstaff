import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server } from 'http'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string
let server: Server
let port: number

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants')
  return {
    ...actual,
    get STAFFS_DIR() { return join(tempDir, 'staffs') },
    get OPENSTAFF_HOME() { return tempDir }
  }
})

const { systemRoutes } = await import('./system')
const { EventEmitter } = await import('events')

describe('system API routes', () => {
  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'openstaff-sys-test-'))

    const app = express()
    app.use(express.json())

    const mockManager = Object.assign(new EventEmitter(), {
      getRunningStaffIds: () => [],
      getStatus: () => 'stopped' as const,
      getStaffConfig: () => null
    })

    const mockMonitoring = {
      getSystemResources: async () => ({
        cpu_percent: 25.5,
        memory_percent: 60.0,
        memory_used_mb: 8192,
        memory_total_mb: 16384
      })
    }

    app.use('/api/system', systemRoutes({
      staffManager: mockManager as never,
      configStore: {} as never,
      monitoringEngine: mockMonitoring as never,
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

  it('GET /api/system/resources returns system metrics', async () => {
    const res = await fetch(`http://localhost:${port}/api/system/resources`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.cpu_percent).toBe(25.5)
    expect(data.memory_percent).toBe(60.0)
  })

  it('GET /api/system/ngrok returns not_configured when no ngrok manager', async () => {
    const res = await fetch(`http://localhost:${port}/api/system/ngrok`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ngrok_status).toBe('not_configured')
    expect(data.ngrok_url).toBeNull()
  })

  it('GET /api/system/stats returns dashboard stats', async () => {
    const res = await fetch(`http://localhost:${port}/api/system/stats`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.active_staffs).toBe(0)
    expect(data.total_staffs).toBe(0)
    expect(data.total_cycles).toBe(0)
    expect(data.tokens_today).toBe(0)
    expect(data.tokens_month).toBe(0)
  })
})

describe('system API routes with ngrok manager', () => {
  let tempDir3: string
  let server3: Server
  let port3: number

  beforeAll(async () => {
    tempDir3 = mkdtempSync(join(tmpdir(), 'openstaff-sys-ngrok-'))
    tempDir = tempDir3

    const mockNgrok = {
      isActive: () => true,
      getUrl: () => 'https://abc123.ngrok.io'
    }

    const app = express()
    app.use(express.json())
    app.use('/api/system', systemRoutes({
      staffManager: {} as never,
      configStore: {} as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never,
      ngrokManager: mockNgrok as never
    }))

    server3 = createServer(app)
    await new Promise<void>((resolve) => {
      server3.listen(0, () => {
        const addr = server3.address()
        port3 = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    server3.close()
    rmSync(tempDir3, { recursive: true, force: true })
  })

  it('GET /api/system/ngrok returns connected status with URL', async () => {
    const res = await fetch(`http://localhost:${port3}/api/system/ngrok`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ngrok_status).toBe('connected')
    expect(data.ngrok_url).toBe('https://abc123.ngrok.io')
  })
})

describe('system API routes with staff data', () => {
  let tempDir2: string
  let server2: Server
  let port2: number

  beforeAll(async () => {
    tempDir2 = mkdtempSync(join(tmpdir(), 'openstaff-sys2-'))
    // Override tempDir for the mock to use
    tempDir = tempDir2

    // Create a staff with cycles and usage data
    const { writeStaffConfig, ensureStaffDir } = await import('../../data/staff-data')
    const staffId = 'test-staff-1'
    ensureStaffDir(staffId)
    writeStaffConfig({
      id: staffId,
      name: 'Test Staff',
      role: 'Tester',
      gather: 'g',
      execute: 'e',
      evaluate: 'ev',
      kpi: '',
      agent: 'claude-code',
      model: 'claude-sonnet-4-5',
      skills: [],
      created_at: new Date().toISOString()
    })

    // Write cycles and usage data
    const { appendJsonl } = await import('../../data/jsonl-reader')
    const staffDir = join(tempDir2, 'staffs', staffId)
    const today = new Date().toISOString().slice(0, 10)

    appendJsonl(join(staffDir, 'cycles.jsonl'), { cycle: 1, date: today, summary: 'Test cycle' })
    appendJsonl(join(staffDir, 'cycles.jsonl'), { cycle: 2, date: today, summary: 'Test cycle 2' })
    appendJsonl(join(staffDir, 'usage.jsonl'), {
      date: today,
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0.05
    })
    appendJsonl(join(staffDir, 'usage.jsonl'), {
      date: today,
      input_tokens: 2000,
      output_tokens: 1000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0.10
    })

    const mockManager = Object.assign(new EventEmitter(), {
      getRunningStaffIds: () => [staffId],
      getStatus: (id: string) => id === staffId ? 'running' as const : 'stopped' as const,
      getStaffConfig: () => null
    })

    const mockMonitoring = {
      getSystemResources: async () => ({
        cpu_percent: 50.0,
        memory_percent: 75.0,
        memory_used_mb: 12288,
        memory_total_mb: 16384
      })
    }

    const app = express()
    app.use(express.json())
    app.use('/api/system', systemRoutes({
      staffManager: mockManager as never,
      configStore: {} as never,
      monitoringEngine: mockMonitoring as never,
      io: { emit: vi.fn() } as never
    }))

    server2 = createServer(app)
    await new Promise<void>((resolve) => {
      server2.listen(0, () => {
        const addr = server2.address()
        port2 = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    server2.close()
    rmSync(tempDir2, { recursive: true, force: true })
  })

  it('GET /api/system/stats returns correct counts with staff data', async () => {
    const res = await fetch(`http://localhost:${port2}/api/system/stats`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.total_staffs).toBe(1)
    expect(data.active_staffs).toBe(1)
    expect(data.total_cycles).toBe(2)
    expect(data.cost_today).toBeCloseTo(0.15, 2)
    expect(data.cost_month).toBeCloseTo(0.15, 2)
  })
})
