import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Staff Deletion', () => {
  test('creates and deletes a staff', async () => {
    const { app, page, cleanup } = await launchApp()

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Create a staff
      await page.click('text=Create Staff')
      await page.fill('input[name="name"]', 'To Delete')
      await page.fill('input[name="role"]', 'Temp role')
      await page.fill('textarea[name="gather"]', 'Gather')
      await page.fill('textarea[name="execute"]', 'Execute')
      await page.fill('textarea[name="evaluate"]', 'Evaluate')
      await page.click('text=Create')

      await waitForText(page, 'To Delete')

      // Delete the staff
      await page.click('text=Delete')
      await page.click('text=Confirm')

      // Should be back on Dashboard without the staff
      await waitForText(page, 'Dashboard')
    } finally {
      await cleanup()
    }
  })
})
