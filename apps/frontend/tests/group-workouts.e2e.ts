import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { institutionFixture } from './institution-fixture'
import { testPreview, testDatabase } from './local-config'
import { layoutIssues } from './layout-contract'
import AxeBuilder from '@axe-core/playwright'

test.use({ baseURL: testPreview, serviceWorkers: 'block' })
test('workout template authoring, program import and coach-only group recording', async ({
  page,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: randomUUID(),
      name: 'Workout template validation',
    })
    for (const [person, role] of [
      [f.coach, 'trainer'],
      [f.client, 'trainee'],
    ] as const) {
      const token = randomBytes(32).toString('hex')
      await f.call(f.owner, '/v1/institution', {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: person.email,
        roles: [role],
        token,
      })
      await f.call(person, '/v1/invitations/' + token, {})
    }
    const people = await f.call(f.owner, '/v1/institution?view=admin')
    const coach = people.members.find((m: any) => m.user_id === f.coach.id),
      athlete = people.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.owner, '/v1/institution', {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: athlete.id,
      revision: athlete.revision,
      trainer: coach.id,
    })
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.locale')) localStorage.setItem('rafik.locale', 'en')
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    await f.login(page, f.coach, '/workout-templates/new')
    await page.getByLabel('Workout name', { exact: true }).fill('Field strength validation')
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
    await page.getByRole('combobox', { name: 'Exercise 1', exact: true }).fill('goblet squat')
    const option = page
      .getByRole('option')
      .filter({ hasText: /goblet squat/i })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.getByRole('button', { name: 'Save workout template', exact: true }).click()
    await expect(page).toHaveURL(/\/workout-templates\/[a-f0-9-]{36}$/)
    const templateId = page.url().split('/').at(-1)!
    await expect(
      page.getByRole('heading', { name: 'Field strength validation', exact: true }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('link', { name: 'Use in a new program', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Field strength validation', exact: false }),
    ).toBeVisible()
    await page.goto('/schedule/new')
    await page.getByRole('radio', { name: /Group workout/ }).check()
    await page.getByRole('button', { name: /Field strength validation/ }).click()
    await expect(page.getByLabel('Event name', { exact: true })).toHaveValue(
      'Field strength validation',
    )
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: `artifacts/group-composer-${info.project.name}.png`,
      fullPage: true,
    })
    const eid = randomUUID()
    await f.call(f.coach, '/v1/institution/calendar', {
      operation: randomUUID(),
      action: 'create',
      view: 'trainer',
      id: eid,
      title: 'Field session validation',
      kind: 'training',
      local: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      zone: 'UTC',
      minutes: 60,
      count: 1,
      every: 7,
      staff: [coach.id],
      participants: [athlete.id],
      workout_template_id: templateId,
      workout_template_revision: 1,
    })
    if (!/^rafik_browser_\d+$/.test(testDatabase)) throw Error('Disposable target required')
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
        input: `UPDATE public.institution_events SET starts_at=now()-interval '30 minutes',ends_at=now()+interval '30 minutes' WHERE id='${eid}';`,
        stdio: 'pipe',
      },
    )
    await f.call(f.coach, '/v1/institution/calendar', {
      operation: randomUUID(),
      action: 'attendance',
      view: 'trainer',
      id: eid,
      member: athlete.id,
      revision: 1,
      attendance: 'present',
    })
    await page.goto('/schedule/' + eid)
    await page.getByRole('button', { name: 'Record workout', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'Prepare participant workout' })
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Adapt workout for this athlete', exact: true }).click()
    // Exercise options must remain above the participant editor, including on phones.
    await panel.getByRole('button', { name: 'Choose an exercise', exact: true }).click()
    const popupOption = page
      .getByRole('dialog', { name: 'Exercise 1 · Options' })
      .getByRole('option')
      .first()
    await expect(popupOption).toBeVisible()
    await popupOption.click()
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: `artifacts/group-participant-${info.project.name}.png`,
      fullPage: true,
    })
    await panel.getByRole('button', { name: 'Start recording', exact: true }).click()
    await expect(page).toHaveURL(/\/record\/[a-f0-9-]{36}$/)
    const checks = page.getByRole('button', { name: /Mark set.*Done/ })
    await expect(checks.first()).toBeVisible()
    for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).click()
    await page.getByRole('button', { name: 'Finish session', exact: true }).click()
    await expect(page).toHaveURL(/\/review\/[a-f0-9-]{36}$/)
    const review = page.url()
    await f.login(page, f.client, '/schedule/' + eid)
    await expect(page.getByRole('button', { name: 'Record workout', exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: 'View workout', exact: true }).click()
    await expect(page).toHaveURL(review)
    await expect(page.getByRole('button', { name: 'Continue workout for athlete' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save feedback' })).toHaveCount(0)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: `artifacts/group-athlete-review-${info.project.name}.png`,
      fullPage: true,
    })
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('heading', { name: 'R4 Athlete', exact: true })).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: `artifacts/group-athlete-ar-dark-${info.project.name}.png`,
      fullPage: true,
    })
  } finally {
    await f.cleanup()
  }
})
