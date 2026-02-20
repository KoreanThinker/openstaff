import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer, Server } from 'http'

let server: Server
let port: number

// Mock agent registry
vi.mock('../../agent-driver/agent-registry', () => {
  return {
    getAllDrivers: () => [{
      id: 'claude-code',
      name: 'Claude Code',
      isInstalled: async () => true,
      getVersion: async () => '1.0.0',
      getAvailableModels: () => [
        { id: 'claude-sonnet-4-5', name: 'Sonnet 4.5', description: 'Balanced' }
      ],
      install: async () => {},
      testConnection: async (key: string) => key === 'valid-key'
    }],
    getDriver: (id: string) => {
      if (id !== 'claude-code') return undefined
      return {
        id: 'claude-code',
        name: 'Claude Code',
        isInstalled: async () => true,
        getVersion: async () => '1.0.0',
        getAvailableModels: () => [
          { id: 'claude-sonnet-4-5', name: 'Sonnet 4.5', description: 'Balanced' }
        ],
        install: async () => {},
        testConnection: async (key: string) => key === 'valid-key'
      }
    }
  }
})

const { agentRoutes } = await import('./agents')
const agentRegistry = await import('../../agent-driver/agent-registry')

function createMockConfigStore() {
  const store: Record<string, unknown> = {
    anthropic_api_key: 'valid-key',
    openai_api_key: ''
  }
  return {
    get: (key: string) => store[key] ?? '',
    set: (key: string, value: unknown) => { store[key] = value },
    delete: (key: string) => { delete store[key] }
  }
}

describe('agents API routes', () => {
  beforeAll(async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
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

  afterAll(() => server.close())

  it('GET /api/agents lists all agents including Codex placeholder', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.length).toBe(2)
    expect(data[0].id).toBe('claude-code')
    expect(data[0].installed).toBe(true)
    expect(data[0].status).toBe('connected')
    expect(data[1].id).toBe('codex')
    expect(data[1].status).toBe('not_installed')
  })

  it('GET /api/agents/:id returns single agent', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.id).toBe('claude-code')
    expect(data.connected).toBe(true)
  })

  it('GET /api/agents/:id returns 404 for unknown agent', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/unknown`)
    expect(res.status).toBe(404)
  })

  it('GET /api/agents/:id/models returns models', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/models`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.length).toBe(1)
    expect(data[0].id).toBe('claude-sonnet-4-5')
  })

  it('PUT /api/agents/:id/api-key saves API key', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'new-key' })
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('saved')
  })

  it('PUT /api/agents/:id/api-key rejects non-string api_key', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 12345 })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('api_key must be a string')
  })

  it('PUT /api/agents/:id/api-key rejects overly long api_key', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'x'.repeat(501) })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('too long')
  })

  it('PUT /api/agents/:id/api-key rejects unknown agent', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/unknown-agent/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'test' })
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Unknown agent')
  })

  it('POST /api/agents/:id/test-connection tests connection', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/test-connection`, {
      method: 'POST'
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(typeof data.connected).toBe('boolean')
  })

  it('POST /api/agents/:id/test-connection returns not connected when no API key', async () => {
    // Clear the API key first
    await fetch(`http://localhost:${port}/api/agents/claude-code/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: '' })
    })

    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/test-connection`, {
      method: 'POST'
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.connected).toBe(false)
    expect(data.error).toBe('No API key configured')

    // Restore key
    await fetch(`http://localhost:${port}/api/agents/claude-code/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'valid-key' })
    })
  })

  it('POST /api/agents/:id/install triggers installation', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/claude-code/install`, {
      method: 'POST'
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('installed')
  })

  it('PUT /api/agents/codex/api-key saves OpenAI key', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/codex/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'openai-key-123' })
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('saved')
  })

  it('POST /api/agents/unknown/install returns 404', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/unknown/install`, {
      method: 'POST'
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/agents/unknown/test-connection returns 404', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/unknown/test-connection`, {
      method: 'POST'
    })
    expect(res.status).toBe(404)
  })

  it('GET /api/agents/unknown/models returns 404', async () => {
    const res = await fetch(`http://localhost:${port}/api/agents/unknown/models`)
    expect(res.status).toBe(404)
  })
})

