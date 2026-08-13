import { describe, expect, it } from 'vitest'
import { linearRegression, sampleRegression } from './regression'

describe('native XY regression', () => {
  it.each([
    ['positive', [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }], 2],
    ['negative', [{ x: 1, y: 6 }, { x: 2, y: 4 }, { x: 3, y: 2 }], -2],
    ['horizontal', [{ x: 1, y: 3 }, { x: 2, y: 3 }], 0],
    ['constant x', [{ x: 5, y: 1 }, { x: 5, y: 9 }], 0],
    ['epoch dates', [{ x: 1_700_000_000_000, y: 1 }, { x: 1_700_086_400_000, y: 2 }], 1 / 86_400_000],
  ])('fits %s data', (_name, points, slope) => expect(linearRegression(points)?.slope).toBeCloseTo(slope))

  it('samples the current 95% mean band deterministically without mutating input', () => {
    const points = [{ x: 1, y: 2 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 9 }]
    const before = structuredClone(points), regression = linearRegression(points)!
    const samples = sampleRegression(regression, 0, 5)
    expect(samples).toHaveLength(31)
    expect(samples.every((sample) => Number.isFinite(sample.lower) && sample.upper >= sample.lower)).toBe(true)
    expect(points).toEqual(before)
    expect(sampleRegression(linearRegression([{ x: 1, y: 2 }, { x: 2, y: 4 }])!, 1, 2).every((sample) => sample.lower === sample.upper)).toBe(true)
  })
})
