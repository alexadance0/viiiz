import type { ChartConfig } from '../../core/types'

export function verticalAxisLabelPlacement(side: 'left' | 'right' | undefined, size: number, gap: number, tickLength: number, categoryAlignment?: ChartConfig['categoryAxisLabelAlignment']) {
  const towardPlot = categoryAlignment !== 'outer'
  return { margin: towardPlot ? gap : gap + size + tickLength, align: towardPlot ? side === 'right' ? 'left' as const : 'right' as const : side === 'right' ? 'right' as const : 'left' as const }
}

export function horizontalCategoryLabelPlacement(side: 'top' | 'bottom' | undefined, rotation: number) {
  return rotation > 0 ? { align: side === 'top' ? 'left' as const : 'right' as const, verticalAlign: 'middle' as const } : { align: 'center' as const, verticalAlign: side === 'top' ? 'bottom' as const : 'top' as const }
}
