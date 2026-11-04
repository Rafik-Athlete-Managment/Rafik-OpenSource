import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
test('separate institution roles and reassigns responsibility with recoverable commands', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000)
  const f = await institutionFixture(),
    staffContext = await browser.newContext(),
    clientContext = await browser.newContext(),
    staff = await staffContext.newPage(),
    client = await clientContext.newPage()
  try {
    // Institutions now come from first-run setup; create one directly for this journey.
    const id = randomUUID(),
      base = ``
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Madar test organization',
    })
    await f.login(page, f.owner, base)
    await page.getByRole('button', { name: 'Invite people', exact: true }).click()
    await page.getByLabel('Email address', { exact: true }).fill(f.coach.email)
    await page.getByRole('radio', { name: 'Coach', exact: true }).check()
    await expect(
      page.getByText('Invitation draft saved on this device.', { exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(f.coach.email)
    await expect(page.getByRole('radio', { name: 'Coach', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click()
    const link = await page.getByLabel('Invitation link', { exact: true }).inputValue()
    await f.login(staff, f.coach, new URL(link).pathname)
    await staff.getByRole('button', { name: 'Accept invitation', exact: true }).click()
    await expect(staff).toHaveURL(new RegExp(`$`))
    await page.getByLabel('Email address', { exact: true }).fill(f.client.email)
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click()
    const clientLink = await page.getByLabel('Invitation link', { exact: true }).inputValue()
    await f.login(client, f.client, new URL(clientLink).pathname)
    await client.getByRole('button', { name: 'Accept invitation', exact: true }).click()
    await expect(client).toHaveURL(new RegExp(`$`))
    // Management lives on each profile's Manage tab, opened from the directory icon.
    const manage = async (tab: string, name: string) => {
      await page.goto(base + '/people')
      await page.getByRole('tab', { name: tab, exact: true }).click()
      await page.getByRole('link', { name: 'Manage ' + name, exact: true }).click()
      await expect(page).toHaveURL(/\?tab=manage/)
    }
    await manage('Athletes', 'R4 Athlete')
    await page
      .locator('form')
      .filter({ has: page.getByRole('heading', { name: 'Primary coach', exact: true }) })
      .getByRole('checkbox', { name: /^R4 Coach/ })
      .check()
    let lost = false
    await page.route('**/v1/institutions/' + id, async (route) => {
      if (
        !lost &&
        route.request().method() === 'POST' &&
        route.request().postDataJSON().action === 'assign-trainer'
      ) {
        lost = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Update primary coach', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Retry saved change', exact: true })).toHaveCount(
      0,
    )
    await page.goto(base + '/people')
    const athleteCard = page
      .locator('.organization-person')
      .filter({ has: page.getByRole('heading', { name: 'R4 Athlete', exact: true }) })
    await expect(athleteCard).toContainText('Primary coach: R4 Coach')
    // The lost acknowledgement and retry produce exactly one active primary link.
    const roster = async () =>
      (await f.call(f.owner, `/v1/institution/people?view=admin&role=trainee`)).items[0]
    expect((await roster()).coaches.map((c: { kind: string }) => c.kind)).toEqual(['primary'])
    await staff.goto(`/people`)
    await expect(staff.getByRole('heading', { name: 'R4 Athlete', exact: true })).toBeVisible()
    await expect(staff.getByRole('link', { name: /^Manage/ })).toHaveCount(0)
    await expect(staff.getByRole('heading', { name: 'R4 Owner', exact: true })).toHaveCount(0)
    await manage('Coaches', 'R4 Coach')
    await page.getByRole('checkbox', { name: 'Active membership', exact: true }).uncheck()
    await page.getByRole('button', { name: 'Save membership', exact: true }).click()
    await expect(page.locator('.rafik-toast').last()).toBeVisible()
    await page.goto(base + '/people')
    await page.getByRole('tab', { name: 'Coaches', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Manage R4 Coach', exact: true })).toHaveCount(0)
    // Deactivating the coach ends the primary link and its trainer_id mirror together.
    expect((await roster()).coaches).toEqual([])
    expect((await roster()).trainer_id).toBeNull()
    await staff.reload()
    // Revoked staff are returned to the institution chooser; no athlete data remains on screen.
    await expect(staff).toHaveURL(/\/institutions/)
    await expect(staff.getByRole('heading', { name: 'R4 Athlete', exact: true })).toHaveCount(0)
    await manage('Administrators', 'R4 Owner')
    await page.getByRole('checkbox', { name: 'Active membership', exact: true }).uncheck()
    await page.getByRole('button', { name: 'Save membership', exact: true }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'another active administrator' }).first(),
    ).toBeVisible()
    await page.goto(base + '/people')
    await expect(page.getByRole('heading', { name: 'R4 Athlete', exact: true })).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({
      path: `artifacts/organization-people-${info.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    })
  } finally {
    await staffContext.close()
    await clientContext.close()
    await f.cleanup()
  }
})
