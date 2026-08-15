import { describe, expect, it } from 'vitest'
import { histogramBins, histogramDomain, kdeDensity } from './frequency'

describe('Distribution frequency transforms', () => {
  it('matches legacy histogram bounds, count clamping, and final inclusive bin', () => {
    expect(histogramDomain(4, 4)).toEqual({ minimum: 3.5, maximum: 4.5 })
    expect(histogramDomain(1, 8, 20)).toEqual({ minimum: 20, maximum: 27 })
    const bins = histogramBins([0, 2, 4, 10], { minimum: 0, maximum: 10 }, 2)
    expect(bins).toHaveLength(3)
    expect(bins.map((bin) => bin.count)).toEqual([2, 1, 1])
    expect(histogramBins([1], { minimum: 0, maximum: 1 }, 500)).toHaveLength(80)
  })

  it('matches the normalized Gaussian KDE and zeroes both tail endpoints', () => {
    const result = kdeDensity([1, 2, 3], { minimum: 0, maximum: 4 }, .14, 2)
    expect(result.points).toHaveLength(121)
    expect(result.bandwidth).toBeCloseTo(.28)
    expect(result.points[0].density).toBe(0)
    expect(result.points.at(-1)?.density).toBe(0)
    expect(result.points[60].density).toBeCloseTo(0.476545, 5)
  })
})
