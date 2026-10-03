import { describe, expect, it } from 'vitest'
import { interiorAnchor, polygonDistance, rectangleInsidePolygon } from './labelPlacement'

describe('map label anchors', () => {
  it('chooses interior space in a concave mainland instead of its bounding-box center or an island', () => {
    const mainland = [[[0, 0], [100, 0], [100, 20], [20, 20], [20, 80], [100, 80], [100, 100], [0, 100], [0, 0]]]
    const island = [[[200, 0], [205, 0], [205, 5], [200, 5], [200, 0]]]
    const anchor = interiorAnchor([mainland, island])
    expect(polygonDistance([50, 50], mainland)).toBeLessThan(0)
    expect(anchor.radius).toBeGreaterThan(10)
    expect(polygonDistance(anchor.center, mainland)).toBeGreaterThan(0)
    expect(rectangleInsidePolygon(anchor.center, 12, 12, mainland)).toBe(true)
    expect(rectangleInsidePolygon([50, 10], 30, 30, mainland)).toBe(false)
  })

  it('avoids lakes and rejects a text rectangle that covers a hole even with its corners on land', () => {
    const polygon = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], [[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]]
    const anchor = interiorAnchor([polygon])
    expect(anchor.radius).toBeGreaterThan(20)
    expect(polygonDistance(anchor.center, polygon)).toBeGreaterThan(0)
    expect(rectangleInsidePolygon(anchor.center, 20, 20, polygon)).toBe(true)
    expect(rectangleInsidePolygon([50, 50], 60, 60, polygon)).toBe(false)
  })
})
