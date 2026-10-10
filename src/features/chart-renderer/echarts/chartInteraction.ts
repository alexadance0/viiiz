import type { ChartElementSelection } from '../../../core/types'

export function sourceSeriesName(rendererName: string | undefined, sourceName?: string) {
  const name = sourceName ?? rendererName?.replace(/^__hit__:/, '')
  return name && !name.startsWith('__') ? name : null
}

export function clickSelection(element: ChartElementSelection, selectedSeries: string | null) {
  const name = sourceSeriesName(element.seriesName)
  if (!name) return null
  return selectedSeries !== name
    ? { kind: 'series' as const, selection: { name, color: element.color ?? '' } }
    : { kind: 'element' as const, selection: { ...element, seriesName: name } }
}

export type PointHit = { x: number; y: number; markerSize?: number; selection: ChartElementSelection }

export function nearestPoint(points: PointHit[], x: number, y: number, seriesName?: string | null, radius = 18) {
  let nearest: PointHit | undefined, distance = radius
  for (const point of points) {
    if (seriesName && point.selection.seriesName !== seriesName) continue
    const next = Math.hypot(point.x - x, point.y - y)
    if (next <= distance) { nearest = point; distance = next }
  }
  return nearest?.selection
}
