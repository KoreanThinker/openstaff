import { Router } from 'express'
import type { ApiContext } from '../server'
import type { AgentInfo } from '@shared/types'
import { getDriver, getAllDrivers } from '../../agent-driver/agent-registry'

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
          const apiKey = driver.id === 'claude-code'
            ? ctx.configStore.get('anthropic_api_key')
            : ctx.configStore.get('openai_api_key')
          const apiKeyConfigured = !!apiKey && apiKey !== ''

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

      // Add Codex placeholder
      agents.push({
        id: 'codex',
        name: 'OpenAI Codex',
        installed: false,
        version: null,
        connected: false,
        api_key_configured: false,
        models: [],
        status: 'not_installed'
      })

      res.json(agents)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Get single agent
  router.get('/:id', async (req, res) => {
    try {
      const driver = getDriver(req.params.id!)
      if (!driver) return res.status(404).json({ error: 'Agent not found' })

      const installed = await driver.isInstalled()
      const version = installed ? await driver.getVersion() : null
      const apiKey = ctx.configStore.get('anthropic_api_key')
      const apiKeyConfigured = !!apiKey && apiKey !== ''

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
      if (req.params.id === 'claude-code') {
        ctx.configStore.set('anthropic_api_key', api_key)
      } else if (req.params.id === 'codex') {
        ctx.configStore.set('openai_api_key', api_key)
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

      const apiKey = req.params.id === 'claude-code'
        ? ctx.configStore.get('anthropic_api_key')
        : ctx.configStore.get('openai_api_key')

      if (!apiKey) return res.json({ connected: false, error: 'No API key configured' })

      const connected = await driver.testConnection(apiKey)
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
