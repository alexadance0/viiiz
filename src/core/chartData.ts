import type { ChartConfig, DataTable, DataValue } from './types'
import { chartUsesAggregation } from './chartKinds'

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

export const chartDataValueKey = (value: DataValue) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value)}`
export function repeatedChartCategories(table: DataTable, config: ChartConfig) {
  if (!chartUsesAggregation(config.kind)) return []
  const fields = config.seriesField ? [config.yFields[0] ?? config.yField] : [...new Set(config.yFields.length ? config.yFields : [config.yField])]
  const counts = new Map<string, number>(), repeated = new Map<string, DataValue>()
  table.rows.forEach((row) => {
    const category = row[config.xField], categoryKey = chartDataValueKey(category)
    const series = config.seriesField ? String(row[config.seriesField] ?? 'Без категории') : ''
    fields.forEach((field) => {
      if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) return
      const key = `${categoryKey}\u001f${series}\u001f${field}`
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      if (count > 1) repeated.set(categoryKey, category)
    })
  })
  return [...repeated.values()]
}
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
  if (config.kind === 'seasonal-line') {
    const valueField = config.yFields[0] ?? config.yField
    const datedRows = table.rows.flatMap((row) => row[config.xField] instanceof Date ? [{ row, date: row[config.xField] as Date }] : [])
    const years = [...new Set(datedRows.map(({ date }) => date.getFullYear()))].sort((left, right) => left - right)
    const values = new Map(years.map((year) => [year, Array.from({ length: 12 }, () => [] as number[])]))
    datedRows.forEach(({ row, date }) => { const value = row[valueField]; if (typeof value === 'number' && Number.isFinite(value)) values.get(date.getFullYear())![date.getMonth()].push(value) })
    const categories = Array.from({ length: 12 }, (_, month) => new Date(2000, month, 1))
    const series = years.map((year) => ({ name: String(year), data: values.get(year)!.map((monthValues) => aggregate(monthValues, config.aggregation)) }))
    if (config.missingMode === 'zero') series.forEach((item) => { item.data = item.data.map((value) => value ?? 0) })
    return { categories, series }
  }
  const categoryMap = new Map<string, DataValue>()
  table.rows.forEach((row) => categoryMap.set(chartDataValueKey(row[config.xField]), row[config.xField]))
  const categories = [...categoryMap.values()].sort((left, right) => {
    if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
    return typeof left === 'number' && typeof right === 'number' ? left - right : 0
  })
  const categoryKeys = categories.map(chartDataValueKey)
  const fields = [...new Set(config.yFields.length ? config.yFields : [config.yField])]
  const definitions = config.seriesField
    ? [...new Set(table.rows.map((row) => String(row[config.seriesField] ?? 'Без категории')))].map((name) => ({ name, field: config.yFields[0] ?? config.yField, seriesValue: name }))
    : fields.map((field) => ({ name: field, field, seriesValue: '' }))
  const valuesBySeries = new Map(definitions.map((definition) => [definition.name, new Map<string, number[]>()]))
  const definitionsByValue = config.seriesField ? new Map(definitions.map((definition) => [definition.seriesValue, definition])) : null
  table.rows.forEach((row) => {
    const categoryKey = chartDataValueKey(row[config.xField])
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
  if (config.kind === 'indexed-line') {
    const baseIndex = categoryKeys.indexOf(config.indexBaseXValue ?? '')
    series.forEach((item) => {
      const base = item.data[baseIndex]
      item.data = typeof base === 'number' && Number.isFinite(base) && base !== 0
        ? item.data.map((value) => typeof value === 'number' && Number.isFinite(value) ? value / base * 100 : null)
        : item.data.map(() => null)
    })
  }
  return { categories, series }
}
