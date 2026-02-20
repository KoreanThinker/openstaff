import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server } from 'http'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
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
    get SKILLS_DIR() { return join(tempDir, 'skills') },
    get OPENSTAFF_HOME() { return tempDir }
  }
})

const { skillRoutes } = await import('./skills')
const { EventEmitter } = await import('events')

function createMockConfigStore() {
  const store: Record<string, unknown> = {}
  return {
    get: (key: string) => store[key] ?? '',
    set: (key: string, value: unknown) => { store[key] = value }
  }
}

describe('skills API routes', () => {
  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'openstaff-skills-api-'))
    mkdirSync(join(tempDir, 'skills'), { recursive: true })
    mkdirSync(join(tempDir, 'staffs'), { recursive: true })

    const mockManager = Object.assign(new EventEmitter(), {
      isRunning: () => false,
      restartStaff: vi.fn()
    })

    const app = express()
    app.use(express.json())
    app.use('/api/skills', skillRoutes({
      staffManager: mockManager as never,
      configStore: createMockConfigStore() as never,
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

  it('GET /api/skills returns empty initially', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toEqual([])
  })

  it('POST /api/skills/import imports a skill', async () => {
    // Create a skill directory to import
    const sourceDir = join(tempDir, 'source-skill')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, 'SKILL.md'), `---
name: test-skill
description: A test skill
compatibility: Requires TEST_API_KEY
---
# Test Skill`)

    const res = await fetch(`http://localhost:${port}/api/skills/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: sourceDir })
    })
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.name).toBe('test-skill')
  })

  it('GET /api/skills returns imported skill', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.length).toBe(1)
    expect(data[0].name).toBe('test-skill')
  })

  it('GET /api/skills/:name returns skill detail', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/test-skill`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.name).toBe('test-skill')
    expect(data.description).toBe('A test skill')
  })

  it('GET /api/skills/:name shows connected_staffs when staff uses the skill', async () => {
    // Create a staff that uses test-skill
    const { writeStaffConfig, ensureStaffDir } = await import('../../data/staff-data')
    ensureStaffDir('staff-skill-detail')
    writeStaffConfig({
      id: 'staff-skill-detail',
      name: 'Staff Skill Detail',
      role: 'Tester',
      gather: 'g',
      execute: 'e',
      evaluate: 'ev',
      kpi: '',
      agent: 'claude-code',
      model: 'claude-sonnet-4-5',
      skills: ['test-skill'],
      created_at: new Date().toISOString()
    })

    const res = await fetch(`http://localhost:${port}/api/skills/test-skill`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.connected_staffs).toContain('staff-skill-detail')
  })

  it('PUT /api/skills/:name/auth saves auth config', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/test-skill/auth`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TEST_API_KEY: 'my-key-123' })
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('saved')
  })

  it('GET /api/skills/:name returns 404 for nonexistent', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/nonexistent-skill`)
    expect(res.status).toBe(404)
  })

  it('POST /api/skills/import rejects path traversal', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '../../etc/passwd' })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid path')
  })

  it('POST /api/skills/import rejects missing path', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/skills/import returns 500 for invalid path', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/nonexistent/path/to/skill' })
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  it('DELETE /api/skills/:name deletes skill', async () => {
    const res = await fetch(`http://localhost:${port}/api/skills/test-skill`, {
      method: 'DELETE'
    })
    expect(res.status).toBe(204)

    // Verify deleted
    const listRes = await fetch(`http://localhost:${port}/api/skills`)
    const data = await listRes.json()
    expect(data.length).toBe(0)
  })
})

