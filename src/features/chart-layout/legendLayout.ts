import { measureTextWidth, wrapMeasuredText } from '../../core/textMetrics'
import type { ChartTextStyle } from '../../core/types'
import type { Rect } from './geometry'

export const legendItemWidth = (label: string, style: ChartTextStyle, markerRail = 64) => Math.max(0, ...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight))) + markerRail

export function sideLegendWidth(labels: string[], style: ChartTextStyle, content: Rect) {
  const natural = Math.max(90, ...labels.map((label) => legendItemWidth(label, style)))
  return Math.ceil(Math.min(natural, Math.max(90, content.width - 160)))
}

export function legendLabelText(label: string, style: ChartTextStyle, rail: Rect | undefined, position: string | undefined) {
  if (!rail || position !== 'left' && position !== 'right') return label
  return wrapMeasuredText(label, style.size, Math.max(1, rail.width - 64), style.fontFamily, style.weight, false).text
}
