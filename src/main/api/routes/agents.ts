import { Router } from 'express'
import type { ApiContext } from '../server'
import type { AgentInfo } from '@shared/types'
import { getDriver, getAllDrivers } from '../../agent-driver/agent-registry'

function getApiKeyStoreKey(agentId: string): 'anthropic_api_key' | 'openai_api_key' | null {
  if (agentId === 'claude-code') return 'anthropic_api_key'
  if (agentId === 'codex') return 'openai_api_key'
  return null
}

function parseApiKeyList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function buildPlaceholderCodex(): AgentInfo {
  return {
    id: 'codex',
    name: 'OpenAI Codex',
    installed: false,
    version: null,
    connected: false,
    api_key_configured: false,
    models: [],
    status: 'not_installed'
  }
}

export function agentRoutes(ctx: ApiContext): Router {
  const router = Router()

  // List all agents
  router.get('/', async (_req, res) => {
    try {
      const drivers = getAllDrivers()
      const agents: AgentInfo[] = await Promise.all(
        drivers.map(async (driver) => {
          const installed = await driver.isInstalled()
          const version = installed ? await driver.getVersion() : null
          const apiKeyStoreKey = getApiKeyStoreKey(driver.id)
          const apiKey = apiKeyStoreKey ? ctx.configStore.get(apiKeyStoreKey) : ''
          const apiKeyConfigured = apiKeyStoreKey ? parseApiKeyList(apiKey).length > 0 : true

          let status: AgentInfo['status'] = 'not_installed'
          if (installed && apiKeyConfigured) status = 'connected'
          else if (installed) status = 'disconnected'

          return {
            id: driver.id,
            name: driver.name,
            installed,
            version,
            connected: status === 'connected',
            api_key_configured: apiKeyConfigured,
            models: driver.getAvailableModels(),
            status
          }
        })
      )

      // Add Codex placeholder only when no concrete driver exists yet.
      if (!agents.some((agent) => agent.id === 'codex')) {
        agents.push(buildPlaceholderCodex())
      }

      res.json(agents)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get single agent
  router.get('/:id', async (req, res) => {
    try {
      const driver = getDriver(req.params.id!)
      if (!driver) {
        if (req.params.id === 'codex') {
          return res.json(buildPlaceholderCodex())
        }
        return res.status(404).json({ error: 'Agent not found' })
      }

      const installed = await driver.isInstalled()
      const version = installed ? await driver.getVersion() : null
      const apiKeyStoreKey = getApiKeyStoreKey(driver.id)
      const apiKey = apiKeyStoreKey ? ctx.configStore.get(apiKeyStoreKey) : ''
      const apiKeyConfigured = apiKeyStoreKey ? parseApiKeyList(apiKey).length > 0 : true

      res.json({
        id: driver.id,
        name: driver.name,
        installed,
        version,
        connected: installed && apiKeyConfigured,
        api_key_configured: apiKeyConfigured,
        models: driver.getAvailableModels(),
        status: installed && apiKeyConfigured ? 'connected' : installed ? 'disconnected' : 'not_installed'
      })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Install agent
  router.post('/:id/install', async (req, res) => {
    try {
      const driver = getDriver(req.params.id!)
      if (!driver) return res.status(404).json({ error: 'Agent not found' })

      ctx.io.emit('agent:install:progress', { agentId: req.params.id, percent: 0 })

      await driver.install((percent) => {
        ctx.io.emit('agent:install:progress', { agentId: req.params.id, percent })
      })

      ctx.io.emit('agent:status:change', { agentId: req.params.id, status: 'disconnected' })
      res.json({ status: 'installed' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Update API key
  router.put('/:id/api-key', (req, res) => {
    try {
      const { api_key } = req.body as { api_key: string }
      if (typeof api_key !== 'string') {
        return res.status(400).json({ error: 'api_key must be a string' })
      }
      if (api_key.length > 500) {
        return res.status(400).json({ error: 'api_key is too long' })
      }
      const storeKey = getApiKeyStoreKey(req.params.id!)
      if (!storeKey) {
        return res.status(400).json({ error: 'Unknown agent' })
      }
      if (api_key === '') {
        ctx.configStore.delete(storeKey)
      } else {
        ctx.configStore.set(storeKey, api_key)
      }
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Test connection
  router.post('/:id/test-connection', async (req, res) => {
    try {
      const driver = getDriver(req.params.id!)
      if (!driver) return res.status(404).json({ error: 'Agent not found' })

      const apiKeyStoreKey = getApiKeyStoreKey(req.params.id!)
      const apiKey = apiKeyStoreKey ? ctx.configStore.get(apiKeyStoreKey) : ''
      const apiKeys = parseApiKeyList(apiKey)
      if (apiKeyStoreKey && apiKeys.length === 0) {
        return res.json({ connected: false, error: 'No API key configured' })
      }

      const connected = await driver.testConnection(apiKeys[0] ?? '')
      res.json({ connected })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get models
  router.get('/:id/models', (req, res) => {
    try {
      const driver = getDriver(req.params.id!)
      if (!driver) return res.status(404).json({ error: 'Agent not found' })
      res.json(driver.getAvailableModels())
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
