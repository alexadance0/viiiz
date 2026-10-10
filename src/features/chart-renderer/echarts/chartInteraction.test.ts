import { describe, expect, it } from 'vitest'
import { clickSelection, nearestPoint, sourceSeriesName } from './chartInteraction'

describe('chart selection', () => {
  const element = { key: 'A\u001f2024', seriesName: 'A', category: '2024', value: '10', color: '#202027' }
  it('selects a series first, its element second, and starts again for a different series', () => {
    expect(clickSelection(element, null)).toEqual({ kind: 'series', selection: { name: 'A', color: '#202027' } })
    expect(clickSelection(element, 'A')).toEqual({ kind: 'element', selection: element })
    expect(clickSelection(element, 'B')?.kind).toBe('series')
  })
  it('resolves hit layers to their source and never exposes other internal layers', () => {
    expect(sourceSeriesName('__hit__:A')).toBe('A')
    expect(sourceSeriesName('__bar-labels', 'A')).toBe('A')
    expect(clickSelection({ ...element, seriesName: '__hit__:A' }, 'A')?.selection).toEqual(element)
    expect(clickSelection({ ...element, seriesName: '__guide' }, null)).toBeNull()
  })
  it('finds the nearest point inside a generous hit radius without jumping to a distant point', () => {
    const points = [{ x: 100, y: 100, selection: element }, { x: 115, y: 100, selection: { ...element, key: 'B', seriesName: 'B' } }]
    expect(nearestPoint(points, 109, 105)?.seriesName).toBe('B')
    expect(nearestPoint(points, 109, 105, 'A')).toEqual(element)
    expect(nearestPoint(points, 100, 119)).toBeUndefined()
    expect(nearestPoint(points, NaN, 100)).toBeUndefined()
  })
})
