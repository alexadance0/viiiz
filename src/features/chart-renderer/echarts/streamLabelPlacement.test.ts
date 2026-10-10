import { describe, expect, it } from 'vitest'
import { placeStreamLabel, type StreamLabelSegment } from './streamLabelPlacement'

const plot = { x: 0, y: 0, width: 200, height: 100 }
const flat: StreamLabelSegment = { left: 0, right: 200, top: [10, 10, 10, 10], bottom: [90, 90, 90, 90] }

describe('stream label placement', () => {
  it('centers a label in a flat ribbon and stays inside the clipped plot', () => {
    expect(placeStreamLabel([flat], 40, 20, plot)).toEqual({ x: 100, y: 50, clearance: 52 })
    expect(placeStreamLabel([flat], 40, 20, { ...plot, x: 50, width: 100, y: 20, height: 60 })).toEqual({ x: 100, y: 50, clearance: 32 })
  })
  it('finds room where a historical stream is thick, away from its thin endpoint', () => {
    const segments: StreamLabelSegment[] = [
      { left: 0, right: 100, top: [10, 10, 10, 10], bottom: [90, 90, 90, 90] },
      { left: 100, right: 200, top: [10, 23, 36, 49], bottom: [90, 77, 64, 51] },
    ]
    const label = placeStreamLabel(segments, 50, 20, plot)!
    expect(label.x).toBeLessThanOrEqual(71)
    expect(label.y).toBe(50)
  })
  it('hides labels that are too wide, too tall, or have no continuous area', () => {
    expect(placeStreamLabel([flat], 200, 20, plot)).toBeUndefined()
    expect(placeStreamLabel([flat], 40, 80, plot)).toBeUndefined()
    expect(placeStreamLabel([], 40, 20, plot)).toBeUndefined()
  })
  it('checks the whole text width even when the ribbon is thick at its peak', () => {
    const narrowPeak: StreamLabelSegment[] = [
      { left: 0, right: 100, top: [49, 36, 23, 10], bottom: [51, 64, 77, 90] },
      { left: 100, right: 200, top: [10, 23, 36, 49], bottom: [90, 77, 64, 51] },
    ]
    expect(placeStreamLabel(narrowPeak, 150, 30, plot)).toBeUndefined()
    expect(placeStreamLabel(narrowPeak, 40, 20, plot)).toBeDefined()
  })
  it('checks cubic extrema between data points', () => {
    const curved: StreamLabelSegment = { ...flat, top: [10, 100, 100, 10] }
    expect(placeStreamLabel([curved], 180, 20, plot)).toBeUndefined()
    expect(placeStreamLabel([{ ...flat, bottom: [90, 0, 0, 90] }], 180, 20, plot)).toBeUndefined()
  })
  it('keeps the anchor inside a thin ribbon when a silhouette allows overflow', () => {
    const thin: StreamLabelSegment = { ...flat, top: [48, 48, 48, 48], bottom: [52, 52, 52, 52] }
    expect(placeStreamLabel([thin], 40, 20, plot)).toBeUndefined()
    expect(placeStreamLabel([thin], 40, 20, plot, true)).toMatchObject({ y: 50, overflow: true })
    expect(placeStreamLabel([flat], 40, 20, plot, true)?.overflow).toBeUndefined()
  })
  it('does not place a silhouette on empty streams or beyond the canvas', () => {
    expect(placeStreamLabel([{ ...flat, bottom: flat.top }], 40, 20, plot, true)).toBeUndefined()
    expect(placeStreamLabel([flat], 200, 20, plot, true)).toBeUndefined()
    expect(placeStreamLabel([flat], 40, 100, plot, true)).toBeUndefined()
  })
})
