import { test, expect, type Page } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
import { testPreview } from './local-config'
test.use({ baseURL: testPreview })

async function inspect(page: Page, name: string, info: { project: { name: string } }) {
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: `artifacts/r1b-${name}-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
}

test('admin builds a coaching team; a supporting coach sees training only until the link ends', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture(),
    supportContext = await browser.newContext(),
    supportPage = await supportContext.newPage(),
    institution = randomUUID(),
    endpoint = `/v1/institution`
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Madar coaching team',
    })
    const support = await f.createPerson('Supporting Coach With A Long Name')
    for (const [person, roles] of [
      [f.coach, ['trainer']],
      [support, ['trainer']],
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
    const people = await f.call(f.owner, `${endpoint}?view=admin`),
      athlete = people.members.find((m: any) => m.user_id === f.client.id),
      primary = people.members.find((m: any) => m.user_id === f.coach.id),
      supporting = people.members.find((m: any) => m.user_id === support.id),
      football = randomUUID()
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
    for (const member of [athlete, supporting])
      await f.call(f.owner, endpoint + '/sports', {
        operation: randomUUID(),
        action: 'member-sports',
        view: 'admin',
        member: member.id,
        sports: [football],
        previous: [],
      })
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: athlete.id,
      revision: athlete.revision,
      trainer: primary.id,
    })

    const base = ``
    await f.login(page, f.owner, base + '/people')
    // Management lives on the profile's Manage tab; the directory icon opens it directly.
    await page.getByRole('link', { name: 'Manage R4 Athlete', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/members/${athlete.id}\\?tab=manage`))
    const manageUrl = page.url()
    const team = page.locator('.coaching-team')
    await expect(
      team.getByRole('checkbox', { name: /^Supporting Coach With A Long Name/ }),
    ).not.toBeChecked()
    // Choosing a coach with one eligible scope saves immediately.
    const linked = page.waitForResponse(
      (r) =>
        r.url().endsWith('/v1/institution') &&
        r.request().method() === 'POST' &&
        r.request().postDataJSON()?.action === 'link-coach',
    )
    await team.getByRole('checkbox', { name: /^Supporting Coach With A Long Name/ }).check()
    expect((await linked).ok()).toBeTruthy()
    await expect(
      team.getByRole('checkbox', { name: /^Supporting Coach With A Long Name/ }),
    ).toBeChecked()
    await expect(
      team.getByRole('checkbox', { name: /^Supporting Coach With A Long Name/ }),
    ).toBeEnabled()
    await expect(team.locator('.chosen-members, .coaching-links')).toHaveCount(0)
    await inspect(page, 'supporting-inline-selected', info)
    await page.goto(base + '/people')
    const card = page
      .locator('.organization-person')
      .filter({ has: page.getByRole('heading', { name: 'R4 Athlete', exact: true }) })
    await expect(card).toContainText('Primary coach: R4 Coach')
    await expect(card).toContainText('Supporting: Supporting Coach With A Long Name · Football')
    await inspect(page, 'admin-team', info)

    // The supporting coach sees the athlete, flagged as training-only, without nutrition.
    await f.login(supportPage, support, `/people`)
    const supportCard = supportPage
      .locator('.organization-person')
      .filter({ has: supportPage.getByRole('heading', { name: 'R4 Athlete', exact: true }) })
    await expect(supportCard).toContainText('You support this athlete for training records only.')
    await expect(supportCard.getByRole('link', { name: 'Nutrition' })).toHaveCount(0)
    await expect(supportCard.getByRole('link', { name: 'Message' })).toBeVisible()
    const nutrition = await supportPage.request.get(
      `http://127.0.0.1:55341${endpoint}/nutrition?view=trainer&member=${athlete.id}`,
      { headers: { 'x-rafik-client': 'web' } },
    )
    expect(nutrition.status()).toBe(403)
    await inspect(supportPage, 'supporting-roster', info)

    // Arabic dark phone view of the admin team panel.
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(manageUrl)
    await expect(page.getByRole('heading', { name: 'المدربون المساندون' })).toBeVisible()
    await inspect(page, 'admin-team-ar-dark-320', info)

    // Ending the link removes the athlete from the supporting coach's roster.
    const ended = page.waitForResponse(
      (r) =>
        r.url().endsWith('/v1/institution') &&
        r.request().method() === 'POST' &&
        r.request().postDataJSON()?.action === 'end-coach-link',
    )
    await page
      .locator('.coaching-team')
      .getByRole('checkbox', { name: /^Supporting Coach With A Long Name/ })
      .uncheck()
    expect((await ended).ok()).toBeTruthy()
    await expect(
      page
        .locator('.coaching-team')
        .getByRole('checkbox', { name: /^Supporting Coach With A Long Name/ }),
    ).not.toBeChecked()
    await supportPage.reload()
    await expect(supportPage.getByRole('heading', { name: 'R4 Athlete', exact: true })).toHaveCount(
      0,
    )
  } finally {
    await supportContext.close()
    await f.cleanup()
  }
})
