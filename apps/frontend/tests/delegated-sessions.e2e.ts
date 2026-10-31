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
    // Record history opens in a side panel from the sticky record toolbar.
    await page.getByRole('button', { name: 'Record history', exact: true }).click()
    const history = page.getByRole('dialog', { name: 'Record history' })
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
    await page.getByRole('button', { name: 'سجل التعديلات', exact: true }).click()
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
    await page.getByRole('link', { name: 'Back', exact: true }).click()
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
    await f.login(page, f.coach, '/training?assignment=' + assignment)
    await expect(page).toHaveURL(new RegExp('/training/' + assignment + '$'))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Track block')
    await expect(page.getByRole('searchbox', { name: 'Search athletes' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Adapt athlete plan', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Adapt athlete plan', exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('Plan name', { exact: true })).toHaveValue('Track block')
    await expect(page.getByRole('button', { name: 'Publish program', exact: true })).toHaveCount(0)
    await page.getByLabel('Plan name', { exact: true }).fill('Athlete-specific adaptation')
    await page.reload()
    await expect(page.getByLabel('Plan name', { exact: true })).toHaveValue(
      'Athlete-specific adaptation',
    )
    const adaptationRequests: unknown[] = []
    let loseAdaptationAck = true
    await page.route('**/v1/institution/delivery', async (r) => {
      const body = r.request().method() === 'POST' ? r.request().postDataJSON() : null
      if (body?.action !== 'adapt') return r.continue()
      adaptationRequests.push(body)
      if (loseAdaptationAck) {
        loseAdaptationAck = false
        await r.fetch()
        await r.abort('failed')
      } else await r.continue()
    })
    await page.getByRole('button', { name: 'Apply changes to athlete plan', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeEnabled()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect.poll(() => adaptationRequests.length).toBe(2)
    expect(adaptationRequests[1]).toEqual(adaptationRequests[0])
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Athlete-specific adaptation')
    // The revision label is part of the plan subtitle line.
    await expect(page.getByText(/Personalized plan · revision\s+1\b/)).toBeVisible()
    const agenda = page.getByRole('region', { name: 'Next workouts', exact: true })
    await agenda.getByRole('button', { name: 'Schedule workout', exact: true }).click()
    const scheduleForm = page.getByRole('dialog', { name: 'Schedule the next workout' })
    await inspect(page, 'schedule-form', info)
    await scheduleForm
      .getByLabel('Date and time', { exact: true })
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16))
    await scheduleForm.getByLabel('Duration (minutes)', { exact: true }).fill('45')
    await scheduleForm.getByRole('button', { name: 'Save schedule', exact: true }).click()
    await expect(scheduleForm).toHaveCount(0)
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
    await expect(page.getByRole('button', { name: 'تعديل خطة الرياضي', exact: true })).toBeVisible()
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

test('coach desk shows disjoint planning, status recovery and Arabic layout', async ({
  page,
}, info) => {
  test.setTimeout(300000)
  const f = await institutionFixture()
  try {
    await institution(f, 'Madar desk', undefined, false)
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    page.on('pageerror', (error) => console.log('Desk runtime:', error.message))
    const planningRead = page.waitForResponse((response) =>
      response.url().includes('queue=planning'),
    )
    await f.login(page, f.coach, '/dashboard')
    const planningResponse = await planningRead
    expect(planningResponse.status()).toBe(200)
    expect((await planningResponse.json()).total).toBe(1)
    await page.screenshot({
      path: 'artifacts/r1e-coach-desk-initial-' + info.project.name + '.png',
      fullPage: true,
    })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back')
    await expect(page.getByRole('heading', { name: 'Today’s work' })).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: 'Needs scheduling', exact: true })
        .getByRole('button', { name: 'Schedule', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.tag[data-status="unscheduled"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Athlete health', exact: true })).toBeVisible()
    await expect(
      page.getByText('No shared status means unknown, not cleared to train.', { exact: false }),
    ).toBeVisible()
    const recordQueue = page.getByRole('region', { name: 'Workouts to record', exact: true })
    await expect(
      page.getByRole('heading', { name: 'Continue recording', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Due workouts', exact: true })).toHaveCount(0)
    const oldQueueUrl = '**/v1/institution/workout-scheduling?**queue=actionable'
    await page.route(oldQueueUrl, async (route) => {
      const url = route.request().url().replace('queue=actionable', 'queue=planning')
      const response = await route.fetch({ url })
      const result = await response.json()
      delete result.queue
      await route.fulfill({ json: result })
    })
    await recordQueue.getByRole('button', { name: 'Refresh workouts', exact: true }).click()
    await expect(
      recordQueue.getByText('The backend does not confirm this workout queue.', { exact: false }),
    ).toBeVisible()
    await expect(recordQueue.locator('.record-row')).toHaveCount(0)
    await page.unroute(oldQueueUrl)
    await recordQueue.getByRole('button', { name: 'Refresh workouts', exact: true }).click()
    await expect(recordQueue.getByRole('alert')).toHaveCount(0)
    await inspect(page, 'coach-priorities', info)
    // UI-only synthetic status response: this checks long/populated/error rendering, not authorization.
    const statusUrl = '**/v1/institution/injuries?view=trainer'
    await page.route(statusUrl, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'display-status',
              athlete_name: 'Synthetic athlete with a deliberately long roster display name',
              participation: 'modified',
              effective_from: new Date().toISOString(),
            },
          ],
        },
      }),
    )
    await page.getByRole('button', { name: 'Refresh athlete health' }).click()
    await expect(
      page.getByText('Synthetic athlete with a deliberately long roster display name'),
    ).toBeVisible()
    await inspect(page, 'coach-desk-status', info)
    await page.unroute(statusUrl)
    await page.route(statusUrl, (route) => route.abort('failed'))
    await page.getByRole('button', { name: 'Refresh athlete health' }).click()
    await expect(page.locator('.desk-status').getByRole('alert')).toBeVisible()
    await expect(
      page.getByText('Synthetic athlete with a deliberately long roster display name'),
    ).toBeVisible()
    await page.unroute(statusUrl)
    await page.getByRole('button', { name: 'Refresh athlete health' }).click()
    await expect(page.locator('.desk-status').getByRole('alert')).toHaveCount(0)

    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'عمل اليوم', exact: true })).toBeVisible()
    await inspect(page, 'coach-desk-ar', info)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Today’s work', exact: true })).toBeVisible()
    const planning = page.getByRole('region', { name: 'Needs scheduling', exact: true })
    await planning.getByRole('button', { name: 'Schedule', exact: true }).click()
    const planningForm = page.getByRole('dialog', { name: 'Schedule the next workout' })
    await planningForm
      .getByLabel('Date and time', { exact: true })
      .fill(new Date(Date.now() - 60000).toISOString().slice(0, 16))
    const savedSchedule = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/v1/institution/workout-scheduling'),
    )
    await planningForm.getByRole('button', { name: 'Save schedule', exact: true }).click()
    const scheduleResponse = await savedSchedule
    expect(scheduleResponse.status(), JSON.stringify(await scheduleResponse.json())).toBe(200)
    await page.screenshot({
      path: 'artifacts/r1e-desk-scheduled-' + info.project.name + '.png',
      fullPage: true,
    })
    await expect(planning.getByRole('button', { name: 'Schedule', exact: true })).toHaveCount(0)
    await expect(recordQueue.locator('.record-row')).toHaveCount(1)
    await expect(recordQueue.getByText(/Full body A/)).toHaveCount(1)
    await recordQueue.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page).toHaveURL(/\/record\/[a-f0-9-]{36}$/)
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Resume', exact: true })).toHaveCount(1)
    await expect(page.getByText(/Full body A/)).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'Needs scheduling', exact: true })).toHaveCount(0)
    await inspect(page, 'coach-desk-single-record', info)
  } finally {
    await f.cleanup()
  }
})

