import { describe, expect, it } from 'vitest'
import { clampNumber, normalizeNumberDraft } from './NumberInput'

describe('NumberInput helpers', () => {
  it('normalizes leading zeroes without changing fractional values', () => {
    expect(normalizeNumberDraft('003')).toEqual({ draft: '3', value: 3 })
    expect(normalizeNumberDraft('-07')).toEqual({ draft: '-7', value: -7 })
    expect(normalizeNumberDraft('0.5')).toEqual({ draft: '0.5', value: .5 })
  })

  it('keeps incomplete values as drafts until blur', () => {
    expect(normalizeNumberDraft('')).toBeNull()
    expect(normalizeNumberDraft('-')).toBeNull()
  })

  it('clamps values to the supplied bounds', () => {
    expect(clampNumber(-1, '0', '10')).toBe(0)
    expect(clampNumber(12, '0', '10')).toBe(10)
    expect(clampNumber(1.5, '0', '10')).toBe(1.5)
  })
})
