import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'

test('flat routes derive roles and reject retired bookmarks and Tasks', async ({ page }) => {
  test.setTimeout(120000)
  const f = await institutionFixture(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Routing institution',
    })
    const token = randomBytes(32).toString('hex')
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: f.coach.email,
      roles: ['trainer'],
      token,
    })
    await f.call(f.coach, `/v1/invitations/${token}`, {})
    await f.login(page, f.owner, '/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const draftKeys = [
      `trainer-tasks:${f.owner.id}:${id}:admin:new`,
      `r4-command:${f.owner.id}:trainer-tasks:${f.owner.id}:${id}:admin`,
      `plan:${f.owner.id}:${id}:admin:keep`,
      'trainer-tasks:another-account:keep',
    ]
    await page.evaluate(async (keys) => {
      const database = await new Promise<IDBDatabase>((accept, reject) => {
        const request = indexedDB.open('rafik-revamp', 1)
        request.onsuccess = () => accept(request.result)
        request.onerror = () => reject(request.error)
      })
      await new Promise<void>((accept, reject) => {
        const tx = database.transaction('drafts', 'readwrite')
        for (const key of keys)
          tx.objectStore('drafts').put({
            key,
            value: { title: 'Fixture draft' },
            savedAt: new Date().toISOString(),
          })
        tx.oncomplete = () => accept()
        tx.onerror = () => reject(tx.error)
      })
      database.close()
    }, draftKeys)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const remaining = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((accept) => {
        const request = indexedDB.open('rafik-revamp', 1)
        request.onsuccess = () => accept(request.result)
      })
      const keys = await new Promise<IDBValidKey[]>((accept) => {
        const request = database.transaction('drafts').objectStore('drafts').getAllKeys()
        request.onsuccess = () => accept(request.result)
      })
      database.close()
      return keys
    })
    expect(remaining).not.toContain(draftKeys[0])
    expect(remaining).not.toContain(draftKeys[1])
    expect(remaining).toContain(draftKeys[2])
    expect(remaining).toContain(draftKeys[3])
    await expect(page.locator('.dashboard-navigation a[href="/tasks"]')).toHaveCount(0)
    await expect(page.locator('.dashboard-navigation a[href="/institution-settings"]')).toHaveCount(
      1,
    )
    for (const path of [
      '/people?search=R4&limit=25',
      '/institution-settings',
      '/schedule?view=month',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
    for (const path of [
      `/organization/${id}/admin/people`,
      '/calendar',
      '/session-history',
      '/institutions',
      '/tasks',
      '/coach/forms',
      '/checkins',
      '/teams',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'That page isn’t here.' })).toBeVisible()
    }
    await f.login(page, f.coach, '/schedule')
    await expect(page).toHaveURL(/\/schedule$/)
    await expect(page.locator('.dashboard-navigation a[href="/institution-settings"]')).toHaveCount(
      0,
    )
    await page.goto('/institution-settings')
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto('/schedule')
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'ar')
      localStorage.setItem('rafik.theme', 'dark')
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.loading-state')).toHaveCount(0)
    expect(await layoutIssues(page)).toEqual([])
  } finally {
    await f.cleanup()
  }
})
