import type { AxisSpec } from './axisLayout'
import type { Rect } from './geometry'
import type { ChartConfig } from '../../core/types'

export function verticalAxisLabelPlacement(side: 'left' | 'right' | undefined, size: number, gap: number, tickLength: number, categoryAlignment?: ChartConfig['categoryAxisLabelAlignment']) {
  const towardPlot = categoryAlignment !== 'outer'
  return { margin: towardPlot ? gap : size + Math.max(gap, tickLength), align: towardPlot ? side === 'right' ? 'left' as const : 'right' as const : side === 'right' ? 'right' as const : 'left' as const }
}

export function horizontalCategoryLabelPlacement(side: 'top' | 'bottom' | undefined, rotation: number) {
  return rotation > 0 ? { align: side === 'top' ? 'left' as const : 'right' as const, verticalAlign: 'middle' as const } : { align: 'center' as const, verticalAlign: side === 'top' ? 'bottom' as const : 'top' as const }
}

// Other reservations can sit between the axis label rail and the plot.
export function reservedAxisLabelGap(axis: AxisSpec, plot: Rect, rail: Rect | undefined) {
  if (!rail || axis.placement.kind !== 'side') return axis.labels.gap
  const extra = axis.placement.side === 'left' ? plot.x - rail.x - rail.width
    : axis.placement.side === 'right' ? rail.x - plot.x - plot.width : 0
  return axis.labels.gap + Math.max(0, extra)
}
