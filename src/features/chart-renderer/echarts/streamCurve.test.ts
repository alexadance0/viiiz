import { describe, expect, it } from 'vitest'
import { monotoneTangents, streamBoundaryTangents } from './streamCurve'

const cubic = (a: number, b: number, c: number, d: number, t: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d

describe('stream curves', () => {
  it('keeps densely sampled straight slopes straight instead of flattening at every sample', () => {
    const x = Array.from({ length: 60 }, (_, i) => i)
    expect(monotoneTangents(x, x.map((value) => value * 2 + 10))).toEqual(x.map(() => 2))
    expect(monotoneTangents([0], [10])).toEqual([0])
    expect(monotoneTangents([0, 1, 2], [0, 5, 0])).toEqual([5, 0, -5])
  })

  it('retains samples and nonnegative ribbon thickness, including zeros and irregular intervals', () => {
    const x = [0, 1, 3, 4, 10, 11]
    const a = [0, 10, .01, 0, 20, 2], b = [10, 0, 5, 30, .001, 1]
    const base = [0, -2, 20, -10, 50, 2]
    const bands = [a.map((value, i) => ({ lower: base[i], upper: base[i] + value })), b.map((value, i) => ({ lower: base[i] + a[i], upper: base[i] + a[i] + value }))]
    const slopes = streamBoundaryTangents(x, bands)
    for (let i = 0; i < x.length - 1; i++) {
      const delta = (x[i + 1] - x[i]) / 3
      for (let layer = 0; layer < bands.length; layer++) {
        const points = bands[layer]
        for (let step = 0; step <= 100; step++) {
          const t = step / 100
          const lower = cubic(points[i].lower, points[i].lower + delta * slopes[layer][i], points[i + 1].lower - delta * slopes[layer][i + 1], points[i + 1].lower, t)
          const upper = cubic(points[i].upper, points[i].upper + delta * slopes[layer + 1][i], points[i + 1].upper - delta * slopes[layer + 1][i + 1], points[i + 1].upper, t)
          const thickness = upper - lower
          expect(thickness).toBeGreaterThanOrEqual(Math.min(points[i].upper - points[i].lower, points[i + 1].upper - points[i + 1].lower) - 1e-9)
          expect(thickness).toBeLessThanOrEqual(Math.max(points[i].upper - points[i].lower, points[i + 1].upper - points[i + 1].lower) + 1e-9)
        }
      }
    }
  })
})
