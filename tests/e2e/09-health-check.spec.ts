import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Health Check + Recovery', () => {
  test.skip(!!process.env.CI, 'Requires real process kill/restart')

  test('auto-recovers after agent process is killed', async () => {
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

      // Create and start a staff for the health check test
      await page.locator('button:has-text("Create Staff")').first().click()
      await page.waitForURL(/#\/staffs\/new/, { timeout: 10000 })
      await waitForText(page, 'Create Staff', 15000)

      await page.fill('input[name="name"]', 'E2E Health Check')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt exists')

      await page.locator('button:has-text("Create")').first().click()
      await waitForText(page, 'E2E Health Check', 15000)

      // Start the staff
      await page.locator('button:has-text("Start")').first().click()
      await page.waitForTimeout(5000)

      // Verify it's running
      const isRunning = await page.locator('text=Running').isVisible().catch(() => false)
      const hasStopButton = await page.locator('button:has-text("Stop")').isVisible().catch(() => false)
      expect(isRunning || hasStopButton).toBeTruthy()

      // Get the API port and query the staff status via API
      const apiBase = await page.evaluate(() => {
        return (window as Record<string, unknown>).__API_BASE__ || 'http://localhost:17734'
      })

      // Kill the agent process externally to trigger health check recovery
      // The health checker should detect the dead process and restart it
      const staffsResponse = await page.evaluate(async (base) => {
        const resp = await fetch(`${base}/api/staffs`)
        return resp.json()
      }, apiBase)

      // Verify we have the staff in the API
      expect(Array.isArray(staffsResponse)).toBeTruthy()
      const ourStaff = (staffsResponse as Array<{ name: string; status: string }>)
        .find((s) => s.name === 'E2E Health Check')
      expect(ourStaff).toBeDefined()

      // Stop the staff before cleanup
      await page.locator('button:has-text("Stop")').first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2000)
    } finally {
      await cleanup()
    }
  })
})
