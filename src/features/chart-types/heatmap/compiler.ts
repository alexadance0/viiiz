import { contrastText, mixHexColors } from '../../../core/color'
import { planCategoryDateLabels } from '../../../core/chartDateAxis'
import { formatChartNumber, formatYAxisNumber } from '../../../core/numberFormat'
import type { ChartConfig, DataTable } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { ChartElement } from '../../../entities/chart/model/ChartElement'
import type { HeatmapCellScene, NativeHeatmapChartScene } from '../../../entities/chart/model/ChartScene'
import type { GuideSpec } from '../../chart-layout/guides/types'
import { compileNativeBarScene } from '../bar/compiler'
import { categoryLabelPlan } from '../line/compiler'

function normalizedDomain(values: number[], config: ChartConfig) {
  const dataMin = values.length ? Math.min(...values) : 0, dataMax = values.length ? Math.max(...values) : 1
  const diverging = (config.heatmapScaleMode ?? 'diverging') === 'diverging', midpoint = config.heatmapMidpoint ?? 0
  const distance = Math.max(Math.abs(dataMin - midpoint), Math.abs(dataMax - midpoint), 1)
  const automaticMin = diverging ? midpoint - distance : dataMin, automaticMax = diverging ? midpoint + distance : dataMax === dataMin ? dataMin + 1 : dataMax
  const requestedMin = config.heatmapScaleMin != null && Number.isFinite(config.heatmapScaleMin) ? config.heatmapScaleMin : undefined
  const requestedMax = config.heatmapScaleMax != null && Number.isFinite(config.heatmapScaleMax) ? config.heatmapScaleMax : undefined
  let min = requestedMin ?? automaticMin, max = requestedMax ?? automaticMax
  if (max <= min) {
    if (requestedMin != null && requestedMax == null) max = min + 1
    else if (requestedMax != null && requestedMin == null) min = max - 1
    else if (requestedMin != null && requestedMax != null && requestedMin !== requestedMax) [min, max] = [max, min]
    else { min = automaticMin; max = automaticMax }
  }
  const colorMidpoint = Math.max(min, Math.min(max, midpoint))
  return { min, max, midpoint: colorMidpoint, midpointRatio: (colorMidpoint - min) / (max - min), diverging }
}

