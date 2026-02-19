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
    // Add entry from same month but different day (covers month-only matching branch)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    appendJsonl(join(staffDir, 'usage.jsonl'), {
      date: yesterday,
      input_tokens: 500,
      output_tokens: 250,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0.02
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
    expect(data.tokens_today).toBe(4500) // 1000+500+2000+1000
    expect(data.cost_month).toBeCloseTo(0.17, 2) // 0.15 today + 0.02 yesterday
    expect(data.tokens_month).toBe(5250) // 4500 today + 750 yesterday
  })
})

describe('system API routes: ngrok disconnected', () => {
  let dcServer: Server
  let dcPort: number

  beforeAll(async () => {
    const dcTempDir = mkdtempSync(join(tmpdir(), 'openstaff-sys-dc-'))
    tempDir = dcTempDir

    const mockNgrok = {
      isActive: () => false,
      getUrl: () => null
    }

    const app = express()
    app.use(express.json())
    app.use('/api/system', systemRoutes({
      staffManager: Object.assign(new EventEmitter(), {
        getRunningStaffIds: () => [],
        getStatus: () => 'stopped' as const
      }) as never,
      configStore: {} as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never,
      ngrokManager: mockNgrok as never
    }))

    dcServer = createServer(app)
    await new Promise<void>((resolve) => {
      dcServer.listen(0, () => {
        const addr = dcServer.address()
        dcPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    dcServer.close()
  })

  it('GET /api/system/ngrok returns disconnected when ngrok inactive', async () => {
    const res = await fetch(`http://localhost:${dcPort}/api/system/ngrok`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ngrok_status).toBe('disconnected')
    expect(data.ngrok_url).toBeNull()
  })
})

describe('system API routes: stats with error staffs', () => {
  let errStaffServer: Server
  let errStaffPort: number
  let errStaffTempDir: string

  beforeAll(async () => {
    errStaffTempDir = mkdtempSync(join(tmpdir(), 'openstaff-sys-errs-'))
    tempDir = errStaffTempDir

    const { writeStaffConfig, ensureStaffDir } = await import('../../data/staff-data')
    ensureStaffDir('err-staff-1')
    writeStaffConfig({
      id: 'err-staff-1',
      name: 'Error Staff',
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

    const mockManager = Object.assign(new EventEmitter(), {
      getRunningStaffIds: () => [],
      getStatus: (id: string) => id === 'err-staff-1' ? 'error' as const : 'stopped' as const
    })

    const app = express()
    app.use(express.json())
    app.use('/api/system', systemRoutes({
      staffManager: mockManager as never,
      configStore: {} as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    errStaffServer = createServer(app)
    await new Promise<void>((resolve) => {
      errStaffServer.listen(0, () => {
        const addr = errStaffServer.address()
        errStaffPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    errStaffServer.close()
    rmSync(errStaffTempDir, { recursive: true, force: true })
  })

  it('GET /api/system/stats counts error staffs', async () => {
    const res = await fetch(`http://localhost:${errStaffPort}/api/system/stats`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.error_staffs).toBe(1)
    expect(data.active_staffs).toBe(0)
  })
})

describe('system API routes: stats catch block', () => {
  let statsErrServer: Server
  let statsErrPort: number
  let statsErrTempDir: string

  beforeAll(async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs')
    statsErrTempDir = mkdtempSync(join(tmpdir(), 'openstaff-sys-stats-err-'))
    tempDir = statsErrTempDir

    // Create a staff with corrupt usage.jsonl to trigger JSON.parse error in readJsonl
    const { ensureStaffDir, writeStaffConfig } = await import('../../data/staff-data')
    ensureStaffDir('corrupt-staff')
    writeStaffConfig({
      id: 'corrupt-staff',
      name: 'Corrupt Staff',
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

    // Write corrupt usage.jsonl that will cause JSON.parse to throw
    writeFileSync(
      join(statsErrTempDir, 'staffs', 'corrupt-staff', 'usage.jsonl'),
      'this is not valid json\n'
    )

    const mockManager = Object.assign(new EventEmitter(), {
      getRunningStaffIds: () => [],
      getStatus: () => 'stopped' as const
    })

    const app = express()
    app.use(express.json())
    app.use('/api/system', systemRoutes({
      staffManager: mockManager as never,
      configStore: {} as never,
      monitoringEngine: { getSystemResources: async () => ({}) } as never,
      io: { emit: vi.fn() } as never
    }))

    statsErrServer = createServer(app)
    await new Promise<void>((resolve) => {
      statsErrServer.listen(0, () => {
        const addr = statsErrServer.address()
        statsErrPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    statsErrServer.close()
    rmSync(statsErrTempDir, { recursive: true, force: true })
  })

  it('GET /api/system/stats returns 500 when readJsonl throws on corrupt data', async () => {
    const res = await fetch(`http://localhost:${statsErrPort}/api/system/stats`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })
})

describe('system API routes: error handling', () => {
  let errServer: Server
  let errPort: number

  beforeAll(async () => {
    const errTempDir = mkdtempSync(join(tmpdir(), 'openstaff-sys-err-'))
    tempDir = errTempDir

    const app = express()
    app.use(express.json())

    const brokenMonitoring = {
      getSystemResources: async () => { throw new Error('Monitoring failure') }
    }

    const brokenNgrok = {
      isActive: () => { throw new Error('Ngrok failure') },
      getUrl: () => null
    }

    app.use('/api/system', systemRoutes({
      staffManager: Object.assign(new EventEmitter(), {
        getRunningStaffIds: () => [],
        getStatus: () => 'stopped' as const
      }) as never,
      configStore: {} as never,
      monitoringEngine: brokenMonitoring as never,
      io: { emit: vi.fn() } as never,
      ngrokManager: brokenNgrok as never
    }))

    errServer = createServer(app)
    await new Promise<void>((resolve) => {
      errServer.listen(0, () => {
        const addr = errServer.address()
        errPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => errServer.close())

  it('GET /api/system/resources returns 500 when monitoring throws', async () => {
    const res = await fetch(`http://localhost:${errPort}/api/system/resources`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Monitoring failure')
  })

  it('GET /api/system/ngrok returns 500 when ngrok throws', async () => {
    const res = await fetch(`http://localhost:${errPort}/api/system/ngrok`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Ngrok failure')
  })

})
