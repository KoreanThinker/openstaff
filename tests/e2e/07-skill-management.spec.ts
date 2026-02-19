import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Skill Management', () => {
  test('navigates to skills page', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Navigate to Skills
      await page.click('text=Skills')
      await waitForText(page, 'Skills')
    } finally {
      await cleanup()
    }
  })
})
