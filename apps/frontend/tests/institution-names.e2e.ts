import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { testPreview } from './local-config'

// Verify the frozen production bundle so development reloads cannot interrupt setup.
test.use({ baseURL: testPreview })

test('first-run web integration uses canonical institution services and renders both locales', async ({
  page,
}) => {
  test.setTimeout(120000)
  const failures: string[] = [],
    legacy: string[] = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('response', (response) => {
    if (/\/v1\//.test(response.url()) && response.status() >= 400)
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
  page.on('request', (request) => {
    if (/\/v1\/(workspaces|organization-)/.test(request.url())) legacy.push(request.url())
  })
  await page.goto('/setup')
  await page.getByLabel('Your full name').fill('Institution migration administrator')
  await page
    .getByLabel('University or training institution name')
    .fill('Migration acceptance university')
  await page.getByLabel('Sign-in email address').fill('institution-names@rafik.test')
  await page.getByLabel('Password', { exact: true }).fill('Migration-2026!')
  await page.getByLabel('Confirm password').fill('Migration-2026!')
  const initialized = page.waitForResponse(
    (response) =>
      response.url().endsWith('/v1/auth/setup') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create institution and account' }).click()
  expect((await initialized).status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('main h1')).toContainText('Migration acceptance university')
  for (const path of ['/people', '/plans', '/schedule', '/institution-settings']) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
  }
  await page.goto('/settings')
  await page.locator('input[autocomplete="name"]').fill('Named account endpoint')
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/v1/account/profile') && response.request().method() === 'PUT',
  )
  await page.locator('form').getByRole('button', { name: 'Save changes', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(page.locator('input[autocomplete="name"]')).toHaveValue('Named account endpoint')
  await page.goto('/support')
  await page.getByLabel('Subject', { exact: true }).fill('Canonical support request')
  await page.getByLabel('What happened?', { exact: true }).fill('Synthetic retirement acceptance')
  await page.getByRole('button', { name: 'Save support request', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark resolved', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Canonical support request', { exact: true }).first()).toBeVisible()
  for (const old of ['/calendar', '/session-history', '/organization/retired/admin/people']) {
    await page.goto(old)
    await expect(page.getByRole('heading', { name: 'That page isn’t here.' })).toBeVisible()
  }
  await page.goto('/people')
  await expect(page.locator('main h1')).toHaveText('People')
  await expect(page.getByRole('tab', { name: 'Athletes', exact: true })).toBeVisible()
  await expect(page.locator('main .empty-state').first()).toBeVisible()
  await page.screenshot({ path: resolve('artifacts/institution-names-en.png'), fullPage: true })
  await page.evaluate(() => {
    localStorage.setItem('rafik.locale', 'ar')
    localStorage.setItem('rafik.theme', 'dark')
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.locator('main h1')).toHaveText('الأشخاص')
  await expect(page.getByRole('tab', { name: 'الرياضيون', exact: true })).toBeVisible()
  await expect(page.locator('main .empty-state').first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.screenshot({ path: resolve('artifacts/institution-names-ar.png'), fullPage: true })
  expect(legacy).toEqual([])
  expect(failures).toEqual([])
})
