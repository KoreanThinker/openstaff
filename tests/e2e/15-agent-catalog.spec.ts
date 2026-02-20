import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Agent Catalog', () => {
  test('shows Codex and Gemini agent cards', async () => {
    const { page, cleanup } = await launchApp()

    try {
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      await waitForText(page, 'Dashboard', 15000)
      await page.locator('a:has-text("Agents"), button:has-text("Agents")').first().click()
      await waitForText(page, 'Agents', 15000)

      await expect(page.getByText('OpenAI Codex')).toBeVisible()
      await expect(page.getByText('Google Gemini CLI')).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
