import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server } from 'http'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Initialize tempDir BEFORE mock so getter has a valid path
let tempDir: string = mkdtempSync(join(tmpdir(), 'openstaff-registry-'))
let server: Server
let port: number

vi.mock('@shared/constants', async () => {
  const actual = await vi.importActual('@shared/constants')
  return {
    ...actual,
    get REGISTRY_DIR() { return join(tempDir, 'registry') },
    REGISTRY_CACHE_TTL_MS: 999999999,
    REGISTRY_GITHUB_OWNER: 'koreanthinker',
    REGISTRY_GITHUB_REPO: 'openstaff'
  }
})

const { registryRoutes } = await import('./registry')

// Shared setup — one server for all suites
beforeAll(async () => {
  mkdirSync(join(tempDir, 'registry'), { recursive: true })

  const app = express()
  app.use(express.json())
  app.use('/api/registry', registryRoutes({
    staffManager: {} as never,
    configStore: {} as never,
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

describe('registry API routes', () => {
  beforeAll(() => {
    // Seed valid cache
    const cache = {
      fetched_at: Date.now(),
      data: {
        version: '1.0.0',
        updated_at: new Date().toISOString(),
        templates: [
          {
            id: 'test-template',
            name: 'Test Template',
            role: 'Tester',
            category: 'Dev',
            gather: 'Gather',
            execute: 'Execute',
            evaluate: 'Evaluate',
            kpi: '',
            required_skills: [],
            recommended_agent: 'claude-code',
            recommended_model: 'claude-sonnet-4-5'
          }
        ],
        skills: [
          {
            name: 'test-skill',
            description: 'Test skill',
            category: 'Dev',
            author: 'test',
            version: '1.0.0',
            auth_required: false,
            required_env_vars: [],
            github_path: 'registry/skills/test-skill'
          }
        ]
      }
    }
    writeFileSync(join(tempDir, 'registry', 'cache.json'), JSON.stringify(cache))
  })

  it('GET /api/registry returns registry index', async () => {
    const res = await fetch(`http://localhost:${port}/api/registry`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.version).toBe('1.0.0')
    expect(data.templates.length).toBe(1)
    expect(data.skills.length).toBe(1)
  })

  it('GET /api/registry/templates returns templates', async () => {
    const res = await fetch(`http://localhost:${port}/api/registry/templates`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data[0].name).toBe('Test Template')
  })

  it('GET /api/registry/skills returns skills', async () => {
    const res = await fetch(`http://localhost:${port}/api/registry/skills`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data[0].name).toBe('test-skill')
  })
})

describe('registry skill install', () => {
  const realFetch = globalThis.fetch

  beforeAll(() => {
    // Mock fetch to return a SKILL.md for GitHub and pass through localhost
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      if (urlStr.includes('localhost')) {
        return realFetch(url, init)
      }
      // Return SKILL.md content for skill install
      if (urlStr.includes('SKILL.md')) {
        return {
          ok: true,
          text: async () => '---\nname: test-skill\ndescription: A test skill\n---\n# Test Skill'
        } as Response
      }
      // Return registry index for other GitHub calls
      return { ok: false, status: 404 } as Response
    }) as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = realFetch
  })

  it('POST /api/registry/skills/:name/install installs skill from registry', async () => {
    const res = await realFetch(`http://localhost:${port}/api/registry/skills/test-skill/install`, {
      method: 'POST'
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('installed')
    expect(data.name).toBe('test-skill')
  })

  it('POST /api/registry/skills/:name/install returns 404 for unknown skill', async () => {
    const res = await realFetch(`http://localhost:${port}/api/registry/skills/nonexistent-skill/install`, {
      method: 'POST'
    })
    expect(res.status).toBe(404)
  })
})

describe('registry routes with expired cache', () => {
  const realFetch = globalThis.fetch

  beforeAll(() => {
    // Overwrite the cache with expired data
    const cache = {
      fetched_at: 0, // epoch = very expired
      data: {
        version: '0.9.0',
        updated_at: '2024-01-01T00:00:00Z',
        templates: [],
        skills: []
      }
    }
    writeFileSync(join(tempDir, 'registry', 'cache.json'), JSON.stringify(cache))

    // Mock global fetch to simulate GitHub failure, but let localhost through
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      if (urlStr.includes('localhost')) {
        return realFetch(url, init)
      }
      return { ok: false, status: 503, json: async () => ({}) } as Response
    }) as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = realFetch
  })

  it('GET /api/registry falls back to expired cache when fetch fails', async () => {
    const res = await realFetch(`http://localhost:${port}/api/registry`)
    const data = await res.json()
    expect(res.status).toBe(200)
    // Should return the cached data (even expired) since GitHub fetch fails
    expect(data.version).toBe('0.9.0')
  })
})
