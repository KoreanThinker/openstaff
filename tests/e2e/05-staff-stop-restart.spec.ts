import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Stop + Restart', () => {
  test.skip(!!process.env.CI, 'Requires real running Staff process')

  test('creates, starts, stops, and restarts a staff', async () => {
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

      await page.fill('input[name="name"]', 'E2E Stop Restart')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt exists')

      await page.locator('button:has-text("Create")').first().click()
      await waitForText(page, 'E2E Stop Restart', 15000)

      // Start the staff
      await page.locator('button:has-text("Start")').first().click()
      await page.waitForTimeout(5000)

      // Should see running indicators
      const isRunning = await page.locator('text=Running').isVisible().catch(() => false)
      const hasStopButton = await page.locator('button:has-text("Stop")').isVisible().catch(() => false)
      expect(isRunning || hasStopButton).toBeTruthy()

      // Stop the staff
      await page.locator('button:has-text("Stop")').first().click()
      await page.waitForTimeout(3000)

      // Should see stopped/idle status
      const isStopped = await page.locator('text=Idle').isVisible().catch(() => false)
      const hasStartButton = await page.locator('button:has-text("Start")').isVisible().catch(() => false)
      expect(isStopped || hasStartButton).toBeTruthy()

      // Restart the staff
      await page.locator('button:has-text("Start")').first().click()
      await page.waitForTimeout(5000)

      // Should be running again
      const isRunningAgain = await page.locator('text=Running').isVisible().catch(() => false)
      const hasStopAgain = await page.locator('button:has-text("Stop")').isVisible().catch(() => false)
      expect(isRunningAgain || hasStopAgain).toBeTruthy()

      // Final cleanup - stop the staff
      await page.locator('button:has-text("Stop")').first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2000)
    } finally {
      await cleanup()
    }
  })
})
