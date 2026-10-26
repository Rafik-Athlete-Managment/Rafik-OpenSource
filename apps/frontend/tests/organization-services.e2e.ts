import { testDatabase } from './local-config'
import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

test('organization staff schedule a group assessment, recover a result, correct it and inspect real analytics', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000)
  const f = await institutionFixture(),
    clientContext = await browser.newContext(),
    client = await clientContext.newPage(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Madar service test',
    })
    for (const [person, roles] of [
      [f.coach, ['trainer']],
      [f.client, ['trainee']],
    ] as const) {
      const token = randomBytes(32).toString('hex')
      await f.call(f.owner, `/v1/institution`, {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: person.email,
        roles,
        token,
      })
      await f.call(person, `/v1/invitations/${token}`, {})
    }
    const secondClient = await f.createPerson('R4 Athlete Two'),
      secondClientToken = randomBytes(32).toString('hex')
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: secondClient.email,
      roles: ['trainee'],
      token: secondClientToken,
    })
    await f.call(secondClient, `/v1/invitations/${secondClientToken}`, {})
    const people = await f.call(f.owner, `/v1/institution?view=admin`),
      trainee = people.members.find((m: any) => m.user_id === f.client.id),
      trainer = people.members.find((m: any) => m.user_id === f.coach.id)
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: trainee.id,
      revision: trainee.revision,
      trainer: trainer.id,
    })
    const base = ``
    await f.login(page, f.owner, base + '/assessment-templates')
    await page.getByRole('button', { name: 'New template', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Movement baseline')
    await page.getByLabel('Drill name', { exact: true }).fill('Chair stands')
    await page.getByLabel('Unit', { exact: true }).fill('reps')
    await expect(page.getByText('Draft saved on this device.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Drill name', { exact: true })).toHaveValue('Chair stands')
    await page.getByRole('button', { name: 'Save template', exact: true }).click()
    await expect(page.locator('.rafik-toast').filter({ hasText: /saved/i }).last()).toBeVisible()
    await page.goto(base + '/groups')
    await page.getByRole('button', { name: 'New group', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Morning group')
    await page.getByRole('checkbox', { name: 'R4 Athlete', exact: true }).check()
    await page.getByRole('checkbox', { name: 'R4 Athlete Two', exact: true }).check()
    await page.getByRole('button', { name: 'Save group', exact: true }).click()
    await expect(page.locator('.rafik-toast').filter({ hasText: /saved/i }).last()).toBeVisible()
    await page.goto(base + '/schedule/new')
    await page.getByLabel('Event name', { exact: true }).fill('Morning assessment')
    await page.getByRole('combobox', { name: 'Event type', exact: true }).selectOption('assessment')
    await page.getByRole('radio', { name: 'Movement baseline 1 test', exact: true }).check()
    await page
      .getByRole('searchbox', { name: 'Find an assessment template', exact: true })
      .fill('No matching template')
    await page.getByRole('button', { name: 'Search templates', exact: true }).click()
    await expect(
      page.getByText('No templates match. Try another name or create a template.', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('.template-selection')).toContainText('Movement baseline')
    await page.getByRole('combobox', { name: 'Timezone', exact: true }).click()
    await page.getByRole('combobox', { name: 'Timezone', exact: true }).fill('UTC')
    await page.getByRole('option', { name: 'UTC · UTC', exact: true }).click()
    await page.getByRole('button', { name: 'Choose people', exact: true }).click()
    await expect(page.locator('section[aria-label="Choose people"]')).toBeFocused()
    await page.getByRole('checkbox', { name: 'R4 Coach', exact: true }).check()
    await page.getByText('Start with a training group', { exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Start with a group (optional)', exact: true })
      .selectOption({ label: 'Morning group' })
    await page.getByRole('button', { name: 'Review schedule', exact: true }).click()
    await expect(page.getByText('Dates to schedule', { exact: true })).toBeVisible()
    await expect(page.locator('section[aria-label="Review schedule"]')).toBeFocused()
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    let lost = false
    await page.route(`**/v1/institution/calendar`, async (r) => {
      if (!lost && r.request().method() === 'POST') {
        lost = true
        await r.fetch()
        await r.abort('failed')
      } else await r.continue()
    })
    await page.getByRole('button', { name: 'Confirm schedule', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeEnabled()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(page).toHaveURL(/\/schedule\/[a-f0-9-]{36}$/)
    const eid = new URL(page.url()).pathname.split('/').at(-1)!
    expect(eid).toMatch(/^[a-f0-9-]{36}$/)
    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        resolve('../../infrastructure/compose.yaml'),
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
        input: `update public.institution_events e set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' from public.institutions w where e.institution_id=w.id and e.id='${eid}' and w.id='${id}' and w.created_by='${f.owner.id}';`,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    await page.reload()
    for (const name of ['R4 Athlete', 'R4 Athlete Two']) {
      const card = page
        .locator('.event-participant')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
      await card
        .getByRole('combobox', { name: 'Attendance for ' + name, exact: true })
        .selectOption('present')
      await card.getByRole('button', { name: 'Save attendance', exact: true }).click()
      await expect(
        page.locator('.rafik-toast').filter({ hasText: 'Attendance recorded.' }).last(),
      ).toBeVisible()
      await card.getByRole('button', { name: 'Record result', exact: true }).click()
      await page
        .getByRole('spinbutton', { name: 'Chair stands (reps)', exact: true })
        .fill(name === 'R4 Athlete' ? '12' : '19')
      await page.getByRole('button', { name: 'Save result', exact: true }).click()
      await expect(
        page.locator('.rafik-toast').filter({ hasText: 'Assessment result saved.' }).last(),
      ).toBeVisible()
    }
    await page.getByRole('button', { name: 'Finish event', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Session completed.' }).last(),
    ).toBeVisible()
    await page
      .locator('.event-participant')
      .filter({ has: page.getByRole('heading', { name: 'R4 Athlete', exact: true }) })
      .getByRole('button', { name: 'Review / correct result', exact: true })
      .click()
    await page.getByRole('spinbutton', { name: 'Chair stands (reps)', exact: true }).fill('14')
    let dropped = false
    await page.unroute(`**/v1/institution/calendar`)
    await page.route(`**/v1/institution/calendar`, async (r) => {
      if (!dropped && r.request().method() === 'POST') {
        dropped = true
        await r.fetch()
        await r.abort('failed')
      } else await r.continue()
    })
    await page.getByRole('button', { name: 'Save correction', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeEnabled()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Assessment result saved.' }).last(),
    ).toBeVisible()
    await expect(page.getByText('14 reps', { exact: true })).toBeVisible()
    await expect(page.getByText('19 reps', { exact: true })).toBeVisible()
    await f.login(client, f.client, `/schedule/${eid}`)
    await expect(client.getByText('14 reps', { exact: true })).toBeVisible()
    await expect(client.getByText('19 reps', { exact: true })).toHaveCount(0)
    await page.goto(base + '/analytics')
    await page.getByRole('tab', { name: 'Delivery & capacity', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Coach responsibility', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.analytics-numbers').getByText('2', { exact: true })).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({
      path: `artifacts/r9-admin-analytics-${info.project.name}.png`,
      fullPage: true,
    })
    // A late calendar read must not overwrite the URL filters of the page we navigate to.
    let releaseCalendar!: () => void
    let calendarStarted!: () => void
    const pendingCalendar = new Promise<void>((resolve) => {
      releaseCalendar = resolve
    })
    const calendarRequest = new Promise<void>((resolve) => {
      calendarStarted = resolve
    })
    await page.route(`**/v1/institution/calendar?**`, async (r) => {
      const response = await r.fetch()
      calendarStarted()
      await pendingCalendar
      await r.fulfill({ response })
    })
    await page.goto(base + '/schedule')
    await calendarRequest
    const navigation = page.getByRole('button', { name: 'Open navigation', exact: true })
    if (await navigation.isVisible()) await navigation.click()
    // Sidebar groups collapse to the current section; open Administration to reach Analytics.
    const institutionNav = page.getByRole('navigation', { name: 'Institution navigation' })
    const analyticsLink = institutionNav.getByRole('link', { name: 'Analytics', exact: true })
    if (!(await analyticsLink.isVisible()))
      await institutionNav.locator('summary').filter({ hasText: 'Administration' }).click()
    await analyticsLink.click()
    await expect(
      page.getByRole('heading', { name: 'Institution analytics', exact: true }),
    ).toBeVisible()
    const calendarResponse = page.waitForResponse((r) =>
      r.url().includes(`/v1/institution/calendar?`),
    )
    releaseCalendar()
    await (await calendarResponse).finished()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expect(page).toHaveURL(base + '/analytics')
    await page.unroute(`**/v1/institution/calendar?**`)
    await f.login(page, f.coach, `/analytics`)
    await expect(
      page.getByRole('heading', { name: 'Coaching analytics', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Coach responsibility', exact: true }),
    ).toHaveCount(0)
    await page.goto(`/assessments/${trainee.id}`)
    await expect(page.getByRole('definition').filter({ hasText: '14 reps' })).toBeVisible()
  } finally {
    await clientContext.close()
    await f.cleanup()
  }
})
