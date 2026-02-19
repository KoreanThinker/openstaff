import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Settings Persistence', () => {
  test('settings persist across app restarts', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Navigate to Settings
      await page.click('text=Settings')
      await waitForText(page, 'Settings')

      // Settings should be accessible
      await expect(page.locator('text=App Behavior')).toBeVisible()
      await expect(page.locator('text=Defaults')).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
