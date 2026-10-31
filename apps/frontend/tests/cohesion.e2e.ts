import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { layoutIssues } from './layout-contract'

test('Help explains the institution dashboard without a institution chooser', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: 'Your institution dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open your dashboard' })).toHaveAttribute(
    'href',
    '/dashboard',
  )
  await expect(page.getByRole('link', { name: 'Choose your institution' })).toHaveCount(0)
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
