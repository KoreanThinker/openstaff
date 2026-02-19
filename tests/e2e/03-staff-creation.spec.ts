import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Creation', () => {
  test('creates a new staff via form', async () => {
    const { app, page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard first
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Wait for Dashboard to fully load
      await waitForText(page, 'Staff', 15000)
      await page.waitForTimeout(1000)

      // Navigate to staff creation — use first matching button
      await page.locator('button:has-text("Create Staff")').first().click()

      // Wait for the Create Staff form page
      await page.waitForURL(/#\/staffs\/new/, { timeout: 10000 })
      await waitForText(page, 'Create Staff', 15000)

      // Fill form
      await page.fill('input[name="name"]', 'Test Staff')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt exists')

      // Submit
      await page.click('button:has-text("Create")')

      // Should navigate to staff detail
      await waitForText(page, 'Test Staff', 15000)
    } finally {
      await cleanup()
    }
  })
})
