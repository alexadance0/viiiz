import { measureTextWidth } from '../../core/textMetrics'
import type { ChartTextStyle } from '../../core/types'
import type { Rect } from './geometry'

export const legendItemWidth = (label: string, style: ChartTextStyle, markerRail = 38) => measureTextWidth(label, style.size, style.fontFamily, style.weight) + markerRail

export function sideLegendWidth(labels: string[], style: ChartTextStyle, content: Rect) {
  const natural = Math.max(90, ...labels.map((label) => legendItemWidth(label, style)))
  return Math.ceil(Math.min(natural, Math.max(90, content.width - 160)))
}

export function constrainedLegendTextStyle<T extends object>(style: T, rail: Rect | undefined, side: boolean, markerRail = 38) {
  return side && rail ? { ...style, width: Math.max(24, rail.width - markerRail), overflow: 'truncate', ellipsis: '…' } : style
}
