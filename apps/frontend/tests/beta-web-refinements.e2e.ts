import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

const image = readFileSync(
  resolve(
    import.meta.dirname,
    '../../backend/content/exercise-videos/wger-fff4c294-93f0-4926-b3a2-bf59ad4afaa5-623708fc-r1.webp',
  ),
)
const pdf = Buffer.from('%PDF-1.4\n% synthetic beta attachment\n%%EOF\n')
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

async function inspect(page: Page, name: string, info: { project: { name: string } }) {
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: `artifacts/r0-${name}-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
}

async function prepareInstitution(f: Awaited<ReturnType<typeof institutionFixture>>, name: string) {
  const institution = randomUUID(),
    endpoint = `/v1/institution`
  await f.call(f.owner, '/v1/institutions', { id: institution, kind: 'institution', name })
  const join = async (person: { email: string }, roles: string[]) => {
    const token = randomBytes(32).toString('hex')
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: person.email,
      roles,
      token,
    })
    await f.call(person as never, `/v1/invitations/${token}`, {})
  }
  return { institution, endpoint, join }
}

test('coach browses later pages of athlete plans, nutrition plans and events, then reopens them', async ({
  page,
}, info) => {
  test.setTimeout(300000)
  const f = await institutionFixture()
  try {
    const { institution, endpoint, join } = await prepareInstitution(f, 'Madar browse acceptance')
    await join(f.coach, ['trainer'])
    const athletes = []
    for (let i = 1; i <= 26; i++) {
      const name =
        i === 26
          ? 'رياضية باسم طويل جداً لاختبار التفاف النص في البطاقات Athlete 26'
          : `Browse Athlete ${String(i).padStart(2, '0')}`
      const person = await f.createPerson(name)
      await join(person, ['trainee'])
      athletes.push({ person, name })
    }
    let people = await f.call(f.owner, `${endpoint}?view=admin`)
    const staff = people.members.find((m: any) => m.user_id === f.coach.id)
    for (const { person } of athletes) {
      const member = people.members.find((m: any) => m.user_id === person.id)
      await f.call(f.owner, endpoint, {
        operation: randomUUID(),
        action: 'assign-trainer',
        id: member.id,
        revision: member.revision,
        trainer: staff.id,
      })
    }
    people = await f.call(f.owner, `${endpoint}?view=admin`)
    const members = athletes.map(({ person }) =>
      people.members.find((m: any) => m.user_id === person.id),
    )
    const plan = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../backend/content/starter.json'), 'utf8'),
      ).prescription,
      published = await f.call(f.coach, endpoint + '/programs', {
        operation: randomUUID(),
        action: 'publish',
        view: 'trainer',
        id: randomUUID(),
        title: 'Preseason conditioning',
        draft: plan,
        revision: null,
      })
    await f.call(f.coach, endpoint + '/delivery', {
      operation: randomUUID(),
      action: 'assign',
      view: 'trainer',
      version_id: published.version.id,
      start_date: day(0),
      schedule_mode: 'flexible',
      members: members.map((m: any) => ({ id: m.id, revision: m.revision })),
    })
    for (const [i, member] of members.entries()) {
      await f.call(f.coach, endpoint + '/nutrition', {
        operation: randomUUID(),
        action: 'publish',
        view: 'trainer',
        member: member.id,
        id: randomUUID(),
        revision: 0,
        effective_on: day(0),
        expires_on: day(30),
        targets: { kcal: 2000 + i, protein_g: 120 },
        guidance: 'Regular meals around training',
        meals: [],
      })
      await f.call(f.coach, endpoint + '/schedule', {
        operation: randomUUID(),
        action: 'create',
        id: randomUUID(),
        view: 'trainer',
        title: `Field session ${String(i + 1).padStart(2, '0')}`,
        kind: 'training',
        staff: [staff.id],
        participants: [member.id],
        local: day(i + 1) + 'T10:00',
        zone: 'UTC',
        minutes: 60,
        count: 1,
        every: 7,
      })
    }
    const base = ``

    // Athlete plans: a record from the later page stays selected through reload and close.
    await f.login(page, f.coach, base + '/training')
    await expect(page.getByText('26 matching assignments')).toBeVisible()
    const firstPage = await page.locator('.athlete-plan-list .record-title a').allTextContents()
    expect(firstPage).toHaveLength(24)
    await page
      .getByRole('navigation', { name: 'Plan pages' })
      .getByRole('button', { name: 'Next' })
      .click()
    await expect(page).toHaveURL(/offset=24/)
    await expect(page.locator('.athlete-plan-list .record-row')).toHaveCount(2)
    const later = (await page
      .locator('.athlete-plan-list .record-title a')
      .first()
      .textContent())!.trim()
    expect(firstPage).not.toContain(later)
    await page
      .locator('.athlete-plan-list .record-row')
      .filter({ hasText: later })
      .locator('.record-title a')
      .click()
    const detail = page.getByRole('region', { name: 'Assigned plan' })
    await expect(detail.getByRole('heading', { name: 'Preseason conditioning' })).toBeVisible()
    await expect(detail).toContainText(later)
    await page.reload()
    await expect(detail).toContainText(later)
    await expect(page).toHaveURL(/offset=24/)
    await inspect(page, 'athlete-plan-detail', info)
    await detail.getByRole('link', { name: 'Athlete plans', exact: true }).click()
    await expect(detail).toHaveCount(0)
    await expect(page).toHaveURL(/offset=24/)
    await expect(
      page.locator('.athlete-plan-list .record-row').filter({ hasText: later }),
    ).toBeVisible()
    await page.getByLabel('Search athletes').fill(later.slice(0, 18))
    await page.getByLabel('Search athletes').press('Enter')
    await expect(page.getByText('1 matching assignments')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Search athletes')).toHaveValue(later.slice(0, 18))
    await expect(page.locator('.athlete-plan-list .record-row')).toHaveCount(1)

    // Nutrition plans: later-page selection opens the athlete editor and returns to the same page.
    await page.goto(base + '/nutrition')
    await expect(page.locator('.athlete-plan-list .record-row, article')).not.toHaveCount(0)
    const pages = page.getByRole('navigation', { name: 'Nutrition plan pages' })
    await pages.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/offset=10/)
    await expect(pages.locator('.pagination-range')).toContainText('11–20')
    await expect(page.locator('article h2')).toHaveCount(10)
    const laterNutrition = page.getByRole('link', { name: 'View nutrition plan' }).first()
    const nutritionAthlete = (await page.locator('article h2').first().textContent())!.trim()
    const nutritionUrl = page.url()
    await laterNutrition.click()
    await expect(page).not.toHaveURL(nutritionUrl)
    await expect(page.getByRole('navigation', { name: 'Nutrition plan pages' })).toHaveCount(0)
    await expect(page.getByText(nutritionAthlete).first()).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/offset=10/)
    await expect(page.locator('article h2').first()).toHaveText(nutritionAthlete)
    await inspect(page, 'nutrition-plans-later-page', info)

    // Events: filters plus a later page, then the event detail and back.
    await page.goto(base + '/events')
    await page.getByLabel('Activity type').selectOption('training')
    await expect(page).toHaveURL(/kind=training/)
    await page
      .getByRole('navigation', { name: 'Event pages' })
      .getByRole('button', { name: 'Next' })
      .click()
    await expect(page).toHaveURL(/offset=10/)
    await expect(page.locator('.event-list > li')).toHaveCount(10)
    await expect(
      page.getByRole('navigation', { name: 'Event pages' }).locator('.pagination-range'),
    ).toContainText('11–20')
    await expect(page.locator('.event-list > li').first()).toContainText('Athletes: 1')
    const eventLink = page.locator('.event-list h2 a').first()
    const eventTitle = (await eventLink.textContent())!.trim()
    await eventLink.click()
    await expect(page).toHaveURL(/\/calendar\/[a-f0-9-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: eventTitle })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/offset=10/)
    await expect(page).toHaveURL(/kind=training/)
    await expect(page.locator('.event-list h2 a').first()).toHaveText(eventTitle)

    // Arabic dark at phone width keeps the long-name later page usable.
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(base + '/training?status=active&offset=24')
    await expect(page.locator('.athlete-plan-list .record-row')).toHaveCount(2)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await inspect(page, 'athlete-plans-ar-dark-320', info)
    await page.goto(base + '/events?offset=24')
    await expect(page.locator('.event-list h2 a').first()).toBeVisible()
    await inspect(page, 'events-ar-dark-320', info)
  } finally {
    await f.cleanup()
  }
})

test('multiple message attachments survive reload, exact retry and recipient revocation', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture(),
    recipientContext = await browser.newContext(),
    recipient = await recipientContext.newPage()
  try {
    const { institution, endpoint, join } = await prepareInstitution(f, 'Madar attachments')
    await join(f.client, ['trainee'])
    await f.login(page, f.owner, `/messages`)
    await page.getByRole('button', { name: /R4 Athlete/ }).click()
    await expect(page).toHaveURL(/\/messages\/[a-f0-9-]{36}$/)
    const channel = page.url().split('/').at(-1)!

    const photos = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Attach a photo', exact: true }).click()
    await (
      await photos
    ).setFiles([
      { name: 'warmup-1.webp', mimeType: 'image/webp', buffer: image },
      { name: 'warmup-2.webp', mimeType: 'image/webp', buffer: image },
    ])
    const documents = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Attach a file or document', exact: true }).click()
    await (
      await documents
    ).setFiles([{ name: 'session-plan.pdf', mimeType: 'application/pdf', buffer: pdf }])
    const pending = page.getByRole('region', { name: 'Attachments' })
    await expect(pending.getByRole('heading', { name: 'Attachments (3/10)' })).toBeVisible()
    await pending
      .locator('.pending-attachment')
      .filter({ hasText: 'warmup-2.webp' })
      .getByRole('button', { name: 'Remove attachment' })
      .click()
    await expect(pending.getByRole('heading', { name: 'Attachments (2/10)' })).toBeVisible()
    await page.getByLabel('Write a message').fill('Warm-up photo and session plan')
    await expect(page.getByText('Draft saved on this device', { exact: true })).toBeVisible()
    await page.reload()
    await expect(pending.getByRole('heading', { name: 'Attachments (2/10)' })).toBeVisible()
    await expect(pending.locator('.pending-attachment-name')).toHaveText([
      'warmup-1.webp',
      'session-plan.pdf',
    ])

    let lost = false,
      sends = 0
    await page.route(`**${endpoint}/communication`, async (route) => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
      if (body?.action === 'send') sends++
      if (!lost && body?.action === 'send') {
        lost = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Send message', exact: true }).click()
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(page.locator('.message-bubble')).toHaveCount(1)
    await expect(pending).toHaveCount(0)
    expect(sends).toBe(2)
    await inspect(page, 'attachments-sent', info)

    await f.login(recipient, f.client, `/messages/${channel}`)
    const bubble = recipient.locator('.message-bubble')
    await expect(bubble).toHaveCount(1)
    await expect(bubble.locator('.organization-asset')).toHaveCount(2)
    await expect(bubble.locator('.organization-asset img')).toBeVisible()
    await expect(bubble.getByRole('link', { name: 'Download · session-plan.pdf' })).toHaveAttribute(
      'download',
      'session-plan.pdf',
    )
    await recipient.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await recipient.setViewportSize({ width: 320, height: 740 })
    await recipient.reload()
    await expect(bubble.locator('.organization-asset')).toHaveCount(2)
    await inspect(recipient, 'attachments-recipient-ar-dark-320', info)

    const thread = await f.call(f.client, `${endpoint}/communication?view=trainee&id=${channel}`)
    expect(thread.messages).toHaveLength(1)
    const ids: string[] = thread.messages[0].asset_ids
    expect(ids).toHaveLength(2)
    const readable = async () => {
      let ok = 0
      for (const id of ids) {
        const r = await recipient.request.get(`http://127.0.0.1:55341/v1/assets/${id}`, {
          headers: { 'x-rafik-client': 'web' },
        })
        if (r.ok()) ok++
      }
      return ok
    }
    expect(await readable()).toBe(2)

    const people = await f.call(f.owner, `${endpoint}?view=admin`),
      member = people.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'member',
      id: member.id,
      revision: member.revision,
      roles: ['trainee'],
      active: false,
    })
    expect(await readable()).toBe(0)
  } finally {
    await recipientContext.close()
    await f.cleanup()
  }
})