test('role dashboards prioritize athlete actions and administrator oversight', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  page.setDefaultTimeout(15000)
  const f = await institutionFixture()
  try {
    await institution(f, 'Madar oversight')
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    const errors: string[] = []
    page.on('pageerror', (e) => {
      console.log('Dashboard error at', page.url(), e.message)
      errors.push(e.message)
    })
    await f.login(page, f.owner, '/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Institution overview')
    await expect(
      page.getByText('Recorded completions in this period', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('No records in this period', { exact: true })).toHaveCount(1)
    await inspect(page, 'admin-overview-empty', info)
    const analytics = '**/v1/institution/analytics?**'
    await page.route(analytics, async (route) => {
      const response = await route.fetch(),
        result = await response.json()
      result.summary.completed = 9
      result.summary.participating = 1
      result.daily = [{ date: result.window.to, value: 9 }]
      result.attendance = [
        { label: 'present', value: 6 },
        { label: 'unmarked', value: 2 },
      ]
      await route.fulfill({ json: result })
    })
    await page.getByRole('combobox', { name: /Reporting period/ }).selectOption('7')
    await expect(page.getByText('9', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('img', { name: 'Workout activity', exact: true })).toBeVisible()
    await inspect(page, 'admin-overview-populated', info)
    await page.unroute(analytics)
    await page.route(analytics, (route) => route.abort())
    await page.getByRole('combobox', { name: /Reporting period/ }).selectOption('90')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Workout activity', exact: true })).toBeVisible()
    await page.unroute(analytics)
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('نظرة عامة على المؤسسة')
    await inspect(page, 'admin-overview-ar', info)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    expect(errors).toEqual([])
    const athleteContext = await browser.newContext({
      baseURL: testPreview,
      viewport: page.viewportSize()!,
      isMobile: !!info.project.use.isMobile,
      hasTouch: !!info.project.use.hasTouch,
      deviceScaleFactor: Number(info.project.use.deviceScaleFactor || 1),
      serviceWorkers: 'block',
    })
    page = await athleteContext.newPage()
    page.setDefaultTimeout(15000)
    page.on('pageerror', (e) => {
      console.log('Athlete error at', page.url(), e.message)
      errors.push(e.message)
    })
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    await f.login(page, f.client, '/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('My day')
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your coaches', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Message R4 Coach/i })).toBeVisible()
    await inspect(page, 'athlete-my-day', info)
    await expect(page.getByRole('link', { name: 'All my workouts', exact: true })).toHaveCount(1)
    await page.getByRole('link', { name: /Message R4 Coach/i }).click()
    await expect(page).toHaveURL(/\/messages\/[a-f0-9-]+$/)
    await expect(page.getByPlaceholder('Write a message…', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Log food', exact: true }).click()
    await expect(page).toHaveURL(/nutrition\?section=diary/)
    await expect(page.getByRole('heading', { name: 'Food diary', exact: true })).toBeVisible()
    await page.goto('/dashboard')
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('يومي')
    await inspect(page, 'athlete-my-day-ar', info)
    expect(errors).toEqual([])
    await athleteContext.close()
  } finally {
    await f.cleanup()
  }
})

test('plan scheduling switches from weekly slots to opt-in day-only preparation', async ({
  page,
}, info) => {
  test.setTimeout(180000)
  page.setDefaultTimeout(15000)
  const f = await institutionFixture()
  try {
    await institution(
      f,
      'Madar recurring',
      (plan) => {
        plan.days[0].weekday = 0
        plan.days[0].week = 1
        plan.days[0].restDay = false
      },
      false,
    )
    const assigned = (await f.call(f.coach, '/v1/institution/athlete-plans?view=trainer')).items[0]
      .id
    const today = new Date().toISOString().slice(0, 10),
      tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      until = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    await page.addInitScript(() => {
      if (!localStorage.getItem('rafik.theme')) localStorage.setItem('rafik.theme', 'light')
    })
    await f.login(page, f.coach, '/training/' + assigned)
    const policy = page.getByRole('region', { name: 'Scheduling policy', exact: true })
    await expect(
      policy.getByText('Manual scheduling. Automatic preparation is off.', { exact: true }),
    ).toBeVisible()
    await policy.getByRole('button', { name: 'Set up scheduling', exact: true }).click()
    await policy.getByLabel('From', { exact: true }).fill(tomorrow)
    await policy.getByLabel('Until', { exact: true }).fill(until)
    await policy.getByLabel('Local time', { exact: true }).fill('10:00')
    await inspect(page, 'rule-weekly-form', info)
    await policy.getByRole('button', { name: 'Save scheduling', exact: true }).click()
    await expect(
      policy.getByRole('button', { name: 'Change future scheduling', exact: true }),
    ).toBeVisible()
    const readRule = async () =>
      (
        await f.call(f.coach, `/v1/institution/workout-rules?view=trainer&assignment=${assigned}`)
      ).items.find((r: any) => r.state === 'active')
    await expect
      .poll(async () => !!(await readRule())?.last_generated_on, {
        timeout: 15000,
        intervals: [500, 1000],
      })
      .toBe(true)
    const old = (
      await f.call(
        f.coach,
        `/v1/institution/workout-scheduling?view=trainer&assignment=${assigned}`,
      )
    ).items[0]
    await page.getByRole('button', { name: 'Refresh workouts', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Reschedule', exact: true })).toBeVisible()
    await policy.getByRole('button', { name: 'Stop future scheduling', exact: true }).click()
    await expect(
      policy.getByText('Manual scheduling. Automatic preparation is off.', { exact: true }),
    ).toBeVisible()
    const retained = (
      await f.call(
        f.coach,
        `/v1/institution/workout-scheduling?view=trainer&assignment=${assigned}`,
      )
    ).items[0]
    expect(retained.occurrence.id).toBe(old.occurrence.id)
    await f.call(f.coach, '/v1/institution/workout-scheduling', {
      operation: randomUUID(),
      action: 'skip-workout',
      view: 'trainer',
      assignment_id: assigned,
      occurrence_id: old.occurrence.id,
      revision: old.occurrence.revision,
      reason: 'Synthetic weekly slot resolved before enabling daily preparation',
    })
    await policy.getByRole('button', { name: 'Set up scheduling', exact: true }).click()
    await policy.getByRole('radio', { name: 'Automatic daily preparation', exact: true }).check()
    await policy.getByLabel('From', { exact: true }).fill(today)
    await policy.getByLabel('Until', { exact: true }).fill(until)
    await policy.getByRole('button', { name: 'Save scheduling', exact: true }).click()
    await expect
      .poll(async () => !!(await readRule())?.last_generated_on, {
        timeout: 15000,
        intervals: [500, 1000],
      })
      .toBe(true)
    await page.getByRole('button', { name: 'Refresh workouts', exact: true }).click()
    await expect(page.getByText('No fixed time', { exact: false })).toBeVisible()
    await inspect(page, 'rule-automatic-plan', info)
    await page.goto('/schedule')
    const dayEvent = page.locator('.agenda-event').filter({ hasText: 'No fixed time' })
    await expect(dayEvent).toBeVisible()
    await inspect(page, 'rule-day-calendar', info)
    await dayEvent.click()
    await expect(page.getByRole('link', { name: 'Open plan workouts', exact: true })).toBeVisible()
    await expect(page.getByText('No fixed time', { exact: false })).toBeVisible()
    await page.goto('/training/' + assigned)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await page.getByRole('button', { name: 'تغيير الجدولة القادمة', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'تجهيز يومي تلقائي', exact: true })).toBeChecked()
    await inspect(page, 'rule-automatic-ar', info)
  } finally {
    await f.cleanup()
  }
})

test('program preparation default is visible and confirmed at assignment', async ({
  page,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture()
  try {
    const prepared = await institution(f, 'Preparation defaults', undefined, false)
    const program = randomUUID()
    const published = await f.call(f.coach, '/v1/institution/programs', {
      operation: randomUUID(),
      action: 'publish',
      view: 'trainer',
      id: program,
      title: 'Daily preparation',
      revision: null,
      draft: { ...prepared.plan, automaticPreparation: true },
    })
    await f.login(page, f.coach, '/plans/' + program)
    const preference = page.getByLabel('Default to automatic daily preparation', { exact: true })
    await expect(preference).toBeChecked()
    await preference.uncheck()
    await preference.check()
    await preference.scrollIntoViewIfNeeded()
    await inspect(page, 'program-preparation-default', info)
    await page.goto('/deliver/' + published.version.id + '?member=' + prepared.athlete.id)
    const automatic = page.getByLabel('Automatic daily preparation', { exact: true })
    await expect(automatic).toBeChecked()
    const end = page.getByLabel('Preparation ends on', { exact: true })
    await expect(end).toHaveAttribute('required', '')
    await automatic.uncheck()
    await expect(page.getByLabel('End date (optional)', { exact: true })).toBeVisible()
    await automatic.check()
    await end.fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
    await inspect(page, 'program-preparation-assignment', info)
    await page
      .getByRole('button', { name: /Review assignment|Review and assign|Review selection/ })
      .click()
    await expect(page.getByText(/Automatic daily preparation ·/)).toBeVisible()
    await page.getByRole('button', { name: 'Confirm assignment', exact: true }).click()
    await expect(page.getByText('Ready for their next session.', { exact: true })).toBeVisible()
    const assigned = (
      await f.call(f.coach, '/v1/institution/athlete-plans?view=trainer')
    ).items.find(
      (p: any) => p.version_id === published.version.id || p.version?.id === published.version.id,
    )
    expect(assigned).toBeTruthy()
    const rules = await f.call(
      f.coach,
      '/v1/institution/workout-rules?view=trainer&assignment=' + assigned.id,
    )
    expect(rules.items.filter((r: any) => r.state === 'active')).toHaveLength(1)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'light')
    })
    await page.goto('/plans/' + program)
    const arabicPreference = page.getByLabel('التحضير اليومي التلقائي افتراضياً', { exact: true })
    await expect(arabicPreference).toBeChecked()
    await arabicPreference.scrollIntoViewIfNeeded()
    await inspect(page, 'program-preparation-default-ar', info)
    await page.goto('/deliver/' + published.version.id)
    await expect(page.getByLabel('التحضير اليومي التلقائي', { exact: true })).toBeChecked()
    await inspect(page, 'program-preparation-assignment-ar', info)
  } finally {
    await f.cleanup()
  }
})

test('calendar entry schedules the existing plan workout without a separate named event', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const f = await institutionFixture()
  try {
    const { athlete } = await institution(f, 'Scheduling entry validation', undefined, false)
    const before = await f.call(
      f.coach,
      '/v1/institution/workout-scheduling?view=trainer&queue=planning',
    )
    const next = before.items.find((item: any) => item.member_id === athlete.id)
    expect(next).toBeTruthy()
    let calendarWrites = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/v1/institution/calendar'))
        calendarWrites++
    })
    await f.login(page, f.coach, '/schedule/new')
    await expect(page.getByRole('radio', { name: /^Workout from a plan/ })).toBeChecked()
    await expect(page.getByLabel('Event name', { exact: true })).not.toBeVisible()
    const finder = page.getByRole('searchbox', { name: 'Search athletes', exact: true })
    await finder.fill('No such validation athlete')
    await finder.press('Enter')
    await expect(
      page.getByText('No workouts match this athlete search.', { exact: true }),
    ).toBeVisible()
    await finder.fill(athlete.name)
    await finder.press('Enter')
    await page.getByRole('button', { name: 'Schedule workout', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Schedule the next workout', exact: true })
    const timezonePicker = dialog.getByRole('combobox', { name: 'Timezone', exact: true })
    await timezonePicker.fill('Dubai')
    await page.getByRole('option', { name: 'Asia/Dubai · UTC+4', exact: true }).click()
    await expect(timezonePicker).toHaveValue('Asia/Dubai · UTC+4')
    await expect(dialog).toBeVisible()
    await dialog
      .getByLabel('Date and time', { exact: true })
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16))
    await inspect(page, 'calendar-plan-workout-entry', info)
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/v1/institution/workout-scheduling'),
    )
    await dialog.getByRole('button', { name: 'Save schedule', exact: true }).click()
    expect((await saved).status()).toBe(200)
    await expect(page).toHaveURL(/\/schedule$/)
    const after = await f.call(
      f.coach,
      '/v1/institution/workout-scheduling?view=trainer&assignment=' + next.assignment_id,
    )
    expect(after.items).toHaveLength(1)
    expect(after.items[0].assignment_id).toBe(next.assignment_id)
    expect(after.items[0].cursor).toBe(next.cursor)
    expect(after.items[0].day.id).toBe(next.day.id)
    expect(after.items[0].occurrence.id).toBeTruthy()
    expect(calendarWrites).toBe(0)
    await page.goto('/schedule/new')
    await expect(page.getByRole('button', { name: 'Schedule workout', exact: true })).toHaveCount(0)
    await page.getByRole('radio', { name: /^Custom event/ }).check()
    await expect(page.getByLabel('Event name', { exact: true })).toBeVisible()
  } finally {
    await f.cleanup()
  }
})

