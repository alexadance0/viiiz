import { describe, expect, it } from 'vitest'
import { distributionDensity } from './density'

describe('distributionDensity', () => {
  it.each([[[5]], [[2, 2, 2]], [[-4, 0, 9]], [[1e12, 1e12 + 1]], [[1, 1 + 1e-12]]])('creates a finite immutable 81-sample profile for %j', (values) => {
    const source = [...values], profile = distributionDensity(values, .14, Math.max(1e-9, Math.max(...values) - Math.min(...values)), { q1: values[0], median: values[0], q3: values.at(-1)! })
    expect(profile.samples).toHaveLength(81)
    expect(profile.samples[0].density).toBe(0)
    expect(profile.samples.at(-1)?.density).toBe(0)
    expect(profile.samples.every((sample) => Number.isFinite(sample.density) && Number.isFinite(sample.relativeDensity))).toBe(true)
    expect(profile.bandwidth).toBeGreaterThan(0)
    expect(values).toEqual(source)
  })

  it.each([.04, .14, .5])('uses the legacy bandwidth ratio %s and direct statistic kernel', (ratio) => {
    const profile = distributionDensity([0, 10], ratio, 10, { q1: 2.5, median: 5, q3: 7.5 })
    expect(profile.bandwidth).toBe(10 * ratio)
    expect(profile.minimum).toBe(-profile.bandwidth * 1.75)
    expect(profile.statisticDensity.median).toBeGreaterThan(0)
  })
})
