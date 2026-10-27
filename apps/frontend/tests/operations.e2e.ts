import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
test('platform operator has a separate audited account workflow and private deep links return through sign-in', async ({
  page,
}, info) => {
  const f = await institutionFixture(),
    restoreReason = `Restore isolated account ${randomUUID()}`
  try {
    await page.goto('/notifications?event=' + randomUUID())
    await expect(page).toHaveURL(/\/login\?next=/)
    await page.goto('/platform')
    await expect(page).toHaveURL(/\/login\?next=/)
    await page.goto('/local-preview')
    await page.getByRole('button', { name: /Amina/ }).click()
    await expect(page).toHaveURL('/platform')
    await page.getByRole('combobox', { name: 'Area', exact: true }).selectOption('users')
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(f.client.email)
    await page.getByRole('button', { name: 'Refresh results', exact: true }).click()
    await page.getByRole('button', { name: 'Suspend access', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Reason for this action', exact: true })
      .fill('Local browser acceptance of suspension')
    await page.getByRole('button', { name: 'Confirm action', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Access suspended.' }).last(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Restore access', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Reason for this action', exact: true })
      .fill(restoreReason)
    await page.getByRole('button', { name: 'Confirm action', exact: true }).click()
    await expect(
      page.locator('.rafik-toast').filter({ hasText: 'Access restored.' }).last(),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Suspend access', exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Area', exact: true }).selectOption('audit')
    await expect(page.getByText(restoreReason, { exact: true })).toBeVisible()
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: info.outputPath('platform-audit.png'), fullPage: true })
  } finally {
    await f.cleanup()
  }
})
test('organization coach starts a private conversation with their assigned athlete from People and stays a participant', async ({
  page,
}) => {
  const f = await institutionFixture(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Scoped communication',
    })
    const join = async (who: typeof f.coach, roles: string[]) => {
      const token = randomBytes(32).toString('hex')
      await f.call(f.owner, `/v1/institution`, {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: who.email,
        roles,
        token,
      })
      await f.call(who, `/v1/invitations/${token}`, {})
    }
    await join(f.coach, ['trainer'])
    await join(f.client, ['trainee'])
    const org = await f.call(f.owner, `/v1/institution?view=admin`),
      coach = org.members.find((m: any) => m.user_id === f.coach.id),
      client = org.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: client.id,
      revision: client.revision,
      trainer: coach.id,
    })
    await f.login(page, f.coach, `/messages`)
    await page.setViewportSize({ width: 320, height: 568 })
    // Chats start from Contacts; the coach is always one of the two participants.
    await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
    await page
      .locator('.conversation-contacts')
      .getByRole('button', { name: /R4 Athlete/ })
      .click()
    await expect(page).toHaveURL(/messages\/[a-f0-9-]{36}$/)
    await page.getByRole('button', { name: 'Participants (2)', exact: true }).click()
    const participants = page.locator('.channel-people')
    await expect(participants).toContainText('R4 Coach')
    await expect(participants).toContainText('R4 Athlete')
    await page.getByRole('button', { name: 'Participants (2)', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Write a message', exact: true })
      .fill('What would help with the next session?')
    await page.getByRole('button', { name: 'Send message', exact: true }).click()
    await expect(page.locator('.message-bubble')).toContainText(
      'What would help with the next session?',
    )
    expect(await layoutIssues(page)).toEqual([])
  } finally {
    await f.cleanup()
  }
})

test('large member selection searches the full roster and keeps reviewed choices across pages and reload', async ({
  page,
}, info) => {
  const f = await institutionFixture(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Roster selection test',
    })
    const { execFileSync } = await import('node:child_process'),
      { testDatabase } = await import('./local-config')
    const people = Array.from({ length: 61 }, (_, i) => ({
      id: randomUUID(),
      name: `Trainee ${String(i).padStart(3, '0')} with a long displayed name`,
    }))
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
        cwd: resolve(import.meta.dirname, '../../backend'),
        input: `insert into public.institution_members(id,institution_id,name,roles) values ${people.map((p) => `('${p.id}','${id}','${p.name}',ARRAY['trainee'])`).join(',')};`,
        stdio: 'pipe',
      },
    )
    await f.login(page, f.owner, `/groups`)
    await page.getByRole('button', { name: 'New group', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Reviewed roster selection')
    const picker = page.locator('.member-picker').first()
    // Large rosters: only the five closest matches are listed; choices survive new searches.
    await expect(picker.getByRole('checkbox')).toHaveCount(5)
    await picker.getByRole('checkbox', { name: people[0]!.name, exact: true }).check()
    await picker.getByRole('searchbox').fill('049')
    await expect(picker.getByRole('checkbox')).toHaveCount(1)
    await picker.getByRole('checkbox', { name: people[49]!.name, exact: true }).check()
    await expect(picker.locator('.chosen-members')).toContainText(people[49]!.name)
    await expect(
      picker.getByRole('checkbox', { name: people[49]!.name, exact: true }),
    ).toBeChecked()
    await picker.getByRole('searchbox').fill('060')
    await picker.getByRole('checkbox', { name: people[60]!.name, exact: true }).check()
    await expect(picker.locator('.chosen-members')).toContainText(people[0]!.name)
    await expect(page.getByText('Draft saved on this device.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(picker.locator('.chosen-members')).toContainText(people[60]!.name)
    await expect(picker.locator('.chosen-members')).toContainText(people[0]!.name)
    await page.setViewportSize({ width: 320, height: 568 })
    expect(await layoutIssues(page)).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: info.outputPath('paged-selection.png'), fullPage: true })
    await page.getByRole('button', { name: 'Save group', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Reviewed roster selection', exact: true }),
    ).toBeVisible()
  } finally {
    await f.cleanup()
  }
})
