import { planCategoryDateLabels } from '../../../core/chartDateAxis'
import { prepareVisibleChartData, niceNumericScale, orderedBounds } from '../../../core/chartScale'
import { formatChartNumber } from '../../../core/numberFormat'
import { formatTimeValue } from '../../../core/timeFrequency'
import type { ChartConfig, ChartKind, DataTable, DataValue } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { aggregateDatumId, markElementId, rawDatumId, seriesId, syntheticDatumId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import type { BarMarkScene, BarSeriesScene, NativeChartScene } from '../../../entities/chart/model/ChartScene'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import type { GuideSpec } from '../../chart-layout/guides/types'

export const NATIVE_BAR_KINDS = ['bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar'] as const
export type NativeBarKind = typeof NATIVE_BAR_KINDS[number]
export const isNativeBarKind = (kind: ChartKind): kind is NativeBarKind => (NATIVE_BAR_KINDS as readonly ChartKind[]).includes(kind)

const typed = (value: DataValue) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value ?? '')}`
export const legacyBarElementKey = (series: string, category: DataValue) => `${series}\u001f${category instanceof Date ? category.toISOString() : typed(category)}`
const coordinate = (value: DataValue, index: number) => value instanceof Date ? value.toISOString() : `${index}:${String(value ?? '')}`
const paletteFallback = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']
export const nativeBarSeriesColor = (config: ChartConfig, name: string, index: number) => config.seriesStyles[name]?.color ?? config.barFillColor ?? (config.palette?.length ? config.palette : [config.color, ...paletteFallback.slice(1)])[index % Math.max(1, config.palette?.length ?? paletteFallback.length)]

const stacking = (kind: NativeBarKind) => kind.includes('normalized') ? 'normalized' : kind.includes('stacked') ? 'stacked' : 'none'
const horizontal = (kind: NativeBarKind) => kind.startsWith('horizontal-')
const axis = (input: Pick<AxisSpec, 'id' | 'channel' | 'orientation' | 'placement' | 'line' | 'ticks' | 'labels' | 'title'>): AxisSpec => input

function sourceRowIndex(table: DataTable, config: ChartConfig, category: DataValue, seriesName: string) {
  return table.rows.findIndex((row) => {
    const value = row[config.xField]
    const sameCategory = value instanceof Date && category instanceof Date ? value.getTime() === category.getTime() : value === category
    return sameCategory && (!config.seriesField || String(row[config.seriesField] ?? '') === seriesName)
  })
}

export function compileNativeBarScene(table: DataTable, sourceConfig: ChartConfig): NativeChartScene {
  if (!isNativeBarKind(sourceConfig.kind)) throw new Error(`Native bar compiler cannot compile ${sourceConfig.kind}.`)
  const orientation = horizontal(sourceConfig.kind) || sourceConfig.barOrientation === 'horizontal' ? 'horizontal' : 'vertical'
  const config = orientation === 'horizontal' ? { ...sourceConfig, barOrientation: 'horizontal' as const } : sourceConfig
  const prepared = prepareVisibleChartData(table, config)
  const stack = stacking(config.kind as NativeBarKind)
  const plannedLabels = planCategoryDateLabels(prepared.categories, table, config)
  const overrideAxis = orientation === 'horizontal' ? 'y' : 'x'
  const categories = prepared.categories.map((value, index) => {
    const key = coordinate(value, index)
    return { id: syntheticDatumId('category', typed(value)), value, coordinate: key, label: config.categoryLabelOverrides?.[overrideAxis]?.[key] ?? plannedLabels[index] ?? String(value ?? '') }
  })
  const series: BarSeriesScene[] = prepared.series.map((source, seriesIndex) => {
    const id = seriesId(config.seriesField || 'measure', source.name)
    const color = nativeBarSeriesColor(config, source.name, seriesIndex)
    const seriesStyle = config.seriesStyles[source.name]
    const marks: BarMarkScene[] = source.data.map((value, categoryIndex) => {
      const category = prepared.categories[categoryIndex]
      const legacyKey = legacyBarElementKey(source.name, category)
      const override = config.elementStyles[legacyKey]
      const rowIndex = sourceRowIndex(table, config, category, source.name)
      const datumId = config.aggregation === 'none' && rowIndex >= 0 ? rawDatumId(rowIndex, source.name) : aggregateDatumId(category, source.name)
      const markColor = override?.color ?? color
      return {
        type: 'rect', id: markElementId(id, datumId), datumId, seriesId: id, legacyKey, category, categoryIndex, value,
        displayCategory: formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat),
        displayValue: value == null ? 'пропуск' : formatChartNumber(value, config),
        style: {
          color: markColor,
          opacity: override?.fillOpacity ?? seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1,
          borderColor: override?.borderColor ?? seriesStyle?.borderColor ?? config.barBorderColor ?? markColor,
          borderWidth: override?.borderWidth ?? seriesStyle?.borderWidth ?? config.barBorderWidth ?? 0,
          borderRadius: config.barBorderRadius ?? 0,
          width: override?.barWidth ?? seriesStyle?.barWidth,
        },
        label: {
          visible: override?.showLabel ?? config.showValues,
          text: override?.label || formatChartNumber(value, config),
          style: override?.valueText ?? config.valueText,
          position: config.valueLabelPosition ?? 'auto',
          autoContrast: config.valueLabelAutoContrast ?? true,
        },
      }
    })
    return { id, name: source.name, color, visible: true, marks }
  })
  const scaleValues = stack === 'none' ? series.flatMap((item) => item.marks.map((mark) => mark.value)) : categories.flatMap((_, categoryIndex) => {
    let positive = 0, negative = 0
    series.forEach((item) => { const value = item.marks[categoryIndex]?.value; if (value != null) { if (value >= 0) positive += value; else negative += value } })
    return [positive, negative]
  })
  const automatic = stack === 'normalized'
    ? { min: scaleValues.some((value) => value != null && value < 0) ? -100 : 0, max: scaleValues.some((value) => value != null && value > 0) ? 100 : 0, step: 20 }
    : niceNumericScale(scaleValues, true)
  const [configuredMin, configuredMax] = orderedBounds(config.yAxisMin, config.yAxisMax)
  const valueDomain = { min: configuredMin ?? automatic.min, max: configuredMax ?? automatic.max, step: config.yAxisStep ?? automatic.step }
  const categorySide = orientation === 'vertical' ? config.xAxisPosition : config.yAxisPosition
  const valueSide = orientation === 'vertical' ? config.yAxisPosition : config.xAxisPosition
  const categoryStyle = config.xAxisLabelText ?? config.axisLabelText
  const valueStyle = config.yAxisLabelText ?? config.axisLabelText
  const categoryTitleStyle = config.xAxisTitleText ?? config.axisTitleText
  const valueTitleStyle = config.yAxisTitleText ?? config.axisTitleText
  const categoryAxis = axis({ id: 'category', channel: 'category', orientation: orientation === 'vertical' ? 'horizontal' : 'vertical', placement: { kind: 'side', side: categorySide }, line: { visible: config.showXAxisLine }, ticks: { visible: config.showXTicks, length: config.tickLength }, labels: { visible: config.showXAxisLabels ?? true, size: 0, gap: config.xAxisLabelGap ?? 8, rotation: orientation === 'vertical' && typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0, style: categoryStyle }, title: { visible: config.showXAxisTitle, text: config.xAxisTitle, size: 0, gap: config.xAxisTitleGap, style: categoryTitleStyle } })
  const valueAxis = axis({ id: 'value', channel: 'value', orientation: orientation === 'vertical' ? 'vertical' : 'horizontal', placement: { kind: 'side', side: valueSide }, line: { visible: config.showYAxisLine }, ticks: { visible: config.showYTicks, length: config.tickLength }, labels: { visible: config.showYAxisLabels ?? true, size: 0, gap: config.yAxisLabelGap ?? 8, style: valueStyle }, title: { visible: config.showYAxisTitle, text: config.yAxisTitle, size: 0, gap: config.yAxisTitleGap, style: valueTitleStyle } })
  const guides: GuideSpec[] = [
    { id: 'legend', kind: 'categorical-legend', visible: config.showLegend && !config.showDirectLabels, coordinateSpace: 'content', position: config.legendPosition ?? 'top', items: series.map((item) => ({ seriesId: item.id, label: config.seriesStyles[item.name]?.legendLabel?.trim() || item.name })) },
    { id: 'direct-series', kind: 'direct-series', visible: Boolean(config.showDirectLabels), coordinateSpace: 'plot', side: orientation === 'vertical' && config.yAxisPosition === 'right' ? 'left' : 'right', style: config.directLabelText ?? config.legendText, leaderLines: config.showDirectLabelLines ?? false },
  ]
  const elements: ChartElement[] = [
    ...series.flatMap((item) => item.marks.map((mark): ChartElement => ({ id: mark.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: mark.seriesId, datumId: mark.datumId, legacyKey: mark.legacyKey }))),
    ...categories.map((category): ChartElement => ({ id: `category-label:${category.id}`, role: 'category-label', coordinateSpace: 'canvas', selectable: true, axisId: 'category', datumId: category.id, text: category.label })),
    ...series.map((item): ChartElement => ({ id: `legend-item:${item.id}`, role: 'legend-item', coordinateSpace: 'canvas', selectable: true, seriesId: item.id, text: item.name })),
  ]
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const)
    .filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false))
    .map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { migrationMode: 'native', document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides, frameElements, plot: { kind: 'bar', orientation, stacking: stack, categories, categoryAxis, valueAxis, valueDomain, barWidth: config.barWidth ?? 68, seriesGap: config.barSeriesGap ?? 30, series } }
}
