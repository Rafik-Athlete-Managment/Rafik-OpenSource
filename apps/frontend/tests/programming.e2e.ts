import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
test('organization program authoring, reviewed delivery, recording and feedback stay in one scope', async ({
  page,
  browser,
}, info) => {
  // Two publications/assignments plus offline/reload/review; individual expectations remain bounded.
  test.setTimeout(150000)
  const f = await institutionFixture(),
    clientContext = await browser.newContext(),
    client = await clientContext.newPage(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Madar performance',
    })
    const token = randomBytes(32).toString('hex')
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: f.client.email,
      roles: ['trainee'],
      token,
    })
    await f.call(f.client, `/v1/invitations/${token}`, {})
    const base = ``
    await f.login(page, f.owner, base + '/plans/new')
    await expect(page.locator('.editor-exercise')).toHaveCount(0)
    await expect(page.locator('.program-empty-exercises')).toBeVisible()
    await page.getByLabel('Program name', { exact: true }).fill('Three-day foundation')
    await expect(page.getByLabel('Main goal', { exact: true })).toBeVisible()
    await page.getByLabel('Main goal', { exact: true }).fill('Build a steady training habit')
    await page.getByLabel('Upload a program cover image', { exact: true }).setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
        'base64',
      ),
    })
    await expect(page.locator('.program-cover')).toBeVisible()
    await expect
      .poll(() =>
        page.locator('.program-cover').evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBe(1)

    await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
    await page.getByRole('button', { name: 'Duplicate session', exact: true }).click()
    await page.getByLabel('Session name', { exact: true }).fill('Full body C')
    await page.getByRole('button', { name: 'Duplicate this week', exact: true }).click()
    await page.getByRole('button', { name: 'Athlete preview', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Three-day foundation', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Edit program', exact: true }).click()
    await page.getByRole('button', { name: 'Publish program', exact: true }).click()
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Published and added to the institution program library.' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Assign this plan', exact: true }).click()
    // Recipients are found by search (top matches) and added to a separate selection.
    await page.getByRole('searchbox', { name: 'Find athletes', exact: true }).fill('R4 Athlete')
    await page.getByRole('button', { name: 'Add R4 Athlete', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'Selected athletes', exact: true }),
    ).toContainText('R4 Athlete')
    await page.getByRole('button', { name: /Review assignment/ }).click()
    await expect(page.getByText('First plan', { exact: false })).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({
      path: `artifacts/r8-delivery-${info.project.name}.png`,
      fullPage: true,
    })
    let lost = false
    await page.route(`**/v1/institution/delivery`, async (route) => {
      if (!lost && route.request().method() === 'POST') {
        lost = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Confirm assignment', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeEnabled()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Ready for their next session.', exact: true }),
    ).toBeVisible()
    await f.login(client, f.client, `/training`)
    await client
      .getByRole('button', { name: /^Open session/ })
      .first()
      .click()
    await expect(client.getByRole('spinbutton', { name: 'Set 1 load', exact: true })).toBeVisible()
    let offline = true
    await client.route(`**/v1/institution/sessions`, async (r) => {
      if (offline && r.request().method() === 'POST') await r.abort('failed')
      else await r.continue()
    })
    await client.getByRole('spinbutton', { name: 'Set 1 load', exact: true }).fill('8')
    await client.getByRole('button', { name: 'Mark set 1 done', exact: true }).click()
    await client.getByRole('button', { name: 'Finish session', exact: true }).click()
    await client.getByRole('button', { name: 'Finish with recorded sets', exact: true }).click()
    await expect(client.getByRole('status')).toContainText('Saved here')
    await client.reload()
    await expect(
      client.getByRole('heading', { name: 'Session complete.', exact: true }),
    ).toBeVisible()
    offline = false
    await client.reload()
    await expect(client.getByRole('status')).toContainText('Synced with your account')
    const workout = client.url()
    // Staff review recorded workouts from Session history; /training is the plan index.
    await page.goto(base + '/workouts')
    await page
      .getByRole('link')
      .filter({ hasText: 'R4 Athlete' })
      .filter({ hasText: 'Three-day foundation' })
      .click()
    await expect(page.getByText('8 kg × 10', { exact: true })).toBeVisible()
    await page.getByLabel('Coach feedback').fill('Keep the same load next time.')
    await page.getByRole('button', { name: 'Save review', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Review saved' })).toBeVisible()
    await client.goto(workout)
    await expect(client.getByText('Keep the same load next time.', { exact: true })).toBeVisible()
    await page.goto(base + '/training')
    await page
      .locator('.athlete-plan-card')
      .filter({ hasText: 'Three-day foundation' })
      .getByRole('button', { name: 'View assigned plan' })
      .click()
    await page.getByRole('button', { name: 'Adapt this program', exact: true }).click()
    await expect(page.getByLabel('Program name', { exact: true })).toHaveValue(
      'Three-day foundation adapted',
    )
    await page.getByLabel('Program name', { exact: true }).fill('R4 Athlete next block')
    await page.reload()
    await expect(page.getByLabel('Program name', { exact: true })).toHaveValue(
      'R4 Athlete next block',
    )
    await page.getByRole('button', { name: 'Publish program', exact: true }).click()
    await page.getByRole('link', { name: 'Assign this plan', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'Selected athletes', exact: true }),
    ).toContainText('R4 Athlete')
    await page.getByRole('button', { name: /Review assignment/ }).click()
    await page.getByRole('button', { name: 'Confirm assignment', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Ready for their next session.', exact: true }),
    ).toBeVisible()
    await client.goto(workout)
    await expect(client.getByText('Keep the same load next time.', { exact: true })).toBeVisible()
  } finally {
    await clientContext.close()
    await f.cleanup()
  }
})
// The independent-coach delivery journey targeted retired /coach screens (ADR 0021); organization
// delivery, add/replace and review are covered above and in concurrent-plans.e2e.ts.
