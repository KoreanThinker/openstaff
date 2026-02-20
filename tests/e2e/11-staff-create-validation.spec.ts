import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Create Validation + Discard', () => {
  test('validates required fields and handles discard dialog', async () => {
    const { page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Staff', 15000)
      await page.waitForTimeout(500)

      // Open create screen
      await page.locator('button:has-text("Create Staff")').first().click()
      await page.waitForURL(/#\/staffs\/new/, { timeout: 10000 })
      await waitForText(page, 'Create Staff', 15000)

      const submitButton = page.locator('button:has-text("Create & Start")')

      // Initially disabled because required fields are empty
      await expect(submitButton).toBeDisabled()

      // Fill partial fields
      await page.fill('input[name="name"]', 'Validation Staff')
      await page.fill('input[name="role"]', 'Validation role')
      await page.fill('textarea[name="gather"]', 'Collect data')
      await expect(submitButton).toBeDisabled()

      // Fill all required fields -> enabled
      await page.fill('textarea[name="execute"]', 'Do work')
      await page.fill('textarea[name="evaluate"]', 'Evaluate output')
      await expect(submitButton).toBeEnabled()

      // Make form invalid again
      await page.fill('input[name="role"]', '')
      await expect(submitButton).toBeDisabled()

      // Trigger dirty cancel flow
      await page.locator('button:has-text("Cancel")').first().click()
      await waitForText(page, 'Discard changes?', 5000)

      // Keep editing first
      await page.locator('button:has-text("Keep editing")').click()
      await waitForText(page, 'Create Staff', 5000)
      await page.waitForURL(/#\/staffs\/new/, { timeout: 5000 })

      // Cancel and discard
      await page.locator('button:has-text("Cancel")').first().click()
      await waitForText(page, 'Discard changes?', 5000)
      await page.locator('button:has-text("Discard")').click()

      await waitForText(page, 'Dashboard', 15000)
    } finally {
      await cleanup()
    }
  })
})
