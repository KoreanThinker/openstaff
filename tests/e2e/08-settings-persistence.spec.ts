import { test, expect, type Page } from '@playwright/test'
import { launchApp, waitForText, getApiBase } from './helpers'

async function getSettings(page: Page): Promise<{
  start_on_login: boolean
  show_window_on_startup: boolean
  theme: 'light' | 'dark' | 'system'
}> {
  const apiBase = await getApiBase(page)
  return page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/settings`)
    if (!res.ok) {
      throw new Error(`Failed to fetch settings: ${res.status}`)
    }
    return res.json()
  }, apiBase)
}

test.describe('Settings Persistence', () => {
  test('settings are saved and preserved across navigation', async () => {
    const { page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Dashboard', 15000)

      // Navigate to Settings
      await page.getByRole('link', { name: /^Settings$/ }).click()
      await waitForText(page, 'Settings', 15000)

      // Verify sections are visible
      await expect(page.locator('text=Remote Access')).toBeVisible()
      await expect(page.locator('text=Defaults')).toBeVisible()
      await expect(page.locator('text=App Behavior')).toBeVisible()
      await expect(page.locator('text=About')).toBeVisible()

      const switches = page.getByRole('switch')
      const startOnLoginSwitch = switches.nth(0)
      const showOnStartupSwitch = switches.nth(1)

      const initialStartOnLogin = (await startOnLoginSwitch.getAttribute('aria-checked')) === 'true'
      const initialShowOnStartup = (await showOnStartupSwitch.getAttribute('aria-checked')) === 'true'

      await startOnLoginSwitch.click()
      await showOnStartupSwitch.click()

      await expect(startOnLoginSwitch).toHaveAttribute('aria-checked', String(!initialStartOnLogin))
      await expect(showOnStartupSwitch).toHaveAttribute('aria-checked', String(!initialShowOnStartup))

      await expect.poll(async () => {
        const settings = await getSettings(page)
        return settings.start_on_login
      }).toBe(!initialStartOnLogin)

      await expect.poll(async () => {
        const settings = await getSettings(page)
        return settings.show_window_on_startup
      }).toBe(!initialShowOnStartup)

      const darkThemeButton = page.getByRole('button', { name: 'Dark' })
      await darkThemeButton.click()
      await expect(darkThemeButton).toHaveAttribute('aria-pressed', 'true')

      await expect.poll(async () => {
        const settings = await getSettings(page)
        return settings.theme
      }).toBe('dark')

      // Navigate away and come back to confirm persistence
      await page.getByRole('link', { name: /^Dashboard$/ }).click()
      await waitForText(page, 'Dashboard', 10000)
      await page.getByRole('link', { name: /^Settings$/ }).click()
      await waitForText(page, 'Settings', 10000)

      await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('switch').nth(0)).toHaveAttribute('aria-checked', String(!initialStartOnLogin))
      await expect(page.getByRole('switch').nth(1)).toHaveAttribute('aria-checked', String(!initialShowOnStartup))

      // About section remains functional
      await expect(page.locator('text=OpenStaff v')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Check for Updates' })).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
