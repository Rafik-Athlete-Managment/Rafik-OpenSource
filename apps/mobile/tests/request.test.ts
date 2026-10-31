import { test } from 'node:test'
import assert from 'node:assert/strict'
import { instanceUrl, jsonRequest } from '../src/field/request.ts'
import { ApiFailure, ConnectionFailure, failureText } from '../src/field/model.ts'
import { translate } from '../src/field/translations.ts'
import { selectedInstitution } from '../src/field/access.ts'
import { checkCapabilities, fieldCapabilities } from '../src/field/capabilities.ts'

test('capability discovery separates legacy, invalid, offline and denied responses without assuming workout support', async () => {
  const value = {
    protocol: 1,
    features: {
      attendance: true,
      assessments: true,
      event_completion: true,
      individual_workout_recording: false,
      group_workout_recording: false,
      day_only_calendar: false,
    },
  }
  const result = await checkCapabilities(async (path) => {
    assert.equal(path, '/mobile/capabilities')
    return value
  })
  assert.deepEqual(result, { state: 'available', value })
  assert.throws(() => fieldCapabilities({ ...value, protocol: 2 }), /unsupported/)
  assert.throws(
    () => fieldCapabilities({ ...value, features: { attendance: true } }),
    /unsupported/,
  )
  assert.throws(
    () =>
      fieldCapabilities({
        ...value,
        features: { ...value.features, group_workout_recording: 'false' },
      }),
    /unsupported/,
  )
  assert.deepEqual(
    await checkCapabilities(async () => {
      throw new ApiFailure(404, 'not_found')
    }),
    { state: 'legacy' },
  )
  for (const error of [
    new ConnectionFailure(),
    new ApiFailure(401, 'invalid_mobile_session'),
    new ApiFailure(403, 'forbidden'),
    new ApiFailure(500, 'server_error'),
    new ApiFailure(404, 'event_unavailable'),
  ]) {
    await assert.rejects(
      checkCapabilities(async () => {
        throw error
      }),
      (actual) => actual === error,
    )
  }
})

test('connection failures hide raw host details and recover on the next successful request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw Error('fetch failed: java.net.ConnectException: /10.0.2.2:55341')
  })
  await assert.rejects(
    jsonRequest('https://institution.test/v1/institution/context', {}),
    (error) => {
      assert.ok(error instanceof ConnectionFailure)
      assert.equal(
        failureText(error),
        'Could not reach your institution. Check your connection and try again.',
      )
      assert.doesNotMatch(failureText(error), /java|10\.0|55341/)
      assert.notEqual(translate('ar', failureText(error)), failureText(error))
      return true
    },
  )
  fetch.mock.mockImplementation(async (_url, init) => {
    assert.equal(init?.credentials, 'omit')
    assert.equal(init?.redirect, 'error')
    assert.ok(init?.signal instanceof AbortSignal)
    return new Response(JSON.stringify({ contexts: [] }))
  })
  assert.deepEqual(await jsonRequest('https://institution.test/v1/institution/context', {}), {
    contexts: [],
  })
})

test('server denial and malformed data remain distinct from connection failure', async (t) => {
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }),
  )
  await assert.rejects(
    jsonRequest('https://institution.test/v1/institution/context', {}),
    (error) => {
      assert.ok(error instanceof ApiFailure)
      assert.equal(error.status, 403)
      assert.match(failureText(error), /permission/)
      return true
    },
  )
  fetch.mock.mockImplementation(async () => new Response('not json'))
  await assert.rejects(
    jsonRequest('https://institution.test/v1/institution/context', {}),
    /invalid response/,
  )
  const interrupted = Response.json({})
  t.mock.method(interrupted, 'json', async () => {
    throw new TypeError('connection ended while reading')
  })
  fetch.mock.mockImplementation(async () => interrupted)
  await assert.rejects(
    jsonRequest('https://institution.test/v1/institution/context', {}),
    ConnectionFailure,
  )
})

test('sign-in and throttling errors have actionable English and Arabic messages', () => {
  for (const [status, code] of [
    [401, 'invalid_credentials'],
    [429, 'rate_limited'],
  ] as const) {
    const message = failureText(new ApiFailure(status, code))
    assert.doesNotMatch(message, /rejected this request|invalid_credentials|rate_limited/)
    assert.notEqual(translate('ar', message), message)
  }
})

test('instance entry keeps HTTPS and local forwarding boundaries with readable validation', () => {
  assert.equal(instanceUrl(' https://institution.test/api/ '), 'https://institution.test/api')
  assert.equal(instanceUrl('http://127.0.0.1:55331'), 'http://127.0.0.1:55331')
  assert.equal(instanceUrl('http://10.0.2.2:55331'), 'http://10.0.2.2:55331')
  for (const value of [
    'institution.test',
    'https://u:p@institution.test/api',
    'https://institution.test/api?token=secret',
    'https://institution.test/api#fragment',
  ])
    assert.throws(() => instanceUrl(value), /Enter your institution HTTPS API URL/)
  assert.throws(() => instanceUrl('http://192.168.1.3:55331'), /Remote institutions require HTTPS/)
})

test('access changes preserve saved work selection but leave removed empty institutions', () => {
  assert.equal(selectedInstitution('old', [{ institution_id: 'new' }], []), 'new')
  assert.equal(selectedInstitution('old', [], []), '')
  assert.equal(selectedInstitution('old', [{ institution_id: 'new' }], ['old']), 'old')
  assert.equal(selectedInstitution('old', [], ['old']), 'old')
  assert.equal(selectedInstitution('', [], ['saved']), 'saved')
})