describe('agents API routes: test-connection catch block', () => {
  let errServer: Server
  let errPort: number

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    // Config store that throws on get to trigger the test-connection catch block
    const throwingConfigStore = {
      get: () => { throw new Error('config store exploded') },
      set: vi.fn()
    }

    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: throwingConfigStore as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
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

  it('POST /api/agents/:id/test-connection returns 500 when handler throws', async () => {
    const res = await fetch(`http://localhost:${errPort}/api/agents/claude-code/test-connection`, {
      method: 'POST'
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('config store exploded')
  })
})

describe('agents API routes: models catch block', () => {
  let modelsErrServer: Server
  let modelsErrPort: number
  let originalGetDriver: typeof agentRegistry.getDriver

  beforeAll(async () => {
    // Temporarily override getDriver to return a driver whose getAvailableModels throws
    originalGetDriver = agentRegistry.getDriver
    ;(agentRegistry as Record<string, unknown>).getDriver = (id: string) => {
      if (id !== 'claude-code') return undefined
      return {
        id: 'claude-code',
        name: 'Claude Code',
        getAvailableModels: () => { throw new Error('models exploded') }
      }
    }

    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    modelsErrServer = createServer(app)
    await new Promise<void>((resolve) => {
      modelsErrServer.listen(0, () => {
        const addr = modelsErrServer.address()
        modelsErrPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    ;(agentRegistry as Record<string, unknown>).getDriver = originalGetDriver
    modelsErrServer.close()
  })

  it('GET /api/agents/:id/models returns 500 when getAvailableModels throws', async () => {
    const res = await fetch(`http://localhost:${modelsErrPort}/api/agents/claude-code/models`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('models exploded')
  })
})

describe('agents API routes: list catch block', () => {
  let listErrServer: Server
  let listErrPort: number
  let originalGetAllDrivers: typeof agentRegistry.getAllDrivers

  beforeAll(async () => {
    originalGetAllDrivers = agentRegistry.getAllDrivers
    ;(agentRegistry as Record<string, unknown>).getAllDrivers = () => {
      throw new Error('getAllDrivers exploded')
    }

    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    listErrServer = createServer(app)
    await new Promise<void>((resolve) => {
      listErrServer.listen(0, () => {
        const addr = listErrServer.address()
        listErrPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    ;(agentRegistry as Record<string, unknown>).getAllDrivers = originalGetAllDrivers
    listErrServer.close()
  })

  it('GET /api/agents returns 500 when getAllDrivers throws', async () => {
    const res = await fetch(`http://localhost:${listErrPort}/api/agents`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('getAllDrivers exploded')
  })
})

describe('agents API routes: not_installed state', () => {
  let niServer: Server
  let niPort: number
  let originalGetAllDrivers: typeof agentRegistry.getAllDrivers
  let originalGetDriver: typeof agentRegistry.getDriver

  beforeAll(async () => {
    originalGetAllDrivers = agentRegistry.getAllDrivers
    originalGetDriver = agentRegistry.getDriver

    const notInstalledDriver = {
      id: 'claude-code',
      name: 'Claude Code',
      isInstalled: async () => false,
      getVersion: async () => null,
      getAvailableModels: () => [],
      install: async () => {},
      testConnection: async () => false
    }

    ;(agentRegistry as Record<string, unknown>).getAllDrivers = () => [notInstalledDriver]
    ;(agentRegistry as Record<string, unknown>).getDriver = (id: string) => {
      if (id === 'claude-code') return notInstalledDriver
      return undefined
    }

    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    niServer = createServer(app)
    await new Promise<void>((resolve) => {
      niServer.listen(0, () => {
        const addr = niServer.address()
        niPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    ;(agentRegistry as Record<string, unknown>).getAllDrivers = originalGetAllDrivers
    ;(agentRegistry as Record<string, unknown>).getDriver = originalGetDriver
    niServer.close()
  })

  it('GET /api/agents shows not_installed when isInstalled returns false', async () => {
    const res = await fetch(`http://localhost:${niPort}/api/agents`)
    const data = await res.json()
    expect(res.status).toBe(200)
    const claude = data.find((a: { id: string }) => a.id === 'claude-code')
    expect(claude.status).toBe('not_installed')
    expect(claude.installed).toBe(false)
    expect(claude.version).toBeNull()
  })

  it('GET /api/agents/:id shows not_installed status', async () => {
    const res = await fetch(`http://localhost:${niPort}/api/agents/claude-code`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('not_installed')
    expect(data.version).toBeNull()
  })
})

describe('agents API routes: GET single agent catch block', () => {
  let getErrServer: Server
  let getErrPort: number
  let originalGetDriver: typeof agentRegistry.getDriver

  beforeAll(async () => {
    originalGetDriver = agentRegistry.getDriver
    ;(agentRegistry as Record<string, unknown>).getDriver = (id: string) => {
      if (id !== 'claude-code') return undefined
      return {
        id: 'claude-code',
        name: 'Claude Code',
        isInstalled: async () => { throw new Error('isInstalled exploded') },
        getVersion: async () => '1.0.0',
        getAvailableModels: () => [],
        install: async () => {},
        testConnection: async () => true
      }
    }

    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    getErrServer = createServer(app)
    await new Promise<void>((resolve) => {
      getErrServer.listen(0, () => {
        const addr = getErrServer.address()
        getErrPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    ;(agentRegistry as Record<string, unknown>).getDriver = originalGetDriver
    getErrServer.close()
  })

  it('GET /api/agents/:id returns 500 when isInstalled throws', async () => {
    const res = await fetch(`http://localhost:${getErrPort}/api/agents/claude-code`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('isInstalled exploded')
  })
})

describe('agents API routes: install catch block', () => {
  let installErrServer: Server
  let installErrPort: number
  let originalGetDriver: typeof agentRegistry.getDriver

  beforeAll(async () => {
    originalGetDriver = agentRegistry.getDriver
    ;(agentRegistry as Record<string, unknown>).getDriver = (id: string) => {
      if (id !== 'claude-code') return undefined
      return {
        id: 'claude-code',
        name: 'Claude Code',
        install: async () => { throw new Error('install exploded') },
        isInstalled: async () => true,
        getVersion: async () => '1.0.0',
        getAvailableModels: () => [],
        testConnection: async () => true
      }
    }

    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: createMockConfigStore() as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    installErrServer = createServer(app)
    await new Promise<void>((resolve) => {
      installErrServer.listen(0, () => {
        const addr = installErrServer.address()
        installErrPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    ;(agentRegistry as Record<string, unknown>).getDriver = originalGetDriver
    installErrServer.close()
  })

  it('POST /api/agents/:id/install returns 500 when install throws', async () => {
    const res = await fetch(`http://localhost:${installErrPort}/api/agents/claude-code/install`, {
      method: 'POST'
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('install exploded')
  })
})

describe('agents API routes: api-key catch block', () => {
  let apiKeyErrServer: Server
  let apiKeyErrPort: number

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    const throwingConfigStore = {
      get: () => '',
      set: () => { throw new Error('api key save failed') }
    }

    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: throwingConfigStore as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    apiKeyErrServer = createServer(app)
    await new Promise<void>((resolve) => {
      apiKeyErrServer.listen(0, () => {
        const addr = apiKeyErrServer.address()
        apiKeyErrPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => apiKeyErrServer.close())

  it('PUT /api/agents/:id/api-key returns 500 when configStore.set throws', async () => {
    const res = await fetch(`http://localhost:${apiKeyErrPort}/api/agents/claude-code/api-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'test' })
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('api key save failed')
  })
})

describe('agents API routes: disconnected state', () => {
  let dcServer: Server
  let dcPort: number

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    // Config store with no API key set
    const emptyConfigStore = {
      get: () => '',
      set: vi.fn()
    }

    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: emptyConfigStore as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
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

  afterAll(() => dcServer.close())

  it('GET /api/agents shows disconnected when installed but no API key', async () => {
    const res = await fetch(`http://localhost:${dcPort}/api/agents`)
    const data = await res.json()
    expect(res.status).toBe(200)
    const claude = data.find((a: { id: string }) => a.id === 'claude-code')
    expect(claude.status).toBe('disconnected')
    expect(claude.api_key_configured).toBe(false)
    expect(claude.installed).toBe(true)
  })

  it('GET /api/agents/:id shows disconnected when no API key', async () => {
    const res = await fetch(`http://localhost:${dcPort}/api/agents/claude-code`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('disconnected')
    expect(data.connected).toBe(false)
  })
})

describe('agents API routes: non-claude-code driver branches', () => {
  let nccServer: Server
  let nccPort: number
  let originalGetAllDrivers: typeof agentRegistry.getAllDrivers
  let originalGetDriver: typeof agentRegistry.getDriver

  beforeAll(async () => {
    originalGetAllDrivers = agentRegistry.getAllDrivers
    originalGetDriver = agentRegistry.getDriver

    const codexDriver = {
      id: 'codex',
      name: 'OpenAI Codex',
      isInstalled: async () => true,
      getVersion: async () => '2.0.0',
      getAvailableModels: () => [],
      install: async (onProgress: (p: number) => void) => { onProgress(50); onProgress(100) },
      testConnection: async (key: string) => key === 'openai-key'
    }

    ;(agentRegistry as Record<string, unknown>).getAllDrivers = () => [codexDriver]
    ;(agentRegistry as Record<string, unknown>).getDriver = (id: string) => {
      if (id === 'codex') return codexDriver
      return undefined
    }

    const store: Record<string, unknown> = { openai_api_key: 'openai-key' }
    const app = express()
    app.use(express.json())
    app.use('/api/agents', agentRoutes({
      staffManager: {} as never,
      configStore: { get: (k: string) => store[k] ?? '', set: (k: string, v: unknown) => { store[k] = v } } as never,
      monitoringEngine: {} as never,
      io: { emit: vi.fn() } as never
    }))

    nccServer = createServer(app)
    await new Promise<void>((resolve) => {
      nccServer.listen(0, () => {
        const addr = nccServer.address()
        nccPort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })
  })

  afterAll(() => {
    ;(agentRegistry as Record<string, unknown>).getAllDrivers = originalGetAllDrivers
    ;(agentRegistry as Record<string, unknown>).getDriver = originalGetDriver
    nccServer.close()
  })

  it('GET /api/agents reads openai_api_key for non-claude-code driver', async () => {
    const res = await fetch(`http://localhost:${nccPort}/api/agents`)
    const data = await res.json()
    expect(res.status).toBe(200)
    const codex = data.find((a: { id: string }) => a.id === 'codex')
    expect(codex.status).toBe('connected')
    expect(codex.api_key_configured).toBe(true)
  })

  it('POST /api/agents/:id/install calls progress callback', async () => {
    const res = await fetch(`http://localhost:${nccPort}/api/agents/codex/install`, {
      method: 'POST'
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.status).toBe('installed')
  })

  it('POST /api/agents/:id/test-connection reads openai_api_key for codex', async () => {
    const res = await fetch(`http://localhost:${nccPort}/api/agents/codex/test-connection`, {
      method: 'POST'
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.connected).toBe(true)
  })
})

