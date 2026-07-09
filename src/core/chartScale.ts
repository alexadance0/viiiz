import { prepareChartData } from './chartData'
import type { ChartConfig, DataTable } from './types'
import { isNormalizedStackedChart } from './chartKinds'

export const axisValue = (value?: string) => {
  const parsed = value?.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export const dateValue = (value?: string) => {
  const parsed = value ? new Date(`${value}T00:00:00`).getTime() : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export const orderedBounds = (min?: number | null, max?: number | null): [number | undefined, number | undefined] =>
  min != null && max != null && min > max ? [max, min] : [min ?? undefined, max ?? undefined]

const applyCategoryRange = (prepared: ReturnType<typeof prepareChartData>, config: ChartConfig) => {
  const dateAxis = prepared.categories.some((value) => value instanceof Date)
  const [min, max] = orderedBounds(
    dateAxis ? dateValue(config.xAxisMin) : axisValue(config.xAxisMin),
    dateAxis ? dateValue(config.xAxisMax) : axisValue(config.xAxisMax),
  )
  if (min == null && max == null) return prepared
  const indices = prepared.categories.flatMap((value, index) => {
    const numeric = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) && (min == null || numeric >= min) && (max == null || numeric <= max) ? [index] : []
  })
  return {
    categories: indices.map((index) => prepared.categories[index]),
    series: prepared.series.map((series) => ({ ...series, data: indices.map((index) => series.data[index]) })),
  }
}

const orderSeries = <T extends { name: string }>(series: T[], order?: string[]) => {
  if (!order?.length) return series
  const positions = new Map(order.map((name, index) => [name, index]))
  return [...series].sort((left, right) =>
    (positions.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.name) ?? Number.MAX_SAFE_INTEGER))
}

export const prepareVisibleChartData = (table: DataTable, config: ChartConfig) => {
  const source = prepareChartData(table, isNormalizedStackedChart(config.kind) ? { ...config, valueMode: 'absolute' } : config)
  if (isNormalizedStackedChart(config.kind)) {
    source.categories.forEach((_, categoryIndex) => {
      const positive = source.series.reduce((sum, series) => sum + Math.max(0, series.data[categoryIndex] ?? 0), 0)
      const negative = source.series.reduce((sum, series) => sum + Math.abs(Math.min(0, series.data[categoryIndex] ?? 0)), 0)
      source.series.forEach((series) => {
        const value = series.data[categoryIndex]
        series.data[categoryIndex] = value == null ? null : value >= 0 ? positive ? value / positive * 100 : 0 : negative ? value / negative * 100 : 0
      })
    })
  }
  const prepared = applyCategoryRange(source, config)
  return { ...prepared, series: orderSeries(prepared.series, config.seriesOrder) }
}

export const niceNumericScale = (values: Array<number | null>, includeZero = false) => {
  let dataMin = Number.POSITIVE_INFINITY
  let dataMax = Number.NEGATIVE_INFINITY
  values.forEach((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (value < dataMin) dataMin = value
    if (value > dataMax) dataMax = value
  })
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) return { min: 0, max: 1, step: .2 }
  if (includeZero) {
    dataMin = Math.min(0, dataMin)
    dataMax = Math.max(0, dataMax)
  }
  const magnitude = Math.max(Math.abs(dataMin), Math.abs(dataMax), 1)
  const range = dataMax - dataMin || magnitude * .2
  const roughStep = range / 5
  const power = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / power
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = factor * power
  let min = Math.floor((dataMin - (includeZero && dataMin === 0 ? 0 : step * .15)) / step) * step
  let max = Math.ceil((dataMax + (includeZero && dataMax === 0 ? 0 : step * .15)) / step) * step
  if (dataMin === 0) min = 0
  if (dataMax === 0) max = 0
  if (includeZero) {
    if (dataMin >= 0) min = 0
    if (dataMax <= 0) max = 0
  }
  if (min === max) max = min + step
  const precision = Math.max(0, -Math.floor(Math.log10(step)) + 2)
  const clean = (value: number) => Number(value.toFixed(precision))
  return { min: clean(min), max: clean(max), step: clean(step) }
}
