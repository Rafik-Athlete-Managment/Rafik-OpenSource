import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import AxeBuilder from '@axe-core/playwright'
import { institutionFixture } from './institution-fixture'
import { layoutIssues } from './layout-contract'
import { testApi, testWeb, testDatabase } from './local-config'

// Observation collector, not a substitute for task acceptance or visual inspection.
test('web design audit inventory', async ({ page }, info) => {
  test.skip(process.env.RAFIK_UI_AUDIT !== '1', 'Opt-in design audit')
  test.setTimeout(600000)
  const f = await institutionFixture(),
    institution = randomUUID(),
    endpoint = `/v1/institution`
  const controlsOnly = process.env.RAFIK_UI_AUDIT_CONTROLS === '1'
  const output = resolve(
    '../../artifacts/ui-audit/2026-10-21',
    info.project.name,
    process.env.RAFIK_UI_AUDIT_ROLLOUT === '1'
      ? 'rollout-matrix'
      : process.env.RAFIK_UI_AUDIT_LAYOUTS === '1'
        ? 'focused-layouts'
        : controlsOnly
          ? 'focused-controls'
          : '.',
  )
  mkdirSync(output, { recursive: true })
  const observations: unknown[] = [],
    runtime: string[] = []
  page.on('pageerror', (error) => runtime.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('[Vue warn]'))
      runtime.push(message.text())
  })
  async function capture(name: string, path: string, scan = false, stay = false) {
    const before = runtime.length
    try {
      if (!stay) await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 20000 })
      await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15000 })
      await page.evaluate(() => document.fonts.ready)
      await expect(page.getByText(/^(Loading upcoming events|تحميل المواعيد القادمة)/)).toHaveCount(
        0,
        { timeout: 20000 },
      )
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll('main p')].some((p) => {
            const r = p.getBoundingClientRect()
            return (
              r.width > 0 &&
              r.height > 0 &&
              /^(Loading(?:[ .…]|$)|تحميل |جارٍ? التحميل)/.test(p.textContent?.trim() || '')
            )
          }),
        undefined,
        { timeout: 20000 },
      )
      if (!stay)
        await page.evaluate(() => {
          document.querySelector('main')?.scrollTo(0, 0)
          window.scrollTo(0, 0)
        })
      const structure = await page.locator('main').evaluate((el) => ({
        locale: document.documentElement.lang,
        theme: document.documentElement.dataset.theme,
        direction: getComputedStyle(document.documentElement).direction,
        headings: [...el.querySelectorAll('h1,h2,h3')].map((h) => ({
          level: h.tagName,
          text: h.textContent?.trim(),
          size: getComputedStyle(h).fontSize,
        })),
        controls: el.querySelectorAll('input,select,textarea,button').length,
        passwordReveal: [...el.querySelectorAll('button')].some((b) =>
          /show password|إظهار كلمة المرور/i.test(
            b.textContent || b.getAttribute('aria-label') || '',
          ),
        ),
        alerts: [...el.querySelectorAll('[role="alert"]')].map((n) => n.textContent?.trim()),
      }))
      const layout = await layoutIssues(page)
      const accessibility = scan
        ? (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          }))
        : null
      await page.screenshot({
        path: resolve(output, name + '-viewport.png'),
        scale: 'css',
        animations: 'disabled',
      })
      if (scan)
        await page.screenshot({
          path: resolve(output, name + '-full.png'),
          scale: 'css',
          fullPage: true,
          animations: 'disabled',
        })
      observations.push({
        name,
        path: path.replace(institution, ':institution'),
        url: new URL(page.url()).pathname.replace(institution, ':institution'),
        viewport: page.viewportSize(),
        ...structure,
        layout,
        accessibility,
        runtime: runtime.slice(before),
      })
    } catch (error) {
      observations.push({ name, error: String(error), runtime: runtime.slice(before) })
    }
    writeFileSync(resolve(output, 'observations.json'), JSON.stringify(observations, null, 2))
  }
  async function interactive(name: string, path: string, open: () => Promise<unknown>) {
    try {
      await page.goto(path)
      await open()
      await capture(name, path, true, true)
    } catch (error) {
      observations.push({ name, error: String(error) })
      writeFileSync(resolve(output, 'observations.json'), JSON.stringify(observations, null, 2))
    }
    await page.keyboard.press('Escape')
  }
  try {
    await f.call(f.owner, '/v1/institutions', {
      id: institution,
      kind: 'institution',
      name: 'University Sports · جامعة الرياضة',
    })
    for (const [person, role] of [
      [f.coach, 'trainer'],
      [f.client, 'trainee'],
    ] as const) {
      const token = randomBytes(32).toString('hex')
      await f.call(f.owner, endpoint, {
        operation: randomUUID(),
        action: 'invite',
        id: randomUUID(),
        email: person.email,
        roles: [role],
        token,
      })
      await f.call(person, '/v1/invitations/' + token, {})
    }
    let data = await f.call(f.owner, endpoint + '?view=admin')
    const coach = data.members.find((m: any) => m.user_id === f.coach.id),
      athlete = data.members.find((m: any) => m.user_id === f.client.id)
    await f.call(f.owner, endpoint, {
      operation: randomUUID(),
      action: 'assign-trainer',
      id: athlete.id,
      revision: athlete.revision,
      trainer: coach.id,
    })
    const football = randomUUID()
    for (const [id, name, kind] of [
      [football, 'Football · كرة القدم', 'sport'],
      [randomUUID(), 'Strength and conditioning · الإعداد البدني والقوة', 'specialty'],
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
    for (const member of [coach, athlete])
      await f.call(f.owner, endpoint + '/sports', {
        operation: randomUUID(),
        action: 'member-sports',
        view: 'admin',
        member: member.id,
        sports: [football],
        previous: [],
      })
    const draft = JSON.parse(
      readFileSync(resolve('../backend/content/starter.json'), 'utf8'),
    ).prescription
    const program = randomUUID(),
      published = await f.call(f.owner, endpoint + '/programs', {
        operation: randomUUID(),
        action: 'publish',
        view: 'admin',
        id: program,
        title: 'Preseason strength · الإعداد للموسم',
        draft,
        revision: null,
      })
    data = await f.call(f.owner, endpoint + '?view=admin')
    await f.call(f.owner, endpoint + '/delivery', {
      operation: randomUUID(),
      action: 'assign',
      view: 'admin',
      version_id: published.version.id,
      start_date: new Date().toISOString().slice(0, 10),
      schedule_mode: 'flexible',
      members: [
        { id: athlete.id, revision: data.members.find((m: any) => m.id === athlete.id).revision },
      ],
    })
    const today = new Date().toISOString().slice(0, 10),
      tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await f.call(f.owner, endpoint + '/nutrition', {
      operation: randomUUID(),
      action: 'publish',
      view: 'admin',
      member: athlete.id,
      id: randomUUID(),
      revision: 0,
      effective_on: today,
      expires_on: null,
      targets: { kcal: 2200, protein_g: 130 },
      guidance: 'Regular meals around training · وجبات منتظمة حول التدريب',
      meals: [],
    })
    await f.call(f.owner, endpoint + '/schedule', {
      operation: randomUUID(),
      action: 'create',
      view: 'admin',
      id: randomUUID(),
      title: 'Field training · التدريب الميداني',
      kind: 'training',
      staff: [coach.id],
      participants: [athlete.id],
      local: tomorrow + 'T10:00',
      zone: 'UTC',
      minutes: 60,
      count: 1,
      every: 7,
    })
    const base = ``
    await f.login(page, f.owner, base)
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    await page.reload()
    if (process.env.RAFIK_UI_AUDIT_ROLLOUT === '1') {
      const own = data.members.find((m: any) => m.user_id === f.owner.id)
      const channel = randomUUID(),
        pastEvent = randomUUID()
      await f.call(f.owner, endpoint + '/communication', {
        action: 'create',
        id: channel,
        operation: randomUUID(),
        view: 'admin',
        title: 'Preseason coordination · تنسيق الإعداد للموسم',
        members: [own.id, athlete.id],
        managers: [own.id],
      })
      for (let i = 0; i < 8; i++)
        await f.call(f.owner, endpoint + '/communication', {
          action: 'send',
          id: channel,
          message: randomUUID(),
          operation: randomUUID(),
          view: 'admin',
          body: `Practice note ${i + 1}: keep the next session controlled and review readiness. ملاحظة تدريبية: راجع الجاهزية قبل الحصة القادمة.`,
        })
      await f.call(f.owner, endpoint + '/schedule', {
        action: 'create',
        id: pastEvent,
        operation: randomUUID(),
        view: 'admin',
        title: 'Completed field practice · تدريب ميداني مكتمل',
        kind: 'training',
        staff: [coach.id],
        participants: [athlete.id],
        local: tomorrow + 'T09:00',
        zone: 'UTC',
        minutes: 30,
        count: 1,
        every: 7,
      })
      execFileSync(
        'docker',
        [
          'compose',
          '-f',
          resolve('../../infrastructure/compose.yaml'),
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
          input: `update public.institution_events set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour' where id='${pastEvent}' and institution_id='${institution}';`,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      )
      const beforeAttendance = await f.call(
        f.owner,
        endpoint + '/calendar?view=admin&id=' + pastEvent,
      )
      await f.call(f.owner, endpoint + '/schedule', {
        action: 'attendance',
        id: pastEvent,
        member: athlete.id,
        revision: beforeAttendance.people.find(
          (p: { member_id: string }) => p.member_id === athlete.id,
        ).revision,
        attendance: 'present',
        operation: randomUUID(),
        view: 'admin',
      })
      const past = await f.call(f.owner, endpoint + '/calendar?view=admin&id=' + pastEvent)
      await f.call(f.owner, endpoint + '/schedule', {
        action: 'finish',
        id: pastEvent,
        revision: past.event.revision,
        operation: randomUUID(),
        view: 'admin',
      })
      for (let i = 0; i < 5; i++) {
        await f.call(f.owner, endpoint + '/schedule', {
          action: 'create',
          id: randomUUID(),
          operation: randomUUID(),
          view: 'admin',
          title: 'Today card ' + (i + 1),
          kind: 'training',
          staff: [coach.id],
          participants: [athlete.id],
          local: tomorrow + 'T' + String(11 + i).padStart(2, '0') + ':00',
          zone: 'UTC',
          minutes: 30,
          count: 1,
          every: 7,
        })
      }
      execFileSync(
        'docker',
        [
          'compose',
          '-f',
          resolve('../../infrastructure/compose.yaml'),
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
          input: `update public.institution_events set starts_at=date_trunc('day',now())+interval '12 hours', ends_at=date_trunc('day',now())+interval '13 hours' where institution_id='${institution}' and title like 'Today card %';`,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      )
      const views = [
        ['programs', '/plans'],
        ['program-new', '/plans/new'],
        ['assignment', '/deliver/' + published.version.id],
        ['athlete-plans', '/training'],
        ['sessions', '/workouts'],
        ['calendar', '/schedule'],
        ['schedule-list', '/events'],
        ['event-new', '/schedule/new'],
        ['event-detail', '/schedule/' + pastEvent],
        ['template-new', '/assessment-templates/new'],
        ['group-new', '/groups/new'],
        ['resources', '/resources'],
        ['analytics', '/analytics'],
        ['messages', '/messages/' + channel],
        ['nutrition', '/nutrition'],
        ['nutrition-athlete', '/nutrition?member=' + athlete.id],
      ]
      for (const config of [
        { locale: 'en', theme: 'light', width: 1440, height: 1000 },
        { locale: 'ar', theme: 'dark', width: 320, height: 640 },
        { locale: 'en', theme: 'dark', width: 768, height: 1024 },
        { locale: 'ar', theme: 'light', width: 1024, height: 768 },
      ]) {
        await page.setViewportSize({ width: config.width, height: config.height })
        await page.evaluate((c) => {
          localStorage.setItem('rafik.locale', c.locale)
          localStorage.setItem('rafik.theme', c.theme)
        }, config)
        await page.emulateMedia({
          reducedMotion: config.width === 768 ? 'reduce' : 'no-preference',
        })
        const subset =
          info.project.name === 'webkit-phone' || config.width === 768 || config.width === 1024
            ? views.filter(([name]) =>
                [
                  'event-new',
                  'analytics',
                  'messages',
                  'calendar',
                  'schedule-list',
                  'athlete-plans',
                  'nutrition',
                ].includes(name),
              )
            : config.width === 320
              ? views.filter(([name]) =>
                  [
                    'calendar',
                    'schedule-list',
                    'athlete-plans',
                    'nutrition',
                    'program-new',
                    'assignment',
                    'event-new',
                    'template-new',
                    'resources',
                    'analytics',
                    'messages',
                  ].includes(name),
                )
              : views
        for (const [name, path] of subset) {
          await capture(
            `${config.locale}-${config.theme}-${config.width}-${name}`,
            base + path,
            ['template-new', 'analytics', 'messages', 'event-new', 'resources'].includes(name),
          )
          if (name === 'calendar' && config.locale === 'en') {
            await expect(page.locator('.agenda-list > li')).toHaveCount(4)
            await page
              .getByRole('navigation', { name: 'Booked session pages', exact: true })
              .getByRole('button', { name: 'Next page', exact: true })
              .click()
            await expect(page.locator('.agenda-list > li')).toHaveCount(2)
          }
          if (name === 'athlete-plans' || name === 'nutrition') {
            await expect(page.locator('.athlete-search input')).toHaveCount(1)
            await expect(
              page.locator('details.athlete-filter,details.nutrition-athlete-filter'),
            ).toHaveCount(0)
          }
          if (name === 'messages') {
            await expect(page.locator('.message-bubble')).toHaveCount(8)
            await expect(
              page.getByRole('button', {
                name: config.locale === 'ar' ? 'إرسال الرسالة' : 'Send message',
                exact: true,
              }),
            ).toBeVisible()
          }
          if (name === 'analytics' && config.width === 1440) {
            await page.getByRole('tab', { name: 'Delivery & capacity', exact: true }).click()
            await capture('en-light-analytics-delivery', base + path, true, true)
            await page.getByRole('tab', { name: 'Experience', exact: true }).click()
            await capture('en-light-analytics-experience', base + path, true, true)
          }
        }
      }
      expect(
        (observations as { error?: string; layout?: string[]; accessibility?: unknown[] }[]).filter(
          (x) => x.error || x.layout?.length || x.accessibility?.length,
        ),
      ).toEqual([])
      return
    }
    if (process.env.RAFIK_UI_AUDIT_LAYOUTS === '1') {
      for (const config of [
        { locale: 'en', theme: 'light', width: 1440 },
        { locale: 'ar', theme: 'dark', width: 320 },
      ]) {
        await page.setViewportSize({ width: config.width, height: 800 })
        await page.evaluate((c) => {
          localStorage.setItem('rafik.locale', c.locale)
          localStorage.setItem('rafik.theme', c.theme)
        }, config)
        for (const [name, path] of [
          ['management', '/members/' + athlete.id + '?tab=manage'],
          ['settings', '/settings'],
        ])
          await capture(
            `${config.locale}-${config.theme}-${config.width}-${name}`,
            base + path,
            true,
          )
      }
      expect(
        (observations as { error?: string; layout?: string[]; accessibility?: unknown[] }[]).filter(
          (x) => x.error || x.layout?.length || x.accessibility?.length,
        ),
      ).toEqual([])
      return
    }
    await interactive('en-light-invitation-open', base + '/people', () =>
      page.getByRole('button', { name: 'Invite people', exact: true }).click(),
    )
    await interactive('en-light-close-dialog', base + '/institution-settings', () =>
      page.getByRole('button', { name: 'Close institution', exact: true }).click(),
    )
    await interactive('en-light-timezone-open', base + '/schedule/new', async () => {
      await page.getByRole('radio', { name: /^Custom event/ }).check()
      await page.getByRole('button', { name: 'Choose timezone', exact: true }).click()
      await expect(page.locator('.timezone-options')).toBeVisible()
    })
    await interactive('en-light-exercise-picker-open', base + '/plans/new', async () => {
      await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
      await page.getByRole('combobox', { name: 'Exercise 1', exact: true }).click()
      await expect(page.locator('.exercise-picker-option').first()).toBeInViewport()
    })
    if (controlsOnly) {
      const exercise = page.getByRole('combobox', { name: 'Exercise 1', exact: true })
      await exercise.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await expect(exercise).not.toHaveValue('')
      await page.context().clearCookies()
      await page.goto('/login')
      const password = page.getByLabel('Password', { exact: true })
      await password.fill('SyntheticVisible1!')
      await page.getByRole('button', { name: 'Show password', exact: true }).click()
      await expect(password).toHaveAttribute('type', 'text')
      await expect(password).toHaveValue('SyntheticVisible1!')
      await page.getByRole('button', { name: 'Hide password', exact: true }).click()
      await expect(password).toHaveAttribute('type', 'password')
      await capture('password-field', '/login', true, true)
      expect(
        (observations as { error?: string; layout?: string[]; accessibility?: unknown[] }[]).filter(
          (x) => x.error || x.layout?.length || x.accessibility?.length,
        ),
      ).toEqual([])
      return
    }
    await page.evaluate(() => {
      localStorage.setItem('rafik.locale', 'en')
      localStorage.setItem('rafik.theme', 'light')
    })
    const all = [
      ['overview', ''],
      ['people', '/people'],
      ['athlete-profile', '/members/' + athlete.id],
      ['athlete-manage', '/members/' + athlete.id + '?tab=manage'],
      ['coach-profile', '/members/' + coach.id],
      ['settings', '/settings'],
      ['activity', '/activity'],
      ['analytics', '/analytics'],
      ['programs', '/plans'],
      ['program-editor', '/plans/' + program],
      ['program-new', '/plans/new'],
      ['assignment', '/deliver/' + published.version.id],
      ['athlete-plans', '/training'],
      ['session-history', '/workouts'],
      ['events', '/events'],
      ['calendar', '/schedule'],
      ['event-new', '/schedule/new'],
      ['assessment-templates', '/assessment-templates'],
      ['groups', '/groups'],
      ['nutrition', '/nutrition'],
      ['nutrition-athlete', '/nutrition?member=' + athlete.id],
      ['assessments', '/assessments/' + athlete.id],
      ['injuries', '/injuries'],
      ['messages', '/messages'],
      ['feedback', '/feedback'],
      ['resources', '/resources'],
      ['exercises', '/exercises'],
    ]
    const subset = new Set([
      'people',
      'athlete-manage',
      'settings',
      'program-new',
      'event-new',
      'messages',
      'exercises',
    ])
    for (const [name, path] of all)
      if (info.project.name === 'chromium' || subset.has(name))
        await capture('en-light-' + name, base + path, subset.has(name))
    for (const [name, path] of [
      ['account-settings', '/settings'],
      ['notifications', '/notifications'],
      ['help', '/help'],
      ['support', '/support'],
      ['institutions', '/institutions'],
      ['not-found', '/audit-missing-page'],
    ])
      await capture('en-light-' + name, path)
    for (const role of ['trainer', 'trainee'] as const) {
      await f.login(page, role === 'trainer' ? f.coach : f.client, ``)
      for (const path of ['', '/training', '/schedule', '/nutrition', '/messages'])
        await capture('en-light-' + role + '-' + (path.slice(1) || 'overview'), `${path}`)
    }
    await f.login(page, f.owner, base)
    for (const config of [
      { locale: 'ar', theme: 'dark', width: 320, height: 640 },
      { locale: 'en', theme: 'dark', width: 768, height: 1024 },
      { locale: 'ar', theme: 'light', width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize({ width: config.width, height: config.height })
      await page.evaluate((c) => {
        localStorage.setItem('rafik.locale', c.locale)
        localStorage.setItem('rafik.theme', c.theme)
      }, config)
      for (const [name, path] of all.filter(([name]) =>
        ['people', 'athlete-manage', 'settings', 'event-new', 'messages'].includes(name),
      ))
        await capture(
          `${config.locale}-${config.theme}-${config.width}-${name}`,
          base + path,
          name === 'settings',
        )
    }
    await page.context().clearCookies()
    for (const [name, path] of [
      ['login', '/login'],
      ['password-expired', '/password-setup/expired'],
      ['invitation-invalid', '/organization-invite/expired'],
      ['privacy', '/privacy'],
    ])
      await capture('public-' + name, path, name === 'login')
  } finally {
    await f.cleanup()
  }
})

test('web design audit bootstrap and branding', async ({ page, browser }, info) => {
  test.skip(process.env.RAFIK_UI_AUDIT_BOOTSTRAP !== '1', 'Opt-in empty-instance audit')
  if (!/^rafik_browser_\d+$/.test(testDatabase)) throw Error('Disposable audit database required')
  test.setTimeout(180000)
  const output = resolve('../../artifacts/ui-audit/2026-10-21', info.project.name, 'bootstrap')
  mkdirSync(output, { recursive: true })
  const observations: unknown[] = []
  const preferences = () => {
    localStorage.setItem('rafik.locale', 'en')
    localStorage.setItem('rafik.theme', 'light')
  }
  await page.addInitScript(preferences)
  async function capture(target: Page, name: string) {
    await expect(target.locator('main h1').first()).toBeVisible()
    const layout = await layoutIssues(target)
    const accessibility = (await new AxeBuilder({ page: target }).analyze()).violations.map(
      (v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) }),
    )
    await target.screenshot({ path: resolve(output, name + '-viewport.png'), scale: 'css' })
    await target.screenshot({
      path: resolve(output, name + '-full.png'),
      scale: 'css',
      fullPage: true,
    })
    observations.push({ name, viewport: target.viewportSize(), layout, accessibility })
    writeFileSync(resolve(output, 'observations.json'), JSON.stringify(observations, null, 2))
  }
  await page.goto('/setup')
  await expect(page.getByLabel('Your full name')).toBeVisible()
  await capture(page, 'first-run')
  await page.getByLabel('Your full name').fill('Design Audit Administrator')
  await page.getByLabel('University or training institution name').fill('Design Audit University')
  await page.getByLabel('Sign-in email address').fill('ui-audit-bootstrap@rafik.test')
  await page.getByLabel('Password', { exact: true }).fill('Synthetic audit password 2026!')
  await page.getByLabel('Confirm password').fill('Synthetic audit password 2026!')
  await page.getByRole('button', { name: 'Create institution and account' }).click()
  await expect(page).toHaveURL(/\/organization\/[^/]+\/admin/)
  const base = new URL(page.url()).pathname
  await page.goto(base + '/institution-settings')
  await expect(page.getByLabel('Accent color', { exact: true })).toBeVisible()
  await capture(page, 'authorized-branding')
  const institution = base.split('/')[2],
    token = randomBytes(32).toString('hex')
  const response = await page.request.post(testApi + '/v1/institution', {
    headers: { 'x-rafik-client': 'web', Origin: testWeb },
    data: {
      action: 'invite',
      operation: randomUUID(),
      id: randomUUID(),
      email: 'ui-audit-invited@rafik.test',
      roles: ['trainee'],
      token,
    },
  })
  expect(response.ok()).toBe(true)
  const invited = await browser.newContext({ viewport: page.viewportSize()! })
  try {
    await invited.addInitScript(preferences)
    const target = await invited.newPage()
    await target.goto(testWeb + '/organization-invite/' + token)
    await expect(target.locator('input[type="password"]').first()).toBeVisible()
    await capture(target, 'valid-invitation-signup')
  } finally {
    await invited.close()
  }
  // The isolation wrapper removes the whole newly created audit database, never preview data.
})