test('event template uses one search and preserves selection through no matches', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const f = await institutionFixture()
  try {
    await institution(f, 'Template picker', undefined, false)
    for (let i = 0; i < 6; i++)
      await f.call(f.coach, '/v1/institution/services', {
        operation: randomUUID(),
        action: 'template',
        view: 'trainer',
        id: randomUUID(),
        revision: 0,
        title: `Fitness ${i + 1}`,
        archived: false,
        definition: [{ key: randomUUID(), name: 'Standing jump', unit: 'cm', kind: 'number' }],
      })
    await f.login(page, f.coach, '/schedule/new')
    await page.getByRole('radio', { name: /^Assessor-led assessment/ }).check()
    await page.getByLabel('Event name', { exact: true }).fill('Pre-season assessment')
    await expect(page.getByLabel('Event name', { exact: true })).toHaveAttribute(
      'placeholder',
      'For example: Pre-season fitness assessment',
    )
    const picker = page.getByRole('region', { name: 'Assessment template', exact: true })
    await expect(picker.getByRole('searchbox')).toHaveCount(1)
    await expect(picker.getByRole('combobox')).toHaveCount(0)
    await expect(picker.getByRole('radio')).toHaveCount(5)
    await picker.scrollIntoViewIfNeeded()
    await inspect(page, 'event-template-options', info)
    await picker.getByRole('button', { name: 'More templates', exact: true }).click()
    await picker.getByRole('radio', { name: 'Fitness 6 1 test', exact: true }).check()
    await picker.getByRole('searchbox').fill('not-found')
    await picker.getByRole('searchbox').press('Enter')
    await expect(
      picker.getByText('No templates match. Try another name or create a template.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(picker.locator('.template-selection')).toContainText('Fitness 6')
    await picker.scrollIntoViewIfNeeded()
    await inspect(page, 'event-template-search', info)
    await page.getByRole('button', { name: 'Choose people', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Choose people', exact: true })).toBeVisible()
    await page.reload()
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'light')
    })
    await page.goto('/schedule/new')
    const arabicPicker = page.getByRole('region', { name: 'قالب التقييم', exact: true })
    await expect(arabicPicker.locator('.template-selection')).toContainText('Fitness 6')
    await arabicPicker.scrollIntoViewIfNeeded()
    await inspect(page, 'event-template-search-ar', info)
    const colors = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d')!
      const pixel = (token: string) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const lum = (rgb: number[]) =>
        rgb
          .map((v) => {
            const c = v / 255
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0)
      const ratio = (a: string, b: string) => {
        const x = lum(pixel(a)),
          y = lum(pixel(b))
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
      }
      return {
        card: ratio('--surface', '--page'),
        text: ratio('--ink', '--surface'),
        muted: ratio('--muted', '--surface'),
        softMuted: ratio('--muted', '--surface-soft'),
      }
    })
    // Cards are raised by border and shadow (28 Oct theme); the surface stays brighter than the canvas.
    expect(colors.card).toBeGreaterThan(1.02)
    expect(colors.text).toBeGreaterThanOrEqual(4.5)
    expect(colors.muted).toBeGreaterThanOrEqual(4.5)
    expect(colors.softMuted).toBeGreaterThanOrEqual(4.5)
    console.info('Default light-theme contrast ratios', colors)
  } finally {
    await f.cleanup()
  }
})

