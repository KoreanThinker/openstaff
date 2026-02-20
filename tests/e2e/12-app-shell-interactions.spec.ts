import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('App Shell Interactions', () => {
  test('sidebar toggle, header search, theme menu, and notifications', async () => {
    const { page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Dashboard', 15000)
      await page.waitForTimeout(500)

      // Sidebar brand wordmark
      await expect(page.locator('[data-wordmark-variant="split"]')).toBeVisible()

      // Sidebar collapse/expand
      await page.getByLabel('Collapse sidebar').click()
      await expect(page.getByLabel('Expand sidebar')).toBeVisible()
      await page.getByLabel('Expand sidebar').click()
      await expect(page.getByLabel('Collapse sidebar')).toBeVisible()

      // Search: navigate to Settings via Enter
      const searchInput = page.getByPlaceholder(/Search staffs, skills/)
      await searchInput.click()
      await searchInput.fill('Settings')
      await searchInput.press('Enter')
      await waitForText(page, 'Settings', 10000)

      // Theme menu interactions
      await page.getByLabel('Toggle theme').click()
      await page.getByRole('menuitem', { name: 'Dark' }).click()

      // Notification dropdown
      await page.getByLabel(/Notifications/).click()
      await expect(page.locator('text=No notifications')).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
