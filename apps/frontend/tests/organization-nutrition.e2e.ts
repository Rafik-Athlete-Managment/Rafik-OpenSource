import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
import { testPreview } from './local-config'
test.use({ baseURL: testPreview, serviceWorkers: 'block' })
async function fixture() {
  const f = await institutionFixture(),
    id = randomUUID()
  await f.call(f.owner, '/v1/institutions', { id, kind: 'institution', name: 'Madar nutrition' })
  // A second athlete: drafts must stay scoped when staff switch between athletes.
  const second = await f.createPerson('R4 Second Athlete')
  for (const [person, roles] of [
    [f.coach, ['trainer']],
    [f.client, ['trainee']],
    [second, ['trainee']],
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
  const people = await f.call(f.owner, `/v1/institution?view=admin`)
  const member = people.members.find((m: any) => m.user_id === f.client.id),
    staff = people.members.find((m: any) => m.user_id === f.coach.id)
  await f.call(f.owner, `/v1/institution`, {
    operation: randomUUID(),
    action: 'assign-trainer',
    id: member.id,
    revision: member.revision,
    trainer: staff.id,
  })
  const endpoint = `/v1/institution/nutrition`,
    base = ''
  return { ...f, id, member, staff, endpoint, base }
}
const today = new Date().toISOString().slice(0, 10)
const example = {
  name: 'Oats',
  meal: 'breakfast',
  quantity: 50,
  basis: 100,
  unit: 'g',
  nutrients: { kcal: 389, protein_g: 16.89, carb_g: 66.27, fat_g: 6.9 },
  source: 'Test reference',
}

test('organization plan publication flows through trainee portions, consent, corrections and staff review', async ({
  page,
  browser,
}, info) => {
  const f = await fixture(),
    ctx = await browser.newContext(),
    client = await ctx.newPage()
  try {
    await f.login(page, f.owner, `${f.base}/admin/nutrition`)
    // A new plan starts by choosing the athlete in a dialog limited to the closest matches.
    await page.getByRole('button', { name: 'Create a plan', exact: true }).first().click()
    const chooser = page.getByRole('dialog', { name: 'Create a nutrition plan' })
    await expect(chooser.getByRole('checkbox')).toHaveCount(2)
    await chooser.getByRole('checkbox', { name: 'R4 Athlete', exact: true }).click()
    await page.getByRole('button', { name: 'Create plan', exact: true }).click()
    // The editor grows with its form; the panel is not a fixed-height scroller.
    await expect
      .poll(() =>
        page.locator('.org-nutrition-panel').evaluate((e) => getComputedStyle(e).overflowY),
      )
      .toBe('visible')
    await page.getByRole('spinbutton', { name: 'Energy (kcal)', exact: true }).fill('2100')
    await page.getByRole('spinbutton', { name: 'Protein (g)', exact: true }).fill('130')
    await page.getByLabel('Guidance', { exact: true }).fill('Adjust portions to your routine.')
    await page.getByText('Add food to example day', { exact: true }).click()
    await page.getByRole('searchbox', { name: 'Find a food', exact: true }).fill('oats')
    await page.locator('.food-results button').first().click()
    await page.getByRole('button', { name: 'Add to example day', exact: true }).click()
    await page.getByRole('button', { name: 'Review plan', exact: true }).click()
    await expect(page.getByText('Ready to publish for R4 Athlete')).toBeVisible()
    await page.getByRole('button', { name: 'Publish plan', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Nutrition plan published.' }).last(),
    ).toBeVisible()
    await expect(page.locator('.nutrition-totals')).toContainText('2100')
    // Editing the example day opens only the meal editor, on the Example tab.
    await page.getByRole('button', { name: 'Example meal plan', exact: true }).click()
    await page.getByRole('button', { name: 'Edit meal plan', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit example meal plan' })).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: 'Energy (kcal)', exact: true })).toHaveCount(
      0,
    )
    await expect(page.getByText('Add food to example day', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await page.getByRole('button', { name: 'Plan', exact: true }).click()
    await page.screenshot({ path: `artifacts/r16-plan-${info.project.name}.png` })
    await f.login(client, f.client, `${f.base}/nutrition`)
    await client.getByRole('button', { name: 'Example meal plan', exact: true }).click()
    await client.getByRole('button', { name: 'Record this food', exact: true }).click()
    await client.getByRole('spinbutton', { name: 'Amount eaten', exact: true }).fill('75')
    await client.getByRole('button', { name: 'Save food entry', exact: true }).click()
    await expect(
      client.locator('.rafik-toast').filter({ hasText: 'Food entry saved.' }).last(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Food diary', exact: true }).click()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByText('Food records are not shared', { exact: true })).toBeVisible()
    await expect(page.locator('.org-food-row')).toHaveCount(0)
    await client.getByRole('button', { name: 'Share diary with institution', exact: true }).click()
    await expect(
      client.getByRole('button', { name: 'Stop sharing diary', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.locator('.org-food-row')).toContainText('75 g')
    await client.getByRole('button', { name: 'Correct', exact: true }).click()
    await client.getByRole('spinbutton', { name: 'Amount eaten', exact: true }).fill('90')
    await client.getByRole('button', { name: 'Save food entry', exact: true }).click()
    await expect(client.locator('.org-food-row')).toContainText('90 g')
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await page.getByRole('button', { name: 'Changes', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Entry changes', exact: true })).toBeVisible()
    await expect(page.locator('.org-sharing').last()).toContainText('75 g')
    await expect(page.locator('.org-sharing').last()).toContainText('90 g')
    await client.getByRole('button', { name: 'Stop sharing diary', exact: true }).click()
    await expect(
      client.getByRole('button', { name: 'Share diary with institution', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.locator('.org-food-row')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Entry changes' })).toHaveCount(0)
    await client.getByRole('button', { name: 'Remove', exact: true }).click()
    await client.getByRole('button', { name: 'Confirm removal', exact: true }).click()
    await expect(client.locator('.org-food-row')).toHaveCount(0)
    await client.getByRole('checkbox', { name: 'Show removed entries', exact: true }).click()
    await expect(client.locator('.org-removed')).toContainText('excluded from totals')
    await client
      .locator('.org-removed')
      .getByRole('button', { name: 'Changes', exact: true })
      .click()
    await expect(client.locator('.org-sharing').last()).toContainText('Removed')
    const exported = await f.call(f.client, '/v1/account/institution')
    expect(exported.nutritionMeals[0].organization_meal_history).toHaveLength(3)
    await page.getByRole('button', { name: 'Plan history', exact: true }).click()
    await page.locator('.org-plan-history summary').click()
    await expect(page.locator('.org-plan-history')).toContainText('2100')
  } finally {
    await ctx.close()
    await f.cleanup()
  }
})

test('organization nutrition retains scoped drafts and replays a lost publication acknowledgement exactly', async ({
  page,
}) => {
  const f = await fixture()
  try {
    await f.login(page, f.owner, `${f.base}/admin/nutrition?member=${f.member.id}`)
    await page.getByRole('button', { name: 'Create plan', exact: true }).click()
    await page.getByLabel('Guidance', { exact: true }).fill('Client-specific draft')
    await expect(
      page.getByRole('status').filter({ hasText: 'Draft saved on this device.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Draft saved on this device.' }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Continue draft', exact: true }).click()
    await expect(page.getByLabel('Guidance', { exact: true })).toHaveValue('Client-specific draft')
    await page.getByRole('button', { name: 'Change athlete', exact: true }).click()
    await page.getByRole('checkbox', { name: 'R4 Second Athlete', exact: true }).click()
    await page.getByRole('button', { name: 'Create plan', exact: true }).click()
    await expect(page.getByLabel('Guidance', { exact: true })).toHaveValue('')
    await page.getByRole('button', { name: 'Change athlete', exact: true }).click()
    await page.getByRole('checkbox', { name: 'R4 Athlete', exact: true }).click()
    await expect(page.getByLabel('Guidance', { exact: true })).toHaveValue('Client-specific draft')
    let drop = true
    await page.route('**/nutrition', async (route) => {
      if (route.request().method() === 'POST' && drop) {
        drop = false
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Review plan', exact: true }).click()
    await page.getByRole('button', { name: 'Publish plan', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Nutrition plan published.' }).last(),
    ).toBeVisible()
    const data = await f.call(f.owner, `${f.endpoint}?view=admin&member=${f.member.id}`)
    expect(data.plans).toHaveLength(1)
    expect(data.current.guidance).toBe('Client-specific draft')
  } finally {
    await f.cleanup()
  }
})

test('organization nutrition entry, editor and diary stay readable in both languages and themes', async ({
  page,
}, info) => {
  const f = await fixture()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.text().includes('Failed to resolve component')) errors.push(m.text())
  })
  try {
    await f.call(f.owner, f.endpoint, {
      operation: randomUUID(),
      action: 'publish',
      view: 'admin',
      member: f.member.id,
      id: randomUUID(),
      revision: 0,
      effective_on: today,
      targets: { kcal: 2100, protein_g: 130, carb_g: 240, fat_g: 60 },
      guidance: 'Practical nutrition for a busy week.',
      meals: [example],
    })
    await f.login(page, f.coach, `${f.base}/trainer/nutrition?member=${f.member.id}`)
    for (const width of [320, 1280])
      for (const lang of ['en', 'ar'])
        for (const theme of ['light', 'dark']) {
          await page.setViewportSize({ width, height: 800 })
          await page.evaluate(
            ({ lang, theme }) => {
              localStorage.setItem('rafik.locale', lang)
              localStorage.setItem('rafik.theme', theme)
            },
            { lang, theme },
          )
          await page.reload()
          await expect(page.locator('.nutrition-totals')).toBeVisible()
          await expect.poll(() => layoutIssues(page)).toEqual([])
          // The panel grows with its content; it never becomes an inner scroller.
          expect(
            await page
              .locator('.org-nutrition-panel')
              .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
          ).toBe(true)
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
          await page.screenshot({
            path: `artifacts/r16-${info.project.name}-${width}-${lang}-${theme}.png`,
          })
          await page
            .getByRole('button', {
              name: lang === 'en' ? /Update plan|Continue draft/ : /تحديث الخطة|متابعة المسودة/,
              exact: true,
            })
            .click()
          await expect(page.locator('.org-plan-editor')).toBeVisible()
          await expect(
            page.locator('.org-plan-editor .nutrient-fields input[type=number]'),
          ).toHaveCount(4)
          expect(errors).toEqual([])
          await page.screenshot({
            path: `artifacts/r16-editor-${info.project.name}-${width}-${lang}-${theme}.png`,
          })
          await expect.poll(() => layoutIssues(page)).toEqual([])
          await page
            .getByRole('button', {
              name: lang === 'en' ? 'Close editor' : 'إغلاق المحرر',
              exact: true,
            })
            .click()
          await page
            .getByRole('button', { name: lang === 'en' ? 'Food diary' : 'سجل الطعام', exact: true })
            .click()
          await expect.poll(() => layoutIssues(page)).toEqual([])
          await page
            .getByRole('button', { name: lang === 'en' ? 'Plan' : 'الخطة', exact: true })
            .click()
        }
  } finally {
    await f.cleanup()
  }
})

test('trainee food draft survives date changes and an uncertain save without duplicate consumption', async ({
  page,
}, info) => {
  test.setTimeout(90000)
  const f = await fixture()
  try {
    await f.login(page, f.client, `${f.base}/nutrition`)
    await page.getByRole('button', { name: 'Food diary', exact: true }).click()
    await page.getByRole('button', { name: 'Record food', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Record food', exact: true })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Find a food', exact: true })).toBeVisible()
    await page.screenshot({
      path: `artifacts/founder-food-dialog-${info.project.name}.png`,
      fullPage: true,
    })
    await page.getByLabel('Food name', { exact: true }).fill('Home lunch')
    await page.getByLabel('Amount eaten', { exact: true }).fill('2')
    await expect(
      page.getByRole('status').filter({ hasText: 'Draft saved on this device.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Draft saved on this device.' }),
    ).toBeVisible()
    const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)
    await page.getByLabel('Viewing date', { exact: true }).fill(yesterday)
    await page.getByLabel('Viewing date', { exact: true }).press('Tab')
    await page.getByRole('button', { name: 'Record food', exact: true }).click()
    await expect(page.getByLabel('Food name', { exact: true })).toHaveValue('')
    await page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await page.getByLabel('Viewing date', { exact: true }).fill(today)
    await page.getByLabel('Viewing date', { exact: true }).press('Tab')
    await page.getByRole('button', { name: 'Continue food entry', exact: true }).click()
    await expect(page.getByLabel('Food name', { exact: true })).toHaveValue('Home lunch')
    let dropped = false
    await page.route('**/nutrition', async (route) => {
      if (route.request().method() === 'POST' && !dropped) {
        dropped = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Save food entry', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Food entry saved.' }).last(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Food diary', exact: true }).click()
    await expect(page.locator('.org-food-row')).toHaveCount(1)
    await expect(page.locator('.org-food-row')).toContainText('Home lunch')
    await expect(page.locator('.org-meal-editor')).toHaveCount(0)
    const data = await f.call(f.client, `${f.endpoint}?view=trainee`)
    expect(data.meals).toHaveLength(1)
    expect(data.meals[0].food.quantity).toBe(2)
    expect(data.meals[0].food.nutrients).toEqual({})
  } finally {
    await f.cleanup()
  }
})
