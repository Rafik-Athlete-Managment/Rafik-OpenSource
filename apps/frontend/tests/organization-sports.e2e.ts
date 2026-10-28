import { test, expect, type Page } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

async function inspect(page: Page, name: string, info: { project: { name: string } }) {
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: `artifacts/r1a-${name}-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
}

test('admin defines sports and specialties, links people, and the coach filter stays in scope', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture(),
    coachContext = await browser.newContext(),
    coachPage = await coachContext.newPage(),
    institution = randomUUID(),
    endpoint = `/v1/institution`
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Madar sports',
    })
    const other = await f.createPerson('Second Athlete With A Long Family Name')
    for (const [person, roles] of [
      [f.coach, ['trainer']],
      [f.client, ['trainee']],
      [other, ['trainee']],
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
      coach = people.members.find((m: any) => m.user_id === f.coach.id)
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: athlete.id,
      revision: athlete.revision,
      trainer: coach.id,
    })

    // Settings: add a sport, a specialty and a long Arabic sport; rename one and archive one.
    const base = ``
    await f.login(page, f.owner, base + '/institution-settings')
    const settings = page.getByRole('region', { name: 'Sports and specialties' })
    const add = async (name: string, kind: 'Sport' | 'Coaching specialty') => {
      // Type first; the Add button names what it adds.
      await settings.getByRole('radio', { name: kind, exact: true }).check()
      await settings.getByLabel('Name', { exact: true }).first().fill(name)
      await settings
        .getByRole('button', {
          name: kind === 'Sport' ? 'Add sport' : 'Add specialty',
          exact: true,
        })
        .click()
      await expect(settings.getByText(name, { exact: true })).toBeVisible()
    }
    await add('Footbal', 'Sport')
    await add('Strength & conditioning', 'Coaching specialty')
    await add('كرة الطائرة الشاطئية للفرق الجامعية المتقدمة', 'Sport')
    await add('Archery', 'Sport')
    await settings.getByRole('button', { name: 'Rename Footbal', exact: true }).click()
    await settings.locator('input[id^="sport-"]').fill('Football')
    await settings.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(settings.getByText('Football', { exact: true })).toBeVisible()
    await settings.getByRole('button', { name: 'Archive Archery', exact: true }).click()
    await expect(
      settings.getByRole('button', { name: 'Restore Archery', exact: true }),
    ).toBeVisible()
    await expect(settings.getByRole('heading', { name: 'Sports (3)' })).toBeVisible()
    await expect(settings.getByRole('heading', { name: 'Coaching specialties (1)' })).toBeVisible()
    await page.reload()
    await expect(settings.getByText('Football', { exact: true })).toBeVisible()
    await inspect(page, 'settings', info)

    // People: athletes see sports only; coaches can also take specialties.
    // Member management lives on the profile's Manage tab, opened from the directory icon.
    await page.goto(base + '/people')
    await page.getByRole('link', { name: 'Manage R4 Athlete', exact: true }).click()
    await expect(page).toHaveURL(/\?tab=manage/)
    const athleteManage = page.url()
    const athleteSports = page.getByRole('group', { name: 'Sports', exact: true })
    await expect(athleteSports.getByRole('checkbox', { name: /Strength/ })).toHaveCount(0)
    await expect(athleteSports.getByRole('checkbox', { name: /Archery/ })).toHaveCount(0)
    await athleteSports.getByRole('checkbox', { name: 'Football' }).check()
    await page.getByRole('button', { name: 'Save sports', exact: true }).click()
    await expect(page.locator('.rafik-toast').last()).toBeVisible()
    await page.goto(base + '/people')
    await expect(
      page
        .locator('.organization-person')
        .filter({ has: page.getByRole('heading', { name: 'R4 Athlete', exact: true }) })
        .getByRole('list', { name: 'Sports and specialties' }),
    ).toHaveText('Football')
    await page.getByRole('tab', { name: 'Coaches', exact: true }).click()
    await page.getByRole('link', { name: 'Manage R4 Coach', exact: true }).click()
    const coachSports = page.getByRole('group', { name: 'Sports and specialties' })
    await coachSports.getByRole('checkbox', { name: /Strength & conditioning/ }).check()
    await coachSports.getByRole('checkbox', { name: 'Football' }).check()
    await page.getByRole('button', { name: 'Save sports', exact: true }).click()
    await expect(page.locator('.rafik-toast').last()).toBeVisible()
    await page.goto(base + '/people')
    await page.getByRole('tab', { name: 'Coaches', exact: true }).click()
    await expect(
      page
        .locator('.organization-person')
        .filter({ has: page.getByRole('heading', { name: 'R4 Coach', exact: true }) })
        .locator('.person-sports li'),
    ).toHaveCount(2)
    // Role tabs separate athletes from coaches; the sport filter narrows the athlete tab.
    await page.getByRole('tab', { name: 'Athletes', exact: true }).click()
    await page.getByLabel('Sport or specialty').selectOption({ label: 'Football' })
    await expect(page.locator('.organization-person')).toHaveCount(1)
    await expect(
      page.locator('.organization-person').filter({ hasText: 'Second Athlete' }),
    ).toHaveCount(0)
    await inspect(page, 'people-filtered', info)

    // Coach: the sport filter never widens the assigned-athlete scope.
    await f.call(f.owner, endpoint + '/sports', {
      operation: randomUUID(),
      action: 'member-sports',
      view: 'admin',
      member: people.members.find((m: any) => m.user_id === other.id).id,
      sports: [
        (await f.call(f.owner, endpoint + '/sports?view=admin')).items.find(
          (s: any) => s.name === 'Football',
        ).id,
      ],
      previous: [],
    })
    await f.login(coachPage, f.coach, `/people`)
    await coachPage.getByLabel('Sport or specialty').selectOption({ label: 'Football' })
    await expect(coachPage.locator('.organization-person')).toHaveCount(1)
    await expect(coachPage.locator('.organization-person')).toContainText('R4 Athlete')
    await expect(coachPage.getByRole('link', { name: /^Manage/ })).toHaveCount(0)

    // English light keeps chips and archived labels readable.
    await page.evaluate(() => localStorage.setItem('rafik.theme', 'light'))
    await page.goto(base + '/institution-settings')
    await expect(page.getByText('Football', { exact: true })).toBeVisible()
    await inspect(page, 'settings-light', info)

    // Arabic dark at phone width.
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(base + '/institution-settings')
    await expect(page.getByText('كرة الطائرة الشاطئية للفرق الجامعية المتقدمة')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await inspect(page, 'settings-ar-dark-320', info)
    await page.goto(base + '/people')
    await expect(page.locator('.person-sports').first()).toBeVisible()
    await page.goto(athleteManage)
    await expect(page.getByRole('group', { name: 'الرياضات', exact: true })).toBeVisible()
    await inspect(page, 'people-ar-dark-320', info)
  } finally {
    await coachContext.close()
    await f.cleanup()
  }
})
