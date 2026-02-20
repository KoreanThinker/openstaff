import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Settings Persistence', () => {
  test('settings page shows all sections and allows interaction', async () => {
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

      // Navigate to Settings
      await page.locator('a:has-text("Settings"), button:has-text("Settings")').first().click()
      await waitForText(page, 'Settings', 15000)

      // Verify all sections are visible
      await expect(page.locator('text=Remote Access')).toBeVisible()
      await expect(page.locator('text=Defaults')).toBeVisible()
      await expect(page.locator('text=App Behavior')).toBeVisible()
      await expect(page.locator('text=About')).toBeVisible()

      // Remote Access section: Ngrok fields
      await expect(page.locator('text=Ngrok API Key')).toBeVisible()
      await expect(page.locator('text=Auth Password')).toBeVisible()

      // Defaults section: Agent and Model selects
      await expect(page.locator('text=Default Agent')).toBeVisible()
      await expect(page.locator('text=Default Model')).toBeVisible()

      // App Behavior section: Switches and theme
      await expect(page.locator('text=Start on Login')).toBeVisible()
      await expect(page.locator('text=Show Window on Startup')).toBeVisible()
      await expect(page.locator('text=Theme')).toBeVisible()

      // Theme buttons should exist
      await expect(page.locator('button:has-text("Light")')).toBeVisible()
      await expect(page.locator('button:has-text("Dark")')).toBeVisible()
      await expect(page.locator('button:has-text("System")')).toBeVisible()

      // Toggle theme to Dark
      await page.locator('button:has-text("Dark")').click()
      await page.waitForTimeout(500)

      // Toggle theme back to Light
      await page.locator('button:has-text("Light")').click()
      await page.waitForTimeout(500)

      // About section: version and links
      await expect(page.locator('text=OpenStaff v')).toBeVisible()
      await expect(page.locator('button:has-text("Check for Updates")')).toBeVisible()
      await expect(page.locator('text=GitHub')).toBeVisible()
      await expect(page.locator('text=Documentation')).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
