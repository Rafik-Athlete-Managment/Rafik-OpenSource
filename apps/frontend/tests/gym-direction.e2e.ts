import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

test('gym entry has dark default, unchanged logo and usable bilingual layouts', async ({
  page,
}, info) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('rafik.theme')
    localStorage.setItem('rafik.locale', 'en')
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('link', { name: 'Try a workout', exact: true })).toHaveCount(0)
  await expect(page.locator('.gym-home img')).toHaveCount(0)
  expect(await page.locator('.brand img').evaluate((el) => getComputedStyle(el).filter)).toBe(
    'none',
  )
  for (const width of [320, 768, 1280])
    for (const lang of ['en', 'ar'])
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(
          ({ lang, theme }) => {
            localStorage.setItem('rafik.locale', lang)
            localStorage.setItem('rafik.theme', theme)
          },
          { lang, theme },
        )
        await page.reload()
        await expect(page.locator('.gym-hero')).toBeVisible()
        expect(await layoutIssues(page)).toEqual([])
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
        await page.screenshot({
          path: `artifacts/r17-home-${info.project.name}-${width}-${lang}-${theme}.png`,
          fullPage: true,
        })
      }
})

test('organization month calendar and support preserve staff navigation', async ({
  page,
}, info) => {
  const f = await institutionFixture(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', { id, kind: 'institution', name: 'Madar gym review' })
    await f.login(page, f.owner, `/calendar?from=2026-09-01`)
    await expect(page.getByLabel('Calendar view', { exact: true })).toHaveValue('month')
    await expect(page.locator('.month-day:not(:disabled)')).toHaveCount(30)
    await page.locator('.month-day:not(:disabled)').nth(10).click()
    await expect(page.getByRole('button', { name: 'Show all dates', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next month', exact: true }).click()
    await expect(page.locator('.month-day:not(:disabled)')).toHaveCount(31)
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: `artifacts/r17-calendar-${info.project.name}.png`,
      fullPage: true,
    })
    await page.goto('/support')
    await expect(page.locator('.dashboard-frame')).toBeVisible()
    await expect(page.locator('.account-link svg')).toHaveCount(0)
    const overview = page
      .locator('.dashboard-sidebar')
      .getByRole('link', { name: 'Overview', exact: true })
    if (await overview.isVisible()) {
      await overview.click()
      await expect(page).toHaveURL(new RegExp(`$`))
    }
  } finally {
    await f.cleanup()
  }
})
