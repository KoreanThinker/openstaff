import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { AgentInfo } from '../../src/shared/types'
import { mkdtempSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function launchApp(): Promise<{
  app: ElectronApplication
  page: Page
  cleanup: () => Promise<void>
}> {
  const testHome = mkdtempSync(join(tmpdir(), 'openstaff-e2e-'))
  const userDataDir = mkdtempSync(join(tmpdir(), 'openstaff-e2e-userdata-'))

  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      OPENSTAFF_HOME: testHome,
      ELECTRON_USER_DATA_DIR: userDataDir,
      NODE_ENV: 'test'
    }
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  const cleanup = async (): Promise<void> => {
    await app.close()
    const { rmSync } = await import('fs')
    rmSync(testHome, { recursive: true, force: true })
    rmSync(userDataDir, { recursive: true, force: true })
  }

  return { app, page, cleanup }
}

export async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(`text=${text}`, { timeout })
}

export async function getApiBase(page: Page): Promise<string> {
  return page.evaluate(() => {
    return `http://localhost:${(window as Window & { __apiPort?: number }).__apiPort || 19836}`
  })
}

export async function getAgents(page: Page): Promise<AgentInfo[]> {
  const apiBase = await getApiBase(page)
  const response = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/agents`)
    if (!res.ok) {
      throw new Error(`Failed to load agents: ${res.status}`)
    }
    return res.json()
  }, apiBase)

  return response as AgentInfo[]
}

export async function hasConnectedClaudeAgent(page: Page): Promise<boolean> {
  const agents = await getAgents(page)
  const claude = agents.find((agent) => agent.id === 'claude-code')
  return !!claude && claude.connected
}

export async function createStaffViaApi(page: Page, input: {
  name: string
  role: string
  gather: string
  execute: string
  evaluate: string
}): Promise<{ id: string; name: string }> {
  const apiBase = await getApiBase(page)
  const created = await page.evaluate(async ({ base, payload }) => {
    const res = await fetch(`${base}/api/staffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error || `Failed to create staff (${res.status})`)
    }
    return res.json()
  }, { base: apiBase, payload: input })

  return created as { id: string; name: string }
}

export async function deleteStaffViaApi(page: Page, staffId: string): Promise<void> {
  const apiBase = await getApiBase(page)
  await page.evaluate(async ({ base, id }) => {
    await fetch(`${base}/api/staffs/${id}`, { method: 'DELETE' })
  }, { base: apiBase, id: staffId })
}
