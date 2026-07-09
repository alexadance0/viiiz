import type { ChartConfig } from './types'
import { isNormalizedStackedChart } from './chartKinds'

export function formatChartNumber(value: unknown, config: Pick<ChartConfig, 'kind' | 'valueMode' | 'numberLocale' | 'numberDecimals' | 'numberOperation' | 'numberFactor' | 'numberGrouping' | 'numberZeroLabel'>): string {
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
  return `${formatted}${config.valueMode === 'percent' || isNormalizedStackedChart(config.kind) ? '%' : ''}`
}

export const formatXAxisNumber = (value: unknown, config: Parameters<typeof formatChartNumber>[1]) => formatChartNumber(value, { ...config, kind: isNormalizedStackedChart(config.kind) ? 'bar' : config.kind, valueMode: 'absolute' })
