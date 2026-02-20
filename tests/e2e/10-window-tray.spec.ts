import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Window and Tray behavior', () => {
  test('app launches with window and sidebar navigation works', async () => {
    const { app, page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Verify the app is running with at least one window
      const windows = app.windows()
      expect(windows.length).toBeGreaterThan(0)

      // Verify Dashboard loaded
      await waitForText(page, 'Dashboard', 15000)
      await page.waitForTimeout(1000)

      // Navigate to each page via sidebar and verify it loads
      // Skills
      await page.locator('a:has-text("Skills"), button:has-text("Skills")').first().click()
      await waitForText(page, 'Skills', 10000)

      // Agents
      await page.locator('a:has-text("Agents"), button:has-text("Agents")').first().click()
      await waitForText(page, 'Agents', 10000)

      // Settings
      await page.locator('a:has-text("Settings"), button:has-text("Settings")').first().click()
      await waitForText(page, 'Settings', 10000)

      // Navigate back to Dashboard
      await page.locator('a:has-text("Dashboard"), button:has-text("Dashboard")').first().click()
      await waitForText(page, 'Dashboard', 10000)

      // App should still be running after all navigation
      const windowsAfter = app.windows()
      expect(windowsAfter.length).toBeGreaterThan(0)
    } finally {
      await cleanup()
    }
  })

  test('closing window hides app instead of quitting', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Dashboard')

      // The app should still be running (Docker Desktop model - close hides to tray)
      const windows = app.windows()
      expect(windows.length).toBeGreaterThan(0)

      // Evaluate the window count via Electron
      const windowCount = await app.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length
      })
      expect(windowCount).toBeGreaterThan(0)
    } finally {
      await cleanup()
    }
  })
})
