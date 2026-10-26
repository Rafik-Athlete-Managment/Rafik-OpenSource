import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
import { testPreview } from './local-config'
test.use({ baseURL: testPreview, serviceWorkers: 'block' })

async function inspect(page: Page, name: string, info: { project: { name: string } }) {
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: `artifacts/r1e-${name}-${info.project.name}-viewport.png`,
    animations: 'disabled',
  })
  await page.screenshot({
    path: `artifacts/r1e-${name}-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
}

type Fixture = Awaited<ReturnType<typeof institutionFixture>>
async function bindNext(f: Fixture, member: string) {
  const assignment = (
    await f.call(f.coach, `/v1/institution/athlete-plans?view=trainer&member=${member}`)
  ).items[0].id
  const next = (
    await f.call(
      f.coach,
      `/v1/institution/workout-scheduling?view=trainer&assignment=${assignment}`,
    )
  ).items[0]
  const start = new Date(Date.now() - 120000)
  await f.call(f.coach, '/v1/institution/workout-scheduling', {
    operation: randomUUID(),
    action: 'schedule-workout',
    view: 'trainer',
    assignment_id: assignment,
    cursor: next.cursor,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 3600000).toISOString(),
    timezone: 'UTC',
  })
  return assignment
}
/** Institution with a primary coach, an athlete and one assigned plan built from `days`. */
async function institution(f: Fixture, name: string, adapt?: (plan: any) => void, bind = true) {
  const institution = randomUUID(),
    endpoint = `/v1/institution`,
    today = new Date().toISOString().slice(0, 10)
  await f.call(f.owner, '/v1/institutions', { id: institution, kind: 'institution', name })
  for (const [person, roles] of [
    [f.coach, ['trainer']],
    [f.client, ['trainee']],
  ] as const) {
    const token = randomBytes(32).toString('hex')
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: person.email,
      roles,
      token,
    })
    await f.call(person, `/v1/invitations/${token}`, {})
  }
  let people = await f.call(f.owner, `${endpoint}?view=admin`)
  const coach = people.members.find((m: any) => m.user_id === f.coach.id)
  let athlete = people.members.find((m: any) => m.user_id === f.client.id)
  await f.call(f.owner, endpoint, {
    operation: randomUUID(),
    action: 'assign-trainer',
    id: athlete.id,
    revision: athlete.revision,
    trainer: coach.id,
  })
  const plan = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../backend/content/starter.json'), 'utf8'),
  ).prescription
  adapt?.(plan)
  const version = (
    await f.call(f.coach, endpoint + '/programs', {
      operation: randomUUID(),
      action: 'publish',
      view: 'trainer',
      id: randomUUID(),
      title: 'Track block',
      draft: plan,
      revision: null,
    })
  ).version.id
  people = await f.call(f.owner, `${endpoint}?view=admin`)
  athlete = people.members.find((m: any) => m.user_id === f.client.id)
  await f.call(f.coach, endpoint + '/delivery', {
    operation: randomUUID(),
    action: 'assign',
    view: 'trainer',
    version_id: version,
    start_date: today,
    schedule_mode: 'flexible',
    members: [{ id: athlete.id, revision: athlete.revision, replaces: null }],
  })
  if (bind) await bindNext(f, athlete.id)
  return { institution, endpoint, athlete, plan, base: `` }
}

test('coach records a session on the athlete’s behalf with attribution, exact retry and history', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture(),
    athleteContext = await browser.newContext(),
    athletePage = await athleteContext.newPage(),
    institution = randomUUID(),
    endpoint = `/v1/institution`,
    today = new Date().toISOString().slice(0, 10)
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Madar delegated',
    })
    for (const [person, roles] of [
      [f.coach, ['trainer']],
      [f.client, ['trainee']],
    ] as const) {
      const token = randomBytes(32).toString('hex')
      await f.call(f.owner, endpoint, {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: person.email,
        roles,
        token,
      })
      await f.call(person, `/v1/invitations/${token}`, {})
    }
    let people = await f.call(f.owner, `${endpoint}?view=admin`)
    const coach = people.members.find((m: any) => m.user_id === f.coach.id)
    let athlete = people.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: athlete.id,
      revision: athlete.revision,
      trainer: coach.id,
    })
    const plan = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../backend/content/starter.json'), 'utf8'),
    ).prescription
    const version = (
      await f.call(f.coach, endpoint + '/programs', {
        operation: randomUUID(),
        action: 'publish',
        view: 'trainer',
        id: randomUUID(),
        title: 'Track block',
        draft: plan,
        revision: null,
      })
    ).version.id
    people = await f.call(f.owner, `${endpoint}?view=admin`)
    athlete = people.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.coach, endpoint + '/delivery', {
      operation: randomUUID(),
      action: 'assign',
      view: 'trainer',
      version_id: version,
      start_date: today,
      schedule_mode: 'flexible',
      members: [{ id: athlete.id, revision: athlete.revision, replaces: null }],
    })

    await bindNext(f, athlete.id)
    // Coach starts from the athlete profile's plan agenda under their own name.
    const base = ``
    await f.login(page, f.coach, `${base}/athletes/${athlete.id}`)
    await page.getByRole('tab', { name: 'Plans', exact: true }).click()
    await page.getByRole('link', { name: 'Manage workouts for Track block' }).click()
    const firstDay = plan.days.find((d: any) => !d.restDay)
    await page.getByRole('button', { name: 'Start workout', exact: true }).click()
    await expect(page).toHaveURL(/\/record\/[a-f0-9-]{36}$/)
    await expect(page.getByText('Recorded on behalf of')).toBeVisible()
    const firstSet = page.locator('.delegated-set').first()
    await firstSet.getByLabel(/^Load/).fill('22.5')
    await firstSet.getByRole('button', { name: /Mark set.*Done/ }).click()
    let lost = false,
      saves = 0
    await page.route(`**${endpoint}/sessions`, async (route) => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
      if (body?.action === 'save') saves++
      if (!lost && body?.action === 'save') {
        lost = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Finish session', exact: true }).click()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(page).toHaveURL(/\/review\/[a-f0-9-]{36}$/)
    await page.goto(page.url().replace('/review/', '/record/'))
    const history = page.getByRole('region', { name: 'Record history' })
    await expect(history.getByRole('listitem')).toHaveCount(2)
    await expect(history).toContainText('R4 Coach · started')
    await expect(history).toContainText('R4 Coach · saved as completed')
    expect(saves).toBe(2)
    await inspect(page, 'record', info)
    const recordUrl = page.url()
    const sessionId = recordUrl.split('/').at(-1)

    // The athlete sees who recorded the session and can open it to correct it.
    await f.login(athletePage, f.client, `/workout/${sessionId}?institution=${institution}`)
    await expect(
      athletePage.getByRole('note').filter({ hasText: 'Recorded by R4 Coach on your behalf.' }),
    ).toBeVisible()
    await inspect(athletePage, 'athlete-banner', info)

    // Arabic dark phone view of the coach record page.
    await page.unroute(`**${endpoint}/sessions`)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(recordUrl)
    await expect(page.getByRole('heading', { name: 'سجل التعديلات' })).toBeVisible()
    await inspect(page, 'record-ar-dark-320', info)
  } finally {
    await athleteContext.close()
    await f.cleanup()
  }
})

test('coach-recorded timed and distance sets require actual seconds and metres', async ({
  page,
}) => {
  test.setTimeout(180000)
  const f = await institutionFixture()
  try {
    const { athlete, plan, base } = await institution(f, 'Madar measured', (p) => {
      // A conditioning day: one timed hold and one distance run alongside strength work.
      const day = p.days[0]
      Object.assign(day.exercises[1], { kind: 'timed', seconds: 30, reps: 1, load: 0 })
      Object.assign(day.exercises[2], { kind: 'distance', metres: 400, reps: 1, load: 0 })
    })
    const day = plan.days[0]
    await f.login(page, f.coach, `${base}/athletes/${athlete.id}`)
    await page.getByRole('tab', { name: 'Plans', exact: true }).click()
    await page.getByRole('link', { name: 'Manage workouts for Track block' }).click()
    await page.getByRole('button', { name: 'Start workout', exact: true }).click()
    await expect(page).toHaveURL(/\/record\/[a-f0-9-]{36}$/)
    const timed = page.locator('.delegated-set').nth(day.exercises[0].sets)
    const distance = page
      .locator('.delegated-set')
      .nth(day.exercises[0].sets + day.exercises[1].sets)
    // Timed and distance sets show their own measurement, empty with the target as a hint.
    await expect(timed.getByLabel('Seconds')).toHaveValue('')
    await expect(timed.getByLabel('Seconds')).toHaveAttribute('placeholder', 'Target 30')
    await expect(timed.getByLabel('Reps')).toHaveCount(0)
    await expect(timed.getByLabel(/^Load/)).toHaveCount(0)
    await expect(distance.getByLabel('Metres')).toHaveAttribute('placeholder', 'Target 400')
    // Completing without an actual result is refused.
    await timed.getByRole('button', { name: /Mark set.*Done/ }).click()
    await expect(timed.getByRole('button', { name: /Mark set.*Done/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(page.getByRole('alert')).toContainText('Record the actual result')
    await timed.getByLabel('Seconds').fill('42')
    await timed.getByLabel('Effort (RPE, optional)').fill('7')
    await timed.getByRole('button', { name: /Mark set.*Done/ }).click()
    await distance.getByLabel('Metres').fill('380')
    await distance.getByRole('button', { name: /Mark set.*Done/ }).click()
    await page.getByRole('button', { name: 'Finish session', exact: true }).click()
    await expect(page).toHaveURL(/\/review\/[a-f0-9-]{36}$/)
    const id = page.url().split('/').at(-1)
    const saved = await f.call(f.coach, `/v1/workouts/${id}?view=trainer`)
    const find = (key: string) =>
      saved.entries.find((e: any) => e.exercise_key === key && e.set_index === 0)
    expect(find(day.exercises[1].key)).toMatchObject({ seconds: 42, effort: 7, completed: true })
    expect(find(day.exercises[2].key)).toMatchObject({ metres: 380, completed: true })
  } finally {
    await f.cleanup()
  }
})

test('a delayed start acknowledgment keeps the write but never pulls the coach back', async ({
  page,
}) => {
  test.setTimeout(180000)
  const f = await institutionFixture()
  try {
    const { endpoint, athlete, plan, base } = await institution(f, 'Madar delayed')
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    let starts = 0
    await page.route(`**${endpoint}/sessions`, async (route) => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
      if (body?.action === 'start') {
        starts++
        const response = await route.fetch()
        await held
        await route.fulfill({ response })
      } else await route.continue()
    })
    await f.login(
      page,
      f.coach,
      `${base}/record/new?assignment=${(await f.call(f.coach, `${endpoint}/athlete-plans?view=trainer&member=${athlete.id}`)).items[0].id}`,
    )
    await page.getByRole('button', { name: 'Record ' + plan.days[0].name, exact: true }).click()
    await expect.poll(() => starts).toBe(1)
    // The coach leaves before the acknowledgment arrives.
    await page.getByRole('link', { name: 'Back to athlete plans' }).click()
    await expect(page).toHaveURL(new RegExp(`${base}/training$`))
    release()
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(new RegExp(`${base}/training$`))
    // The write was preserved: the delegated session exists for the athlete.
    const history = await f.call(
      f.coach,
      `${endpoint}/delivery?view=trainer&history=true&member=${athlete.id}`,
    )
    expect(history.sessions).toHaveLength(1)
    expect(history.sessions[0].recorded_mode).toBe('delegated')
  } finally {
    await f.cleanup()
  }
})

test('coach schedules from a plan; athlete sees the future-start explanation in English and Arabic', async ({
  page,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture()
  try {
    const { athlete } = await institution(f, 'Madar scheduled', undefined, false)
    const assignment = (
      await f.call(f.coach, '/v1/institution/athlete-plans?view=trainer&member=' + athlete.id)
    ).items[0].id
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    await f.login(page, f.coach, '/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back')
    await expect(page.getByRole('heading', { name: 'Your coaching priorities' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schedule workout', exact: true })).toBeVisible()
    await expect(page.locator('.tag[data-status="unscheduled"]')).toBeVisible()
    await inspect(page, 'coach-priorities', info)
    await page.goto('/training?assignment=' + assignment)
    await expect(page).toHaveURL(new RegExp('/training/' + assignment + '$'))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Track block')
    await expect(page.getByRole('searchbox', { name: 'Search athletes' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Adapt this program', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Adapt program', exact: true })).toBeVisible()
    await expect(page.getByLabel('Program name', { exact: true })).toHaveValue(
      'Track block adapted',
    )
    await page.getByLabel('Program name', { exact: true }).fill('Athlete-specific adaptation draft')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByText('Program draft saved.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Program name', { exact: true })).toHaveValue(
      'Athlete-specific adaptation draft',
    )
    await page.getByRole('button', { name: 'View assigned plan', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Track block')
    const agenda = page.getByRole('region', { name: 'Next workouts', exact: true })
    await agenda.getByRole('button', { name: 'Schedule workout', exact: true }).click()
    await inspect(page, 'schedule-form', info)
    await agenda
      .getByLabel('Date and time', { exact: true })
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16))
    await agenda.getByLabel('Duration (minutes)', { exact: true }).fill('45')
    await agenda.getByRole('button', { name: 'Save schedule', exact: true }).click()
    await expect(agenda.getByText('Recording opens at the scheduled start time.')).toBeVisible()
    await page.route('**/v1/institution/workout-scheduling?**', (route) => route.abort('failed'))
    await agenda.getByRole('button', { name: 'Refresh workouts', exact: true }).click()
    await expect(agenda.getByRole('alert')).toBeVisible()
    await expect(agenda.getByText('Recording opens at the scheduled start time.')).toBeVisible()
    await page.unroute('**/v1/institution/workout-scheduling?**')
    await agenda.getByRole('button', { name: 'Refresh workouts', exact: true }).click()
    await expect(agenda.getByRole('alert')).toHaveCount(0)
    await inspect(page, 'schedule-future', info)
    const occurrence = (
      await f.call(
        f.coach,
        '/v1/institution/workout-scheduling?view=trainer&assignment=' + assignment,
      )
    ).items[0].occurrence
    await page.goto('/schedule/' + occurrence.id)
    await expect(page.getByRole('link', { name: 'Open plan workouts', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Complete session', exact: true })).toHaveCount(0)
    await f.login(page, f.client, '/training')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your workouts')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '32px')
    await expect(page.getByRole('heading', { name: 'Next workouts', exact: true })).toHaveCount(0)
    await expect(page.locator('.athlete-workout-preview .agenda-row')).toHaveCount(1)
    await expect(page.getByText('In this workout', { exact: true })).toBeVisible()
    await expect(page.locator('.workout-preview-exercises li')).toHaveCount(4)
    await expect(page.getByText('Muscle focus', { exact: true })).toBeVisible()
    await expect(page.getByText('Recording opens at the scheduled start time.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(0)
    await inspect(page, 'athlete-wait-en', info)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.getByText('يفتح التسجيل عند موعد البدء المحدد.')).toBeVisible()
    await inspect(page, 'athlete-wait-ar', info)
    await page.goto('/training/' + assignment)
    await expect(page).toHaveURL(/\/dashboard$/)
    await f.login(page, f.coach, '/training/' + assignment)
    await expect(
      page.getByRole('button', { name: 'تكييف هذا البرنامج', exact: true }),
    ).toBeVisible()
    await inspect(page, 'assigned-plan-ar', info)
  } finally {
    await f.cleanup()
  }
})

test('coach finishes athlete-started bodyweight work and reviews it without a note', async ({
  page,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture()
  try {
    const { athlete, endpoint } = await institution(f, 'Madar coach completion')
    const assignment = (
      await f.call(f.coach, endpoint + '/athlete-plans?view=trainer&member=' + athlete.id)
    ).items[0].id
    const next = (
      await f.call(f.client, endpoint + '/workout-scheduling?view=trainee&assignment=' + assignment)
    ).items[0]
    const id = randomUUID()
    await f.call(f.client, endpoint + '/sessions', {
      operation: id,
      action: 'start',
      view: 'trainee',
      id,
      assignment_id: assignment,
      occurrence_id: next.occurrence.id,
      day_id: next.day.id,
    })
    await f.login(page, f.coach, '/training/' + assignment)
    await page.getByRole('link', { name: 'Resume workout', exact: true }).click()
    await expect(page).toHaveURL(new RegExp('/record/' + id + '$'))
    await expect(
      page.getByText('The athlete started this workout.', { exact: false }),
    ).toBeVisible()
    await page.goto('/review/' + id)
    await expect(page.getByRole('link', { name: 'Continue workout for athlete' })).toBeVisible()
    await inspect(page, 'unfinished-review', info)
    await page.getByRole('link', { name: 'Continue workout for athlete' }).click()
    const set = page.locator('.delegated-set').first()
    await set.getByLabel(/^Load/).fill('0')
    await set.getByRole('button', { name: /Mark set.*Done/ }).focus()
    await page.keyboard.press('Space')
    await inspect(page, 'coach-recorder', info)
    await page.getByRole('button', { name: 'Finish session', exact: true }).click()
    await expect(page).toHaveURL(new RegExp('/review/' + id + '$'))
    await expect(page.getByLabel('Coach feedback')).toHaveValue('')
    await page.getByRole('button', { name: 'Save review', exact: true }).click()
    await expect(page.getByText('Workout review saved.', { exact: true })).toBeVisible()
    await expect(page.locator('.notice.success')).toHaveCount(0)
    await inspect(page, 'bodyweight-review', info)
    const result = await f.call(f.client, '/v1/workouts/' + id + '?view=trainee')
    expect(result.recorded_mode).toBe('self')
    expect(result.completed_by_name).toBe('R4 Coach')
    expect(result.entries[0].load).toBe(0)
    await f.login(page, f.client, '/workout/' + id)
    await expect(page.getByRole('note').filter({ hasText: 'Completed by R4 Coach.' })).toBeVisible()
  } finally {
    await f.cleanup()
  }
})
