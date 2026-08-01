import { effectiveDateStepUnit, moveDateContextToVisibleLabels, planCategoryDateLabels } from '../../../core/chartDateAxis'
import { niceNumericScale, orderedBounds, prepareVisibleChartData } from '../../../core/chartScale'
import { formatChartNumber } from '../../../core/numberFormat'
import { formatTimeValue } from '../../../core/timeFrequency'
import { isoWeekParts } from '../../../core/timeFrequency'
import type { ChartConfig, ChartKind, DataTable, DataValue } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { aggregateDatumId, markElementId, rawDatumId, seriesId, syntheticDatumId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import type { AreaSeriesScene, CartesianAreaPlotScene, CartesianLinePlotScene, CartesianPointScene, LineSegmentScene, LineSeriesScene, NativeChartScene, NativeLineChartScene } from '../../../entities/chart/model/ChartScene'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import type { GuideSpec } from '../../chart-layout/guides/types'

export const NATIVE_LINE_KINDS = ['line', 'spline', 'step-line'] as const
export const NATIVE_AREA_KINDS = ['area', 'stacked-area', 'normalized-stacked-area'] as const
export type NativeLineKind = typeof NATIVE_LINE_KINDS[number]
export type NativeAreaKind = typeof NATIVE_AREA_KINDS[number]
export type NativePointKind = NativeLineKind | NativeAreaKind
export const isNativeLineKind = (kind: ChartKind): kind is NativeLineKind => (NATIVE_LINE_KINDS as readonly ChartKind[]).includes(kind)
export const isNativeAreaKind = (kind: ChartKind): kind is NativeAreaKind => (NATIVE_AREA_KINDS as readonly ChartKind[]).includes(kind)
export const isNativePointKind = (kind: ChartKind): kind is NativePointKind => isNativeLineKind(kind) || isNativeAreaKind(kind)

const paletteFallback = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']
const seriesColor = (config: ChartConfig, name: string, index: number) => config.seriesStyles[name]?.color ?? (config.palette?.length ? config.palette : [config.color, ...paletteFallback.slice(1)])[index % Math.max(1, config.palette?.length ?? paletteFallback.length)]
const typed = (value: DataValue) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value ?? '')}`
export const legacyPointElementKey = (series: string, category: DataValue) => `${series}\u001f${category instanceof Date ? category.toISOString() : typed(category)}`
const coordinate = (value: DataValue, index: number) => value instanceof Date ? value.toISOString() : `${index}:${String(value ?? '')}`
const axis = (input: Pick<AxisSpec, 'id' | 'channel' | 'orientation' | 'placement' | 'line' | 'ticks' | 'labels' | 'title'>): AxisSpec => input

function sourceRowIndex(table: DataTable, config: ChartConfig, category: DataValue, seriesName: string) {
  return table.rows.findIndex((row) => {
    const value = row[config.xField]
    const sameCategory = value instanceof Date && category instanceof Date ? value.getTime() === category.getTime() : value === category
    return sameCategory && (!config.seriesField || String(row[config.seriesField] ?? '') === seriesName)
  })
}

const interpolation = (kind: NativePointKind, config: ChartConfig) => kind === 'spline' ? 'spline' as const : kind === 'step-line' ? config.stepPosition === 'start' ? 'step-start' as const : 'step-end' as const : 'linear' as const
const stacking = (kind: NativeAreaKind) => kind === 'normalized-stacked-area' ? 'normalized' as const : kind === 'stacked-area' ? 'stacked' as const : 'none' as const

function categoryLabelPlan(values: DataValue[], labels: string[], config: ChartConfig) {
  const dateCategories = values.some((value) => value instanceof Date)
  const calendarStep = dateCategories && effectiveDateStepUnit(config)
  const categoricalText = values.length > 0 && values.every((value) => typeof value === 'string' || typeof value === 'boolean' || value == null)
  const anchorTime = config.dateAxisAnchor ? new Date(`${config.dateAxisAnchor}T00:00:00`).getTime() : Number.NaN
  const anchorIndex = Number.isFinite(anchorTime) ? values.findIndex((value) => value instanceof Date && value.getTime() >= anchorTime) : -1
  const requestedStep = Math.max(1, Math.round(config.xAxisStep ?? 1))
  const requestedLabels = labels.filter((label, index) => label && (calendarStep || anchorIndex >= 0 ? index >= anchorIndex && (index - anchorIndex) % requestedStep === 0 : config.xAxisStep == null || index % requestedStep === 0))
  const widest = (label: string) => Math.max(0, ...label.split('\n').map((line) => line.length))
  const available = Math.max(80, (config.canvasWidth ?? 1000) - (config.canvasMarginLeft ?? 32) - (config.canvasMarginRight ?? 24) - 50)
  const slot = available / Math.max(1, requestedLabels.length)
  const longest = requestedLabels.reduce((result, label) => Math.max(result, widest(label)), 0)
  const baseSize = (config.xAxisLabelText ?? config.axisLabelText).size
  const fitted = longest ? Math.floor((slot - 5) / (longest * .58)) : baseSize
  const fontSize = dateCategories && (config.xAxisStep != null || anchorIndex >= 0) ? Math.max(8, Math.min(baseSize, fitted)) : baseSize
  const labelWidth = longest * fontSize * .58
  const rotation = typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : categoricalText && labelWidth > slot * .92 ? 90 : dateCategories && (config.xAxisStep != null || anchorIndex >= 0) && labelWidth > slot * 1.08 ? 45 : 0
  const visibleIndices = labels.flatMap((label, index) => label ? [index] : [])
  const minimumGap = visibleIndices.slice(1).reduce((gap, index, position) => Math.min(gap, index - visibleIndices[position]), Number.POSITIVE_INFINITY)
  const naturalGap = Number.isFinite(minimumGap) ? minimumGap : Math.max(1, values.length)
  const step = available / Math.max(1, values.length)
  const longestWidth = labels.reduce((width, label) => Math.max(width, widest(label) * baseSize * .58), 0)
  const automaticStride = Math.max(1, Math.ceil((longestWidth + 10) / Math.max(1, step * naturalGap)))
  const weekly = config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat?.startsWith('year-week-')
  const automaticVisible = new Set(visibleIndices.filter((index, ordinal) => ordinal % automaticStride === 0 || weekly && values[index] instanceof Date && isoWeekParts(values[index] as Date).week === 1))
  const visible = (index: number) => Boolean(labels[index])
  const anchored = (index: number) => index >= anchorIndex && (index - anchorIndex) % requestedStep === 0
  const interval: 'auto' | number | ((index: number) => boolean) = categoricalText && config.xAxisStep == null ? 0 : calendarStep ? config.xAxisStep == null && anchorIndex < 0 ? (index) => automaticVisible.has(index) : visible : anchorIndex >= 0 ? anchored : config.xAxisStep == null ? dateCategories ? automaticStride - 1 : 'auto' : requestedStep - 1
  const displayed = typeof interval === 'function' ? interval : typeof interval === 'number' ? (index: number) => index % (interval + 1) === 0 : () => true
  return { labels: moveDateContextToVisibleLabels(labels, values, config.dateLabelFormat, displayed), interval, fontSize, rotation, hideOverlap: categoricalText || dateCategories ? false : config.xAxisStep == null && anchorIndex < 0, showMaxLabel: categoricalText || config.xAxisAffixScope != null && config.xAxisAffixScope !== 'all' ? true : undefined }
}

export function compileNativePointScene(table: DataTable, config: ChartConfig, kind: NativePointKind): NativeChartScene {
  const prepared = prepareVisibleChartData(table, config)
  const initialLabels = planCategoryDateLabels(prepared.categories, table, config).map((label, index) => {
    const value = prepared.categories[index], key = coordinate(value, index)
    return config.categoryLabelOverrides?.x?.[key] ?? label
  })
  const planned = categoryLabelPlan(prepared.categories, initialLabels, config)
  const categories = prepared.categories.map((value, index) => {
    const key = coordinate(value, index)
    return { id: syntheticDatumId('category', typed(value)), value, coordinate: key, label: planned.labels[index] ?? String(value ?? '') }
  })
  const area = isNativeAreaKind(kind)
  const series = prepared.series.map((source, seriesIndex): LineSeriesScene | AreaSeriesScene => {
    const id = seriesId(config.seriesField || 'measure', source.name)
    const color = seriesColor(config, source.name, seriesIndex)
    const style = config.seriesStyles[source.name]
    const stroke = { color, width: style?.lineWidth ?? 3, type: style?.lineType ?? 'solid' as const, opacity: 1 }
    const marker = { visible: style?.showMarker ?? false, shape: style?.markerShape ?? 'circle' as const, size: style?.markerSize ?? 8, fill: style?.markerFill ?? '#ffffff', stroke: style?.markerBorder ?? color, strokeWidth: style?.markerBorderWidth ?? 2 }
    const points: CartesianPointScene[] = source.data.map((value, categoryIndex) => {
      const category = prepared.categories[categoryIndex]
      const legacyKey = legacyPointElementKey(source.name, category)
      const override = config.elementStyles[legacyKey]
      const rowIndex = sourceRowIndex(table, config, category, source.name)
      const datumId = config.aggregation === 'none' && rowIndex >= 0 ? rawDatumId(rowIndex, source.name) : aggregateDatumId(category, source.name)
      return {
        type: 'point', id: markElementId(id, datumId), datumId, seriesId: id, legacyKey, category, categoryIndex, value,
        displayCategory: formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat),
        displayValue: value == null ? 'пропуск' : formatChartNumber(value, config),
        marker: {
          visible: override?.showMarker ?? marker.visible,
          shape: override?.markerShape ?? marker.shape,
          size: override?.markerSize ?? marker.size,
          fill: override?.markerFill ?? marker.fill,
          stroke: override?.markerBorder ?? override?.color ?? marker.stroke,
          strokeWidth: override?.markerBorderWidth ?? marker.strokeWidth,
        },
        label: { visible: override?.showLabel ?? config.showValues, text: override?.label || formatChartNumber(value, config), style: override?.valueText ?? config.valueText, position: config.valueLabelPosition ?? 'auto' },
      }
    })
    if (area) return { id, name: source.name, color, visible: true, interpolation: 'linear', missing: config.missingMode, stroke, marker, points, fill: { color, opacity: style?.fillOpacity ?? config.areaFillOpacity ?? .32 } }
    const valid = points.flatMap((point, index) => point.value == null ? [] : [index])
    const segments: LineSegmentScene[] = valid.slice(1).flatMap((right, pairIndex) => {
      if (kind === 'spline') return []
      const left = valid[pairIndex]
      if (config.missingMode !== 'connect' && right !== left + 1) return []
      const rightOverride = config.elementStyles[points[right].legacyKey]
      const firstOverride = left === 0 ? config.elementStyles[points[left].legacyKey] : undefined
      const candidate = rightOverride ?? firstOverride
      const customized = candidate && (candidate.color != null || candidate.lineWidth != null || candidate.lineType != null)
      if (!customized) return []
      const segmentDatum = syntheticDatumId('segment', `${points[left].datumId}:${points[right].datumId}`)
      return [{ id: markElementId(id, segmentDatum), from: points[left].datumId, to: points[right].datumId, fromIndex: left, toIndex: right, stroke: { color: candidate.color ?? stroke.color, width: candidate.lineWidth ?? stroke.width, type: candidate.lineType ?? stroke.type, opacity: 1 } }]
    })
    return { id, name: source.name, color, visible: true, interpolation: interpolation(kind, config), missing: config.missingMode, stroke: { ...stroke, opacity: segments.length ? 0 : 1 }, marker, points, segments }
  })
  const stack = area ? stacking(kind as NativeAreaKind) : 'none'
  const scaleValues = stack === 'none' ? series.flatMap((item) => item.points.map((point) => point.value)) : categories.flatMap((_, categoryIndex) => {
    let positive = 0, negative = 0
    series.forEach((item) => { const value = item.points[categoryIndex]?.value; if (value != null) { if (value >= 0) positive += value; else negative += value } })
    return [positive, negative]
  })
  const automatic = stack === 'normalized' ? { min: scaleValues.some((value) => value != null && value < 0) ? -100 : 0, max: scaleValues.some((value) => value != null && value > 0) ? 100 : 0, step: 20 } : niceNumericScale(scaleValues, area)
  const positives = scaleValues.filter((value): value is number => value != null && value > 0)
  const logMin = 10 ** Math.floor(Math.log10(positives.length ? Math.min(...positives) : 1))
  const logMaxBase = 10 ** Math.ceil(Math.log10(positives.length ? Math.max(...positives) : 10))
  const logMax = logMaxBase <= logMin ? logMin * 10 : logMaxBase
  const [configuredMin, configuredMax] = orderedBounds(config.yAxisMin, config.yAxisMax)
  const valueDomain = config.yAxisScaleType === 'log'
    ? { min: configuredMin != null && configuredMin > 0 ? configuredMin : logMin, max: configuredMax != null && configuredMax > (configuredMin != null && configuredMin > 0 ? configuredMin : logMin) ? configuredMax : logMax, step: config.yAxisStep ?? automatic.step }
    : { min: configuredMin ?? automatic.min, max: configuredMax ?? automatic.max, step: config.yAxisStep ?? automatic.step }
  const categoryStyle = config.xAxisLabelText ?? config.axisLabelText, valueStyle = config.yAxisLabelText ?? config.axisLabelText
  const categoryAxis = axis({ id: 'category', channel: 'category', orientation: 'horizontal', placement: { kind: 'side', side: config.xAxisPosition }, line: { visible: config.showXAxisLine }, ticks: { visible: config.showXTicks, length: config.tickLength }, labels: { visible: config.showXAxisLabels ?? true, size: 0, gap: config.xAxisLabelGap ?? 8, rotation: planned.rotation, style: { ...categoryStyle, size: planned.fontSize } }, title: { visible: config.showXAxisTitle, text: config.xAxisTitle, size: 0, gap: config.xAxisTitleGap, style: config.xAxisTitleText ?? config.axisTitleText } })
  const valueAxis = axis({ id: 'value', channel: 'value', orientation: 'vertical', placement: { kind: 'side', side: config.yAxisPosition }, line: { visible: config.showYAxisLine }, ticks: { visible: config.showYTicks, length: config.tickLength }, labels: { visible: config.showYAxisLabels ?? true, size: 0, gap: config.yAxisLabelGap ?? 8, style: valueStyle }, title: { visible: config.showYAxisTitle, text: config.yAxisTitle, size: 0, gap: config.yAxisTitleGap, style: config.yAxisTitleText ?? config.axisTitleText } })
  const guides: GuideSpec[] = [
    { id: 'legend', kind: 'categorical-legend', visible: config.showLegend && !config.showDirectLabels, coordinateSpace: 'content', position: config.legendPosition ?? 'top', items: series.map((item) => ({ seriesId: item.id, label: config.seriesStyles[item.name]?.legendLabel?.trim() || item.name })) },
    { id: 'direct-series', kind: 'direct-series', visible: Boolean(config.showDirectLabels), coordinateSpace: 'plot', side: config.yAxisPosition === 'right' ? 'left' : 'right', style: config.directLabelText ?? config.legendText, leaderLines: config.showDirectLabelLines ?? false },
  ]
  const elements: ChartElement[] = [
    ...series.flatMap((item) => item.points.map((point): ChartElement => ({ id: point.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: point.seriesId, datumId: point.datumId, legacyKey: point.legacyKey }))),
    ...categories.map((category): ChartElement => ({ id: `category-label:${category.id}`, role: 'category-label', coordinateSpace: 'canvas', selectable: true, axisId: 'category', datumId: category.id, text: category.label })),
    ...series.map((item): ChartElement => ({ id: `legend-item:${item.id}`, role: 'legend-item', coordinateSpace: 'canvas', selectable: true, seriesId: item.id, text: item.name })),
  ]
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const)
    .filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false))
    .map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  const plot = area
    ? { kind: 'area', categoryPlacement: 'point', stacking: stack, categories, categoryLabelPlan: planned, categoryAxis, valueAxis, valueDomain, series: series as AreaSeriesScene[] } satisfies CartesianAreaPlotScene
    : { kind: 'line', categoryPlacement: 'point', categories, categoryLabelPlan: planned, categoryAxis, valueAxis, valueDomain, series: series as LineSeriesScene[] } satisfies CartesianLinePlotScene
  return { migrationMode: 'native', document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides, frameElements, plot }
}

export function compileNativeLineScene(table: DataTable, config: ChartConfig): NativeLineChartScene {
  if (!isNativeLineKind(config.kind)) throw new Error(`Native line compiler cannot compile ${config.kind}.`)
  return compileNativePointScene(table, config, config.kind) as NativeLineChartScene
}
