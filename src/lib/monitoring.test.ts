import { describe, expect, it } from 'vitest'
import { scrub } from './monitoring'

describe('scrub', () => {
  it('masks emails and long numbers in error text', () => {
    expect(scrub('Failed for ada@example.com on 08031234567 acct 0123456789')).toBe('Failed for [email] on [number] acct [number]')
    expect(scrub('Booking 3 of 12 failed')).toBe('Booking 3 of 12 failed')
  })
})
