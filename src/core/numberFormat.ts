import type { ChartConfig } from './types'
import { isNormalizedStackedChart } from './chartKinds'

type NumberFormatConfig = Pick<ChartConfig, 'kind' | 'valueMode' | 'numberLocale' | 'numberDecimals' | 'numberOperation' | 'numberFactor' | 'numberGrouping' | 'numberZeroLabel' | 'numberPrefix' | 'numberSuffix' | 'yAxisAffixScope' | 'xAxisNumberPrefix' | 'xAxisNumberSuffix' | 'xAxisAffixScope' | 'valueLabelAffixesLinked' | 'valueLabelPrefix' | 'valueLabelSuffix' | 'xAxisStartLabel' | 'xAxisEndLabel'>
export type AxisTickPosition = 'first' | 'middle' | 'last'

export const axisAffixApplies = (scope: ChartConfig['yAxisAffixScope'], position?: AxisTickPosition) =>
  position == null || scope == null || scope === 'all' || scope === 'edges' && position !== 'middle' || scope === position

const formatNumber = (value: unknown, config: NumberFormatConfig, prefix: string, suffix: string): string => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return String(value ?? '')
  if (numeric === 0 && config.numberZeroLabel != null && config.numberZeroLabel !== '') return config.numberZeroLabel
  const factor = Number.isFinite(config.numberFactor) && Number(config.numberFactor) !== 0 ? Math.abs(Number(config.numberFactor)) : 1
  const scaled = config.numberOperation === 'divide' ? numeric / factor : config.numberOperation === 'multiply' ? numeric * factor : numeric
  const decimals = config.numberDecimals
  const options: Intl.NumberFormatOptions = {
    notation: 'standard',
    useGrouping: config.numberGrouping ?? true,
    maximumFractionDigits: decimals == null ? 2 : decimals,
    minimumFractionDigits: decimals == null ? 0 : decimals,
  }
  const formatted = new Intl.NumberFormat(config.numberLocale ?? 'ru-RU', options).format(scaled)
  const percent = config.valueMode === 'percent' || isNormalizedStackedChart(config.kind) ? '%' : ''
  return `${prefix}${formatted}${percent}${suffix}`
}

export const formatYAxisNumber = (value: unknown, config: NumberFormatConfig, position?: AxisTickPosition) => {
  const show = axisAffixApplies(config.yAxisAffixScope, position)
  return formatNumber(value, config, show ? config.numberPrefix ?? '' : '', show ? config.numberSuffix ?? '' : '')
}

export const formatChartNumber = (value: unknown, config: NumberFormatConfig) =>
  config.valueLabelAffixesLinked === false
    ? formatNumber(value, config, config.valueLabelPrefix ?? '', config.valueLabelSuffix ?? '')
    : formatYAxisNumber(value, config)

export const formatXAxisNumber = (value: unknown, config: NumberFormatConfig, position?: AxisTickPosition) => {
  const show = axisAffixApplies(config.xAxisAffixScope, position)
  return formatNumber(value, {
    ...config,
    kind: isNormalizedStackedChart(config.kind) ? 'bar' : config.kind,
    valueMode: 'absolute',
    numberOperation: 'none',
    numberFactor: 1,
  }, show ? config.xAxisNumberPrefix ?? '' : '', show ? config.xAxisNumberSuffix ?? config.xAxisEndLabel ?? config.xAxisStartLabel ?? '' : '')
}
