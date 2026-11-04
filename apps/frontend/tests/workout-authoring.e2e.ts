import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { institutionFixture } from './institution-fixture'
import { testPreview } from './local-config'
import type { Exercise } from '../src/lib/domain'

test.use({ baseURL: testPreview, serviceWorkers: 'block' })
test('template alternatives persist into the shared program editor and media opens on demand', async ({
  page,
}) => {
  test.setTimeout(150000)
  const fixture = await institutionFixture()
  try {
    await fixture.call(fixture.owner, '/v1/institutions', {
      id: randomUUID(),
      name: 'Shared exercise authoring validation',
    })
    const catalog = (await fixture.call(
      fixture.owner,
      '/v1/institution/catalog?view=admin',
    )) as Exercise[]
    const main = catalog.find((item) => item.id === 'goblet-squat')!
    expect(main).toBeTruthy()
    const alternatives = catalog
      .filter(
        (item) =>
          item.id !== main.id &&
          item.active !== false &&
          item.scope !== 'private' &&
          (item.kind || 'strength') === (main.kind || 'strength'),
      )
      .slice(0, 3)
    expect(alternatives).toHaveLength(3)
    await page.addInitScript(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    await fixture.login(page, fixture.owner, '/workout-templates/new')
    await page
      .getByRole('textbox', { name: 'Workout name', exact: true })
      .fill('Shared-card validation')
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
    async function choose(label: string, item: Exercise) {
      await page.getByRole('combobox', { name: label, exact: true }).fill(item.name)
      await page
        .getByRole('option')
        .filter({ has: page.getByText(item.name, { exact: true }) })
        .first()
        .click()
    }
    await choose('Exercise 1', main)
    const card = page.locator('.workout-exercise').first()
    for (const alternative of alternatives) {
      await card.getByRole('button', { name: 'Add alternative', exact: true }).click()
      await choose('Add approved alternative 1', alternative)
      await expect(card.locator('.workout-alternative-list')).toContainText(alternative.name)
    }
    await expect(card.getByRole('button', { name: 'Add alternative', exact: true })).toHaveCount(0)
    await card
      .getByRole('button', { name: 'Remove alternative ' + alternatives[2]!.name, exact: true })
      .click()
    await expect(card.getByRole('button', { name: 'Add alternative', exact: true })).toBeVisible()
    await card.getByRole('button', { name: 'Add alternative', exact: true }).click()
    await choose('Add approved alternative 1', alternatives[2]!)
    const thumbnail = card.locator('.exercise-media-thumbnail img')
    await expect(thumbnail).toBeVisible()
    await expect
      .poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(1)
    const viewMedia = card.getByRole('button', { name: 'View media for ' + main.name, exact: true })
    await viewMedia.click()
    const dialog = page.getByRole('dialog', { name: main.name, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'CC BY-SA 4.0', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(viewMedia).toBeFocused()
    await page.getByRole('button', { name: 'Save workout template', exact: true }).click()
    await expect(page).toHaveURL(/\/workout-templates\/[a-f0-9-]{36}$/)
    await page.reload()
    await expect(page.locator('.workout-preview')).toContainText(alternatives[0]!.name)
    const previewName = await page.locator('.workout-preview strong').first().boundingBox()
    const previewMedia = await page
      .locator('.workout-preview .exercise-media-trigger')
      .first()
      .boundingBox()
    expect(Math.abs(previewName!.y - previewMedia!.y)).toBeLessThan(12)
    await page.getByRole('link', { name: 'Use in a new program', exact: true }).click()
    await expect(
      card.getByRole('button', {
        name: 'Remove alternative ' + alternatives[0]!.name,
        exact: true,
      }),
    ).toBeVisible()
    await page.getByLabel('Program name', { exact: true }).fill('Shared-card program validation')
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/institution/programs') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    const response = await saved
    expect(response.ok()).toBe(true)
    const result = await response.json()
    const program = await fixture.call(
      fixture.owner,
      '/v1/institution/programs?view=admin&program=' + result.plan.id,
    )
    expect(
      program.program.draft.days[0].exercises[0].alternatives.map(
        (item: { exerciseId: string }) => item.exerciseId,
      ),
    ).toEqual(alternatives.map((item) => item.id))
    await page.goto('/plans/' + result.plan.id)
    await expect(page.locator('.workout-alternative-list')).toContainText(alternatives[0]!.name)
    await page.getByRole('button', { name: 'Athlete preview', exact: true }).click()
    await expect(page.locator('.workout-preview')).toContainText(alternatives[0]!.name)
    await expect(page.locator('.workout-preview .exercise-media-trigger')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('.exercise-media-thumbnail').first()).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'View media for ' + main.name, exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  } finally {
    await fixture.cleanup()
  }
})
