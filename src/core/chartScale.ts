import { prepareChartData } from './chartData'
import type { ChartConfig, DataTable, DataValue } from './types'
import { isBarChart, isNormalizedStackedChart } from './chartKinds'

export const axisValue = (value?: string) => {
  const parsed = value?.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export const dateValue = (value?: string) => {
  const parsed = value ? new Date(`${value}T00:00:00`).getTime() : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export const slopePositionKey = (value: DataValue) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value ?? '')}`

export const orderedBounds = (min?: number | null, max?: number | null): [number | undefined, number | undefined] =>
  min != null && max != null && min > max ? [max, min] : [min ?? undefined, max ?? undefined]

const applyCategoryRange = (prepared: ReturnType<typeof prepareChartData>, config: ChartConfig) => {
  const dateAxis = prepared.categories.some((value) => value instanceof Date)
  const [min, max] = orderedBounds(
    dateAxis ? dateValue(config.xAxisMin) : axisValue(config.xAxisMin),
    dateAxis ? dateValue(config.xAxisMax) : axisValue(config.xAxisMax),
  )
  const selectedSlopePositions = config.kind === 'slope' && config.slopeXValues?.length === 2 ? new Set(config.slopeXValues) : null
  if (min == null && max == null && !selectedSlopePositions) return prepared
  const indices = prepared.categories.flatMap((value, index) => {
    const numeric = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Number(value)
    const inRange = min == null && max == null || Number.isFinite(numeric) && (min == null || numeric >= min) && (max == null || numeric <= max)
    return inRange && (!selectedSlopePositions || selectedSlopePositions.has(slopePositionKey(value))) ? [index] : []
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

const sortBarCategories = (prepared: ReturnType<typeof prepareChartData>, config: ChartConfig) => {
  const mode = config.barCategorySort ?? 'none'
  if (!isBarChart(config.kind) || mode === 'none' || prepared.categories.some((category) => category instanceof Date || typeof category === 'number')) return prepared
  const selected = prepared.series.find((series) => series.name === config.barCategorySortSeries)
  const indices = prepared.categories.map((_, index) => index)
  indices.sort((left, right) => {
    if (mode === 'name-asc' || mode === 'name-desc') {
      const result = String(prepared.categories[left] ?? '').localeCompare(String(prepared.categories[right] ?? ''), 'ru', { numeric: true, sensitivity: 'base' })
      return mode === 'name-desc' ? -result : result
    }
    const value = (index: number) => selected ? selected.data[index] : prepared.series.reduce((sum, series) => sum + (series.data[index] ?? 0), 0)
    const leftValue = value(left), rightValue = value(right)
    if (leftValue == null) return rightValue == null ? left - right : 1
    if (rightValue == null) return -1
    const result = leftValue - rightValue
    return result ? mode === 'value-desc' ? -result : result : left - right
  })
  return {
    categories: indices.map((index) => prepared.categories[index]),
    series: prepared.series.map((series) => ({ ...series, data: indices.map((index) => series.data[index]) })),
  }
}

export const prepareVisibleChartData = (table: DataTable, config: ChartConfig) => {
  const source = prepareChartData(table, isNormalizedStackedChart(config.kind) ? { ...config, valueMode: 'absolute' } : config)
  const prepared = sortBarCategories(applyCategoryRange(source, config), config)
  if (isNormalizedStackedChart(config.kind)) {
    prepared.categories.forEach((_, categoryIndex) => {
      const positive = prepared.series.reduce((sum, series) => sum + Math.max(0, series.data[categoryIndex] ?? 0), 0)
      const negative = prepared.series.reduce((sum, series) => sum + Math.abs(Math.min(0, series.data[categoryIndex] ?? 0)), 0)
      prepared.series.forEach((series) => {
        const value = series.data[categoryIndex]
        series.data[categoryIndex] = value == null ? null : value >= 0 ? positive ? value / positive * 100 : 0 : negative ? value / negative * 100 : 0
      })
    })
  }
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
