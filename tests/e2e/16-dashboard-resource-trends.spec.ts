import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Dashboard Resource Trends', () => {
  test('shows system resource bars with trend or baseline hints', async () => {
    const { page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Dashboard', 15000)
      await expect(page.locator('text=System Resources')).toBeVisible()
      await expect(page.locator('text=CPU')).toBeVisible()
      await expect(page.getByText(/^Memory \(/)).toBeVisible()

      await expect(page.locator('[role="progressbar"]')).toHaveCount(2)
      await expect(page.getByText(/Collecting trend baseline|stable|rising|falling/).first()).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
