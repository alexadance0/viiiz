import type { ChartConfig, DataTable, DataValue } from './types'
import { chartDataValueKey } from './chartData'
import { formatYAxisNumber } from './numberFormat'
import { DEFAULT_CHART_PALETTE } from '../entities/chart/model/defaults'
import { mixHexColors } from './color'
import type { GuideSpec } from '../features/chart-layout/guides/types'

export const categoryColorValue = (value: DataValue | undefined): string | null => value == null || typeof value === 'number' && !Number.isFinite(value) || String(value).trim() === '' ? null : value instanceof Date ? value.toISOString() : String(value).trim()
export function colorCategories(table: DataTable, config: ChartConfig): Array<{ value: string; label?: string; color: string }> {
  const values = [...new Set(table.rows.map((row) => categoryColorValue(row[config.colorEncoding?.field ?? ''])).filter((value): value is string => value != null))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }))
  const stored = config.colorEncoding?.categories ?? [], palette = config.palette?.length ? config.palette : DEFAULT_CHART_PALETTE
  const present = new Set(values), known = new Set(stored.map((entry) => entry.value))
  return [...stored.filter((entry) => present.has(entry.value)), ...values.flatMap((value, index) => known.has(value) ? [] : [{ value, color: palette[index % palette.length] }])]
}
export function aggregateColorValue(rows: DataTable['rows'], field: string, operation: ChartConfig['aggregation']): number | null {
  const values = rows.flatMap((row) => typeof row[field] === 'number' && Number.isFinite(row[field]) ? [row[field] as number] : [])
  if (!values.length) return null
  if (operation === 'count') return values.length
  if (operation === 'sum') return values.reduce((sum, value) => sum + value, 0)
  if (operation === 'average') return values.reduce((sum, value) => sum + value, 0) / values.length
  if (operation === 'min') return values.reduce((a, b) => Math.min(a, b))
  if (operation === 'max') return values.reduce((a, b) => Math.max(a, b))
  return values[0]
}
export function defaultColorThresholds(table: DataTable, field: string) {
  const values = table.rows.flatMap((row) => typeof row[field] === 'number' && Number.isFinite(row[field]) ? [row[field] as number] : [])
  if (!values.length) return [0]
  const min = values.reduce((a, b) => Math.min(a, b)), max = values.reduce((a, b) => Math.max(a, b))
  return min === max ? [min] : [...new Set([1, 2, 3].map((part) => Number((min + (max - min) * part / 4).toPrecision(6))))]
}
export interface EncodedColor { color: string; label: string; pattern?: 'diagonal'; missing: boolean; conflict: boolean }
export function intervalPalette(colors: readonly string[], count: number) {
  const palette = colors.length ? colors : DEFAULT_CHART_PALETTE
  return Array.from({ length: count }, (_, i) => {
    const position = i * (palette.length - 1) / Math.max(1, count - 1), lower = Math.floor(position)
    return mixHexColors(palette[lower], palette[Math.min(palette.length - 1, lower + 1)], position - lower)
  })
}
export function createColorEncoding(table: DataTable, config: ChartConfig) {
  const encoding = config.colorEncoding, categories = encoding?.mode === 'categories' ? colorCategories(table, config) : [], byValue = new Map(categories.map((entry) => [entry.value, entry]))
  const thresholds = encoding?.thresholds?.length ? encoding.thresholds : encoding?.mode === 'bins' ? defaultColorThresholds(table, encoding?.field ?? config.yField) : [0]
  const palette = config.palette?.length ? config.palette : DEFAULT_CHART_PALETTE
  const missingColor = encoding?.missingColor ?? config.heatmapMissingColor ?? '#e8e7eb', missingLabel = encoding?.missingLabel?.trim() || 'Нет данных'
  const pattern = encoding?.missingPattern === 'diagonal' ? 'diagonal' as const : undefined
  const binPalette = intervalPalette(palette, thresholds.length + 1)
  let missing = false, conflict = false
  let dataMin = Infinity, dataMax = -Infinity
  const used = new Set<string>()
  const missingResult = (ambiguous = false): EncodedColor => { if (ambiguous) conflict = true; else missing = true; return { color: missingColor, label: ambiguous ? 'Несколько категорий' : missingLabel, pattern, missing: !ambiguous, conflict: ambiguous } }
  const binLabel = (index: number) => encoding?.binLabels?.[index]?.trim() || (index === 0 ? `Менее ${formatYAxisNumber(thresholds[0], config)}` : index === thresholds.length ? `${formatYAxisNumber(thresholds[index - 1], config)} и более` : `${formatYAxisNumber(thresholds[index - 1], config)} – < ${formatYAxisNumber(thresholds[index], config)}`)
  const bins = Array.from({ length: thresholds.length + 1 }, (_, index) => ({ id: `bin:${index}`, label: binLabel(index), color: encoding?.binColors?.[index] ?? binPalette[index] }))
  return {
    categories, thresholds, bins,
    resolve(rows: DataTable['rows'], fallback: number | null): EncodedColor {
      if (encoding?.mode === 'single') return { color: config.color, label: '', missing: false, conflict: false }
      if (encoding?.mode === 'categories') {
        const values = new Set(rows.map((row) => categoryColorValue(row[encoding.field ?? ''])))
        if (values.size > 1) return missingResult(true)
        const value = [...values][0]
        if (value == null) return missingResult()
        used.add(value)
        const entry = byValue.get(value)
        return { color: entry?.color ?? palette[0], label: entry?.label?.trim() || value, missing: false, conflict: false }
      }
      const value = encoding?.field ? aggregateColorValue(rows, encoding.field, config.aggregation) : fallback
      if (value == null || !Number.isFinite(value)) return missingResult()
      dataMin = Math.min(dataMin, value); dataMax = Math.max(dataMax, value)
      const index = thresholds.findIndex((threshold) => value < threshold), bin = index < 0 ? thresholds.length : index
      return { color: bins[bin].color, label: bins[bin].label, missing: false, conflict: false }
    },
    legend(): GuideSpec {
      if (encoding?.mode === 'bins') {
        const first = thresholds[0], last = thresholds.at(-1)!
        const lowerStep = thresholds.length > 1 ? thresholds[1] - first : Math.max(1, Math.abs(first))
        const upperStep = thresholds.length > 1 ? last - thresholds[thresholds.length - 2] : Math.max(1, Math.abs(last))
        const minimum = dataMin < first ? dataMin : first - lowerStep, maximum = dataMax > last ? dataMax : last + upperStep
        const bounds = [minimum, ...thresholds, maximum]
        const segments = bins.map((bin, index) => ({ from: bounds[index], to: bounds[index + 1], color: bin.color }))
        const intervalLabels = Boolean(encoding.binLabels?.some((label) => label?.trim()))
        const ticks = intervalLabels ? bins.map((bin, index) => ({ value: (bounds[index] + bounds[index + 1]) / 2, offset: ((bounds[index] + bounds[index + 1]) / 2 - minimum) / (maximum - minimum), label: bin.label })) : [minimum, ...thresholds].map((value, index) => ({ value, offset: (value - minimum) / (maximum - minimum), label: index === 0 && dataMin >= first ? `< ${formatYAxisNumber(first, config)}` : formatYAxisNumber(value, config) }))
        return { id: 'color-scale', kind: 'color-scale', visible: config.showLegend, position: config.legendPosition ?? 'top', coordinateSpace: 'content', minimum, maximum, colors: bins.map((bin) => bin.color), segments, ticks, intervalLabels, style: config.legendText, ...(missing ? { missing: { label: missingLabel, color: missingColor, pattern } } : {}) }
      }
      const items = encoding?.mode === 'categories' ? categories.filter((entry) => used.has(entry.value)).map((entry) => ({ id: `color:${entry.value}`, label: entry.label?.trim() || entry.value, color: entry.color })) : bins
      const extra = [ ...(missing ? [{ id: 'color:missing', label: missingLabel, color: missingColor, pattern }] : []), ...(conflict ? [{ id: 'color:conflict', label: 'Несколько категорий', color: missingColor, pattern }] : []) ]
      return { id: 'legend', kind: 'categorical-legend', visible: config.showLegend && encoding?.mode !== 'single', position: config.legendPosition ?? 'top', coordinateSpace: 'content', items: [...items, ...extra].map((item) => ({ ...item, visible: true, target: { kind: 'group', seriesIds: [] } })) }
    },
  }
}
export const colorRowGroupKey = (value: DataValue, series = '') => JSON.stringify([chartDataValueKey(value), series])
export function colorRowGroups(table: DataTable, config: ChartConfig) {
  const groups = new Map<string, DataTable['rows']>()
  for (const row of table.rows) {
    const key = colorRowGroupKey(row[config.xField], config.seriesField ? String(row[config.seriesField] ?? 'Без категории') : '')
    const rows = groups.get(key) ?? []; rows.push(row); groups.set(key, rows)
  }
  return groups
}
export function validateColorEncoding(table: DataTable, config: ChartConfig) {
  const encoding = config.colorEncoding, errors: Array<{ field: string; message: string }> = []
  if (encoding?.mode === 'categories' && !table.columns.includes(encoding.field ?? '') || encoding?.mode === 'bins' && encoding.field && !table.columns.includes(encoding.field)) errors.push({ field: 'colorEncoding', message: 'Выберите существующую колонку для цвета.' })
  const thresholds = encoding?.thresholds
  if (encoding?.mode === 'bins' && thresholds && (thresholds.length > 12 || thresholds.some((value, i) => !Number.isFinite(value) || i > 0 && value <= thresholds[i - 1]))) errors.push({ field: 'colorEncoding', message: 'Границы цветовых интервалов должны быть конечными числами по возрастанию.' })
  return errors
}
