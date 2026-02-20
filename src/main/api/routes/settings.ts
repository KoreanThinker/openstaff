import { Router } from 'express'
import type { ApiContext } from '../server'
import type { SettingsKey } from '@shared/types'

const ALLOWED_SETTINGS: string[] = [
  'anthropic_api_key',
  'openai_api_key',
  'ngrok_api_key',
  'ngrok_auth_password',
  'default_agent',
  'default_model',
  'setup_completed',
  'start_on_login',
  'show_window_on_startup',
  'theme',
  'monthly_budget_usd',
  'budget_warning_percent'
]

function isValidSettingsKey(key: string): boolean {
  return ALLOWED_SETTINGS.includes(key) || key.startsWith('skill_env_')
}

export function settingsRoutes(ctx: ApiContext): Router {
  const router = Router()

  // Get all settings
  router.get('/', (_req, res) => {
    try {
      const settings = ctx.configStore.getAll()
      // Mask sensitive values
      const masked = {
        ...settings,
        anthropic_api_key: settings.anthropic_api_key ? '***' : '',
        openai_api_key: settings.openai_api_key ? '***' : '',
        ngrok_api_key: settings.ngrok_api_key ? '***' : '',
        ngrok_auth_password: settings.ngrok_auth_password ? '***' : ''
      }
      res.json(masked)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Update settings
  router.patch('/', (req, res) => {
    try {
      const updates = req.body as Record<string, unknown>
      for (const [key, value] of Object.entries(updates)) {
        if (!isValidSettingsKey(key)) {
          return res.status(400).json({ error: `Unknown setting: ${key}` })
        }
        ctx.configStore.set(key as SettingsKey, value as never)
      }
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
