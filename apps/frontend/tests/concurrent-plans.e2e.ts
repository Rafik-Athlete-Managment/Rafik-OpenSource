import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

async function inspect(page: Page, name: string, info: { project: { name: string } }) {
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: `artifacts/r1c-${name}-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
}

test('coach adds a concurrent goal-specific plan, the athlete sees both, then plans are ended or replaced explicitly', async ({
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
      name: 'Madar concurrent plans',
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
    const football = randomUUID()
    await f.call(f.owner, endpoint + '/sports', {
      operation: randomUUID(),
      action: 'sport',
      view: 'admin',
      id: football,
      name: 'Football',
      kind: 'sport',
      archived: false,
      revision: 0,
    })
    const plan = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../backend/content/starter.json'), 'utf8'),
    ).prescription
    const release = (title: string, id = randomUUID(), revision: number | null = null) =>
      f.call(f.coach, endpoint + '/programs', {
        operation: randomUUID(),
        action: 'publish',
        view: 'trainer',
        id,
        title,
        draft: plan,
        revision,
      })
    const publish = async (title: string) => (await release(title)).version.id as string
    const speed = await publish('Speed block'),
      strength = await publish('Strength block'),
      mobility = await publish('Mobility block')
    people = await f.call(f.owner, `${endpoint}?view=admin`)
    athlete = people.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.coach, endpoint + '/delivery', {
      operation: randomUUID(),
      action: 'assign',
      view: 'trainer',
      version_id: speed,
      start_date: today,
      schedule_mode: 'flexible',
      goal: 'Match speed',
      sport: football,
      members: [{ id: athlete.id, revision: athlete.revision, replaces: null }],
    })

    // Coach adds a second plan; the existing one is kept by default.
    const base = ``
    await f.login(page, f.coach, `${base}/deliver/${strength}?member=${athlete.id}`)
    await expect(
      page.getByText('Speed block · Match speed · Football', { exact: true }),
    ).toBeVisible()
    const chosen = page.getByRole('region', { name: 'Selected athletes', exact: true })
    await expect(chosen).toContainText('Added alongside current plans')
    await page.getByLabel('Goal (optional)').fill('General strength')
    await page.getByRole('button', { name: /^Review assignment/ }).click()
    await expect(page.getByText('R4 Athlete — Added alongside current plans')).toBeVisible()
    await inspect(page, 'delivery-review', info)
    await page.getByRole('button', { name: 'Confirm assignment', exact: true }).click()
    const overlap = page.getByRole('status').filter({ hasText: 'Overlapping plans' })
    await expect(overlap).toContainText('R4 Athlete: Speed block · Match speed')

    // Searching the same program again greys out an athlete who is already on it.
    await page.goto(`${base}/deliver/${strength}`)
    await page.getByRole('searchbox', { name: 'Find athletes', exact: true }).fill('R4 Athlete')
    const already = page.getByRole('button', {
      name: 'R4 Athlete: already on this program',
      exact: true,
    })
    await expect(already).toBeDisabled()
    await expect(already).toContainText('Already on this program')
    await page.goto(`${base}/deliver/${strength}?member=${athlete.id}`)
    await expect(page.getByRole('alert')).toContainText('Already on this program')
    await expect(page.getByRole('button', { name: /^Review assignment/ })).toBeDisabled()

    // The athlete sees both plans, their labels and a same-day notice.
    await f.login(athletePage, f.client, `/training`)
    await expect(athletePage.getByRole('heading', { name: 'Speed block' })).toBeVisible()
    await expect(athletePage.getByRole('heading', { name: 'Strength block' })).toBeVisible()
    await expect(athletePage.getByText('Match speed', { exact: true })).toBeVisible()
    await expect(athletePage.getByText('General strength', { exact: true })).toBeVisible()
    await expect(
      athletePage.getByText('You have sessions from more than one plan today.', { exact: false }),
    ).toBeVisible()
    await expect(
      athletePage.getByRole('button', { name: /Open session .* · Strength block/ }).first(),
    ).toBeVisible()
    await inspect(athletePage, 'athlete-two-plans', info)

    // End one plan from the staff plan detail.
    await page.goto(`/training?status=active`)
    const card = page.locator('.athlete-plan-list .record-row').filter({ hasText: 'Speed block' })
    await expect(card.getByText(/Match speed · Football/)).toBeVisible()
    await card.locator('.record-title a').click()
    await page.getByRole('button', { name: 'More plan actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'End plan…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'End plan', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goto(`/training?status=active`)
    await expect(
      page.locator('.athlete-plan-list .record-row').filter({ hasText: 'Speed block' }),
    ).toHaveCount(0)

    // Replacing is an explicit per-athlete choice.
    await page.goto(`${base}/deliver/${mobility}?member=${athlete.id}`)
    await page
      .getByRole('button', { name: 'Change plan choice for R4 Athlete', exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /Replace Strength block · General strength/ }).check()
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Selected athletes', exact: true }),
    ).toContainText('Replaces Strength block · General strength')
    await page.getByRole('button', { name: /^Review assignment/ }).click()
    await expect(
      page.getByText('R4 Athlete — Replaces Strength block · General strength'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Confirm assignment', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ready for their next session.' })).toBeVisible()
    await athletePage.reload()
    await expect(athletePage.getByRole('heading', { name: 'Mobility block' })).toBeVisible()
    await expect(athletePage.getByRole('heading', { name: 'Strength block' })).toHaveCount(0)
    await expect(athletePage.getByRole('heading', { name: 'Speed block' })).toHaveCount(0)

    // A renamed, republished version of the athlete's program is the same program: adding moves them.
    const tempo = randomUUID(),
      first = await release('Tempo block', tempo)
    await f.call(f.coach, endpoint + '/delivery', {
      operation: randomUUID(),
      action: 'assign',
      view: 'trainer',
      version_id: first.version.id,
      start_date: today,
      schedule_mode: 'flexible',
      members: [{ id: athlete.id, revision: athlete.revision, replaces: null }],
    })
    const second = await release('Tempo block II', tempo, first.plan.draft_version)
    await page.goto(`${base}/deliver/${second.version.id}`)
    await page.getByRole('searchbox', { name: 'Find athletes', exact: true }).fill('R4 Athlete')
    const move = page.getByRole('button', { name: 'Add R4 Athlete', exact: true })
    await expect(move).toContainText('On version 1 · will move to this version')
    await move.click()
    await expect(
      page.getByRole('region', { name: 'Selected athletes', exact: true }),
    ).toContainText('Moves from version 1 to this version')
    await page.getByRole('button', { name: /^Review assignment/ }).click()
    await expect(page.getByText('R4 Athlete — Moves from version 1 to this version')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm assignment', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ready for their next session.' })).toBeVisible()
    await athletePage.reload()
    await expect(athletePage.getByRole('heading', { name: 'Tempo block II' })).toBeVisible()
    await expect(
      athletePage.getByRole('heading', { name: 'Tempo block', exact: true }),
    ).toHaveCount(0)

    // Arabic dark phone view of two plans.
    await f.call(f.coach, endpoint + '/delivery', {
      operation: randomUUID(),
      action: 'assign',
      view: 'trainer',
      version_id: speed,
      start_date: today,
      schedule_mode: 'flexible',
      goal: 'سرعة المباراة',
      sport: football,
      members: [{ id: athlete.id, revision: athlete.revision, replaces: null }],
    })
    await athletePage.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await athletePage.setViewportSize({ width: 320, height: 740 })
    await athletePage.reload()
    await expect(athletePage.getByText('سرعة المباراة', { exact: true })).toBeVisible()
    await expect(athletePage.locator('html')).toHaveAttribute('dir', 'rtl')
    await inspect(athletePage, 'athlete-two-plans-ar-dark-320', info)
  } finally {
    await athleteContext.close()
    await f.cleanup()
  }
})