test('message directory tabs mix institution channels without exposing private previews', async ({
  page,
}, info) => {
  test.setTimeout(180000)
  page.setDefaultTimeout(15000)
  const f = await institutionFixture()
  try {
    const prepared = await institution(f, 'Message tabs', undefined, false)
    await f.call(f.owner, '/v1/institution?view=admin')
    const group = randomUUID()
    await f.call(f.coach, '/v1/institution/services', {
      operation: randomUUID(),
      action: 'group',
      view: 'trainer',
      id: group,
      revision: 0,
      name: 'Field group',
      archived: false,
      members: [prepared.athlete.id],
    })
    await f.call(f.coach, '/v1/institution/communication', {
      operation: randomUUID(),
      action: 'open-group',
      view: 'trainer',
      id: group,
    })
    await f.login(page, f.owner, '/messages')
    await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
    await page
      .locator('.conversation-contacts')
      .getByRole('button', { name: /R4 Athlete/ })
      .click()
    await expect(page).toHaveURL(/\/messages\/[a-f0-9-]{36}$/)
    if ((page.viewportSize()?.width || 1440) <= 850)
      await page.getByRole('link', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Chats', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const directory = page.locator('.conversation-directory')
    await directory.evaluate((node) => node.setAttribute('data-continuity', 'retained'))
    await page
      .getByRole('switch', { name: 'Include institution conversations', exact: true })
      .click()
    const unjoined = page.locator('article.conversation-person').filter({ hasText: 'Field group' })
    await expect(
      unjoined.getByRole('button', { name: 'Join conversation', exact: true }),
    ).toBeVisible()
    await expect(
      page.locator('.conversation-list').getByRole('link', { name: /R4 Athlete/ }),
    ).toBeVisible()
    // Typing narrows the chat list immediately and keeps the directory mounted.
    const search = page.getByRole('searchbox', { name: 'Search chats', exact: true })
    await search.fill('Field group')
    await expect(unjoined).toBeVisible()
    await expect(
      page.locator('.conversation-list').getByRole('link', { name: /R4 Athlete/ }),
    ).toHaveCount(0)
    await expect(directory).toHaveAttribute('data-continuity', 'retained')
    await inspect(page, 'message-groups-mixed', info)
    await search.fill('')
    await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
    await expect(
      page.locator('.conversation-contacts').getByRole('button', { name: /R4 Athlete/ }),
    ).toContainText('Open chat')
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.goto('/messages')
    await page.setViewportSize({ width: 320, height: 740 })
    const conversations = page.getByRole('tab', { name: 'المحادثات', exact: true })
    await expect(conversations).toBeVisible()
    await conversations.focus()
    await conversations.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: 'جهات الاتصال', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await inspect(page, 'message-tabs-ar-320', info)
  } finally {
    await f.cleanup()
  }
})
