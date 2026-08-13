import { describe, expect, it } from 'vitest'
import { deterministicDistributionOffset } from './jitter'

describe('distribution jitter', () => {
  it('is deterministic, bounded and preserves the legacy index seed', () => {
    expect(deterministicDistributionOffset(0, 0)).toBeCloseTo(0.594402)
    expect(deterministicDistributionOffset(4, 2)).toBe(deterministicDistributionOffset(4, 2))
    expect(Array.from({ length: 50 }, (_, index) => deterministicDistributionOffset(index, 1)).every((value) => value >= -1 && value <= 1)).toBe(true)
  })
})
