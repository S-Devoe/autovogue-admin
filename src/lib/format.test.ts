import { describe, expect, it } from 'vitest'
import { age, bps, naira, timeLeft, titleCase } from './format'

describe('naira', () => {
  it('formats kobo as naira with two decimals', () => {
    expect(naira(1250000)).toMatch(/12,500\.00/)
    expect(naira(0)).toMatch(/0\.00/)
  })
  it('shows a dash for missing values', () => {
    expect(naira(null)).toBe('-')
    expect(naira(undefined)).toBe('-')
  })
})

describe('time helpers', () => {
  it('formats ages compactly', () => {
    const now = new Date('2026-11-07T12:00:00Z')
    expect(age('2026-11-07T11:55:00Z', now)).toBe('5m')
    expect(age('2026-11-07T09:48:00Z', now)).toBe('2h 12m')
    expect(age('2026-11-05T08:00:00Z', now)).toBe('2d 4h')
  })
  it('says time left or over', () => {
    expect(timeLeft(3 * 3600 + 600)).toBe('3h 10m left')
    expect(timeLeft(-7200)).toBe('2h 0m over')
  })
  it('formats basis points as percent', () => {
    expect(bps(1000)).toBe('10.00%')
  })
})

describe('titleCase', () => {
  it('formats enum values and never throws on odd input', () => {
    expect(titleCase('PENDING_PAYMENT')).toBe('Pending Payment')
    expect(titleCase(null)).toBe('')
    expect(titleCase({ valid: true } as unknown)).toBe('[Object Object]')
  })
})
