import { describe, it, expect } from 'vitest'
import { convertLoad, restoreInstitution, type LocalSession } from '../src/lib/domain'
describe('recorded weight units', () => {
  it('converts the actual weight when the display unit changes', () => {
    expect(convertLoad(8, 'kg', 'lb')).toBe(17.64)
    expect(convertLoad(22.05, 'lb', 'kg')).toBe(10)
    expect(convertLoad(0, 'kg', 'lb')).toBe(0)
  })
  it('keeps same-unit values and avoids appreciable round-trip drift', () => {
    for (const kg of [0, 1, 2.5, 8, 17.5, 50, 100]) {
      expect(convertLoad(kg, 'kg', 'kg')).toBe(kg)
      expect(
        Math.abs(convertLoad(convertLoad(kg, 'kg', 'lb'), 'lb', 'kg') - kg),
      ).toBeLessThanOrEqual(0.01)
    }
  })
})

describe('institution identity upgrade', () => {
  it('hydrates historical workout scope without changing exact pending work or its owner', () => {
    const pending = {
      id: 'operation',
      entries: [{ seconds: 25 }],
      note: 'retained',
      complete: false,
      expectedVersion: 3,
      localRevision: 2,
    }
    const row = {
      id: 'workout',
      owner: 'original-owner',
      session: { workspace_id: 'institution-id' },
      pending,
    } as unknown as LocalSession
    const payload = JSON.stringify(pending)
    const hydrated = restoreInstitution(row)!
    expect(hydrated.session.institution_id).toBe('institution-id')
    expect(hydrated.owner).toBe('original-owner')
    expect(hydrated.id).toBe('workout')
    expect(hydrated.pending).toBe(pending)
    expect(JSON.stringify(hydrated.pending)).toBe(payload)
  })
})
