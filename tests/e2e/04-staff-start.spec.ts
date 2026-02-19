import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Start + Monitoring', () => {
  test.skip(!!process.env.CI, 'Requires real Claude Code + API key')

  test('starts a staff and shows running status', async () => {
    const { app, page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Wait for Dashboard to fully load
      await waitForText(page, 'Staff', 15000)
      await page.waitForTimeout(1000)

      // Create a test staff
      await page.locator('button:has-text("Create Staff")').first().click()
      await page.waitForURL(/#\/staffs\/new/, { timeout: 10000 })
      await waitForText(page, 'Create Staff', 15000)

      await page.fill('input[name="name"]', 'E2E Test Staff')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt exists')

      await page.locator('button:has-text("Create")').first().click()

      await waitForText(page, 'E2E Test Staff', 15000)
    } finally {
      await cleanup()
    }
  })
})
