import { test, expect } from '@playwright/test'
import { createStaffViaApi, deleteStaffViaApi, launchApp, waitForText } from './helpers'

test.describe('Staff Detail Lazy Tabs', () => {
  test('loads metrics, kpi, and memory tabs on demand', async () => {
    const { page, cleanup } = await launchApp()
    const createdIds: string[] = []

    page.on('pageerror', (err) => console.log('[PAGE_ERROR]', err.message))

    try {
      await waitForText(page, 'Welcome to OpenStaff')
      await page.click('text=Get Started')
      await page.click('text=Skip')
      await page.click('text=Go to Dashboard')
      await waitForText(page, 'Dashboard', 15000)

      const staff = await createStaffViaApi(page, {
        name: 'Lazy Tabs Staff',
        role: 'Lazy tab regression check',
        gather: 'Gather',
        execute: 'Execute',
        evaluate: 'Evaluate'
      })
      createdIds.push(staff.id)

      await page.reload()
      await waitForText(page, 'Staff', 15000)

      await page.getByRole('link', { name: `View details for ${staff.name}` }).first().click()
      await waitForText(page, staff.name, 10000)

      await page.getByRole('tab', { name: 'Metrics' }).click()
      await expect(page.getByText(/No metrics yet|Token Usage/)).toBeVisible()

      await page.getByRole('tab', { name: 'KPI' }).click()
      await expect(page.getByText(/No KPI data yet|Goal:/)).toBeVisible()

      await page.getByRole('tab', { name: 'Memory' }).click()
      await expect(page.getByText(/No learnings yet|Agent Memory/)).toBeVisible()
      await expect(page).toHaveURL(/tab=memory/)
    } finally {
      for (const id of createdIds) {
        await deleteStaffViaApi(page, id)
      }
      await cleanup()
    }
  })
})
