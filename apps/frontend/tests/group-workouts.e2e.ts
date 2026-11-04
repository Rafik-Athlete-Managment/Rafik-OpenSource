import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { institutionFixture } from './institution-fixture'
import { testPreview, testDatabase } from './local-config'
import { layoutIssues } from './layout-contract'
import AxeBuilder from '@axe-core/playwright'

test.use({ baseURL: testPreview, serviceWorkers: 'block' })
test('attendance-first group workspace, draft recovery, review and next athlete', async ({
  page,
}, info) => {
  test.setTimeout(240000)
  const f = await institutionFixture()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: randomUUID(),
      name: 'Workout template validation',
    })
    const second = await f.createPerson('Validation Second athlete long name')
    for (const [person, role] of [
      [f.coach, 'trainer'],
      [f.client, 'trainee'],
      [second, 'trainee'],
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
      athlete = people.members.find((m: any) => m.user_id === f.client.id),
      secondAthlete = people.members.find((m: any) => m.user_id === second.id)
    for (const member of [athlete, secondAthlete])
      await f.call(f.owner, '/v1/institution', {
        operation: randomUUID(),
        action: 'assign-trainer',
        id: member.id,
        revision: member.revision,
        trainer: coach.id,
      })
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.locale')) localStorage.setItem('rafik.locale', 'en')
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    const templateId = randomUUID()
    await f.call(f.coach, '/v1/institution/workout-templates', {
      operation: randomUUID(),
      action: 'save',
      view: 'trainer',
      id: templateId,
      revision: 0,
      title: 'Field strength validation',
      workout: {
        id: randomUUID(),
        name: 'Field strength validation',
        minutes: 30,
        exercises: [
          {
            key: randomUUID(),
            exerciseId: 'goblet-squat',
            kind: 'strength',
            sets: 1,
            reps: 10,
            load: 0,
            unit: 'kg',
            rest: 60,
            note: '',
          },
        ],
      },
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
      participants: [athlete.id, secondAthlete.id],
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
    await page.setViewportSize({
      width: info.project.name === 'webkit-phone' ? 390 : 1280,
      height: 800,
    })
    await f.login(page, f.coach, '/schedule/' + eid)
    await expect(page.getByRole('tab', { name: /Attendance/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mark everyone present', exact: true }).click()
    await page.getByRole('button', { name: /Save attendance/ }).click()
    await expect(page.getByRole('tab', { name: 'Workout recording', exact: true })).toBeEnabled()
    await page.getByRole('tab', { name: 'Workout recording', exact: true }).click()
    const sheet = page.getByRole('region', {
      name: /Selected athlete workout|تمرين الرياضي المحدد/,
      exact: true,
    })
    await chooseAthlete('R4 Athlete')
    async function chooseAthlete(name: string) {
      if (page.viewportSize()!.width < 981) {
        await page.getByRole('combobox', { name: 'Selected athlete', exact: true }).fill(name)
        await expect(page.getByRole('option')).toHaveCount(1)
        await page.getByRole('option').click()
      } else await page.getByRole('button', { name: new RegExp(name) }).click()
    }
    const preview = page.locator('.shared-workout-preview')
    await expect(preview).toHaveJSProperty('open', false)
    await preview.locator('summary').click()
    await chooseAthlete('Validation Second')
    await expect(preview).toHaveJSProperty('open', true)
    await preview.locator('summary').click()
    await chooseAthlete('R4 Athlete')
    await expect(preview).toHaveJSProperty('open', false)
    await sheet.getByRole('button', { name: 'Adapt workout for this athlete', exact: true }).click()
    await sheet.getByRole('combobox', { name: 'Exercise 1', exact: true }).fill('goblet squat')
    await page
      .getByRole('option')
      .filter({ hasText: /goblet squat/i })
      .first()
      .click()
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: 'artifacts/group-participant-' + info.project.name + '.png',
      fullPage: true,
    })
    await sheet.getByRole('button', { name: 'Skip with reason', exact: true }).click()
    const skipPanel = page.getByRole('dialog', { name: 'Skip participant workout', exact: true })
    await skipPanel
      .getByLabel('Reason (no health details)', { exact: true })
      .fill('Cancelled skip validation')
    await skipPanel.getByRole('button', { name: 'Cancel', exact: true }).click()
    await sheet.getByRole('button', { name: 'Start recording', exact: true }).click()
    const checks = sheet.getByRole('button', { name: /Mark set.*Done/ })
    await expect(checks.first()).toBeVisible()
    await sheet.getByLabel('Note', { exact: true }).fill('Unsubmitted athlete-specific draft')
    await chooseAthlete('Validation Second')
    await chooseAthlete('R4 Athlete')
    await expect(sheet.getByLabel('Note', { exact: true })).toHaveValue(
      'Unsubmitted athlete-specific draft',
    )
    await page.reload()
    await expect(sheet.getByLabel('Note', { exact: true })).toHaveValue(
      'Unsubmitted athlete-specific draft',
    )
    let releaseSave!: () => void
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    await page.route(
      '**/v1/institution/sessions',
      async (route) => {
        await saveGate
        await route.continue()
      },
      { times: 1 },
    )
    await sheet.getByRole('button', { name: 'Save progress', exact: true }).click()
    if (page.viewportSize()!.width < 981)
      await expect(
        page.getByRole('combobox', { name: 'Selected athlete', exact: true }),
      ).toBeDisabled()
    else await expect(page.getByRole('button', { name: /Validation Second/ })).toBeDisabled()
    await expect(page.getByRole('tab', { name: /Attendance/ })).toBeDisabled()
    releaseSave()
    await expect(sheet.getByRole('button', { name: 'Save progress', exact: true })).toBeEnabled()
    for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).click()
    await sheet.getByRole('button', { name: 'Finish session', exact: true }).click()
    await expect(sheet.getByRole('button', { name: 'Save review', exact: true })).toBeVisible()
    await expect(page).toHaveURL(new RegExp('/schedule/' + eid))
    const results = await f.call(
      f.coach,
      '/v1/institution/group-workouts?view=trainer&event=' + eid,
    )
    const firstRecord = results.participants.find((p: any) => p.member_id === athlete.id).session.id
    const review = new URL('/review/' + firstRecord, page.url()).href
    await sheet.getByLabel('Coach feedback', { exact: false }).fill('Good group session')
    await sheet.getByRole('button', { name: 'Save review', exact: true }).click()
    await expect(sheet.getByText('Reviewed', { exact: true })).toBeVisible()
    await sheet.getByRole('button', { name: 'Record next athlete', exact: true }).click()
    await expect(sheet.getByRole('heading', { name: /Validation Second/ })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    const selector = page.getByRole('combobox', { name: 'Selected athlete', exact: true })
    await selector.fill('R4')
    await page.getByRole('option', { name: /R4 Athlete/ }).click()
    await expect(sheet.getByRole('button', { name: 'Save review', exact: true })).toBeVisible()
    await selector.fill('Second athlete')
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.getByRole('option', { name: /Second athlete/ }).click()
    await sheet.getByRole('button', { name: 'Start recording', exact: true }).click()
    await expect(checks.first()).toBeVisible()
    for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).click()
    await sheet.getByRole('button', { name: 'Finish session', exact: true }).click()
    await expect(sheet.getByRole('button', { name: 'Save review', exact: true })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Record next athlete' })).toHaveCount(0)
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: 'artifacts/group-recording-phone-' + info.project.name + '.png',
      fullPage: true,
    })
    await page.getByRole('tab', { name: /Attendance/ }).click()
    await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Workout recording', exact: true }).click()
    await expect(sheet.getByRole('button', { name: 'Save review', exact: true })).toBeVisible()
    await expect(page.locator('.swal2-popup')).toBeHidden()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(sheet.getByRole('button', { name: 'حفظ المراجعة', exact: true })).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    await page.screenshot({
      path: 'artifacts/group-recording-ar-dark-' + info.project.name + '.png',
      fullPage: true,
    })
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await f.login(page, f.owner, '/schedule/' + eid + '?groupTab=recording')
    await expect(sheet.getByRole('button', { name: 'Save review', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toHaveCount(0)
    await f.login(page, f.client, '/schedule/' + eid)
    await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: 'View workout', exact: true }).click()
    await expect(page).toHaveURL(review)
    await expect(page.getByRole('heading', { name: 'R4 Athlete', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue workout for athlete' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save feedback' })).toHaveCount(0)
    await expect(page.locator('.swal2-popup')).toBeHidden()
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
