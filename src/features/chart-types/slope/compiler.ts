import { planCategoryDateLabels } from '../../../core/chartDateAxis'
import type { PreparedChartData } from '../../../core/chartData'
import { changeColor, describeChange, formatChange } from '../../../core/changeSemantics'
import { niceNumericScale, orderedBounds, prepareVisibleChartData, slopePositionKey } from '../../../core/chartScale'
import { formatChartNumber } from '../../../core/numberFormat'
import { formatTimeValue } from '../../../core/timeFrequency'
import type { ChartConfig, DataTable, DataValue } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { aggregateDatumId, markElementId, rawDatumId, seriesId, syntheticDatumId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import type { CartesianPointScene, CartesianSlopePlotScene, NativeSlopeChartScene, SlopeEndpointLabelScene, SlopePositionScene, SlopeSeriesScene } from '../../../entities/chart/model/ChartScene'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import { legacyPointElementKey } from '../line/compiler'

const paletteFallback = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']
const seriesColor = (config: ChartConfig, name: string, index: number) => config.seriesStyles[name]?.color ?? (config.palette?.length ? config.palette : [config.color, ...paletteFallback.slice(1)])[index % Math.max(1, config.palette?.length ?? paletteFallback.length)]
const coordinate = (value: DataValue, index: number) => value instanceof Date ? value.toISOString() : `${index}:${String(value ?? '')}`

export function prepareSlopeComparison(table: DataTable, config: ChartConfig): PreparedChartData {
  const prepared = prepareVisibleChartData(table, config)
  const available = new Set(prepared.categories.map(slopePositionKey))
  const requested = config.slopeXValues ?? []
  const selected = requested.length === 2 && new Set(requested).size === 2 && requested.every((key) => available.has(key))
    ? new Set(requested)
    : prepared.categories.length === 2 ? new Set(prepared.categories.map(slopePositionKey)) : undefined
  if (!selected) throw new Error('Выберите две позиции по оси X для наклонного графика.')
  const indices = prepared.categories.flatMap((value, index) => selected.has(slopePositionKey(value)) ? [index] : [])
  if (indices.length !== 2) throw new Error('Выберите две позиции по оси X для наклонного графика.')
  return { categories: indices.map((index) => prepared.categories[index]), series: prepared.series.map((series) => ({ ...series, data: indices.map((index) => series.data[index]) })) }
}

function sourceRowIndex(table: DataTable, config: ChartConfig, category: DataValue, seriesName: string) {
  return table.rows.findIndex((row) => {
    const value = row[config.xField]
    const sameCategory = value instanceof Date && category instanceof Date ? value.getTime() === category.getTime() : value === category
    return sameCategory && (!config.seriesField || String(row[config.seriesField] ?? '') === seriesName)
  })
}

const frameElements = (config: ChartConfig) => ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const)
  .filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false))
  .map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))

