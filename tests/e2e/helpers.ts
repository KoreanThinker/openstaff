import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
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

  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      OPENSTAFF_HOME: testHome,
      NODE_ENV: 'test'
    }
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  const cleanup = async (): Promise<void> => {
    await app.close()
    const { rmSync } = await import('fs')
    rmSync(testHome, { recursive: true, force: true })
  }

  return { app, page, cleanup }
}

export async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(`text=${text}`, { timeout })
}
