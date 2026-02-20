import { test, expect } from '@playwright/test'
import { launchApp, waitForText } from './helpers'

test.describe('Skill Management', () => {
  test('shows empty state and add skill modal with tabs', async () => {
    const { app, page, cleanup } = await launchApp()

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')

      // Wait for Dashboard to load
      await waitForText(page, 'Staff', 15000)
      await page.waitForTimeout(1000)

      // Navigate to Skills
      await page.locator('a:has-text("Skills"), button:has-text("Skills")').first().click()
      await waitForText(page, 'Skills', 15000)

      // Should show empty state since no skills installed (except built-in openstaff)
      // Check for either empty state or the skills list
      const hasEmptyState = await page.locator('text=No skills installed yet').isVisible().catch(() => false)
      const hasSkillsList = await page.locator('text=openstaff').isVisible().catch(() => false)

      // At least one of these should be true
      expect(hasEmptyState || hasSkillsList).toBeTruthy()

      // Click Add Skill button (either in empty state or header)
      const addButton = page.locator('button:has-text("Add Skill"), button:has-text("Add Your First Skill")').first()
      await addButton.click()

      // Add Skill modal should appear
      await waitForText(page, 'Add Skill', 5000)

      // Should have Local Import and GitHub Registry tabs
      await expect(page.locator('text=Local Import')).toBeVisible()
      await expect(page.locator('text=GitHub Registry')).toBeVisible()

      // Local Import tab should be selected by default
      // Should show path input and Browse button
      await expect(page.locator('text=Path to skill directory').or(page.locator('input[placeholder*="Path"]'))).toBeVisible()
      await expect(page.locator('button:has-text("Browse")')).toBeVisible()

      // Import button should be disabled without a path
      const importButton = page.locator('button:has-text("Import Skill")')
      if (await importButton.isVisible()) {
        await expect(importButton).toBeDisabled()
      }

      // Switch to Registry tab
      await page.locator('button:has-text("GitHub Registry")').click()
      await page.waitForTimeout(1000)

      // Close the modal
      const cancelButton = page.locator('button:has-text("Cancel")').first()
      await cancelButton.click()

      // Modal should be closed
      await page.waitForTimeout(500)
    } finally {
      await cleanup()
    }
  })
})