describe('skills API routes: delete with connected staff', () => {
  let tempDir2: string
  let server2: Server
  let port2: number

  beforeAll(async () => {
    tempDir2 = mkdtempSync(join(tmpdir(), 'openstaff-skills-del-'))
    tempDir = tempDir2
    mkdirSync(join(tempDir2, 'skills'), { recursive: true })
    mkdirSync(join(tempDir2, 'staffs'), { recursive: true })

    // Create a skill
    const skillDir = join(tempDir2, 'skills', 'del-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: del-skill
description: A skill to delete
---
# Del Skill`)

    // Create a staff that uses this skill
    const { writeStaffConfig, ensureStaffDir } = await import('../../data/staff-data')
    ensureStaffDir('staff-with-skill')
    writeStaffConfig({
      id: 'staff-with-skill',
      name: 'Staff With Skill',
      role: 'Tester',
      gather: 'g',
      execute: 'e',
      evaluate: 'ev',
      kpi: '',
      agent: 'claude-code',
      model: 'claude-sonnet-4-5',
      skills: ['del-skill'],
      created_at: new Date().toISOString()
    })

    const mockManager = Object.assign(new EventEmitter(), {
      isRunning: () => false,
      restartStaff: vi.fn()
    })

    const app = express()
    app.use(express.json())
    app.use('/api/skills', skillRoutes({
      staffManager: mockManager as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
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

  it('DELETE /api/skills/:name removes skill from connected staffs', async () => {
    // Verify skill exists and is connected
    const listRes = await fetch(`http://localhost:${port2}/api/skills`)
    const skills = await listRes.json()
    expect(skills.length).toBe(1)
    expect(skills[0].connected_staffs).toContain('staff-with-skill')

    // Delete
    const res = await fetch(`http://localhost:${port2}/api/skills/del-skill`, {
      method: 'DELETE'
    })
    expect(res.status).toBe(204)

    // Verify staff config was updated
    const { readStaffConfig } = await import('../../data/staff-data')
    const updatedConfig = readStaffConfig('staff-with-skill')
    expect(updatedConfig?.skills).not.toContain('del-skill')
  })
})

describe('skills API routes: delete restarts running staff', () => {
  let tempDir3: string
  let server3: Server
  let port3: number
  let restartFn: ReturnType<typeof vi.fn>

  beforeAll(async () => {
    tempDir3 = mkdtempSync(join(tmpdir(), 'openstaff-skills-restart-'))
    tempDir = tempDir3
    mkdirSync(join(tempDir3, 'skills'), { recursive: true })
    mkdirSync(join(tempDir3, 'staffs'), { recursive: true })

    // Create a skill
    const skillDir = join(tempDir3, 'skills', 'running-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: running-skill
description: A skill used by running staff
---
# Running Skill`)

    // Create a staff that uses this skill
    const { writeStaffConfig, ensureStaffDir } = await import('../../data/staff-data')
    ensureStaffDir('running-staff')
    writeStaffConfig({
      id: 'running-staff',
      name: 'Running Staff',
      role: 'Tester',
      gather: 'g',
      execute: 'e',
      evaluate: 'ev',
      kpi: '',
      agent: 'claude-code',
      model: 'claude-sonnet-4-5',
      skills: ['running-skill'],
      created_at: new Date().toISOString()
    })

    restartFn = vi.fn()
    const mockManager = Object.assign(new EventEmitter(), {
      isRunning: () => true, // Staff is running
      restartStaff: restartFn
    })

    const app = express()
    app.use(express.json())
    app.use('/api/skills', skillRoutes({
      staffManager: mockManager as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
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

  it('DELETE /api/skills/:name restarts running staff after removing skill', async () => {
    const res = await fetch(`http://localhost:${port3}/api/skills/running-skill`, {
      method: 'DELETE'
    })
    expect(res.status).toBe(204)
    expect(restartFn).toHaveBeenCalledWith('running-staff')
  })
})

describe('skills API routes: error handling catch blocks', () => {
  let tempDirErr: string
  let serverErr: Server
  let portErr: number

  beforeAll(async () => {
    tempDirErr = mkdtempSync(join(tmpdir(), 'openstaff-skills-err-'))
    tempDir = tempDirErr
    mkdirSync(join(tempDirErr, 'skills'), { recursive: true })
    mkdirSync(join(tempDirErr, 'staffs'), { recursive: true })

    // Create a skill so GET /:name finds it and exercises getSkillInfo -> getSkillAuthStatus -> configStore.get
    const skillDir = join(tempDirErr, 'skills', 'err-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: err-skill
description: A skill for error testing
compatibility: Requires ERR_API_KEY
---
# Err Skill`)

    // Config store that throws to trigger catch blocks
    const throwingConfigStore = {
      get: () => { throw new Error('configStore.get exploded') },
      set: () => { throw new Error('configStore.set exploded') }
    }

    const mockManager = Object.assign(new EventEmitter(), {
      isRunning: () => false,
      restartStaff: vi.fn()
    })

    const app = express()
    app.use(express.json())
    app.use('/api/skills', skillRoutes({
      staffManager: mockManager as never,
      configStore: throwingConfigStore as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    serverErr = createServer(app)
    await new Promise<void>((resolve) => {
      serverErr.listen(0, () => {
        const addr = serverErr.address()
        portErr = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    serverErr.close()
    rmSync(tempDirErr, { recursive: true, force: true })
  })

  it('GET /api/skills returns 500 when configStore.get throws', async () => {
    const res = await fetch(`http://localhost:${portErr}/api/skills`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('configStore.get exploded')
  })

  it('GET /api/skills/:name returns 500 when configStore.get throws', async () => {
    const res = await fetch(`http://localhost:${portErr}/api/skills/err-skill`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('configStore.get exploded')
  })

  it('PUT /api/skills/:name/auth returns 500 when configStore.set throws', async () => {
    const res = await fetch(`http://localhost:${portErr}/api/skills/err-skill/auth`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ERR_API_KEY: 'some-value' })
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('configStore.set exploded')
  })
})

describe('skills API routes: delete catch block', () => {
  let tempDirDel: string
  let serverDel: Server
  let portDel: number

  beforeAll(async () => {
    tempDirDel = mkdtempSync(join(tmpdir(), 'openstaff-skills-del-err-'))
    tempDir = tempDirDel
    mkdirSync(join(tempDirDel, 'skills'), { recursive: true })
    mkdirSync(join(tempDirDel, 'staffs'), { recursive: true })

    // Create a skill
    const skillDir = join(tempDirDel, 'skills', 'del-err-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: del-err-skill
description: Skill for delete error test
---
# Del Err Skill`)

    // Create a staff that uses this skill with corrupt JSON to trigger an error during delete
    const { ensureStaffDir } = await import('../../data/staff-data')
    ensureStaffDir('staff-del-err')
    // Write a corrupt staff.json that will cause readStaffConfig to fail when JSON parsing
    writeFileSync(join(tempDirDel, 'staffs', 'staff-del-err', 'staff.json'), '{invalid json}')

    const mockManager = Object.assign(new EventEmitter(), {
      isRunning: () => false,
      restartStaff: vi.fn()
    })

    const app = express()
    app.use(express.json())
    app.use('/api/skills', skillRoutes({
      staffManager: mockManager as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    serverDel = createServer(app)
    await new Promise<void>((resolve) => {
      serverDel.listen(0, () => {
        const addr = serverDel.address()
        portDel = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    serverDel.close()
    rmSync(tempDirDel, { recursive: true, force: true })
  })

  it('DELETE /api/skills/:name returns 500 when readStaffConfig throws on corrupt JSON', async () => {
    const res = await fetch(`http://localhost:${portDel}/api/skills/del-err-skill`, {
      method: 'DELETE'
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })
})
