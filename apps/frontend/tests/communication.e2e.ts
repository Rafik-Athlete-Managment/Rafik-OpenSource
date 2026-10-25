import { test, expect } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
import { testPreview } from './local-config'
// Request fault injection must bypass the production service worker. Offline
// shell behavior has separate acceptance; it is not established by this test.
test.use({ baseURL: testPreview, serviceWorkers: 'block' })
test('organization conversations preserve scope, compact layout, drafts and exact send recovery; notification links reach the right context', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000)
  const f = await institutionFixture(),
    clientContext = await browser.newContext(),
    client = await clientContext.newPage(),
    id = randomUUID()
  try {
    await f.call(f.owner, '/v1/institutions', {
      id,
      kind: 'institution',
      name: 'Madar communication test',
    })
    const token = randomBytes(32).toString('hex')
    await f.call(f.owner, `/v1/institution`, {
      operation: randomUUID(),
      action: 'invite',
      id: randomUUID(),
      email: f.client.email,
      roles: ['trainee'],
      token,
    })
    await f.call(f.client, `/v1/invitations/${token}`, {})
    const base = `/messages`
    const initialList = page.waitForResponse(
      (response) =>
        response.url().includes(`/v1/institution/communication`) &&
        response.request().method() === 'GET',
    )
    await f.login(page, f.owner, base)
    await page.locator('.conversation-contacts > summary').click()
    await expect(page.getByRole('button', { name: 'New conversation', exact: true })).toHaveCount(0)
    await initialList
    const athlete = page
      .locator('.conversation-contacts')
      .getByRole('button', { name: /R4 Athlete/ })
    await expect(athlete).toBeVisible()
    // The successful click creates a conversation and removes this contact from
    // the People list during SPA navigation. Dispatch the button's real click
    // handler without Playwright retrying against the intentionally removed row.
    await athlete.evaluate((element) => (element as HTMLButtonElement).click())
    await expect(page).toHaveURL(/\/messages\/[a-f0-9-]{36}$/)
    await expect(page.locator('.swal2-toast')).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toHaveCount(0)
    await expect(
      page.locator('.conversation-contacts').getByRole('button', { name: /R4 Athlete/ }),
    ).toHaveCount(0)
    await expect(
      page.locator('.conversation-contacts').getByText(/No available people/),
    ).toHaveCount(0)
    const channel = new URL(page.url()).pathname.split('/').at(-1)!
    await page.goto(base)
    await expect(page.locator('.conversation-directory')).toHaveCSS('overflow-y', 'auto')
    await expect(page.locator('.conversation-list')).toHaveCSS('overflow-y', 'visible')
    await expect(
      page.locator('.conversation-contacts').getByRole('button', { name: /R4 Athlete/ }),
    ).toHaveCount(0)
    await page
      .locator('.conversation-list')
      .getByRole('link', { name: /R4 Athlete/ })
      .click()
    await expect(page).toHaveURL(new RegExp(`/messages/${channel}$`))
    await page
      .getByRole('textbox', { name: 'Write a message', exact: true })
      .fill('Let us review your first week together.')
    await expect(page.getByText('Draft saved on this device', { exact: true })).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve, reject) => {
              const open = indexedDB.open('rafik-revamp', 1)
              open.onerror = () => reject(open.error)
              open.onsuccess = () => {
                const db = open.result,
                  read = db.transaction('drafts').objectStore('drafts').getAll()
                read.onerror = () => {
                  db.close()
                  reject(read.error)
                }
                read.onsuccess = () => {
                  const saved = read.result.some(
                    (draft) => draft.value?.text === 'Let us review your first week together.',
                  )
                  db.close()
                  resolve(saved)
                }
              }
            }),
        ),
      )
      .toBe(true)
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Write a message', exact: true })).toHaveValue(
      'Let us review your first week together.',
    )
    let lost = false,
      loseAcknowledgment = true
    await page.route(`**/v1/institution/communication`, async (r) => {
      if (
        loseAcknowledgment &&
        r.request().method() === 'POST' &&
        r.request().postDataJSON()?.action === 'send'
      ) {
        // WebKit may retry an aborted POST internally. Keep the acknowledgment
        // unavailable until the explicit user retry, while applying only once.
        if (!lost) {
          lost = true
          await r.fetch()
        }
        await r.abort('failed')
      } else await r.continue()
    })
    await page.getByRole('button', { name: 'Send message', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retry saved change', exact: true }),
    ).toBeEnabled()
    await page.reload()
    loseAcknowledgment = false
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Write a message', exact: true })).toHaveValue(
      '',
    )
    await expect(
      page
        .locator('.message-bubble')
        .filter({ hasText: 'Let us review your first week together.' }),
    ).toHaveCount(1)
    await expect(page.locator('.swal2-toast')).toHaveCount(0)
    await f.login(client, f.client, '/notifications')
    await client.getByRole('button', { name: 'Notification preferences', exact: true }).click()
    await client.getByRole('combobox', { name: 'Quiet from', exact: true }).selectOption('0')
    await client.getByRole('combobox', { name: 'Until', exact: true }).selectOption('0')
    await client.getByRole('button', { name: 'Save preferences', exact: true }).click()
    await expect(
      client
        .locator('.rafik-toast')
        .filter({ hasText: 'Notification preferences updated.' })
        .last(),
    ).toBeVisible()
    await client.getByRole('button', { name: 'Back to updates', exact: true }).click()
    await client.getByRole('button', { name: 'New conversation updates', exact: false }).click()
    await expect(client).toHaveURL(`/messages/${channel}`)
    await expect(
      client
        .locator('.message-bubble')
        .filter({ hasText: 'Let us review your first week together.' }),
    ).toHaveCount(1)
    await client.getByRole('button', { name: /^Participants/ }).click()
    await expect(
      client
        .locator('.channel-people')
        .getByText('Madar communication test · manager', { exact: true }),
    ).toBeVisible()
    await client.getByRole('button', { name: /^Participants/ }).click()
    await client
      .getByRole('textbox', { name: 'Write a message', exact: true })
      .fill('The first session felt clear, thank you.')
    const composer = client.getByRole('textbox', { name: 'Write a message', exact: true })
    await composer.press('Shift+Enter')
    await expect(composer).toHaveValue('The first session felt clear, thank you.\n')
    await composer.press('Enter')
    await expect(client.getByRole('textbox', { name: 'Write a message', exact: true })).toHaveValue(
      '',
    )
    expect(await layoutIssues(client)).toEqual([])
    expect((await new AxeBuilder({ page: client }).analyze()).violations).toEqual([])
    await client.screenshot({
      path: `artifacts/founder-conversation-${info.project.name}.png`,
      fullPage: true,
    })
    await client.goto(`/messages`)
    await expect(client.getByRole('link', { name: /R4 Athlete/ })).toBeVisible()
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 664 },
      { width: 844, height: 390 },
    ]) {
      await client.setViewportSize(size)
      expect(await layoutIssues(client)).toEqual([])
      expect((await client.locator('.conversation-person').boundingBox())!.height).toBeLessThan(130)
    }
    await client
      .getByRole('searchbox', { name: 'Search people and conversations', exact: true })
      .fill('no matching group')
    await client.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(client.getByText(/No matching conversations/)).toBeVisible()
  } finally {
    await clientContext.close()
    await f.cleanup()
  }
})
