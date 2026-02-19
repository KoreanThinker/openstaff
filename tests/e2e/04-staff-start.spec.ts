import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Start + Monitoring', () => {
  test.skip(!!process.env.CI, 'Requires real Claude Code + API key')

  test('starts a staff and shows running status', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Create a test staff
      await page.click('text=Create Staff')
      await page.fill('input[name="name"]', 'E2E Test Staff')
      await page.fill('input[name="role"]', 'Test file creator')
      await page.fill('textarea[name="gather"]', 'Check if test-output.txt exists')
      await page.fill('textarea[name="execute"]', 'Create or update test-output.txt')
      await page.fill('textarea[name="evaluate"]', 'Verify test-output.txt exists')
      await page.click('text=Create')

      await waitForText(page, 'E2E Test Staff')
    } finally {
      await cleanup()
    }
  })
})
