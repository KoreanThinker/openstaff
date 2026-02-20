import { test, expect } from '@playwright/test'
import { createStaffViaApi, deleteStaffViaApi, launchApp, waitForText } from './helpers'

test.describe('Dashboard Search + Sort', () => {
  test('applies search filter and name sort order correctly', async () => {
    const { page, cleanup } = await launchApp()
    const createdIds: string[] = []

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      // Skip wizard
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')
      await waitForText(page, 'Dashboard', 15000)

      // Seed staff data via API
      const alpha = await createStaffViaApi(page, {
        name: 'Alpha Staff',
        role: 'Role A',
        gather: 'Gather A',
        execute: 'Execute A',
        evaluate: 'Evaluate A'
      })
      const zeta = await createStaffViaApi(page, {
        name: 'Zeta Staff',
        role: 'Role Z',
        gather: 'Gather Z',
        execute: 'Execute Z',
        evaluate: 'Evaluate Z'
      })
      createdIds.push(alpha.id, zeta.id)

      // Refresh dashboard list after seeding
      await page.reload()
      await waitForText(page, 'Staff', 15000)
      await expect(page.getByRole('link', { name: 'View details for Alpha Staff' }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'View details for Zeta Staff' }).first()).toBeVisible()

      // Search filter: keep Zeta only
      const searchInput = page.locator('input[placeholder="Search staff..."]')
      await searchInput.fill('Zeta')
      await expect(page.getByRole('link', { name: 'View details for Zeta Staff' }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'View details for Alpha Staff' })).toHaveCount(0)

      // Empty result UX + clear filters
      await searchInput.fill('NoSuchStaff')
      await expect(page.locator('text=No matching Staff')).toBeVisible()
      await page.getByRole('button', { name: 'Clear Filters' }).click()
      await expect(page.getByRole('link', { name: 'View details for Alpha Staff' }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'View details for Zeta Staff' }).first()).toBeVisible()

      // Clear search and verify both are back
      await searchInput.fill('')
      await expect(page.getByRole('link', { name: 'View details for Alpha Staff' }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'View details for Zeta Staff' }).first()).toBeVisible()

      // Name sort default is ascending -> Alpha first among visible staff cards/rows
      const visibleStaffLinks = page.locator('[aria-label^="View details for "]:visible')
      await expect(visibleStaffLinks.first()).toHaveAttribute('aria-label', /Alpha Staff/)

      // If desktop table header is visible, verify toggle to descending (Zeta first)
      const nameHeader = page.getByRole('columnheader', { name: /^Name/i })
      if (await nameHeader.count()) {
        await nameHeader.first().click()
        await expect(visibleStaffLinks.first()).toHaveAttribute('aria-label', /Zeta Staff/)
      }
    } finally {
      for (const id of createdIds) {
        await deleteStaffViaApi(page, id)
      }
      await cleanup()
    }
  })
})
