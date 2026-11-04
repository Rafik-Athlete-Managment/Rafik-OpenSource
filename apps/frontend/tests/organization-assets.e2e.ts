import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
const png = readFileSync(
  resolve(
    import.meta.dirname,
    '../../backend/content/exercise-videos/wger-fff4c294-93f0-4926-b3a2-bf59ad4afaa5-623708fc-r1.webp',
  ),
)
test('organization author uploads, categorizes, filters, reuses and archives an exercise demonstration', async ({
  page,
}, info) => {
  test.setTimeout(90000)
  const f = await institutionFixture(),
    institution = randomUUID(),
    base = ``
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Exercise studio',
    })
    await f.login(page, f.owner, base + '/exercises')
    await page.getByRole('button', { name: 'Create exercise', exact: true }).click()
    await page.getByLabel('Exercise name', { exact: true }).fill('Studio row and brace')
    await page
      .getByLabel('Instructions', { exact: true })
      .fill('Brace the torso and row with control.')
    await page
      .getByRole('combobox', { name: 'Movement category', exact: true })
      .selectOption('compound')
    for (const [label, options] of [
      ['Body areas', ['Back', 'Waist']],
      ['Muscle groups', ['Lats', 'Abdominals']],
      ['Equipment', ['Dumbbell', 'Bench']],
    ] as const) {
      const group = page.getByRole('group', { name: label, exact: true })
      await group.locator('summary').click()
      for (const option of options)
        await group.getByRole('checkbox', { name: option, exact: true }).check()
      await group.locator('summary').click()
    }
    let lost = false
    await page.route('**/v1/assets/*', async (route) => {
      if (!lost && route.request().method() === 'PUT') {
        lost = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    const file = { name: 'row-demo.webp', mimeType: 'image/webp', buffer: png }
    await page.getByLabel('Upload demonstration', { exact: true }).setInputFiles(file)
    await expect(page.getByRole('alert').filter({ hasText: 'Choose the same file' })).toBeVisible()
    await page.getByLabel('Upload demonstration', { exact: true }).setInputFiles(file)
    await expect(page.getByText('Uploaded: row-demo.webp', { exact: true })).toBeVisible()
    await expect(page.locator('.organization-asset img')).toBeVisible()
    await page.getByRole('button', { name: 'Save exercise', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Exercise library updated' }),
    ).toBeVisible()
    const records = await f.call(f.owner, `/v1/institution/catalog?view=admin`)
    const exercise = records.find((e: any) => e.name === 'Studio row and brace')
    expect(exercise.body_parts).toEqual(['back', 'waist'])
    expect(exercise.muscles).toEqual(['lats', 'abdominals'])
    expect(exercise.equipment_items).toEqual(['dumbbell', 'bench'])
    await page.getByLabel('Search exercises', { exact: true }).fill('Studio row')
    if (info.project.name.includes('webkit'))
      await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByRole('combobox', { name: 'Body area', exact: true }).selectOption('waist')
    await expect(page.locator('.catalog-choice')).toHaveCount(1)
    await page.locator('.catalog-choice').click()
    await page.getByRole('button', { name: 'Edit exercise', exact: true }).click()
    for (const label of ['Body areas', 'Muscle groups', 'Equipment']) {
      const group = page.getByRole('group', { name: label, exact: true })
      while (await group.locator('.choice-chip').count())
        await group.locator('.choice-chip').first().click()
    }
    await page.getByRole('button', { name: 'Save exercise', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Exercise library updated' }),
    ).toBeVisible()
    const cleared = (await f.call(f.owner, `/v1/institution/catalog?view=admin`)).find(
      (e: any) => e.id === exercise.id,
    )
    expect(cleared.body_parts).toEqual([])
    expect(cleared.body_part).toBe('')
    expect(cleared.equipment).toBe('')
    await page.goto(base + '/resources')
    await expect(page.getByRole('button', { name: /row-demo.webp/ })).toBeVisible()
    await expect(page.locator('.organization-asset img')).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({
      path: `artifacts/r18-resources-${info.project.name}.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Archive file', exact: true }).click()
    await expect(page.getByText('No files here yet.', { exact: false })).toBeVisible()
    await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('true')
    await expect(page.getByRole('button', { name: 'Restore file', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Restore file', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
    await expect
      .poll(async () => (await f.call(f.owner, `/v1/institution/assets?view=admin`)).items.length)
      .toBe(1)
    await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('false')
    await expect(page.getByRole('button', { name: /row-demo.webp/ })).toBeVisible()
    await page.goto(base + '/exercises')
    await page.getByRole('button', { name: 'Create exercise', exact: true }).click()
    await page.getByText('Choose an uploaded file', { exact: true }).click()
    await page.getByRole('button', { name: 'row-demo.webp', exact: true }).click()
    await expect(page.locator('.organization-asset img')).toBeVisible()
    for (const width of [320, 1280])
      for (const lang of ['en', 'ar'])
        for (const theme of ['light', 'dark']) {
          await page.setViewportSize({ width, height: 900 })
          await page.evaluate(
            ({ lang, theme }) => {
              localStorage.setItem('rafik.locale', lang)
              localStorage.setItem('rafik.theme', theme)
            },
            { lang, theme },
          )
          await page.reload()
          await expect(page.locator('.exercise-editor')).toBeVisible()
          expect(await layoutIssues(page)).toEqual([])
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
          await page.screenshot({
            path: `artifacts/r18-exercise-${info.project.name}-${width}-${lang}-${theme}.png`,
            fullPage: true,
          })
        }
  } finally {
    await f.cleanup()
  }
})
// The single-file pair attachment journey is covered by the multi-attachment reload,
// exact-retry and revocation test in beta-web-refinements.e2e.ts.
