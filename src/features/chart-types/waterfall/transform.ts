import { formatChartNumber } from '../../../core/numberFormat'
import type { ChartConfig } from '../../../core/types'

export const waterfallSteps = (values: Array<number | null>) => {
  let running = 0
  const steps = values.map((delta) => {
    const start = running
    if (delta != null && Number.isFinite(delta)) running += delta
    return { delta, start, end: running }
  })
  return { steps, total: running }
}

export const formatWaterfallChange = (value: number, config: ChartConfig) => {
  const mode = config.waterfallSignMode ?? 'negative-only'
  if (mode === 'negative-only') return formatChartNumber(value, config)
  const unsigned = formatChartNumber(Math.abs(value), config)
  if (mode === 'none' || value === 0) return unsigned
  if (mode === 'plus-minus') return `${value > 0 ? '+' : '-'}${unsigned}`
  return `${value > 0 ? config.waterfallPositivePrefix ?? '' : config.waterfallNegativePrefix ?? ''}${unsigned}`
}

export const waterfallValueLabel = (change: number, cumulative: number, total: boolean, config: ChartConfig) => {
  if (total) return formatChartNumber(cumulative, config)
  const changeLabel = formatWaterfallChange(change, config)
  const cumulativeLabel = formatChartNumber(cumulative, config)
  return config.waterfallLabelContent === 'cumulative' ? cumulativeLabel : config.waterfallLabelContent === 'both' ? `${changeLabel} → ${cumulativeLabel}` : changeLabel
}

export const waterfallLabelPlacement = (startY: number, endY: number, barWidth: number, labelWidth: number, labelHeight: number, position: NonNullable<ChartConfig['valueLabelPosition']>, gap: number) => {
  const direction = endY <= startY ? -1 : 1
  const fits = Math.abs(startY - endY) >= labelHeight + gap * 2 && barWidth >= labelWidth + 8
  const resolved = position === 'auto' ? fits ? 'inside-center' : 'top' : position
  if (resolved === 'inside-center') return { y: (startY + endY) / 2, verticalAlign: 'middle' as const, inside: true }
  if (resolved === 'inside-top') return { y: endY - direction * gap, verticalAlign: direction < 0 ? 'top' as const : 'bottom' as const, inside: true }
  if (resolved === 'inside-bottom') return { y: startY + direction * gap, verticalAlign: direction < 0 ? 'bottom' as const : 'top' as const, inside: true }
  if (resolved === 'bottom') return { y: startY - direction * gap, verticalAlign: direction < 0 ? 'top' as const : 'bottom' as const, inside: false }
  return { y: endY + direction * gap, verticalAlign: direction < 0 ? 'bottom' as const : 'top' as const, inside: false }
}
