import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Start + Monitoring', () => {
  test.skip(!!process.env.CI, 'Requires real Claude Code + API key')

  test('creates a staff, starts it, and verifies running status', async () => {
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

      await page.fill('input[name="name"]', 'E2E Start Test')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists in the current directory')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt with a timestamp')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt was created or updated')

      await page.locator('button:has-text("Create")').first().click()

      // Should navigate to staff detail
      await waitForText(page, 'E2E Start Test', 15000)

      // Click Start button
      await page.locator('button:has-text("Start")').first().click()

      // Status should change to running (or starting)
      await page.waitForTimeout(3000)

      // Look for running status indicator or status text
      const isRunning = await page.locator('text=Running').isVisible().catch(() => false)
      const isStarting = await page.locator('text=Starting').isVisible().catch(() => false)
      const hasStopButton = await page.locator('button:has-text("Stop")').isVisible().catch(() => false)

      // At least one indicator should show the staff started
      expect(isRunning || isStarting || hasStopButton).toBeTruthy()

      // Verify the Overview tab shows status
      await expect(page.locator('text=Overview').first()).toBeVisible()

      // Wait for some output to appear in the logs
      if (await page.locator('text=Logs').isVisible()) {
        await page.locator('text=Logs').click()
        // Wait for log output to appear
        await page.waitForTimeout(5000)
      }

      // Stop the staff before cleanup
      await page.locator('button:has-text("Stop")').first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2000)
    } finally {
      await cleanup()
    }
  })
})
