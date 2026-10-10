import type { ChartConfig, DataTable } from '../../../core/types'
import { formatChartNumber } from '../../../core/numberFormat'
import { formatTimeValue, inferTimeProfile } from '../../../core/timeFrequency'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { compileNativeBarScene } from '../bar/compiler'
import type { NativeBarChartScene } from '../../../entities/chart/model/ChartScene'

export function validateMarimekkoMapping(table: DataTable, config: ChartConfig) {
  const fields = config.seriesField ? [config.yFields[0] ?? config.yField] : config.yFields.length ? config.yFields : [config.yField]
  const values = table.rows.flatMap((row) => fields.map((field) => row[field])).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const errors: Array<{ field: string; message: string }> = []
  if (values.some((value) => value < 0)) errors.push({ field: 'yField', message: 'Для Marimekko нужны неотрицательные значения. Уберите отрицательные значения или выберите другой график.' })
  if (!values.some((value) => value > 0)) errors.push({ field: 'yField', message: 'Для Marimekko нужен хотя бы один положительный размер группы.' })
  return { ok: errors.length === 0, errors }
}

export function compileMarimekkoScene(table: DataTable, config: ChartConfig): NativeBarChartScene {
  const normalized = config.marimekkoMode !== 'absolute'
  const horizontal = config.barOrientation === 'horizontal'
  config = { ...config, valueMode: 'absolute', barOrientation: horizontal ? 'horizontal' : 'vertical', yAxisScaleType: 'linear', showDirectLabels: false }
  // Reuse aggregation, ordering, mark identities, colors and the Cartesian frame.
  const scene = compileNativeBarScene(table, { ...config, kind: horizontal ? 'horizontal-stacked-bar' : 'stacked-bar', valueMode: 'absolute' })
  const totals = scene.plot.categories.map((_, index) => scene.plot.series.reduce((sum, series) => sum + Math.max(0, series.marks[index]?.value ?? 0), 0))
  const indices = totals.flatMap((total, index) => total > 0 && Number.isFinite(total) ? [index] : [])
  const total = indices.reduce((sum, index) => sum + totals[index], 0)
  const values = scene.plot.categories.map((category) => category.value)
  const timeProfile = table.timeProfiles?.[config.xField] ?? inferTimeProfile(values, values) ?? undefined
  let start = 0
  const categories = indices.map((index) => {
    const end = start + totals[index] / total * 100
    const original = scene.plot.categories[index]
    const category = { ...original, label: original.value instanceof Date ? config.categoryLabelOverrides?.x?.[original.coordinate] ?? formatTimeValue(original.value, timeProfile, config.dateLabelFormat, index) : original.label, span: { start, end, total: totals[index] } }
    start = end
    return category
  })
  const series = scene.plot.series.map((series) => ({ ...series, marks: indices.map((index, categoryIndex) => {
    const mark = series.marks[index], raw = mark.value
    if (!normalized) return { ...mark, categoryIndex }
    const value = raw == null ? null : Math.max(0, raw) / totals[index] * 100
    const percent = formatChartNumber(value, { ...config, kind: 'bar', valueMode: 'percent', numberPrefix: '', numberSuffix: '', numberOperation: 'none', valueLabelAffixesLinked: true })
    return { ...mark, categoryIndex, value, displayValue: `${formatChartNumber(raw, { ...config, kind: 'bar', valueMode: 'absolute' })} · ${percent}`, label: { ...mark.label, text: config.elementStyles[mark.legacyKey]?.label || percent } }
  }) }))
  const retained = new Set([...series.flatMap((series) => series.marks.map((mark) => mark.id)), ...categories.map((category) => `category-label:${category.id}`)])
  return {
    ...scene, document: chartDocumentFromLegacy(table, config), compatibilityConfig: config,
    elements: scene.elements.filter((element) => element.role !== 'mark' && element.role !== 'category-label' || retained.has(element.id)),
    plot: { ...scene.plot, dateAxis: undefined, categoryAxis: { ...scene.plot.categoryAxis, timeScale: undefined, calendarTicks: undefined }, categories, series, stacking: normalized ? 'normalized' : 'stacked', valueDomain: normalized ? { min: 0, max: 100, step: config.yAxisStep != null && config.yAxisStep > 0 ? Math.min(100, config.yAxisStep) : 20 } : scene.plot.valueDomain, barWidth: 100, seriesGap: 0 },
  }
}
