import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server } from 'http'
import { settingsRoutes } from './settings'

let server: Server
let port: number

function createMockConfigStore() {
  const store: Record<string, unknown> = {
    default_agent: 'claude-code',
    default_model: 'claude-sonnet-4-5',
    setup_completed: false,
    start_on_login: true,
    show_window_on_startup: true,
    theme: 'system',
    anthropic_api_key: 'test-key',
    openai_api_key: '',
    ngrok_api_key: '',
    ngrok_auth_password: ''
  }
  return {
    get: (key: string) => store[key] ?? '',
    set: (key: string, value: unknown) => { store[key] = value },
    getAll: () => store,
    delete: (key: string) => { delete store[key] }
  }
}

describe('settings API routes', () => {
  const mockConfigStore = createMockConfigStore()

  beforeAll(async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/settings', settingsRoutes({
      staffManager: {} as never,
      configStore: mockConfigStore as never,
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
  })

  it('GET /api/settings returns masked settings', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.anthropic_api_key).toBe('***')
    expect(data.default_agent).toBe('claude-code')
    expect(data.setup_completed).toBe(false)
  })

  it('PATCH /api/settings updates settings', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup_completed: true, theme: 'dark' })
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('saved')

    // Verify changes persisted
    expect(mockConfigStore.get('setup_completed')).toBe(true)
    expect(mockConfigStore.get('theme')).toBe('dark')
  })

  it('GET /api/settings masks empty sensitive values', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`)
    const data = await res.json()
    // openai_api_key was set to '' which is falsy, should return ''
    expect(data.openai_api_key).toBe('')
  })

  it('GET /api/settings shows empty when anthropic key is falsy', async () => {
    const original = mockConfigStore.get('anthropic_api_key')
    mockConfigStore.set('anthropic_api_key', '')

    const res = await fetch(`http://localhost:${port}/api/settings`)
    const data = await res.json()
    expect(data.anthropic_api_key).toBe('')

    mockConfigStore.set('anthropic_api_key', original)
  })

  it('GET /api/settings masks all sensitive keys when truthy', async () => {
    // Set all sensitive keys to truthy values
    mockConfigStore.set('openai_api_key', 'oai-key')
    mockConfigStore.set('ngrok_api_key', 'ngrok-key-123')
    mockConfigStore.set('ngrok_auth_password', 'secret-pass')

    const res = await fetch(`http://localhost:${port}/api/settings`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.anthropic_api_key).toBe('***')
    expect(data.openai_api_key).toBe('***')
    expect(data.ngrok_api_key).toBe('***')
    expect(data.ngrok_auth_password).toBe('***')

    // Restore
    mockConfigStore.set('openai_api_key', '')
    mockConfigStore.set('ngrok_api_key', '')
    mockConfigStore.set('ngrok_auth_password', '')
  })

  it('PATCH /api/settings rejects unknown keys', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid_key: 'value' })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Unknown setting')
  })

  it('PATCH /api/settings accepts skill_env_ prefixed keys', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_env_GITHUB_TOKEN: 'test-token' })
    })
    expect(res.status).toBe(200)
    expect(mockConfigStore.get('skill_env_GITHUB_TOKEN')).toBe('test-token')
  })

  it('PATCH /api/settings rejects boolean setting with wrong type', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup_completed: 'yes' })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('must be a boolean')
  })

  it('PATCH /api/settings rejects number setting with wrong type', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_budget_usd: 'hundred' })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('must be a finite number')
  })

  it('PATCH /api/settings rejects negative budget', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_budget_usd: -50 })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('must be non-negative')
  })

  it('PATCH /api/settings rejects string setting with wrong type', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 123 })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('must be a string')
  })

  it('PATCH /api/settings accepts valid budget number', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_budget_usd: 100 })
    })
    expect(res.status).toBe(200)
    expect(mockConfigStore.get('monthly_budget_usd')).toBe(100)
  })

  it('PATCH /api/settings updates multiple keys at once', async () => {
    const res = await fetch(`http://localhost:${port}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        default_agent: 'claude-code',
        default_model: 'claude-opus-4-6',
        start_on_login: false
      })
    })
    expect(res.status).toBe(200)
    expect(mockConfigStore.get('default_model')).toBe('claude-opus-4-6')
    expect(mockConfigStore.get('start_on_login')).toBe(false)
  })
})

describe('settings API routes: error handling', () => {
  let errorServer: Server
  let errorPort: number

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    const brokenStore = {
      get: () => { throw new Error('Storage read failure') },
      set: () => { throw new Error('Storage write failure') },
      getAll: () => { throw new Error('Storage getAll failure') },
      delete: () => { throw new Error('Storage delete failure') }
    }

    app.use('/api/settings', settingsRoutes({
      staffManager: {} as never,
      configStore: brokenStore as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    errorServer = createServer(app)
    await new Promise<void>((resolve) => {
      errorServer.listen(0, () => {
        const addr = errorServer.address()
        errorPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => errorServer.close())

  it('GET /api/settings returns 500 when configStore throws', async () => {
    const res = await fetch(`http://localhost:${errorPort}/api/settings`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Storage getAll failure')
  })

  it('PATCH /api/settings returns 500 when configStore throws', async () => {
    const res = await fetch(`http://localhost:${errorPort}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' })
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Storage write failure')
  })
})
