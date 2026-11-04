import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { testDatabase } from './local-config'

test.afterEach(({}, info) => {
  if (!/^rafik_browser_\d+$/.test(testDatabase))
    throw new Error('Instance branding acceptance requires its disposable database.')
  const email = `branding-${info.project.name}@rafik.test`,
    backend = resolve(import.meta.dirname, '../../backend')
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      resolve(backend, '../../infrastructure/compose.yaml'),
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      'rafik_migrate',
      '-d',
      testDatabase,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      cwd: backend,
      input: `DELETE FROM public.institutions WHERE created_by IN (SELECT id FROM identity.users WHERE email='${email}'); DELETE FROM identity.users WHERE email='${email}'; UPDATE public.instance_branding SET owner_id=NULL,name='Rafik',accent='#285943',background_light='#f8f8f3',background_dark='#171e1a',logo=NULL,logo_mime=NULL WHERE id=true;`,
      stdio: 'pipe',
    },
  )
})

test('the first super admin can set persistent and safe instance branding', async ({
  page,
  context,
}, info) => {
  test.setTimeout(90000)
  const arabic = info.project.name.includes('phone')
  await page.goto('/setup')
  await page.getByLabel('Your full name').fill('Branding Admin')
  await page.getByLabel('University or training institution name').fill('Madar Rugby Institute')
  await page.getByLabel('Sign-in email address').fill(`branding-${info.project.name}@rafik.test`)
  await page.getByLabel('Password', { exact: true }).fill('Branding setup password 2026!')
  await page.getByLabel('Confirm password').fill('Branding setup password 2026!')
  const setup = page.waitForResponse((response) => response.url().endsWith('/v1/auth/setup'))
  await page.getByRole('button', { name: 'Create institution and account' }).click()
  expect((await setup).status()).toBe(200)
  await expect(page).toHaveURL(/\/organization\/[a-f0-9-]{36}\/admin/)
  const institutionId = page.url().match(/\/organization\/([a-f0-9-]{36})\//)?.[1]
  expect(institutionId).toBeTruthy()
  await page.goto(`/settings`)
  if (arabic) await page.getByRole('button', { name: 'Switch to Arabic' }).click()
  await expect(
    page.getByRole('heading', { name: arabic ? 'هوية التثبيت' : 'Instance branding' }),
  ).toBeVisible()
  const nameInput = page.getByLabel(arabic ? 'اسم التثبيت' : 'Installation name')
  await nameInput.fill('Madar Rugby')
  await page.locator('.instance-branding').evaluate((element) => {
    const state = (element as any).__vueParentComponent?.setupState
    if (!state) throw new Error('Branding editor state was not available')
    state.accent = '#2457a6'
    state.backgroundLight = '#e8eef8'
    state.backgroundDark = '#111827'
  })
  const logoPath = resolve(import.meta.dirname, '../public/brand/rafik.png')
  await page.getByLabel(arabic ? /الشعار/ : /Logo \(/).setInputFiles({
    name: 'university-mark.png',
    mimeType: 'image/png',
    buffer: readFileSync(logoPath),
  })
  const saveResponse = page.waitForResponse(
    (response) => response.url().includes('/branding') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: arabic ? 'حفظ الهوية' : 'Save branding' }).click()
  const saved = await saveResponse
  expect(saved.status(), await saved.text()).toBe(200)
  const savedBranding = await saved.json()
  expect(savedBranding).toMatchObject({
    accent: '#2457a6',
    background_light: '#e8eef8',
    background_dark: '#111827',
  })
  await expect(page.locator('.brand')).toContainText('Madar Rugby')
  await expect(page.locator('.brand')).toContainText(arabic ? 'بدعم من رفيق' : 'Powered by Rafik')
  await expect(page.locator('.brand img')).toHaveAttribute('src', /\/v1\/instance\/branding\/logo/)
  expect(
    await page
      .locator('html')
      .evaluate((element) => element.style.getPropertyValue('--instance-accent')),
  ).toBe('#2457a6')
  expect(
    await page
      .locator('html')
      .evaluate((element) => element.style.getPropertyValue('--instance-page-light')),
  ).toBe('#e8eef8')
  expect(
    await page
      .locator('html')
      .evaluate((element) => element.style.getPropertyValue('--instance-page-dark')),
  ).toBe('#111827')
  await expect(page.locator('.brand > span')).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('.swal2-container')).toBeHidden()
  const receipt = resolve(import.meta.dirname, '../../../docs/verification/receipts')
  await page.screenshot({
    path: resolve(receipt, `stage5-branding-${info.project.name}-viewport.png`),
  })
  await page.screenshot({
    path: resolve(receipt, `stage5-branding-${info.project.name}-full-page.png`),
    fullPage: true,
  })
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.reload()
  await expect(page).toHaveTitle('Madar Rugby | Training, connected')
  await expect(page.locator('.brand')).toContainText('Madar Rugby')
  await expect(page.locator('.brand img')).toHaveAttribute('src', /\/v1\/instance\/branding\/logo/)
  expect(
    await page
      .locator('html')
      .evaluate((element) => element.style.getPropertyValue('--instance-page-light')),
  ).toBe('#e8eef8')
  expect(
    await page
      .locator('html')
      .evaluate((element) => element.style.getPropertyValue('--instance-page-dark')),
  ).toBe('#111827')
  expect((await context.cookies()).some((cookie) => cookie.name === 'rafik_session')).toBe(true)
})
