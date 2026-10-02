import { prepareChartData, chartDataValueKey, repeatedChartCategories } from '../../../core/chartData'
import { isPieChart } from '../../../core/chartKinds'
import { contrastText } from '../../../core/color'
import { formatChartNumber } from '../../../core/numberFormat'
import { getSeriesColor } from '../../../core/seriesColor'
import type { ChartConfig, DataTable } from '../../../core/types'
import { aggregateDatumId, markElementId, seriesId } from '../../../entities/chart/model/ChartElement'
import type { NativePieChartScene } from '../../../entities/chart/model/ChartScene'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'

export function validateNativePieMapping(table: DataTable, config: ChartConfig) {
  const chartName = config.kind === 'waffle' ? 'Вафельная диаграмма' : 'Круговая диаграмма'
  const errors: Array<{ field: string; message: string }> = []
  if (!table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку с категориями.' })
  const values = table.rows.map((row) => row[config.yField]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!table.columns.includes(config.yField) || !values.some((value) => value > 0)) errors.push({ field: 'yField', message: `${chartName}: выберите показатель с положительными значениями.` })
  if (values.some((value) => value < 0)) errors.push({ field: 'yField', message: `${chartName} не поддерживает отрицательные значения. Выберите другой показатель или тип графика.` })
  if (config.aggregation === 'none' && repeatedChartCategories(table, { ...config, yFields: [config.yField], seriesField: '' }).length) errors.push({ field: 'aggregation', message: 'Для повторяющихся категорий выберите способ агрегации.' })
  return { ok: !errors.length, errors }
}

export function compileCompositionScene(table: DataTable, config: ChartConfig): NativePieChartScene {
  const validation = validateNativePieMapping(table, config)
  if (!validation.ok) throw new Error(validation.errors.map((error) => error.message).join(' '))
  // Shares aggregation with other charts; percentages here are shares of the entire pie.
  const prepared = prepareChartData(table, { ...config, yFields: [config.yField], seriesField: '', valueMode: 'absolute', missingMode: 'gap' })
  const source = prepared.categories.map((category, index) => ({ category, value: prepared.series[0]?.data[index] ?? 0, name: category instanceof Date ? category.toLocaleDateString('ru-RU') : String(category ?? 'Без категории'), index })).filter((item) => item.value > 0)
  const positions = new Map((config.seriesOrder ?? []).map((name, index) => [name, index]))
  source.sort((left, right) => (positions.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.name) ?? Number.MAX_SAFE_INTEGER))
  const total = source.reduce((sum, item) => sum + item.value, 0)
  const labelPosition = config.pieLabelPosition ?? 'outside'
  const slices = source.map(({ category, name, value, index }) => {
    const datumId = aggregateDatumId(category, config.yField), sliceSeriesId = seriesId(config.xField, category)
    const legacyKey = `pie:${config.yField}\u001f${chartDataValueKey(category)}`, override = config.elementStyles[legacyKey]
    const color = override?.color ?? getSeriesColor(config, name, index)
    const style = override?.valueText ?? config.valueText, percent = value / total * 100
    const absolute = formatChartNumber(value, { ...config, valueMode: 'absolute' })
    const share = formatChartNumber(percent, { ...config, valueMode: 'percent', numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', valueLabelPrefix: '', valueLabelSuffix: '', valueLabelAffixesLinked: true })
    const displayValue = config.pieValueFormat === 'absolute' ? absolute : config.pieValueFormat === 'both' ? `${absolute} (${share})` : share
    const text = override?.label ?? [config.pieShowNames !== false ? name : '', displayValue].filter(Boolean).join('\n')
    return { id: markElementId(sliceSeriesId, datumId), datumId, seriesId: sliceSeriesId, legacyKey, name, value, percent, displayValue, color, label: { visible: override?.showLabel ?? config.showValues, text, style, color: labelPosition === 'inside' && (override?.labelAutoContrast ?? config.valueLabelAutoContrast ?? true) ? contrastText(color) : style.color } }
  })
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const).filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false)).map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements: slices.map((slice) => ({ id: slice.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: slice.seriesId, datumId: slice.datumId, legacyKey: slice.legacyKey })), frameElements, guides: [{ id: 'legend', kind: 'categorical-legend', visible: config.showLegend, coordinateSpace: 'canvas', position: config.legendPosition ?? 'top', items: slices.map((slice) => ({ id: slice.name, label: config.seriesStyles[slice.name]?.legendLabel?.trim() || slice.name, visible: config.seriesStyles[slice.name]?.showLegendItem !== false, color: slice.color, target: { kind: 'series', seriesId: slice.seriesId } })) }], plot: { kind: 'pie', slices, total, innerRadius: config.kind === 'donut' ? Math.min(85, Math.max(10, config.pieInnerRadius ?? 55)) / 100 : 0, labelPosition } }
}

export function compileNativePieScene(table: DataTable, config: ChartConfig): NativePieChartScene {
  if (!isPieChart(config.kind)) throw new Error(`Pie compiler cannot compile ${config.kind}.`)
  return compileCompositionScene(table, config)
}
