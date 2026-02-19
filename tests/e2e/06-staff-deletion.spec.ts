import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Deletion', () => {
  test('creates and deletes a staff', async () => {
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

      // Create a staff
      await page.locator('button:has-text("Create Staff")').first().click()
      await page.waitForURL(/#\/staffs\/new/, { timeout: 10000 })
      await waitForText(page, 'Create Staff', 15000)

      await page.fill('input[name="name"]', 'To Delete')
      await page.fill('input[name="role"]', 'Temp role')
      await page.fill('textarea[name="gather"]', 'Gather')
      await page.fill('textarea[name="execute"]', 'Execute')
      await page.fill('textarea[name="evaluate"]', 'Evaluate')

      // Submit — use button selector to avoid matching the heading
      await page.locator('button:has-text("Create")').first().click()

      // Should navigate to staff detail
      await waitForText(page, 'To Delete', 15000)

      // Delete the staff — click the Delete button on staff detail page
      await page.locator('button:has-text("Delete")').first().click()

      // Wait for the delete confirmation dialog
      await waitForText(page, 'This will permanently delete', 5000)

      // Click the destructive Delete button in the dialog
      await page.locator('[role="dialog"] button:has-text("Delete")').click({ timeout: 5000 })

      // Should be back on Dashboard
      await waitForText(page, 'Dashboard', 15000)
    } finally {
      await cleanup()
    }
  })
})
