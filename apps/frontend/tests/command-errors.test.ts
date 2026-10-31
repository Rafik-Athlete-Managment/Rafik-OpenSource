import { describe, it, expect } from 'vitest'
import { commandRejected } from '../src/lib/command-errors'
describe('command delivery classification', () => {
  it('distinguishes rejected commands from unknown delivery', () => {
    expect(commandRejected({ statusCode: 400, message: 'invalid_context' })).toBe(true)
    expect(commandRejected({ statusCode: 503, message: 'service_unavailable' })).toBe(false)
    expect(commandRejected(new Error('offline'))).toBe(false)
  })
})
