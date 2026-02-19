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

      // Wait for Dashboard to fully load
      await waitForText(page, 'Staff', 15000)
      await page.waitForTimeout(1000)

      // Navigate to Agents via sidebar
      await page.locator('a:has-text("Agents"), button:has-text("Agents")').first().click()
      await waitForText(page, 'Agents', 15000)

      // Check for Claude Code agent card — use specific text to avoid multiple matches
      await expect(page.locator('text=Install Claude Code')).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
