import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Creation', () => {
  test('creates a new staff via form', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard first
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Navigate to staff creation
      await page.click('text=Create Staff')
      await waitForText(page, 'Create Staff')

      // Fill form
      await page.fill('input[name="name"]', 'Test Staff')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt exists')

      // Submit
      await page.click('text=Create')

      // Should navigate to staff detail
      await waitForText(page, 'Test Staff')
    } finally {
      await cleanup()
    }
  })
})
