import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { institutionFixture } from './institution-fixture'
import { testPreview } from './local-config'

test.use({ baseURL: testPreview, serviceWorkers: 'block' })

test('calendar completion is explicit and sign-in stays busy until its request settles', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000)
  const fixture = await institutionFixture()
  const authContext = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    await fixture.call(fixture.owner, '/v1/institutions', {
      id: randomUUID(),
      name: 'Calendar completion feedback validation',
    })
    await page.addInitScript(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    const events = [
      { state: 'scheduled', kind: 'training', title: 'Unfinished training' },
      { state: 'completed', kind: 'training', title: 'Completed individual workout' },
      { state: 'completed', kind: 'assessment', title: 'Completed assessment' },
      { state: 'completed', kind: 'training', title: 'Completed group workout' },
    ].map((event, index) => ({
      ...event,
      id: randomUUID(),
      starts_at: '2026-10-30T10:00:00Z',
      ends_at: '2026-10-30T11:00:00Z',
      training_date: '2026-10-30',
      location: 'Validation field',
      workout_snapshot:
        index === 1 ? { assignment_id: randomUUID() } : index === 3 ? { source: 'group' } : null,
      people: [{ duty: 'staff', active: true, roles: ['trainer'], name: 'Validation coach' }],
    }))
    // Read-projection fixture: this checks presentation, not server completion authority.
    await page.route('**/v1/institution/calendar?**', (route) =>
      route.fulfill({ json: { items: events, next: null } }),
    )
    await fixture.login(page, fixture.owner, '/schedule?from=2026-10-01&day=')
    await expect(page.locator('.agenda-event')).toHaveCount(4)
    await expect(
      page.locator('.agenda-event[data-status="completed"] .tag[data-status="completed"]'),
    ).toHaveCount(3)
    const completed = page.locator('.agenda-event[data-status="completed"]').first()
    const scheduled = page.locator('.agenda-event[data-status="scheduled"]')
    expect(
      await completed.evaluate((element) => getComputedStyle(element).borderInlineStartColor),
    ).not.toBe(
      await scheduled.evaluate((element) => getComputedStyle(element).borderInlineStartColor),
    )
    await expect(page.locator('.month-completed-icon').first()).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('.month-completed-count').first()).toBeVisible()

    const auth = await authContext.newPage()
    await auth.addInitScript(() => localStorage.setItem('rafik.locale', 'en'))
    let release!: () => void,
      requests = 0
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await auth.route('**/v1/auth/password-login', async (route) => {
      requests++
      await gate
      await route.fulfill({ status: 401, json: { message: 'invalid_credentials' } })
    })
    await auth.goto(testPreview + '/login')
    await auth.getByLabel('Email address', { exact: true }).fill('feedback-check@rafik.test')
    await auth.getByLabel('Password', { exact: true }).fill('Validation password 2026!')
    await auth.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(auth.locator('.login-spinner')).toBeVisible()
    await expect(auth.locator('form')).toHaveAttribute('aria-busy', 'true')
    expect(
      await auth
        .locator('.login-spinner')
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('none')
    await auth.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
    release()
    await expect(auth.getByRole('alert')).toBeVisible()
    await expect(auth.locator('.login-spinner')).toHaveCount(0)
    await expect(auth.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
    expect(requests).toBe(1)
  } finally {
    await authContext.close()
    await fixture.cleanup()
  }
})
