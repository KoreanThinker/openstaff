import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Agent Install + Connect', () => {
  // Local-only: requires real npm install + API key
  test.skip(!!process.env.CI, 'Requires real Claude Code + API key')

  test('installs Claude Code and connects with API key', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Navigate to Agents
      await page.click('text=Agents')
      await waitForText(page, 'Agents')

      // Check for Claude Code agent card
      await expect(page.locator('text=Claude Code')).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
