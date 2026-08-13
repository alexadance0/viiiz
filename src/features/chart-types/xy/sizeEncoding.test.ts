import { describe, expect, it } from 'vitest'
import { encodeBubbleDiameter, niceSizeGuideValue, normalizeSizeRange } from './sizeEncoding'

describe('native bubble size encoding', () => {
  it('preserves sqrt-absolute mapping and safely orders the diameter range', () => {
    const range = normalizeSizeRange(42, 6)
    const input = { ...range, maximumMagnitude: 100, missingDiameter: 10 }
    expect(range).toEqual({ minimumDiameter: 6, maximumDiameter: 42 })
    expect(encodeBubbleDiameter(0, input)).toBe(6)
    expect(encodeBubbleDiameter(100, input)).toBe(42)
    expect(encodeBubbleDiameter(-25, input)).toBe(24)
    expect(encodeBubbleDiameter(undefined, input)).toBe(10)
    expect(encodeBubbleDiameter(Number.NaN, input)).toBe(10)
    expect(encodeBubbleDiameter(Number.POSITIVE_INFINITY, input)).toBe(10)
  })

  it('handles zero/equal domains and preserves guide parity', () => {
    expect(encodeBubbleDiameter(0, { minimumDiameter: 4, maximumDiameter: 20, maximumMagnitude: 0, missingDiameter: 8 })).toBe(4)
    expect(encodeBubbleDiameter(7, { minimumDiameter: 4, maximumDiameter: 20, maximumMagnitude: 7, missingDiameter: 8 })).toBe(20)
    expect(niceSizeGuideValue(987)).toBe(700)
    expect(niceSizeGuideValue(0)).toBe(0)
  })
})