export function compileNativeHeatmapScene(table: DataTable, sourceConfig: ChartConfig): NativeHeatmapChartScene {
  if (sourceConfig.kind !== 'heatmap') throw new Error(`Native heatmap compiler cannot compile ${sourceConfig.kind}.`)
  const base = compileNativeBarScene(table, { ...sourceConfig, kind: 'bar', seriesField: '', showLegend: false, showDirectLabels: false })
  const values = base.plot.categories.map((item) => item.value)
  const planned = categoryLabelPlan(values, planCategoryDateLabels(values, table, sourceConfig), sourceConfig).labels
  const categories = base.plot.categories.map((category, index) => ({ ...category, label: planned[index] ?? category.label }))
  const metric = (values: Array<number | null>) => {
    const finite = values.filter((value): value is number => value != null && Number.isFinite(value))
    if (!finite.length) return Number.NEGATIVE_INFINITY
    if (sourceConfig.heatmapRowSort === 'min') return Math.min(...finite)
    if (sourceConfig.heatmapRowSort === 'max') return Math.max(...finite)
    if (sourceConfig.heatmapRowSort === 'last') return finite.at(-1)!
    return finite.reduce((sum, value) => sum + value, 0) / finite.length
  }
  const ordered = base.plot.series.map((series, index) => ({ series, index }))
  if ((sourceConfig.heatmapRowSort ?? 'none') !== 'none') ordered.sort((left, right) => ((metric(left.series.marks.map((mark) => mark.value)) - metric(right.series.marks.map((mark) => mark.value))) * (sourceConfig.heatmapRowSortDirection === 'ascending' ? 1 : -1)) || left.index - right.index)
  const numericValues = ordered.flatMap(({ series }) => series.marks.flatMap((mark) => mark.value != null && Number.isFinite(mark.value) ? [mark.value] : []))
  const domain = normalizedDomain(numericValues, sourceConfig)
  const low = sourceConfig.heatmapLowColor ?? '#2c6aa8', middle = sourceConfig.heatmapMidColor ?? '#f5f5f2', high = sourceConfig.heatmapHighColor ?? '#c83e4d'
  const missingColor = sourceConfig.heatmapMissingColor ?? '#e8e7eb', missingLabel = sourceConfig.heatmapMissingLabel ?? '—'
  const color = (value: number) => domain.diverging
    ? value <= domain.midpoint ? mixHexColors(low, middle, (value - domain.min) / Math.max(Number.EPSILON, domain.midpoint - domain.min)) : mixHexColors(middle, high, (value - domain.midpoint) / Math.max(Number.EPSILON, domain.max - domain.midpoint))
    : mixHexColors(low, high, (value - domain.min) / (domain.max - domain.min))
  const rows = ordered.map(({ series }, rowIndex) => ({
    id: series.id,
    name: series.name,
    cells: series.marks.map((mark, columnIndex): HeatmapCellScene => {
      const fill = mark.value == null ? missingColor : color(mark.value)
      return { id: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, legacyKey: mark.legacyKey, rowIndex, columnIndex, value: mark.value, displayCategory: `${categories[columnIndex]?.label ?? ''} · ${series.name}`, displayValue: mark.value == null ? missingLabel : formatChartNumber(mark.value, sourceConfig), color: sourceConfig.elementStyles[mark.legacyKey]?.color ?? fill, label: { visible: sourceConfig.elementStyles[mark.legacyKey]?.showLabel ?? sourceConfig.showValues, text: sourceConfig.elementStyles[mark.legacyKey]?.label || (mark.value == null ? missingLabel : formatChartNumber(mark.value, sourceConfig)), style: sourceConfig.elementStyles[mark.legacyKey]?.valueText ?? sourceConfig.valueText, color: sourceConfig.valueLabelAutoContrast ?? true ? contrastText(sourceConfig.elementStyles[mark.legacyKey]?.color ?? fill) : sourceConfig.valueText.color } }
    }),
  }))
  const rowAxis = { ...base.plot.valueAxis, id: 'row', channel: 'lane' as const, orientation: 'vertical' as const, placement: { kind: 'side' as const, side: sourceConfig.yAxisPosition }, labels: { ...base.plot.valueAxis.labels, style: sourceConfig.yAxisLabelText ?? sourceConfig.axisLabelText }, title: { ...base.plot.valueAxis.title!, visible: sourceConfig.showYAxisTitle, text: sourceConfig.yAxisTitle, style: sourceConfig.yAxisTitleText ?? sourceConfig.axisTitleText } }
  const position = sourceConfig.heatmapScalePosition ?? 'right'
  const stops = domain.diverging ? [{ offset: 0, color: low }, { offset: domain.midpointRatio, color: middle }, { offset: 1, color: high }] : [{ offset: 0, color: low }, { offset: 1, color: high }]
  const ticks = [[0, domain.min], [domain.diverging ? domain.midpointRatio : .5, domain.diverging ? domain.midpoint : (domain.min + domain.max) / 2], [1, domain.max]].map(([offset, value]) => ({ offset, value, label: formatYAxisNumber(value, sourceConfig) }))
  const guides: GuideSpec[] = [{ id: 'color-scale', kind: 'color-scale', visible: sourceConfig.heatmapShowScale ?? true, coordinateSpace: 'content', position, minimum: domain.min, maximum: domain.max, colors: stops.map((stop) => stop.color), stops, ticks, style: sourceConfig.legendText }]
  const elements: ChartElement[] = [
    ...rows.flatMap((row) => row.cells.map((cell): ChartElement => ({ id: cell.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: cell.seriesId, datumId: cell.datumId, legacyKey: cell.legacyKey }))),
    ...categories.map((category): ChartElement => ({ id: `category-label:${category.id}`, role: 'category-label', coordinateSpace: 'canvas', selectable: true, axisId: 'category', datumId: category.id, text: category.label })),
  ]
  return { document: chartDocumentFromLegacy(table, sourceConfig), compatibilityConfig: sourceConfig, frameElements: base.frameElements, elements, guides, plot: { kind: 'heatmap', categories, rows, categoryAxis: base.plot.categoryAxis, rowAxis, colorDomain: domain, cellGap: sourceConfig.heatmapCellGap ?? 1 } }
}
