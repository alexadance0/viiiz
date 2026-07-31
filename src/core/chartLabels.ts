import { isBarChart } from './chartKinds'
import type { ChartConfig } from './types'

export const valueLabelPosition = (config: ChartConfig, kind: ChartConfig['kind']) => {
  const configured = config.valueLabelPosition ?? 'auto'
  if (isBarChart(kind) && config.barOrientation === 'horizontal') return ({ auto: 'right', top: 'right', bottom: 'left', 'inside-top': 'insideRight', 'inside-center': 'inside', 'inside-bottom': 'insideLeft' } as const)[configured]
  if (configured === 'auto') return 'top'
  return ({ 'inside-top': 'insideTop', 'inside-center': 'inside', 'inside-bottom': 'insideBottom' } as const)[configured as 'inside-top' | 'inside-center' | 'inside-bottom'] ?? configured
}

export const isInsideValueLabel = (config: Pick<ChartConfig, 'valueLabelPosition'>) =>
  ['inside-top', 'inside-center', 'inside-bottom'].includes(config.valueLabelPosition ?? '')

export const absorbedBarLabelPlacement = (
  horizontal: boolean,
  start: number,
  end: number,
  category: number,
  textWidth: number,
  textHeight: number,
  padding: number,
  insidePosition: NonNullable<ChartConfig['barValueLabelInsidePosition']>,
  outsidePosition: NonNullable<ChartConfig['barValueLabelOutsidePosition']>,
  availableThickness?: number,
) => {
  const direction = end >= start ? 1 : -1
  const inside = Math.abs(end - start) >= (horizontal ? textWidth : textHeight) + padding * 2
    && (availableThickness == null || availableThickness >= (horizontal ? textHeight : textWidth) + 4)
  const position = inside ? insidePosition : outsidePosition
  if (position === 'center') return { inside, x: horizontal ? (start + end) / 2 : category, y: horizontal ? category : (start + end) / 2, align: 'center' as const, verticalAlign: 'middle' as const }
  const atEnd = position === 'end'
  const coordinate = atEnd
    ? end + direction * (inside ? -padding : padding)
    : start + direction * (inside ? padding : -padding)
  if (horizontal) {
    const align = atEnd
      ? inside ? direction > 0 ? 'right' : 'left' : direction > 0 ? 'left' : 'right'
      : inside ? direction > 0 ? 'left' : 'right' : direction > 0 ? 'right' : 'left'
    return { inside, x: coordinate, y: category, align: align as 'left' | 'right', verticalAlign: 'middle' as const }
  }
  const verticalAlign = atEnd
    ? inside ? direction > 0 ? 'bottom' : 'top' : direction > 0 ? 'top' : 'bottom'
    : inside ? direction > 0 ? 'top' : 'bottom' : direction > 0 ? 'bottom' : 'top'
  return { inside, x: category, y: coordinate, align: 'center' as const, verticalAlign: verticalAlign as 'top' | 'bottom' }
}

export const barSeriesGeometry = (band: number, config: Pick<ChartConfig, 'barWidth' | 'barSeriesGap'>, seriesCount: number, seriesIndex: number, stacked: boolean) => {
  const groupWidth = band * Math.max(.1, Math.min(1, (config.barWidth ?? 68) / 100))
  const count = stacked ? 1 : Math.max(1, seriesCount)
  const gapRatio = Math.max(-.9, (config.barSeriesGap ?? 30) / 100)
  const width = groupWidth / Math.max(.1, count + Math.max(0, count - 1) * gapRatio)
  const offset = stacked ? 0 : -groupWidth / 2 + width / 2 + seriesIndex * width * (1 + gapRatio)
  return { groupWidth, width, offset }
}

export const denseValueLabelStride = (
  horizontal: boolean,
  band: number,
  textWidth: number,
  textHeight: number,
  hideOverlap: boolean,
) => hideOverlap
  ? Math.max(1, Math.ceil(((horizontal ? textHeight : textWidth) * 1.25 + 8) / Math.max(1, band)))
  : 1

export const showDenseValueLabel = (dataIndex: number, itemCount: number, stride: number) =>
  stride <= 1 || dataIndex > 0 && (itemCount - 1 - dataIndex) % stride === 0

export const valueLabelBoxPlacement = ({
  horizontal, configured, absorption, baseline, value, category, width, height, padding, insidePosition, outsidePosition,
}: {
  horizontal: boolean
  configured: NonNullable<ChartConfig['valueLabelPosition']>
  absorption: boolean
  baseline: number
  value: number
  category: number
  width: number
  height: number
  padding: number
  insidePosition: NonNullable<ChartConfig['barValueLabelInsidePosition']>
  outsidePosition: NonNullable<ChartConfig['barValueLabelOutsidePosition']>
}) => {
  if (absorption) {
    const placement = absorbedBarLabelPlacement(horizontal, baseline, value, category, width, height, padding, insidePosition, outsidePosition)
    return {
      x: placement.x - (placement.align === 'center' ? width / 2 : placement.align === 'right' ? width : 0),
      y: placement.y - (placement.verticalAlign === 'middle' ? height / 2 : placement.verticalAlign === 'bottom' ? height : 0),
    }
  }
  const inside = configured.startsWith('inside-')
  let x = category - width / 2, y = value - height - 3
  if (horizontal) {
    x = value + 3
    y = category - height / 2
    if (inside) x = configured === 'inside-center' ? (baseline + value) / 2 - width / 2 : configured === 'inside-bottom' ? baseline + (value >= baseline ? 3 : -width - 3) : value + (value >= baseline ? -width - 3 : 3)
    else if (configured === 'bottom') x = baseline + (value >= baseline ? -width - 3 : 3)
  } else if (inside) {
    y = configured === 'inside-center' ? (baseline + value) / 2 - height / 2 : configured === 'inside-bottom' ? baseline + (value <= baseline ? -height - 3 : 3) : value + (value <= baseline ? 3 : -height - 3)
  } else if (configured === 'bottom') y = baseline + (value <= baseline ? 3 : -height - 3)
  return { x, y }
}