export function compileNativeSlopeScene(table: DataTable, config: ChartConfig): NativeSlopeChartScene {
  if (config.kind !== 'slope') throw new Error(`Native slope compiler cannot compile ${config.kind}.`)
  const prepared = prepareSlopeComparison(table, config)
  const labels = planCategoryDateLabels(prepared.categories, table, config)
  const positions = prepared.categories.map((value, index): SlopePositionScene => {
    const key = coordinate(value, index)
    return { id: syntheticDatumId('slope-position', slopePositionKey(value)), value, coordinate: key, label: config.categoryLabelOverrides?.x?.[key] ?? labels[index] ?? String(value ?? ''), ordinal: index === 0 ? 'start' : 'end' }
  }) as [SlopePositionScene, SlopePositionScene]
  const series = prepared.series.map((source, seriesIndex): SlopeSeriesScene => {
    const id = seriesId(config.seriesField || 'measure', source.name)
    const color = seriesColor(config, source.name, seriesIndex)
    const style = config.seriesStyles[source.name]
    const marker = { visible: true as const, shape: style?.markerShape ?? 'circle' as const, size: style?.markerSize ?? 11, fill: style?.markerFill ?? color, stroke: style?.markerBorder ?? color, strokeWidth: style?.markerBorderWidth ?? 2 }
    const points = prepared.categories.map((category, categoryIndex): CartesianPointScene => {
      const value = source.data[categoryIndex]
      const rowIndex = sourceRowIndex(table, config, category, source.name)
      const datumId = config.aggregation === 'none' && rowIndex >= 0 ? rawDatumId(rowIndex, source.name) : aggregateDatumId(category, source.name)
      const legacyKey = legacyPointElementKey(source.name, category)
      return {
        type: 'point', id: markElementId(id, datumId), datumId, seriesId: id, legacyKey, category, categoryIndex, value,
        displayCategory: formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat),
        displayValue: value == null ? 'пропуск' : formatChartNumber(value, config), marker,
        label: { visible: false, text: value == null ? '' : formatChartNumber(value, config), style: config.valueText, position: 'auto' },
      }
    }) as [CartesianPointScene, CartesianPointScene]
    const start = points[0].value, end = points[1].value
    const descriptor = start == null || end == null ? undefined : describeChange(start, end)
    const resolvedColor = descriptor && config.slopeColorByChange
      ? changeColor(descriptor, config.slopeIncreaseColor ?? '#168a72', config.slopeDecreaseColor ?? '#db5a5a', config.slopeNeutralColor ?? '#777580')
      : color
    return {
      id, name: source.name, color, visible: true,
      stroke: { color: resolvedColor, width: style?.lineWidth ?? 2.5, type: style?.lineType ?? 'solid', opacity: 1 },
      marker: config.slopeColorByChange && descriptor ? { ...marker, fill: resolvedColor, stroke: resolvedColor } : marker,
      points,
      change: descriptor ? {
        descriptor,
        showLabel: config.slopeShowChange ?? false,
        label: formatChange(descriptor, config.slopeChangeFormat ?? 'absolute', config, config.slopeChangePercentDecimals ?? 0),
        labelPosition: config.slopeChangePosition ?? 'middle',
        colorByDirection: config.slopeColorByChange ?? false,
        resolvedColor,
      } : undefined,
    }
  })
  const values = series.flatMap((item) => item.points.map((point) => point.value))
  const automatic = niceNumericScale(values)
  const positives = values.filter((value): value is number => value != null && value > 0)
  const logMin = 10 ** Math.floor(Math.log10(positives.length ? Math.min(...positives) : 1))
  const logMaxBase = 10 ** Math.ceil(Math.log10(positives.length ? Math.max(...positives) : 10))
  const [configuredMin, configuredMax] = orderedBounds(config.yAxisMin, config.yAxisMax)
  const valueDomain = config.yAxisScaleType === 'log'
    ? { min: configuredMin != null && configuredMin > 0 ? configuredMin : logMin, max: configuredMax != null && configuredMax > logMin ? configuredMax : Math.max(logMin * 10, logMaxBase), step: config.yAxisStep ?? automatic.step }
    : { min: configuredMin ?? automatic.min, max: configuredMax ?? automatic.max, step: config.yAxisStep ?? automatic.step }
  const categoryStyle = config.xAxisLabelText ?? config.axisLabelText
  const valueStyle = config.yAxisLabelText ?? config.axisLabelText
  const categoryAxis: AxisSpec = { id: 'category', channel: 'category', orientation: 'horizontal', placement: { kind: 'side', side: config.xAxisPosition }, line: { visible: false }, ticks: { visible: config.showXTicks, length: config.tickLength }, labels: { visible: config.showXAxisLabels ?? true, size: 0, gap: config.xAxisLabelGap ?? 8, rotation: typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0, style: categoryStyle }, title: { visible: config.showXAxisTitle, text: config.xAxisTitle, size: 0, gap: config.xAxisTitleGap, style: config.xAxisTitleText ?? config.axisTitleText } }
  const valueAxis: AxisSpec = { id: 'value', channel: 'value', orientation: 'vertical', placement: { kind: 'side', side: config.yAxisPosition }, line: { visible: config.showYAxisLine }, ticks: { visible: config.showYTicks, length: config.tickLength }, labels: { visible: false, size: 0, gap: config.yAxisLabelGap ?? 8, style: valueStyle }, title: { visible: config.showYAxisTitle, text: config.yAxisTitle, size: 0, gap: config.yAxisTitleGap, style: config.yAxisTitleText ?? config.axisTitleText } }
  const showValues = config.slopeShowValues ?? true, showNames = config.slopeShowSeriesNames ?? true
  const endpointItems: SlopeEndpointLabelScene[] = []
  series.forEach((item) => item.points.forEach((point, index) => {
    if (point.value == null || index === 0 && !showValues || index === 1 && !showValues && !showNames) return
    const color = item.change?.colorByDirection ? item.change.resolvedColor : item.color
    endpointItems.push({ id: `slope-label:${point.id}`, pointId: point.id, seriesId: item.id, side: index === 0 ? 'left' : 'right', valueText: showValues ? point.displayValue : undefined, seriesText: index === 1 && showNames ? config.seriesStyles[item.name]?.legendLabel?.trim() || item.name : undefined, color, style: { ...config.valueText, color } })
  }))
  const plot: CartesianSlopePlotScene = {
    kind: 'slope', positions, series, valueDomain, categoryAxis, valueAxis,
    guides: { horizontal: config.showHorizontalGrid, vertical: config.showVerticalGrid, xAxisLine: config.showXAxisLine, internalValueLabels: Boolean(config.slopeShowYAxis && (config.showYAxisLabels ?? true)), grid: { color: config.gridColor, width: config.gridWidth, type: config.gridType }, axisLine: { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType } },
    endpointLabels: { distance: 8, collision: 'shift-y', hideOverlap: false, items: endpointItems },
  }
  const elements: ChartElement[] = [
    ...series.flatMap((item) => item.points.map((point): ChartElement => ({ id: point.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: point.seriesId, datumId: point.datumId, legacyKey: point.legacyKey }))),
    ...positions.map((position): ChartElement => ({ id: `category-label:${position.id}`, role: 'category-label', coordinateSpace: 'canvas', selectable: true, axisId: 'category', datumId: position.id, text: position.label })),
  ]
  return { document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides: [], frameElements: frameElements(config), plot }
}
