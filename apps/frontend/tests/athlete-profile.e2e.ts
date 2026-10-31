import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { testDatabase } from './local-config'
import { resolve } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

async function inspect(page: Page, name: string, info: { project: { name: string } }) {
  expect(await layoutIssues(page)).toEqual([])
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: `artifacts/r1d-${name}-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
}

test('athlete profile shows each staff role only what it is allowed to see', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  const f = await institutionFixture(),
    contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]),
    [primaryPage, supportPage, otherPage] = await Promise.all(contexts.map((c) => c.newPage())),
    institution = randomUUID(),
    endpoint = `/v1/institution`,
    today = new Date().toISOString().slice(0, 10)
  const originalCall = f.call
  f.call = async (...args: Parameters<typeof f.call>) => {
    try {
      return await originalCall(...args)
    } catch (e) {
      throw new Error('Profile fixture request: ' + args[1], { cause: e })
    }
  }
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Madar profiles',
    })
    const support = await f.createPerson('Supporting Coach'),
      other = await f.createPerson('Unlinked Coach')
    for (const [person, roles] of [
      [f.coach, ['trainer']],
      [support, ['trainer']],
      [other, ['trainer']],
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
    const find = (p: { id: string }) => people.members.find((m: any) => m.user_id === p.id)
    let athlete = find(f.client)
    const primary = find(f.coach),
      supporting = find(support),
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
    for (const m of [athlete, supporting])
      await f.call(f.owner, endpoint + '/sports', {
        operation: randomUUID(),
        action: 'member-sports',
        view: 'admin',
        member: m.id,
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
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'link-coach',
      id: randomUUID(),
      athlete: athlete.id,
      coach: supporting.id,
      sport: football,
    })
    const plan = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../backend/content/starter.json'), 'utf8'),
    ).prescription
    people = await f.call(f.owner, `${endpoint}?view=admin`)
    athlete = find(f.client)
    for (const [title, sport] of [
      ['Speed block', football],
      ['Strength block', null],
    ] as const) {
      const version = (
        await f.call(f.coach, endpoint + '/programs', {
          operation: randomUUID(),
          action: 'publish',
          view: 'trainer',
          id: randomUUID(),
          title,
          draft: plan,
          revision: null,
        })
      ).version.id
      await f.call(f.coach, endpoint + '/delivery', {
        operation: randomUUID(),
        action: 'assign',
        view: 'trainer',
        version_id: version,
        start_date: today,
        schedule_mode: 'flexible',
        sport,
        members: [{ id: athlete.id, revision: athlete.revision, replaces: null }],
      })
    }
    await f.call(f.coach, endpoint + '/nutrition', {
      operation: randomUUID(),
      action: 'publish',
      view: 'trainer',
      member: athlete.id,
      id: randomUUID(),
      revision: 0,
      effective_on: today,
      expires_on: null,
      targets: { kcal: 2400 },
      guidance: 'Fuel around training',
      meals: [],
    })
    await f.call(f.owner, endpoint + '/injuries', {
      action: 'configure',
      view: 'admin',
      member_id: athlete.id,
      age_group: 'adult',
      guardian_authorized: false,
      revision: 0,
    })
    await f.call(f.client, endpoint + '/injuries', { action: 'assent', view: 'trainee' })
    await f.call(f.client, endpoint + '/injuries', {
      operation: randomUUID(),
      action: 'report',
      view: 'trainee',
      id: randomUUID(),
      participation: 'modified',
      effective_from: today,
      revision: 0,
    })
    const profile = (_view: string) => `/athletes/${athlete.id}`

    // Primary coach: everything for their athlete, including participation status.
    await f.login(primaryPage, f.coach, profile('trainer'))
    await expect(primaryPage.getByRole('heading', { name: 'R4 Athlete', level: 1 })).toBeVisible()
    await primaryPage.getByRole('tab', { name: 'Plans', exact: true }).click()
    const plans = primaryPage.getByRole('region', { name: 'Active plans' })
    await expect(plans.getByText('Speed block')).toBeVisible()
    await expect(plans.getByText('Strength block')).toBeVisible()
    await primaryPage.getByRole('tab', { name: 'Nutrition', exact: true }).click()
    await expect(primaryPage.getByText('Current plan: version 1')).toBeVisible()
    await expect(primaryPage.getByText('has not shared their meal diary')).toBeVisible()
    await primaryPage.getByRole('tab', { name: 'Athlete health', exact: true }).click()
    const status = primaryPage.getByRole('region', { name: 'Athlete health' })
    await expect(status).toContainText('Modified participation')
    await expect(status).toContainText('not a medical assessment')
    await primaryPage.getByRole('tab', { name: 'Overview', exact: true }).click()
    await expect(primaryPage.getByRole('region', { name: 'Details' })).toContainText(
      'Supporting Coach · Football',
    )
    await inspect(primaryPage, 'primary', info)

    // Supporting coach: football plan only, no nutrition or participation sections.
    await f.login(supportPage, support, profile('trainer'))
    await supportPage.getByRole('tab', { name: 'Plans', exact: true }).click()
    const supportPlans = supportPage.getByRole('region', { name: 'Active plans' })
    await expect(supportPlans.getByText('Speed block')).toBeVisible()
    await expect(supportPlans.getByText('Strength block')).toHaveCount(0)
    await expect(supportPage.getByRole('region', { name: 'Nutrition' })).toHaveCount(0)
    await expect(supportPage.getByRole('region', { name: 'Athlete health' })).toHaveCount(0)
    await expect(supportPage.getByText('You support this athlete.')).toBeVisible()

    // Unlinked coach: nothing beyond a clear refusal.
    await f.login(otherPage, other, profile('trainer'))
    await expect(
      otherPage.getByRole('heading', { name: 'This profile is not available to you.' }),
    ).toBeVisible()
    await expect(otherPage.getByText('Speed block')).toHaveCount(0)

    // Administrator: consent setup only, never the status itself.
    await f.login(page, f.owner, profile('admin'))
    await page.getByRole('tab', { name: 'Athlete health', exact: true }).click()
    const consent = page.getByRole('region', { name: 'Athlete health' })
    await expect(consent).toContainText('Consent setup is complete.')
    await expect(consent).toContainText('The athlete has assented.')
    await expect(consent).not.toContainText('Modified participation')
    await page.getByRole('tab', { name: 'Nutrition', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Nutrition' })).toBeVisible()

    await page.getByRole('tab', { name: 'Manage details', exact: true }).click()
    await expect(page.locator('.primary-coach-card .member-options label').first()).toBeVisible()
    await inspect(page, 'athlete-management', info)

    // Admin staff directory/profile and management are separate from the athlete role.
    await page.goto('/people')
    await expect(page.getByRole('tab', { name: 'Athletes', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    )
    await page.getByRole('tab', { name: 'Coaches', exact: true }).click()
    await expect(page.locator('.person-name-link').filter({ hasText: 'R4 Athlete' })).toHaveCount(0)
    await page.locator('.person-name-link').filter({ hasText: 'R4 Coach' }).click()
    await page.getByRole('tab', { name: 'Activity', exact: true }).click()
    await expect(page.getByText('Primary athletes', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Manage details', exact: true }).click()
    await expect(page.getByLabel('Display name', { exact: true })).toBeVisible()
    await page.getByLabel('Display name', { exact: true }).fill('Updated Coach')
    await page.getByRole('button', { name: 'Save membership', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Updated Coach', level: 1 })).toBeVisible()
    await inspect(page, 'staff-management', info)
    await page.evaluate(() => localStorage.setItem('rafik.theme', 'light'))
    await page.reload()
    await page.getByRole('tab', { name: 'Manage details', exact: true }).click()
    await inspect(page, 'staff-management-light', info)
    await page.goto('/people?filter=admin')
    await expect(page.getByRole('tab', { name: 'Administrators', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    )
    await page.goto('/members/' + supporting.id)
    await expect(page.getByRole('link', { name: 'Message', exact: true })).toBeVisible()
    await primaryPage.goto('/members/' + supporting.id)
    await expect(
      primaryPage.getByRole('heading', { name: 'This profile is not available to you.' }),
    ).toBeVisible()

    // Entry point from People, then Arabic dark at phone width.
    await page.goto(`/people`)
    await page.locator('.person-name-link').filter({ hasText: 'R4 Athlete' }).click()
    await expect(page).toHaveURL(new RegExp('/members/' + athlete.id))
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.reload()
    await page.getByRole('tab', { name: 'الخطط', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'الخطط النشطة' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await inspect(page, 'admin-ar-dark-320', info)
  } finally {
    await Promise.all(contexts.map((c) => c.close()))
    await f.cleanup()
  }
})

test('invites apply role-specific sports and the directory keeps role boundaries', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const f = await institutionFixture(),
    institution = randomUUID(),
    endpoint = '/v1/institution',
    football = randomUUID(),
    strength = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'Role directory',
    })
    for (const [id, name, kind] of [
      [football, 'Football', 'sport'],
      [strength, 'Strength coaching', 'specialty'],
    ])
      await f.call(f.owner, endpoint + '/sports', {
        operation: randomUUID(),
        action: 'sport',
        view: 'admin',
        id,
        name,
        kind,
        archived: false,
        revision: 0,
      })
    const token = randomBytes(32).toString('hex')
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: f.coach.email,
      roles: ['trainer'],
      sports: [football, strength],
      token,
    })
    await f.call(f.coach, '/v1/invitations/' + token, {})
    const roster = await f.call(f.owner, endpoint + '/people?view=admin&role=trainer')
    const coach = roster.items.find((m: any) => m.user_id === f.coach.id)
    expect(coach.sports.sort()).toEqual([football, strength].sort())
    await expect(
      f.call(f.owner, endpoint, {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: 'admin-' + randomUUID() + '@rafik.test',
        roles: ['admin'],
        sports: [football],
        token: randomBytes(32).toString('hex'),
      }),
    ).rejects.toThrow()
    await expect(
      f.call(f.owner, endpoint, {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: f.client.email,
        roles: ['trainee'],
        sports: [strength],
        token: randomBytes(32).toString('hex'),
      }),
    ).rejects.toThrow()
    const athleteToken = randomBytes(32).toString('hex')
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: f.client.email,
      roles: ['trainee'],
      sports: [football],
      token: athleteToken,
    })
    await f.call(f.client, '/v1/invitations/' + athleteToken, {})
    const athletes = await f.call(f.owner, endpoint + '/people?view=admin&role=trainee')
    expect(athletes.items[0].sports).toEqual([football])
    await f.login(page, f.owner, '/people')
    await expect(page.getByRole('tab', { name: 'Athletes', exact: true })).toHaveAttribute(
      'data-state',
      'active',
    )
    await expect(page.getByText('Football', { exact: true }).last()).toBeVisible()
    const extraMembers = Array.from(
      { length: 11 },
      (_, i) =>
        "('" +
        randomUUID() +
        "','" +
        institution +
        "','Roster athlete " +
        String(i).padStart(2, '0') +
        "',ARRAY['trainee'])",
    ).join(',')
    execFileSync(
      'docker',
      [
        'compose',
        '-f',
        resolve(import.meta.dirname, '../../../infrastructure/compose.yaml'),
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
        input:
          'INSERT INTO public.institution_members(id,institution_id,name,roles) VALUES ' +
          extraMembers +
          ';',
        encoding: 'utf8',
      },
    )
    await page.reload()
    await expect(page.locator('.organization-person')).toHaveCount(10)
    await page.getByRole('button', { name: 'Next page', exact: true }).click()
    await expect(page.locator('.organization-person')).toHaveCount(2)
    await page.reload()
    await expect(page.locator('.organization-person')).toHaveCount(2)
    await expect(page.locator('.person-name-link').filter({ hasText: 'R4 Athlete' })).toHaveCount(0)
    await page.locator('.organization-person').first().locator('.person-name-link').click()
    await page.getByRole('link', { name: 'Back to people', exact: true }).click()
    await expect(page.locator('.organization-person')).toHaveCount(2)
    await page.getByRole('button', { name: 'Previous page', exact: true }).click()
    await expect(page.locator('.person-name-link').filter({ hasText: 'R4 Athlete' })).toBeVisible()
    await page.getByRole('button', { name: 'Invite people', exact: true }).click()
    const invitation = page.locator('.institution-invite')
    await invitation.getByRole('radio', { name: 'Coach', exact: true }).check()
    await expect(
      invitation.getByRole('checkbox', { name: 'Strength coaching', exact: true }),
    ).toBeVisible()
    await invitation.getByRole('checkbox', { name: 'Strength coaching', exact: true }).check()
    await invitation.getByRole('radio', { name: 'Administrator', exact: true }).check()
    await expect(invitation.getByRole('checkbox')).toHaveCount(0)
    await invitation.getByRole('radio', { name: 'Athlete', exact: true }).check()
    await expect(
      invitation.getByRole('checkbox', { name: 'Football', exact: true }),
    ).not.toBeChecked()
    await expect(
      invitation.getByRole('checkbox', { name: 'Strength coaching', exact: true }),
    ).toHaveCount(0)
    await inspect(page, 'invite-athlete', info)
    await page.getByRole('button', { name: 'Invite people', exact: true }).click()
    await page.getByRole('tab', { name: 'Coaches', exact: true }).click()
    await expect(page.locator('.person-name-link').filter({ hasText: 'R4 Athlete' })).toHaveCount(0)
    await expect(
      page.locator('.organization-person').getByText('Strength coaching', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Message R4 Coach', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Administrators', exact: true }).click()
    await expect(page.locator('.person-name-link').filter({ hasText: 'R4 Coach' })).toHaveCount(0)
    await page.goto('/institution-settings')
    await page.getByRole('button', { name: 'Close institution', exact: true }).click()
    const closure = page.getByRole('dialog')
    await expect(closure).toBeVisible()
    await expect(
      closure.getByRole('button', { name: 'Close institution', exact: true }),
    ).toBeDisabled()
    await closure.getByLabel('Confirm institution name', { exact: true }).fill('wrong')
    await expect(
      closure.getByRole('button', { name: 'Close institution', exact: true }),
    ).toBeDisabled()
    await closure.getByLabel('Confirm institution name', { exact: true }).fill('Role directory')
    await expect(
      closure.getByRole('button', { name: 'Close institution', exact: true }),
    ).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(closure).toHaveCount(0)
    await page
      .getByRole('heading', { name: 'Institution settings', exact: true })
      .scrollIntoViewIfNeeded()
    await inspect(page, 'institution-settings', info)
    await page.goto('/people')
    await page.getByRole('tab', { name: 'Athletes', exact: true }).focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.setViewportSize({ width: 320, height: 640 })
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.getByRole('tab', { name: 'الرياضيون', exact: true })).toBeVisible()
    await inspect(page, 'directory-ar-dark-320', info)
  } finally {
    await f.cleanup()
  }
})
