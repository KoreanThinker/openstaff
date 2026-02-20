import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Setup Wizard', () => {
  test('first launch shows wizard and navigates to dashboard', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Step 1: Welcome screen
      await waitForText(page, 'Welcome to OpenStaff')
      await expect(page.locator('[data-wordmark-variant="gradient"]')).toBeVisible()
      await page.click('text=Get Started')

      // Step 2: Remote Access (skip)
      await waitForText(page, 'Remote Access')
      await page.click('text=Skip')

      // Step 3: Complete
      await waitForText(page, "You're all set")
      await page.click('text=Go to Dashboard')

      // Should be on Dashboard now
      await waitForText(page, 'Dashboard')
    } finally {
      await cleanup()
    }
  })
})
