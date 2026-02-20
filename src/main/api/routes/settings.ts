import { Router } from 'express'
import type { ApiContext } from '../server'
import type { SettingsKey } from '@shared/types'

const ALLOWED_SETTINGS: string[] = [
  'anthropic_api_key',
  'openai_api_key',
  'slack_webhook_url',
  'ngrok_api_key',
  'ngrok_auth_password',
  'default_agent',
  'default_model',
  'setup_completed',
  'start_on_login',
  'show_window_on_startup',
  'auto_update_agents',
  'theme',
  'monthly_budget_usd',
  'budget_warning_percent'
]

const BOOLEAN_SETTINGS = new Set(['setup_completed', 'start_on_login', 'show_window_on_startup', 'auto_update_agents'])
const NUMBER_SETTINGS = new Set(['monthly_budget_usd', 'budget_warning_percent'])
const STRING_SETTINGS = new Set([
  'anthropic_api_key', 'openai_api_key', 'ngrok_api_key', 'ngrok_auth_password',
  'slack_webhook_url',
  'default_agent', 'default_model', 'theme'
])
const THEME_SETTINGS = new Set(['light', 'dark', 'system'])
const DEFAULT_AGENT_SETTINGS = new Set(['claude-code', 'codex', 'gemini-cli'])

function isValidSettingsKey(key: string): boolean {
  return ALLOWED_SETTINGS.includes(key) || key.startsWith('skill_env_')
}

function validateSettingValue(key: string, value: unknown): string | null {
  if (BOOLEAN_SETTINGS.has(key)) {
    if (typeof value !== 'boolean') return `${key} must be a boolean`
  } else if (NUMBER_SETTINGS.has(key)) {
    if (typeof value !== 'number' || !isFinite(value)) return `${key} must be a finite number`
    if (value < 0) return `${key} must be non-negative`
    if (key === 'budget_warning_percent' && value > 100) return `${key} must be 100 or less`
  } else if (STRING_SETTINGS.has(key) || key.startsWith('skill_env_')) {
    if (typeof value !== 'string') return `${key} must be a string`
    if (value.length > 1000) return `${key} is too long`
    if ((key === 'default_agent' || key === 'default_model' || key === 'theme') && value.trim().length === 0) {
      return `${key} cannot be empty`
    }
    if (key === 'theme' && !THEME_SETTINGS.has(value)) {
      return `${key} must be one of light, dark, system`
    }
    if (key === 'default_agent' && !DEFAULT_AGENT_SETTINGS.has(value)) {
      return `${key} must be one of claude-code, codex, gemini-cli`
    }
  }
  return null
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
        slack_webhook_url: settings.slack_webhook_url ? '***' : '',
        ngrok_api_key: settings.ngrok_api_key ? '***' : '',
        ngrok_auth_password: settings.ngrok_auth_password ? '***' : ''
      }
      res.json(masked)
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Update settings
  router.patch('/', async (req, res) => {
    try {
      const updates = req.body
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return res.status(400).json({ error: 'Body must be an object' })
      }

      const entries = Object.entries(updates as Record<string, unknown>)

      // Validate all fields first to avoid partial writes on failure.
      for (const [key, value] of entries) {
        if (!isValidSettingsKey(key)) {
          return res.status(400).json({ error: `Unknown setting: ${key}` })
        }
        const valError = validateSettingValue(key, value)
        if (valError) {
          return res.status(400).json({ error: valError })
        }
      }

      for (const [key, value] of entries) {
        ctx.configStore.set(key as SettingsKey, value as never)
      }

      const shouldRefreshNgrok =
        entries.some(([key]) => key === 'ngrok_api_key' || key === 'ngrok_auth_password')
      if (shouldRefreshNgrok && ctx.ngrokManager) {
        await ctx.ngrokManager.restartFromConfig()
      }
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
