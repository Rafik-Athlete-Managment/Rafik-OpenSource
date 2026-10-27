import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { testDatabase } from './local-config.ts'

test.afterEach(() => {
  if (!/^rafik_browser_\d+$/.test(testDatabase))
    throw new Error('Onboarding acceptance requires its disposable empty database.')
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      resolve(import.meta.dirname, '../../../infrastructure/compose.yaml'),
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
      cwd: resolve(import.meta.dirname, '../../backend'),
      input:
        "DELETE FROM public.institutions WHERE created_by IN (SELECT id FROM identity.users WHERE email IN ('legacy-setup@rafik.test','setup-admin@rafik.test','coach@rafik.test','athlete@rafik.test')); DELETE FROM identity.users WHERE email IN ('legacy-setup@rafik.test','setup-admin@rafik.test','coach@rafik.test','athlete@rafik.test');",
      stdio: 'pipe',
    },
  )
})

test('first launch creates the super admin and an invited member can join without email verification', async ({
  page,
  context,
  browser,
}, testInfo) => {
  test.setTimeout(90000)
  const screenshot = async (target: Page, role: string) => {
    const stem = testInfo.outputPath(`dashboard-${role}-${testInfo.project.name}`)
    await target.screenshot({ path: stem + '-viewport.png' })
    await target.screenshot({ path: stem + '-full-page.png', fullPage: true })
  }
  const waitForDashboardData = async (target: Page, role: 'admin' | 'trainer' | 'athlete') => {
    await expect(target.getByRole('heading', { name: 'Rafik Test University' })).toBeVisible()
    await expect(target.getByText(/Loading upcoming events/)).toBeHidden()
    if (role !== 'athlete')
      await expect(
        target.getByRole('status').filter({ hasText: /Checking recent activity/ }),
      ).toBeHidden()
  }
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      resolve(import.meta.dirname, '../../../infrastructure/compose.yaml'),
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
      cwd: resolve(import.meta.dirname, '../../backend'),
      input:
        "INSERT INTO identity.users (email,raw_user_meta_data) VALUES ('legacy-setup@rafik.test','{}');",
      stdio: 'pipe',
    },
  )
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.getByRole('heading', { name: 'Create the super admin' })).toBeVisible()
  await expect(page.getByText(/first person to finish this form becomes/i)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
  const layout = await page.locator('.auth-form').evaluate((form) => {
    const box = form.getBoundingClientRect()
    return {
      centerDelta: Math.abs(box.left + box.width / 2 - document.documentElement.clientWidth / 2),
      logoBackground: getComputedStyle(document.querySelector('.brand img')!).backgroundColor,
    }
  })
  expect(layout.centerDelta).toBeLessThan(2)
  expect(layout.logoBackground).toBe('rgba(0, 0, 0, 0)')

  await page.getByLabel('Your full name').fill('Rafik Setup Admin')
  await page.getByLabel('University or training institution name').fill('Rafik Test University')
  await page.getByLabel('Sign-in email address').fill('setup-admin@rafik.test')
  await page.getByLabel('Password', { exact: true }).fill('First setup password 2026!')
  await page.getByLabel('Confirm password').fill('First setup password 2026!')
  const setupResponse = page.waitForResponse((response) =>
    response.url().endsWith('/v1/auth/setup'),
  )
  await page.getByRole('button', { name: 'Create institution and account' }).click()
  const created = await setupResponse
  const setupBody = await created.json()
  const cookieNames = (await context.cookies('http://127.0.0.1:55341')).map((cookie) => cookie.name)
  expect(
    created.status(),
    `setup response: ${JSON.stringify(setupBody)} (${cookieNames.join(',')})`,
  ).toBe(200)
  await expect
    .poll(async () => {
      const alert = page.getByRole('alert')
      return (await alert.isVisible())
        ? `setup error: ${await alert.innerText()}; cookies: ${cookieNames.join(',')}`
        : page.url()
    })
    .toMatch(/\/dashboard$/)
  await expect.poll(() => page.locator('body').innerText()).toContain('Rafik Test University')
  const initialPeopleLink = page.getByRole('link', { name: 'People & access' }).first()
  if (!(await initialPeopleLink.isVisible()))
    await page.getByRole('button', { name: 'Open navigation' }).click()
  const adminNavigation = page.locator('.dashboard-navigation:visible').first()
  await expect(adminNavigation.getByRole('link', { name: 'People & access' })).toBeVisible()
  await expect(adminNavigation.getByRole('link', { name: 'Analytics', exact: true })).toBeVisible()
  await expect(adminNavigation.getByRole('link', { name: 'Programs', exact: true })).toBeVisible()
  if (await page.getByRole('button', { name: 'Close navigation' }).isVisible())
    await page.getByRole('button', { name: 'Close navigation' }).click()

  // Omitted legacy athlete routes are unavailable; return through the canonical dashboard.
  await page.goto('/today')
  await expect(page.getByRole('heading', { name: 'That page isn’t here.' })).toBeVisible()
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('combobox', { name: 'Institution' })).toHaveCount(0)
  await expect(page.locator('.institution-nav')).toHaveCount(0)
  await expect(page.locator('.organization-nav')).toBeHidden()
  await waitForDashboardData(page, 'admin')
  const roleDashboard = page.locator('.dashboard-navigation:visible').first()
  if (!(await roleDashboard.count()))
    await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(roleDashboard.getByRole('link', { name: 'People & access' })).toBeVisible()
  // Navigation sections are flat and always visible; no group hides another.
  await expect(roleDashboard.locator('details')).toHaveCount(0)
  await expect(roleDashboard.getByRole('link', { name: 'Exercises', exact: true })).toBeVisible()
  if (await page.getByRole('button', { name: 'Close navigation' }).isVisible())
    await page.getByRole('button', { name: 'Close navigation' }).click()
  await screenshot(page, 'administrator')

  await page.getByRole('button', { name: 'Invite people' }).click()
  await page.getByLabel('Email address').fill('coach@rafik.test')
  await page.getByRole('radio', { name: 'Coach' }).check()
  await page.getByRole('button', { name: 'Create invitation' }).click()
  const link = page.getByLabel('Invitation link')
  await expect(link).toBeVisible()
  const invitationUrl = await link.inputValue()

  const inviteContext = await browser.newContext()
  const invited = await inviteContext.newPage()
  await invited.goto(invitationUrl)
  await expect(invited.getByRole('heading', { name: 'Join Rafik Test University' })).toBeVisible()
  await expect(
    invited.getByText(/email address identifies your account; it is not verified/i),
  ).toBeVisible()
  await invited.getByLabel('Your full name').fill('Rafik Test Coach')
  await invited.getByLabel('Sign-in email').fill('coach@rafik.test')
  await invited.getByLabel('Create a password', { exact: true }).fill('Coach invite password 2026!')
  await invited.getByLabel('Confirm password').fill('Coach invite password 2026!')
  await invited.getByRole('button', { name: 'Create account and join' }).click()
  await expect(invited).toHaveURL(/\/dashboard$/)
  await expect(invited.getByRole('heading', { name: 'Rafik Test University' })).toBeVisible()
  await waitForDashboardData(invited, 'trainer')
  await expect(invited.locator('.institution-nav')).toHaveCount(0)
  await expect(invited.locator('.institution-nav')).toBeHidden()
  const trainerNavigation = invited.locator('.dashboard-navigation:visible').first()
  if (!(await trainerNavigation.count()))
    await invited.getByRole('button', { name: 'Open navigation' }).click()
  await expect(trainerNavigation.getByRole('link', { name: 'People', exact: true })).toBeVisible()
  if (await invited.getByRole('button', { name: 'Close navigation' }).isVisible())
    await invited.getByRole('button', { name: 'Close navigation' }).click()
  await screenshot(invited, 'trainer')
  await inviteContext.close()

  await page.getByLabel('Email address').fill('athlete@rafik.test')
  await page.getByRole('radio', { name: 'Athlete' }).check()
  await page.getByRole('button', { name: 'Create invitation' }).click()
  await expect(link).toBeVisible()
  const athleteInviteContext = await browser.newContext()
  const athlete = await athleteInviteContext.newPage()
  await athlete.goto(await link.inputValue())
  await athlete.getByLabel('Your full name').fill('Rafik Test Athlete')
  await athlete.getByLabel('Sign-in email').fill('athlete@rafik.test')
  await athlete
    .getByLabel('Create a password', { exact: true })
    .fill('Athlete invite password 2026!')
  await athlete.getByLabel('Confirm password').fill('Athlete invite password 2026!')
  await athlete.getByRole('button', { name: 'Create account and join' }).click()
  await expect(athlete).toHaveURL(/\/dashboard$/)
  await expect(athlete.locator('.institution-nav')).toBeHidden()
  await waitForDashboardData(athlete, 'athlete')
  const athleteNavigation = athlete.locator('.dashboard-navigation:visible').first()
  if (!(await athleteNavigation.count()))
    await athlete.getByRole('button', { name: 'Open navigation' }).click()
  await expect(athleteNavigation.getByRole('link', { name: 'Training', exact: true })).toBeVisible()
  await expect(athleteNavigation.getByRole('link', { name: 'People', exact: true })).toHaveCount(0)
  if (await athlete.getByRole('button', { name: 'Close navigation' }).isVisible())
    await athlete.getByRole('button', { name: 'Close navigation' }).click()
  await screenshot(athlete, 'athlete')
  await athleteInviteContext.close()
})
