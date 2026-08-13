import { describe, expect, it } from 'vitest'
import { distributionQuantile, distributionStatistics } from './statistics'

describe('distribution statistics', () => {
  it('preserves interpolated quartiles, mean and 1.5 IQR outliers without mutation', () => {
    const input = [1, 2, 2, 3, 100].map((value, index) => ({ value, datumId: `d${index}` }))
    const before = structuredClone(input), result = distributionStatistics(input)
    expect(result).toEqual({ count: 5, minimumInlier: 1, q1: 2, median: 2, mean: 21.6, q3: 3, maximumInlier: 3, outlierDatumIds: ['d4'] })
    expect(input).toEqual(before)
    expect(distributionQuantile([1, 3], .25)).toBe(1.5)
    expect(distributionStatistics([{ value: -2, datumId: 'a' }])).toMatchObject({ q1: -2, median: -2, mean: -2, q3: -2 })
  })
})
