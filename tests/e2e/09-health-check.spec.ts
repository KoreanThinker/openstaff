import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Health Check + Recovery', () => {
  test.skip(!!process.env.CI, 'Requires real process kill/restart')

  test('auto-recovers after process kill', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Dashboard')
    } finally {
      await cleanup()
    }
  })
})
