import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { testDatabase } from './local-config'
import { layoutIssues } from './layout-contract'
test('optional session and workplace feedback recover and appear as separate source-labelled charts', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture(),
    institution = randomUUID(),
    trainerContext = await browser.newContext(),
    trainer = await trainerContext.newPage(),
    clientContext = await browser.newContext(),
    client = await clientContext.newPage()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Madar experience',
    })
    for (const [person, roles] of [
      [f.coach, ['trainer']],
      [f.client, ['trainee']],
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
    const people = await f.call(f.owner, `/v1/institution?view=admin`),
      member = people.members.find((m: any) => m.user_id === f.client.id),
      staff = people.members.find((m: any) => m.user_id === f.coach.id)
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: member.id,
      revision: member.revision,
      trainer: staff.id,
    })
    const endpoint = `/v1/institution`,
      id = randomUUID(),
      tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await f.call(f.coach, endpoint + '/schedule', {
      operation: randomUUID(),
      action: 'create',
      id,
      view: 'trainer',
      title: 'Strength and mobility',
      kind: 'training',
      staff: [staff.id],
      participants: [member.id],
      local: tomorrow + 'T10:00',
      zone: 'UTC',
      minutes: 60,
      count: 1,
      every: 7,
    })
    execFileSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'db',
        'psql',
        '-U',
        'rafik_migrate',
        '-d',
        testDatabase,
        '-v',
        'ON_ERROR_STOP=1',
      ],
      {
        cwd: resolve(import.meta.dirname, '../../backend'),
        input: `update public.institution_events set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='${id}' and institution_id='${institution}';`,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    await f.call(f.coach, endpoint + '/schedule', {
      operation: randomUUID(),
      action: 'attendance',
      id,
      view: 'trainer',
      member: member.id,
      revision: 1,
      attendance: 'present',
    })
    await f.call(f.coach, endpoint + '/schedule', {
      operation: randomUUID(),
      action: 'finish',
      id,
      view: 'trainer',
      revision: 1,
    })
    const base = ''
    await f.login(client, f.client, base + '/schedule/' + id)
    await client.getByRole('link', { name: 'Rate your session (optional)', exact: true }).click()
    await expect(client.locator('input[type=radio]:checked')).toHaveCount(0)
    await client.getByRole('radio', { name: '4 Satisfied', exact: true }).check()
    await expect(
      client.getByRole('status').filter({ hasText: 'Draft saved on this device.' }),
    ).toBeVisible()
    await client.reload()
    await expect(client.getByRole('radio', { name: '4 Satisfied', exact: true })).toBeChecked()
    let lost = false
    await client.route(`**${endpoint}/feedback`, async (route) => {
      if (!lost && route.request().method() === 'POST') {
        lost = true
        await route.fetch()
        await route.abort('failed')
      } else await route.continue()
    })
    await client.getByRole('button', { name: 'Save rating', exact: true }).click()
    await expect(
      client.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeEnabled()
    await client.reload()
    await client.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(client.getByRole('button', { name: 'Change rating', exact: true })).toBeVisible()
    expect((await f.call(f.client, endpoint + '/feedback?view=trainee')).items[0].revision).toBe(1)
    await client.getByRole('button', { name: 'Change rating', exact: true }).click()
    await client.getByRole('radio', { name: '5 Very satisfied', exact: true }).check()
    await expect(client.getByRole('status').filter({ hasText: 'Saved.' })).toHaveCount(0)
    await client.getByRole('button', { name: 'Save rating', exact: true }).click()
    await expect
      .poll(
        async () => (await f.call(f.client, endpoint + '/feedback?view=trainee')).items[0].revision,
      )
      .toBe(2)
    await client.getByRole('button', { name: 'Change rating', exact: true }).click()
    await client.getByRole('radio', { name: '4 Satisfied', exact: true }).check()
    await client.getByRole('button', { name: 'Save rating', exact: true }).click()
    await expect
      .poll(
        async () => (await f.call(f.client, endpoint + '/feedback?view=trainee')).items[0].revision,
      )
      .toBe(3)
    await f.login(trainer, f.coach, base + '/trainer/feedback')
    await expect(trainer.getByText('It is not anonymous.', { exact: false })).toBeVisible()
    await expect(trainer.locator('input[type=radio]:checked')).toHaveCount(0)
    await trainer.getByRole('radio', { name: '2 Dissatisfied', exact: true }).check()
    await trainer.getByRole('button', { name: 'Save rating', exact: true }).click()
    await expect(trainer.getByRole('button', { name: 'Change rating', exact: true })).toBeVisible()
    await f.login(page, f.owner, base + '/admin/analytics')
    await page.getByRole('tab', { name: 'Experience & renewals', exact: true }).click()
    await expect(page.locator('.response-summary').first()).toContainText('4.0 / 5')
    await page.getByRole('tab', { name: 'Coach workplace', exact: true }).focus()
    await expect(page.locator('.response-summary').first()).toContainText('4.0 / 5')
    await page.getByRole('tab', { name: 'Coach workplace', exact: true }).press('Enter')
    await expect(
      page.getByRole('heading', { name: 'Coach workplace satisfaction', exact: true }),
    ).toBeVisible()
    for (const width of [320, 1280])
      for (const lang of ['en', 'ar'])
        for (const theme of ['light', 'dark']) {
          await page.setViewportSize({ width, height: 900 })
          await page.evaluate(
            (s) => {
              localStorage.setItem('rafik.locale', s.lang)
              localStorage.setItem('rafik.theme', s.theme)
            },
            { lang, theme },
          )
          await page.goto(base + '/admin/analytics')
          await page
            .getByRole('tab', {
              name: lang === 'en' ? 'Experience & renewals' : 'التجربة والتجديدات',
              exact: true,
            })
            .click()
          await expect(page.locator('.response-summary').first()).toContainText('4.0 / 5')
          expect(await layoutIssues(page)).toEqual([])
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
          await page.screenshot({
            path: `artifacts/r21-experience-${info.project.name}-${width}-${lang}-${theme}.png`,
            fullPage: true,
            animations: 'disabled',
          })
          await page
            .getByRole('tab', {
              name: lang === 'en' ? 'Coach workplace' : 'بيئة عمل المدربين',
              exact: true,
            })
            .click()
          await expect(page.locator('.response-summary')).toContainText('2.0 / 5')
          expect(await layoutIssues(page)).toEqual([])
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
          await page.screenshot({
            path: `artifacts/r21-workplace-${info.project.name}-${width}-${lang}-${theme}.png`,
            fullPage: true,
            animations: 'disabled',
          })
          await page
            .getByRole('tab', {
              name: lang === 'en' ? 'Package renewals' : 'تجديد الباقات',
              exact: true,
            })
            .click()
          expect(await layoutIssues(page)).toEqual([])
          await page.screenshot({
            path: `artifacts/r21-renewals-${info.project.name}-${width}-${lang}-${theme}.png`,
            fullPage: true,
            animations: 'disabled',
          })
          await page
            .getByRole('tab', {
              name: lang === 'en' ? 'Delivery & capacity' : 'التدريب وقدرة الفريق',
              exact: true,
            })
            .click()
          await page
            .getByText(lang === 'en' ? 'Attendance by coach' : 'الحضور حسب المدرب', {
              exact: true,
            })
            .click()
          expect(await layoutIssues(page)).toEqual([])
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
          await page.screenshot({
            path: `artifacts/r21-delivery-${info.project.name}-${width}-${lang}-${theme}.png`,
            fullPage: true,
            animations: 'disabled',
          })
        }
    await page.evaluate(() => localStorage.setItem('rafik.locale', 'en'))
    await page.goto(base + '/admin/analytics')
    await page.getByRole('tab', { name: 'Delivery & capacity', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Coach session delivery', exact: true }),
    ).toBeVisible()
    await page.getByText('Attendance by coach', { exact: true }).click()
    await expect(
      page
        .getByRole('table', {
          name: 'Participant outcomes in these completed sessions',
          exact: true,
        })
        .locator('tbody'),
    ).toContainText('R4 Coach')
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({
      path: `artifacts/r21-delivery-${info.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await trainer.goto(base + '/trainer/analytics')
    await trainer.getByRole('tab', { name: 'Experience & renewals', exact: true }).click()
    await expect(
      trainer.getByRole('heading', { name: 'Coach workplace satisfaction', exact: true }),
    ).toHaveCount(0)
    for (const width of [320, 1280])
      for (const lang of ['en', 'ar'])
        for (const theme of ['light', 'dark'])
          for (const [form, view] of [
            [client, 'trainee'],
            [trainer, 'trainer'],
          ] as const) {
            await form.setViewportSize({ width, height: 900 })
            await form.evaluate(
              (s) => {
                localStorage.setItem('rafik.locale', s.lang)
                localStorage.setItem('rafik.theme', s.theme)
              },
              { lang, theme },
            )
            await form.goto(base + '/' + view + '/feedback')
            await form
              .getByRole('button', {
                name: lang === 'en' ? 'Change rating' : 'تعديل التقييم',
                exact: true,
              })
              .click()
            expect(await layoutIssues(form)).toEqual([])
            expect((await new AxeBuilder({ page: form }).analyze()).violations).toEqual([])
            await form.screenshot({
              path: `artifacts/r21-form-${view}-${info.project.name}-${width}-${lang}-${theme}.png`,
              fullPage: true,
              animations: 'disabled',
            })
          }
    await client.evaluate(() => localStorage.setItem('rafik.locale', 'en'))
    await client.reload()
    await client.setViewportSize({ width: 320, height: 740 })
    await client.getByRole('button', { name: 'Change rating', exact: true }).click()
    expect(await layoutIssues(client)).toEqual([])
    expect((await new AxeBuilder({ page: client }).analyze()).violations).toEqual([])
    await client.screenshot({
      path: `artifacts/r21-rating-${info.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    })
  } finally {
    await trainerContext.close()
    await clientContext.close()
    await f.cleanup()
  }
})

test('a completed institution workout links to the athlete feedback form', async ({ page }) => {
  test.setTimeout(120000)
  const f = await institutionFixture(),
    institution = randomUUID(),
    endpoint = `/v1/institution`,
    today = new Date().toISOString().slice(0, 10)
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Madar workout feedback',
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
    const staff = people.members.find((m: any) => m.user_id === f.coach.id)
    let member = people.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: member.id,
      revision: member.revision,
      trainer: staff.id,
    })
    people = await f.call(f.owner, `${endpoint}?view=admin`)
    member = people.members.find((m: any) => m.user_id === f.client.id)
    const plan = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../backend/content/starter.json'), 'utf8'),
      ).prescription,
      published = await f.call(f.coach, endpoint + '/programs', {
        operation: randomUUID(),
        action: 'publish',
        view: 'trainer',
        id: randomUUID(),
        title: 'Workout feedback link',
        draft: plan,
        revision: null,
      }),
      delivery = await f.call(f.coach, endpoint + '/delivery', {
        operation: randomUUID(),
        action: 'assign',
        view: 'trainer',
        version_id: published.version.id,
        start_date: today,
        schedule_mode: 'flexible',
        members: [{ id: member.id, revision: member.revision }],
      }),
      session = randomUUID(),
      started = await f.call(f.client, endpoint + '/sessions', {
        operation: randomUUID(),
        action: 'start',
        view: 'trainee',
        id: session,
        assignment_id: delivery[0].id,
        day_id: plan.days[0].id,
      })
    await f.call(f.client, endpoint + '/sessions', {
      operation: randomUUID(),
      action: 'save',
      view: 'trainee',
      id: session,
      revision: 1,
      entries: started.entries.map((e: any) => ({ ...e, completed: true })),
      note: '',
      complete: true,
    })
    await f.login(page, f.client, `/workout/${session}?institution=${institution}`)
    await page.getByRole('link', { name: 'Rate your session (optional)', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/feedback$`))
    await expect(page.getByRole('radio', { name: '4 Satisfied', exact: true })).toBeVisible()
  } finally {
    await f.cleanup()
  }
})
