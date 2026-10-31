import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { testApi, testDatabase } from './local-config'

type Person = { id: string; email: string; cookie: string }
const root = resolve(import.meta.dirname, '../../backend'),
  composeFile = resolve(root, '../../infrastructure/compose.yaml')
function sql(statement: string) {
  return execFileSync(
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
    { cwd: root, input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  )
}

export async function injuryFixture() {
  const people: Person[] = [],
    institutions: string[] = []
  async function call(person: Person, path: string, input?: Record<string, unknown>) {
    const response = await fetch(testApi + path, {
      method: input ? 'POST' : 'GET',
      headers: {
        'x-rafik-client': 'web',
        'Content-Type': 'application/json',
        Cookie: `rafik_session=${person.cookie}`,
      },
      body: input ? JSON.stringify(input) : undefined,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message)
    return data
  }
  async function person(name: string): Promise<Person> {
    const id = randomUUID(),
      email = `injury-${id}@rafik.test`,
      cookie = randomBytes(32).toString('hex')
    people.push({ id, email, cookie })
    sql(
      `insert into identity.users(id,email,email_confirmed_at) values('${id}','${email}',now()); insert into identity.sessions(token_hash,user_id,expires_at) values('${createHash('sha256').update(cookie).digest('hex')}','${id}',now()+interval '1 hour');`,
    )
    const current = people.at(-1)!
    await call(current, '/v1/account/profile', { p_name: name })
    return current
  }
  async function addMember(
    institution: string,
    current: Person,
    role: 'admin' | 'trainer' | 'trainee',
  ) {
    const id = randomUUID()
    if (!/^[a-f0-9-]{36}$/.test(institution) || !/^[a-f0-9-]{36}$/.test(current.id))
      throw new Error('Invalid fixture membership ID')
    sql(
      `insert into public.institution_members(id,institution_id,user_id,roles,name) values('${id}','${institution}','${current.id}',array['${role}']::text[],'${role === 'trainee' ? 'Injury Athlete' : role === 'trainer' ? 'Injury Coach' : 'Injury Admin'}');`,
    )
    return { id, user_id: current.id, revision: 1 }
  }
  async function assign(athleteMember: string, coachMember: string) {
    if (!/^[a-f0-9-]{36}$/.test(athleteMember) || !/^[a-f0-9-]{36}$/.test(coachMember))
      throw new Error('Invalid fixture assignment ID')
    sql(
      `update public.institution_members set trainer_id='${coachMember}' where id='${athleteMember}';`,
    )
  }
  async function cleanup() {
    for (const id of institutions) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid fixture institution ID')
      sql(`delete from public.institutions where id='${id}';`)
    }
    for (const current of people) {
      if (!/^[a-f0-9-]{36}$/.test(current.id)) throw new Error('Invalid fixture user ID')
      sql(`delete from identity.users where id='${current.id}';`)
    }
  }
  try {
    const admin = await person('Injury Admin'),
      coach = await person('Injury Coach'),
      athlete = await person('Injury Athlete')
    async function login(page: Page, current: Person, path: string) {
      await page.context().addCookies([
        {
          name: 'rafik_session',
          value: current.cookie,
          url: 'http://127.0.0.1',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ])
      await page.goto(path)
    }
    return { admin, coach, athlete, call, login, cleanup, addMember, assign, institutions }
  } catch (error) {
    await cleanup()
    throw error
  }
}
