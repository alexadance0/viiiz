import type { ChartConfig, DataTable, DataValue } from './types'
import { isLineLikeChart } from './chartKinds'

export function segmentEndpointIndex(pixels: number[], pointerX: number) {
  if (pixels.length < 2) return 0
  const direction = pixels.at(-1)! >= pixels[0] ? 1 : -1
  const target = pointerX * direction
  if (target < pixels[0] * direction) return 0
  if (target > pixels.at(-1)! * direction) return pixels.length - 1
  let low = 1, high = pixels.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (pixels[middle] * direction >= target) high = middle
    else low = middle + 1
  }
  return low
}

export function nearestPixelIndex(pixels: number[], pointerX: number) {
  if (!pixels.length) return 0
  if (pixels.length === 1) return 0
  const right = segmentEndpointIndex(pixels, pointerX)
  if (right === 0) return 0
  const left = right - 1
  return Math.abs(pointerX - pixels[left]) <= Math.abs(pointerX - pixels[right]) ? left : right
}

export interface PreparedSeries { name: string; data: Array<number | null> }
export interface PreparedChartData { categories: DataValue[]; series: PreparedSeries[] }

const keyOf = (value: DataValue) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value)}`
const aggregate = (values: number[], operation: ChartConfig['aggregation']): number | null => {
  if (!values.length) return null
  if (operation === 'count') return values.length
  if (operation === 'sum') return values.reduce((sum, value) => sum + value, 0)
  if (operation === 'average') return values.reduce((sum, value) => sum + value, 0) / values.length
  if (operation === 'min') return values.reduce((result, value) => value < result ? value : result, Number.POSITIVE_INFINITY)
  if (operation === 'max') return values.reduce((result, value) => value > result ? value : result, Number.NEGATIVE_INFINITY)
  return values[0]
}

export function prepareChartData(table: DataTable, config: ChartConfig): PreparedChartData {
  const categoryMap = new Map<string, DataValue>()
  table.rows.forEach((row) => categoryMap.set(keyOf(row[config.xField]), row[config.xField]))
  const categories = [...categoryMap.values()].sort((left, right) => {
    if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
    return isLineLikeChart(config.kind) && typeof left === 'number' && typeof right === 'number' ? left - right : 0
  })
  const categoryKeys = categories.map(keyOf)
  const fields = [...new Set(config.yFields.length ? config.yFields : [config.yField])]
  const definitions = config.seriesField
    ? [...new Set(table.rows.map((row) => String(row[config.seriesField] ?? 'Без категории')))].map((name) => ({ name, field: config.yFields[0] ?? config.yField, seriesValue: name }))
    : fields.map((field) => ({ name: field, field, seriesValue: '' }))
  const valuesBySeries = new Map(definitions.map((definition) => [definition.name, new Map<string, number[]>()]))
  const definitionsByValue = config.seriesField ? new Map(definitions.map((definition) => [definition.seriesValue, definition])) : null
  table.rows.forEach((row) => {
    const categoryKey = keyOf(row[config.xField])
    const targets = definitionsByValue ? [definitionsByValue.get(String(row[config.seriesField] ?? 'Без категории'))].filter((item): item is (typeof definitions)[number] => Boolean(item)) : definitions
    targets.forEach((definition) => {
      const value = row[definition.field]
      if (typeof value !== 'number' || !Number.isFinite(value)) return
      const buckets = valuesBySeries.get(definition.name)!
      const values = buckets.get(categoryKey)
      if (values) values.push(value)
      else buckets.set(categoryKey, [value])
    })
  })
  const series = definitions.map((definition) => {
    const buckets = valuesBySeries.get(definition.name)!
    return { name: definition.name, data: categoryKeys.map((categoryKey) => aggregate(buckets.get(categoryKey) ?? [], config.aggregation)) }
  })
  if (config.valueMode === 'percent') {
    categoryKeys.forEach((_, index) => {
      const total = series.reduce((sum, item) => sum + (item.data[index] ?? 0), 0)
      series.forEach((item) => { item.data[index] = total ? (item.data[index] ?? 0) / total * 100 : null })
    })
  }
  if (config.missingMode === 'zero') series.forEach((item) => { item.data = item.data.map((value) => value ?? 0) })
  return { categories, series }
}
