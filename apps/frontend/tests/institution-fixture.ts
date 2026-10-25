import { testApi, testDatabase, testFiles } from './local-config.ts'
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import type { Page } from '@playwright/test'
const root = resolve(import.meta.dirname, '../../backend'),
  composeFile = resolve(root, '../../infrastructure/compose.yaml'),
  url = testApi
const sql = (input: string) =>
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
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
    { cwd: root, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  )
type Person = { id: string; email: string; session: { cookie: string } }
export async function institutionFixture() {
  if (
    !readFileSync(composeFile, 'utf8').startsWith('name: ${RAFIK_INSTANCE_ID:-rafik-prisma-local}')
  )
    throw Error('Local fixture guard failed')
  if (!/^rafik_browser_\d+$/.test(testDatabase)) throw Error('Disposable browser database required')
  const people: Person[] = [],
    institutions: string[] = []
  async function call(who: Person, path: string, args?: Record<string, unknown>) {
    if (path === '/v1/institutions' && args) {
      const id = String(args.id),
        name = String(args.name)
      if (!/^[-a-f0-9]{36}$/.test(id)) throw Error('Invalid fixture ID')
      const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'"
      if (!institutions.length)
        sql(
          "DELETE FROM public.institutions WHERE id IN('12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000002');",
        )
      if (institutions.length) throw Error('One institution per browser fixture')
      sql(
        `BEGIN; INSERT INTO public.institutions(id,kind,name,created_by) VALUES (${quote(id)},'organization',${quote(name)},${quote(who.id)}); INSERT INTO public.institution_members(id,institution_id,user_id,roles,name) VALUES ('${randomUUID()}',${quote(id)},${quote(who.id)},ARRAY['admin'],${quote(name)}); COMMIT;`,
      )
      institutions.push(id)
      return { id, kind: 'institution', name }
    }
    const response = await fetch(url + path, {
      method: args ? 'POST' : 'GET',
      headers: {
        // Synchronous Docker fixture setup can outlive an idle HTTP socket.
        // Do not reuse that socket or retry a possibly acknowledged write.
        Connection: 'close',
        'x-rafik-client': 'web',
        'Content-Type': 'application/json',
        Cookie: 'rafik_session=' + who.session.cookie,
      },
      body: args ? JSON.stringify(args) : undefined,
    })
    const data = await response.json()
    if (!response.ok) throw Error(data.message)
    return data
  }
  async function cleanup() {
    for (const p of [...people].reverse()) {
      const media = sql(
        `copy (select 'program',m.institution_id,m.id from public.program_media m join public.institutions w on w.id=m.institution_id where w.created_by='${p.id}' union all select 'organization',a.institution_id,a.id from public.institution_assets a join public.institutions w on w.id=a.institution_id where w.created_by='${p.id}') to stdout with csv;`,
      ).trim()
      for (const line of media ? media.split('\n') : []) {
        const [kind, institution, id] = line.split(',')
        if (!/^[-a-f0-9]{36}$/.test(institution || '') || !/^[-a-f0-9]{36}$/.test(id || ''))
          throw Error('Invalid media fixture')
        try {
          unlinkSync(
            resolve(
              root,
              testFiles,
              createHash('sha256').update(`${kind}/${institution}/${id}`).digest('hex'),
            ),
          )
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
        }
      }
      sql(
        `BEGIN; delete from public.institution_workout_positions where institution_id in (select id from public.institutions where created_by='${p.id}'); delete from public.institution_workout_recurrences where institution_id in (select id from public.institutions where created_by='${p.id}'); delete from public.institutions where created_by='${p.id}'; delete from identity.users where id='${p.id}'; COMMIT;`,
      )
    }
  }
  async function createPerson(name: string): Promise<Person> {
    const id = randomUUID(),
      email = `r4-browser-${id}@rafik.test`,
      cookie = randomBytes(32).toString('hex')
    sql(
      `insert into identity.users(id,email,email_confirmed_at) values('${id}','${email}',now()); insert into identity.sessions(token_hash,user_id,expires_at) values('${createHash('sha256').update(cookie).digest('hex')}','${id}',now()+interval '1 hour');`,
    )
    const person = { id, email, session: { cookie } }
    people.push(person)
    await call(person, '/v1/account/profile', { p_name: name })
    return person
  }
  try {
    for (const name of ['R4 Owner', 'R4 Coach', 'R4 Athlete']) {
      const id = randomUUID(),
        email = `r4-browser-${id}@rafik.test`,
        cookie = randomBytes(32).toString('hex')
      sql(
        `insert into identity.users(id,email,email_confirmed_at) values('${id}','${email}',now()); insert into identity.sessions(token_hash,user_id,expires_at) values('${createHash('sha256').update(cookie).digest('hex')}','${id}',now()+interval '1 hour');`,
      )
      const person = { id, email, session: { cookie } }
      people.push(person)
      await call(person, '/v1/account/profile', { p_name: name })
    }
    const [owner, coach, client] = people as [Person, Person, Person]
    async function login(page: Page, who: Person, path: string) {
      await page.context().addCookies([
        {
          name: 'rafik_session',
          value: who.session.cookie,
          url: 'http://127.0.0.1',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ])
      await page.goto(path)
    }
    return {
      owner,
      coach,
      client,
      createPerson,
      call,
      login,
      cleanup,
    }
  } catch (e) {
    await cleanup()
    throw e
  }
}
