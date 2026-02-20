import { join } from 'path'
import { homedir } from 'os'

export const OPENSTAFF_HOME = process.env['OPENSTAFF_HOME'] || join(homedir(), '.openstaff')
export const STAFFS_DIR = join(OPENSTAFF_HOME, 'staffs')
export const SKILLS_DIR = join(OPENSTAFF_HOME, 'skills')
export const TOOLS_DIR = join(OPENSTAFF_HOME, 'tools')
export const REGISTRY_DIR = join(OPENSTAFF_HOME, 'registry')

export const API_PORT = parseInt(process.env['OPENSTAFF_API_PORT'] || '0', 10)

export const HEALTH_CHECK_INTERVAL_MS = 60_000
export const IDLE_TIMEOUT_MS = 5 * 60_000
export const MAX_CONSECUTIVE_FAILURES = 5
export const FAILURE_WINDOW_MS = 5 * 60_000
export const BACKOFF_DELAYS_MS = [30_000, 60_000, 120_000]

export const LOG_ROTATION_DAYS = 30
export const LOG_MAX_LINES_MEMORY = 10_000
export const LOG_INITIAL_LINES = 500

export const KEEP_GOING_PROMPT =
  'Continue working. Start your next Gather → Execute → Evaluate cycle now. Do not stop.'

export const INITIAL_PROMPT =
  'You are now active. Begin your first Gather → Execute → Evaluate cycle. Do not stop.'

export const CLAUDE_CODE_MODELS = [
  { id: 'claude-opus-4-6', name: 'Opus 4.6', description: 'Most capable' },
  { id: 'claude-sonnet-4-5', name: 'Sonnet 4.5', description: 'Balanced' },
  { id: 'claude-haiku-4-5', name: 'Haiku 4.5', description: 'Fastest' }
] as const

export const CODEX_MODELS = [
  { id: 'gpt-5', name: 'GPT-5', description: 'Most capable' },
  { id: 'gpt-5-mini', name: 'GPT-5 mini', description: 'Balanced speed and cost' },
  { id: 'gpt-5-nano', name: 'GPT-5 nano', description: 'Fastest and lowest cost' }
] as const

export const PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  'claude-opus-4-6': { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  'claude-sonnet-4-5': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-haiku-4-5': { input: 0.8, output: 4, cache_read: 0.08, cache_write: 1 }
}

export const REGISTRY_GITHUB_OWNER = 'koreanthinker'
export const REGISTRY_GITHUB_REPO = 'openstaff'
export const REGISTRY_CACHE_TTL_MS = 60 * 60_000
