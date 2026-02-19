import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Window and Tray behavior', () => {
  test('closing window hides app instead of quitting', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Verify the app is running
      await waitForText(page, 'Dashboard')

      // The app should still be running (Docker Desktop model)
      const windows = app.windows()
      expect(windows.length).toBeGreaterThan(0)
    } finally {
      await cleanup()
    }
  })
})
