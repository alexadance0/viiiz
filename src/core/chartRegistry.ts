import type { ChartConfig, ChartElementSelection, ChartPlugin, DataTable } from './types'
import { formatTimeValue, isoWeekParts } from './timeFrequency'
import { axisAffixApplies, formatChartNumber, formatXAxisNumber, formatYAxisNumber, type AxisTickPosition } from './numberFormat'
import { measureTextWidth, wrapMeasuredText } from './textMetrics'
import { niceNumericScale, orderedBounds, prepareVisibleChartData, slopePositionKey } from './chartScale'
import { effectiveDateStepUnit, moveDateContextToVisibleLabels, planCategoryDateLabels, stackedContextFormat } from './chartDateAxis'
import { isAreaChart, isBarChart, isHorizontalBarChart, isNormalizedStackedChart, isStackedBarChart, isStackedChart } from './chartKinds'
import { barChartDefinitions } from '../features/chart-types/bar'
import { lineChartDefinitions, intervalChartDefinitions } from '../features/chart-types/line'
import { areaChartDefinitions } from '../features/chart-types/area'
import { relationshipChartDefinitions } from '../features/chart-types/relationship'
import { smoothingChartDefinitions } from '../features/chart-types/smoothing'
import { heatmapChartDefinitions } from '../features/chart-types/heatmap'
import { treemapChartDefinitions } from '../features/chart-types/treemap'
import { distributionChartDefinitions } from '../features/chart-types/distribution'
import { compileLegacyScene } from '../features/chart-renderer/legacyCompiler'
import { compileNativeBarScene, isNativeBarKind } from '../features/chart-types/bar/compiler'
import { compileNativeLineScene, isNativeLineKind } from '../features/chart-types/line/compiler'
import { compileNativeAreaScene, isNativeAreaKind } from '../features/chart-types/area/compiler'
import { compileNativeSlopeScene } from '../features/chart-types/slope/compiler'
import { compileNativeSmoothingScene, isNativeSmoothingKind } from '../features/chart-types/smoothing/compiler'
import { compileNativeIntervalScene, isNativeIntervalKind } from '../features/chart-types/interval/compiler'
import { compileNativeXYScene, isNativeXYKind, validateNativeXYMapping } from '../features/chart-types/xy/compiler'
import { compileNativeDistributionScene, isNativeDistributionKind, validateNativeDistributionMapping } from '../features/chart-types/distribution/compiler'
import { compileNativeWaterfallScene, legacyWaterfallBuilderGuard } from '../features/chart-types/waterfall/compiler'
import { waterfallSteps } from '../features/chart-types/waterfall/transform'
export { formatWaterfallChange, waterfallLabelPlacement, waterfallSteps, waterfallValueLabel } from '../features/chart-types/waterfall/transform'
import { compileNativeButterflyScene, validateNativeButterflyMapping } from '../features/chart-types/butterfly/compiler'
export { fitSwarmClouds, fitSwarmOffsets, packSwarmOffsets } from '../features/chart-types/distribution/swarm'
import { renderScene } from '../features/chart-renderer/echarts/renderScene'
import { nativeMarkSelections } from '../entities/chart/model/sceneVisitors'
import { repeatedChartCategories } from './chartData'
import { changeColor as semanticChangeColor, describeChange, formatChange } from './changeSemantics'
import { absorbedBarLabelPlacement, barSeriesGeometry, denseValueLabelStride, isInsideValueLabel, showDenseValueLabel, valueLabelPosition } from './chartLabels'
import { hyphenateSync as hyphenateRussian } from 'hyphen/ru'
import { getSeriesColor } from './seriesColor'

export { getSeriesColor } from './seriesColor'

const PALETTE = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']

export { niceNumericScale, prepareVisibleChartData } from './chartScale'

type LegacyChartPlugin = Omit<ChartPlugin, 'compile' | 'capabilities' | 'compilerMode'>

function semanticCapabilities(plugin: LegacyChartPlugin): ChartPlugin['capabilities'] {
  const hierarchy = plugin.id === 'treemap', matrix = plugin.id === 'heatmap'
  const scatterLike = plugin.id === 'scatter' || plugin.id === 'bubble'
  return {
    coordinateSystem: hierarchy ? 'hierarchy' : matrix ? 'matrix' : 'cartesian',
    axes: hierarchy ? false : { category: { placements: plugin.id === 'butterfly' ? ['side', 'internal'] : ['side'] }, value: { scaleTypes: ['linear', 'log', 'date'] } },
    guides: matrix ? ['color-scale'] : plugin.id === 'bubble' ? ['legend', 'direct-series', 'size-scale'] : plugin.id === 'slope' ? ['direct-series'] : ['legend', 'direct-series'],
    valueLabels: true,
    markers: scatterLike || plugin.category === 'trend' || plugin.category === 'smoothing',
    orientation: plugin.category === 'comparison' || plugin.category === 'bar-horizontal' || plugin.category === 'distribution' ? ['vertical', 'horizontal'] : undefined,
    stacking: plugin.id.includes('stacked') ? ['stacked', 'normalized'] : undefined,
  }
}

const inferMapping = (table: DataTable): Pick<ChartConfig, 'xField' | 'yField' | 'yFields'> => {
  const numeric = table.columns.filter((column) => table.rows.some((row) => typeof row[column] === 'number' && Number.isFinite(row[column])))
  const xField = table.columns.find((column) => !numeric.includes(column)) ?? table.columns[0] ?? ''
  const yField = numeric[0] ?? table.columns.find((column) => column !== xField) ?? xField
  return { xField, yField, yFields: yField ? [yField] : [] }
}

const validateMapping = (table: DataTable, config: ChartConfig) => {
  const errors: Array<{ field: string; message: string }> = []
  if (!config.xField || !table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку для оси X.' })
  const numeric = (field: string | undefined) => Boolean(field && table.columns.includes(field) && table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  const yFields = config.yFields.length ? config.yFields : [config.yField]
  if (!yFields.some(numeric)) errors.push({ field: 'yField', message: 'Выберите числовую колонку для значения.' })
  if ((config.kind === 'scatter' || config.kind === 'bubble') && !table.rows.some((row) => typeof row[config.xField] === 'number' || row[config.xField] instanceof Date)) errors.push({ field: 'xField', message: 'Для этого графика ось X должна быть числовой или датой.' })
  if (config.kind === 'bubble' && !numeric(config.scatterSizeField)) errors.push({ field: 'scatterSizeField', message: 'Выберите числовую колонку для размера пузырька.' })
  if (config.kind === 'dumbbell' && (!numeric(config.dumbbellStartField) || !numeric(config.dumbbellEndField) || config.dumbbellStartField === config.dumbbellEndField)) errors.push({ field: 'dumbbellFields', message: 'Выберите две разные числовые колонки для гантельной диаграммы.' })
  if ((config.kind === 'range-line' || config.kind === 'step-range-line') && (!numeric(config.rangeLowerField) || !numeric(config.rangeUpperField) || config.rangeLowerField === config.rangeUpperField)) errors.push({ field: 'rangeFields', message: 'Выберите две разные числовые границы диапазона.' })
  if (config.kind === 'confidence-line' && !(config.intervalGroups?.some((group) => new Set([group.main, group.lower, group.upper]).size === 3 && numeric(group.main) && numeric(group.lower) && numeric(group.upper)) || config.yFields.length >= 3 && new Set(config.yFields.slice(0, 3)).size === 3 && config.yFields.slice(0, 3).every(numeric))) errors.push({ field: 'intervalGroups', message: 'Настройте три разных числовых поля: основное значение и две границы.' })
  if (config.aggregation === 'none' && repeatedChartCategories(table, config).length) errors.push({ field: 'aggregation', message: 'Для повторяющихся значений X выберите способ агрегации.' })
  return { ok: errors.length === 0, errors }
}

const pluginModel = (id: ChartConfig['kind']) => ({ defaultConfig: { kind: id }, inferMapping, validate: validateMapping })

const text = (style: ChartConfig['titleText']) => ({
  fontFamily: style.fontFamily, fontSize: style.size, color: style.color, fontWeight: style.weight,
  fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100),
})
const graphicText = (style: ChartConfig['titleText']) => {
  const { color, ...rest } = text(style)
  return { ...rest, fill: color }
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const CONTENT_LEFT = 32
const axisTickPosition = (value: number, minimum: number, maximum: number): AxisTickPosition => {
  const tolerance = Math.max(1, Math.abs(maximum - minimum)) * 1e-9
  if (Math.abs(value - minimum) <= tolerance) return 'first'
  if (Math.abs(value - maximum) <= tolerance) return 'last'
  return 'middle'
}
const alignedLeft = (align: ChartConfig['titleText']['align'], left = CONTENT_LEFT) => align === 'left' ? left : align === 'center' ? 'center' : undefined
const elementKey = (series: string, category: unknown) => `${series}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
const treemapLabelPosition = (position: NonNullable<ChartConfig['treemapLabelPosition']>) => ({
  'top-left': 'insideTopLeft', 'top-center': 'insideTop', 'top-right': 'insideTopRight',
  'center-left': 'insideLeft', center: 'inside', 'center-right': 'insideRight',
  'bottom-left': 'insideBottomLeft', 'bottom-center': 'insideBottom', 'bottom-right': 'insideBottomRight',
} as const)[position]
// ZRender treats U+FEFF as a zero-width word boundary. Together with a soft
// hyphen it wraps only at valid Russian hyphenation points and shows the dash
// only when the line actually breaks.
export const hyphenateTreemapText = (value: string, hyphenChar = '\u00ad\ufeff') => hyphenateRussian(value, { hyphenChar, minWordLength: 6 })
export const treemapAdaptiveFontSize = (baseSize: number, share: number, minimum: number) =>
  Math.max(minimum, Math.round(baseSize * Math.min(1.35, .55 + .8 * Math.sqrt(Math.min(1, share / .25)))))
const orderedTreemapNodes = <T extends { name: string; value: number }>(nodes: T[], order?: string[]) => {
  const fallback = [...nodes].sort((left, right) => right.value - left.value)
  if (!order?.length) return fallback
  const rank = new Map(order.map((name, index) => [name, index]))
  return fallback.sort((left, right) => (rank.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.name) ?? Number.MAX_SAFE_INTEGER))
}
const contrastText = (color: string) => {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1]
  if (!hex) return '#ffffff'
  const luminance = (value: string) => {
    const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  }
  const background = luminance(hex)
  return 1.05 / (background + .05) >= 3 ? '#ffffff' : '#202027'
}
const mixHexColors = (from: string, to: string, amount: number) => {
  const parse = (color: string) => color.match(/^#([\da-f]{6})$/i)?.[1]
  const first = parse(from), second = parse(to)
  if (!first || !second) return amount < .5 ? from : to
  const ratio = Math.min(1, Math.max(0, amount))
  const channel = (index: number) => Math.round(Number.parseInt(first.slice(index, index + 2), 16) * (1 - ratio) + Number.parseInt(second.slice(index, index + 2), 16) * ratio).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}
const directLabelWidth = (config: ChartConfig, series: Array<{ name: string }>) => {
  const canvasWidth = Math.min(1000, config.canvasWidth ?? 1000)
  const content = series.reduce((result, item) => {
    const override = config.seriesStyles[item.name]
    const style = override?.directLabelText ?? config.directLabelText ?? config.legendText
    const lineWidth = (value: string, size: number, weight: number) => Math.max(0, ...value.split('\n').map((line) => measureTextWidth(line, size, style.fontFamily, weight)))
    return Math.max(result, lineWidth(override?.legendLabel?.trim() || item.name, style.size, style.weight), lineWidth(override?.legendNote?.trim() || '', Math.max(8, style.size - 2), 400))
  }, 0)
  return Math.round(Math.min(Math.max(120, canvasWidth - 120), content + 10))
}
const pointData = (config: ChartConfig, series: string, category: unknown, value: number | null) => {
  const key = elementKey(series, category), override = config.elementStyles[key]
  const label = override ? { show: override.showLabel ?? config.showValues, formatter: override.label || formatChartNumber(value, config), ...text(override.valueText ?? config.valueText) } : undefined
  return {
    value, elementKey: key, displayValue: value == null ? 'пропуск' : formatChartNumber(value, config), displayCategory: category instanceof Date ? formatTimeValue(category) : String(category ?? ''),
    itemStyle: override?.color ? { color: override.color } : undefined,
    label,
    emphasis: label ? { label } : undefined,
  }
}
const usesYAxisEdgeOverlay = (config: ChartConfig) => config.kind !== 'slope' && (config.showYAxisLabels ?? true) && config.yAxisAffixScope != null && config.yAxisAffixScope !== 'all' && Boolean(config.numberPrefix || config.numberSuffix)
const yAxisEdgeAffixSeries = (config: ChartConfig, minimum: number, maximum: number) => {
  if (!usesYAxisEdgeOverlay(config) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) return []
  const positions = config.yAxisAffixScope === 'first' ? [['first', minimum]] : config.yAxisAffixScope === 'last' ? [['last', maximum]] : [['first', minimum], ['last', maximum]]
  const style = config.yAxisLabelText ?? config.axisLabelText
  return [{
    name: '__y-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100,
    data: positions.map(([position, value]) => [0, value, position === 'first' ? 0 : 1]),
    renderItem: (_params: { coordSys: { x: number; width: number } }, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => {
      const value = Number(api.value(1)), position = api.value(2) === 0 ? 'first' : 'last'
      const bare = formatYAxisNumber(value, { ...config, numberPrefix: '', numberSuffix: '', yAxisAffixScope: 'all' })
      const label = formatYAxisNumber(value, config, position)
      const prefix = config.numberPrefix && label.startsWith(config.numberPrefix) ? config.numberPrefix : ''
      const bareWidth = measureTextWidth(bare, style.size, style.fontFamily, style.weight) + measureTextWidth(prefix, style.size, style.fontFamily, style.weight)
      const left = config.yAxisPosition === 'left'
      const edge = left ? _params.coordSys.x - (config.yAxisLabelGap ?? 8) : _params.coordSys.x + _params.coordSys.width + (config.yAxisLabelGap ?? 8)
      return { type: 'text', style: { x: left ? edge - bareWidth : edge + bareWidth, y: api.coord([0, value])[1], text: label, ...graphicText(style), align: left ? 'left' : 'right', verticalAlign: 'middle', backgroundColor: config.canvasBackground ?? '#ffffff', padding: left ? [1, 3, 1, 0] : [1, 0, 1, 3] } }
    },
  }]
}
const usesXAxisEdgeOverlay = (config: ChartConfig) => (config.showXAxisLabels ?? true) && config.xAxisAffixScope != null && config.xAxisAffixScope !== 'all' && Boolean(config.xAxisNumberPrefix || config.xAxisNumberSuffix)
type XAxisEdge = { coordinate: unknown; cross: unknown; value: number; position: 'first' | 'last' }
const xAxisEdgeAffixSeries = (config: ChartConfig, edges: XAxisEdge[]) => {
  const visibleEdges = edges.filter((edge, index, items) => axisAffixApplies(config.xAxisAffixScope, edge.position) && items.findIndex((item) => String(item.coordinate) === String(edge.coordinate)) === index)
  if (!usesXAxisEdgeOverlay(config) || !visibleEdges.length) return []
  const style = config.xAxisLabelText ?? config.axisLabelText
  return [{
    name: '__x-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100,
    data: visibleEdges.map((edge) => [edge.coordinate, edge.cross, edge.value, edge.position === 'first' ? 0 : 1]),
    renderItem: (_params: { coordSys: { y: number; height: number } }, api: { value(index: number): unknown; coord(value: unknown[]): [number, number] }) => {
      const value = Number(api.value(2)), first = api.value(3) === 0
      const label = formatXAxisNumber(value, config, first ? 'first' : 'last')
      const top = config.xAxisPosition === 'top'
      return { type: 'text', style: { x: api.coord([api.value(0), api.value(1)])[0], y: top ? _params.coordSys.y - (config.xAxisLabelGap ?? 8) : _params.coordSys.y + _params.coordSys.height + (config.xAxisLabelGap ?? 8), text: label, ...graphicText(style), align: first ? 'left' : 'right', verticalAlign: top ? 'bottom' : 'top', backgroundColor: config.canvasBackground ?? '#ffffff', padding: top ? [0, 2, 2, 2] : [2, 2, 0, 2] } }
    },
  }]
}
const commonOption = (table: DataTable, config: ChartConfig, prepared = prepareVisibleChartData(table, config)) => {
  const categories = prepared.categories
  const xAxisTitleText = config.xAxisTitleText ?? config.axisTitleText
  const yAxisTitleText = config.yAxisTitleText ?? config.axisTitleText
  const xAxisLabelText = config.xAxisLabelText ?? config.axisLabelText
  const yAxisLabelText = config.yAxisLabelText ?? config.axisLabelText
  const scaleValues = isStackedChart(config.kind)
    ? prepared.categories.flatMap((_, categoryIndex) => {
      let positive = 0, negative = 0
      prepared.series.forEach((series) => { const value = series.data[categoryIndex]; if (value != null) { if (value >= 0) positive += value; else negative += value } })
      return [positive, negative]
    })
    : prepared.series.flatMap((series) => series.data)
  const normalizedStack = isNormalizedStackedChart(config.kind)
  const autoScale = normalizedStack
    ? { min: scaleValues.some((value) => value != null && value < 0) ? -100 : 0, max: scaleValues.some((value) => value != null && value > 0) ? 100 : 0, step: 20 }
    : niceNumericScale(scaleValues, isBarChart(config.kind) || isAreaChart(config.kind))
  const [yMin, yMax] = orderedBounds(config.yAxisMin, config.yAxisMax)
  const positiveValues = prepared.series.flatMap((series) => series.data).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
  const smallestPositive = positiveValues.length ? Math.min(...positiveValues) : 1
  const largestPositive = positiveValues.length ? Math.max(...positiveValues) : 10
  const automaticLogMin = 10 ** Math.floor(Math.log10(smallestPositive))
  const automaticLogMaxBase = 10 ** Math.ceil(Math.log10(largestPositive))
  const automaticLogMax = automaticLogMaxBase <= automaticLogMin ? automaticLogMin * 10 : automaticLogMaxBase
  const effectiveYMin = config.yAxisScaleType === 'log' ? (yMin != null && yMin > 0 ? yMin : automaticLogMin) : yMin ?? autoScale.min
  const effectiveYMax = config.yAxisScaleType === 'log' ? (yMax != null && yMax > effectiveYMin ? yMax : automaticLogMax) : yMax ?? autoScale.max
  const xAxisTitleLineHeight = Math.round(xAxisTitleText.size * xAxisTitleText.lineHeight / 100)
  const yAxisTitleLineHeight = Math.round(yAxisTitleText.size * yAxisTitleText.lineHeight / 100)
  const xAxisTitleHeight = xAxisTitleLineHeight * Math.max(1, config.xAxisTitle.split('\n').length)
  const yAxisTitleHeight = yAxisTitleLineHeight * Math.max(1, config.yAxisTitle.split('\n').length)
  const contentTop = config.canvasMarginTop ?? 24, contentRight = config.canvasMarginRight ?? 24, contentBottom = config.canvasMarginBottom ?? 24, contentLeft = config.canvasMarginLeft ?? CONTENT_LEFT
  const yAxisSpace = config.showYAxisTitle && config.yAxisTitle ? yAxisTitleHeight + config.yAxisTitleGap + (config.yAxisLabelGap ?? 0) : 0
  const legendPosition = config.legendPosition ?? 'top'
  const visibleDirectSeries = prepared.series.filter((series) => config.seriesStyles[series.name]?.showDirectLabel !== false)
  const directLabels = config.kind !== 'scatter' && visibleDirectSeries.length > 0 && Boolean(config.showDirectLabels)
  const directLabelsLeft = directLabels && config.kind !== 'seasonal-line' && !isHorizontalBarChart(config.kind) && config.barOrientation !== 'horizontal' && config.yAxisPosition === 'right'
  const standardLegend = config.showLegend && !directLabels
  const sideLegend = standardLegend && (legendPosition === 'left' || legendPosition === 'right')
  const slopeLabelStyle = config.valueText
  const slopeLeftLabelWidth = config.kind === 'slope' && config.showValues && config.slopeShowValues !== false
    ? prepared.series.reduce((width, series) => Math.max(width, ...series.data.map((value) => measureTextWidth(formatChartNumber(value, config), slopeLabelStyle.size, slopeLabelStyle.fontFamily, slopeLabelStyle.weight))), 0) + 16
    : 0
  const slopeRightLabelWidth = config.kind === 'slope' && config.showValues
    ? prepared.series.reduce((width, series) => {
      const seriesName = config.seriesStyles[series.name]?.legendLabel?.trim() || series.name
      const valueWidth = config.slopeShowValues === false ? 0 : Math.max(0, ...series.data.map((value) => measureTextWidth(formatChartNumber(value, config), slopeLabelStyle.size, slopeLabelStyle.fontFamily, slopeLabelStyle.weight)))
      const nameWidth = config.slopeShowSeriesNames === false ? 0 : measureTextWidth(seriesName, slopeLabelStyle.size, slopeLabelStyle.fontFamily, slopeLabelStyle.weight)
      return Math.max(width, valueWidth + nameWidth + (nameWidth ? 10 : 0))
    }, 0)
    : 0
  const directWidth = directLabelWidth(config, prepared.series)
  const directReserve = directWidth + (config.directLabelGap ?? 14)
  const plotLeft = (config.yAxisPosition === 'left' ? contentLeft + yAxisSpace : contentLeft) + (sideLegend && legendPosition === 'left' ? 120 : 0) + (directLabelsLeft ? directReserve : 0) + slopeLeftLabelWidth
  const basePlotRight = (config.yAxisPosition === 'right' ? contentRight + yAxisSpace : directLabels ? 0 : Math.max(30, contentRight)) + (sideLegend && legendPosition === 'right' ? 120 : 0) + (directLabels && !directLabelsLeft ? directWidth + (config.directLabelGap ?? 14) + contentRight : 0) + slopeRightLabelWidth + (slopeRightLabelWidth ? 16 : 0)
  const dateCategories = categories.some((value) => value instanceof Date)
  const calendarStep = dateCategories && effectiveDateStepUnit(config)
  const categoryOverrideAxis = isBarChart(config.kind) && config.barOrientation === 'horizontal' ? 'y' : 'x'
  const categoryKey = (value: unknown, index: number) => value instanceof Date ? value.toISOString() : `${index}:${String(value ?? '')}`
  let categoryLabels = planCategoryDateLabels(categories, table, config).map((label, index) => config.categoryLabelOverrides?.[categoryOverrideAxis]?.[categoryKey(categories[index], index)] ?? label)
  const numericCategoryIndices = categories.flatMap((value, index) => typeof value === 'number' ? [index] : [])
  const firstNumericCategory = numericCategoryIndices[0], lastNumericCategory = numericCategoryIndices.at(-1)
  const xCategoryEdgePosition = (index: number) => index === firstNumericCategory ? 'first' : index === lastNumericCategory ? 'last' : 'middle'
  const categoricalText = categories.length > 0 && categories.every((value) => typeof value === 'string' || typeof value === 'boolean' || value == null)
  const widestLineLength = (label: string) => Math.max(0, ...label.split('\n').map((line) => line.length))
  const anchorTime = config.dateAxisAnchor ? new Date(`${config.dateAxisAnchor}T00:00:00`).getTime() : Number.NaN
  const anchorIndex = Number.isFinite(anchorTime) ? categories.findIndex((value) => value instanceof Date && value.getTime() >= anchorTime) : -1
  const requestedStep = Math.max(1, Math.round(config.xAxisStep ?? 1))
  const requestedLabels = categoryLabels.filter((label, index) => {
    if (!label) return false
    if (calendarStep) return true
    if (anchorIndex >= 0) return index >= anchorIndex && (index - anchorIndex) % requestedStep === 0
    return config.xAxisStep == null || index % requestedStep === 0
  })
  const manualDateDensity = dateCategories && (config.xAxisStep != null || anchorIndex >= 0)
  const adaptiveLabelDensity = manualDateDensity
  const adaptivePlotWidth = Math.max(80, (config.canvasWidth ?? 1000) - plotLeft - basePlotRight - 20)
  const labelSlot = adaptivePlotWidth / Math.max(1, requestedLabels.length)
  const longestCharacters = requestedLabels.reduce((result, label) => Math.max(result, widestLineLength(label)), 0)
  const fittedDateSize = longestCharacters ? Math.floor((labelSlot - 5) / (longestCharacters * .58)) : xAxisLabelText.size
  const minimumXLabelSize = categoricalText ? Math.min(12, xAxisLabelText.size) : 8
  const effectiveXLabelSize = adaptiveLabelDensity ? Math.max(minimumXLabelSize, Math.min(xAxisLabelText.size, fittedDateSize)) : xAxisLabelText.size
  const effectiveLabelWidth = longestCharacters * effectiveXLabelSize * .58
  const automaticRotate = categoricalText && effectiveLabelWidth > labelSlot * .92 ? 90 : manualDateDensity && effectiveLabelWidth > labelSlot * 1.08 ? 45 : 0
  const xLabelRotate = typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : automaticRotate
  const labelLines = Math.max(stackedContextFormat(config.dateLabelFormat) ? 2 : 1, ...categoryLabels.map((label) => label.split('\n').length))
  const rotatedLabelExtra = xLabelRotate === 90 ? Math.min(180, Math.round(effectiveLabelWidth)) : xLabelRotate ? Math.min(72, Math.round(effectiveLabelWidth * .72)) : 0
  const xScaleLabelsHeight = ((config.showXAxisLabels ?? true) ? Math.round(effectiveXLabelSize * xAxisLabelText.lineHeight / 100) * labelLines + rotatedLabelExtra + (config.xAxisLabelGap ?? 8) : 0) + (config.showXTicks ? config.tickLength : 0)
  const headerBottom = (config.subtitle || (standardLegend && legendPosition === 'top') ? 104 : 78) + Math.max(0, contentTop - 24)
  // `containLabel` already moves the coordinate rectangle past axis labels,
  // including rotated labels. Only the axis title belongs in the outer reserve.
  const xAxisTitleReserve = config.showXAxisTitle && config.xAxisTitle ? xAxisTitleHeight + config.xAxisTitleGap : 0
  const plotTop = config.xAxisPosition === 'top' ? headerBottom + xAxisTitleReserve : headerBottom
  const plotBottomBase = (config.note || config.source ? 56 : 18) + (config.xAxisPosition === 'bottom' ? xAxisTitleReserve : 0)
  const plotBottom = plotBottomBase + Math.max(0, contentBottom - 24) + (standardLegend && legendPosition === 'bottom' ? 34 : 0)
  const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const lastVisibleLabel = categoryLabels.findLast((label) => Boolean(label)) ?? ''
  // Category and time labels are centred on their tick. Reserve half of the final
  // label width for every cartesian chart so it cannot escape the canvas edge.
  const rightEdgeLabelSpace = (config.showXAxisLabels ?? true) ? (lastVisibleLabel ? Math.min(110, Math.ceil(widestLineLength(lastVisibleLabel) * effectiveXLabelSize * .3) + 10) : 0) : 0
  const plotRight = basePlotRight + rightEdgeLabelSpace
  const visibleCategory = (index: number) => Boolean(categoryLabels[index])
  const estimatedPlotWidth = Math.max(1, (config.canvasWidth ?? 1000) - plotLeft - plotRight)
  const estimatedCategoryStep = estimatedPlotWidth / Math.max(1, categories.length)
  const longestLabelWidth = categoryLabels.reduce((width, label) => Math.max(width, widestLineLength(label) * xAxisLabelText.size * .58), 0)
  const automaticBarInterval = Math.max(0, Math.ceil((longestLabelWidth + 12) / Math.max(1, estimatedCategoryStep)) - 1)
  const visibleDateIndices = categoryLabels.flatMap((label, index) => label ? [index] : [])
  const minimumVisibleGap = visibleDateIndices.slice(1).reduce((gap, index, position) => Math.min(gap, index - visibleDateIndices[position]), Number.POSITIVE_INFINITY)
  const naturalDateGap = Number.isFinite(minimumVisibleGap) ? minimumVisibleGap : Math.max(1, categories.length)
  const automaticDateStride = Math.max(1, Math.ceil((longestLabelWidth + 10) / Math.max(1, estimatedCategoryStep * naturalDateGap)))
  const weeklyLabels = config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat?.startsWith('year-week-')
  const automaticDateVisible = new Set(visibleDateIndices.filter((index, ordinal) =>
    ordinal % automaticDateStride === 0 || weeklyLabels && categories[index] instanceof Date && isoWeekParts(categories[index]).week === 1
  ))
  const automaticDateCategory = (index: number) => automaticDateVisible.has(index)
  const anchoredInterval = (index: number) => index >= anchorIndex && (index - anchorIndex) % Math.max(1, Math.round(config.xAxisStep ?? 1)) === 0
  const categoryInterval: 'auto' | number | ((index: number) => boolean) = categoricalText && config.xAxisStep == null ? 0 : calendarStep ? config.xAxisStep == null && anchorIndex < 0 ? automaticDateCategory : visibleCategory : anchorIndex >= 0 ? anchoredInterval : config.xAxisStep == null ? dateCategories ? automaticDateStride - 1 : isBarChart(config.kind) ? automaticBarInterval : 'auto' : Math.max(0, Math.round(config.xAxisStep) - 1)
  const categoryIsDisplayed = typeof categoryInterval === 'function'
    ? categoryInterval
    : typeof categoryInterval === 'number' ? (index: number) => index % (categoryInterval + 1) === 0 : () => true
  categoryLabels = moveDateContextToVisibleLabels(categoryLabels, categories, config.dateLabelFormat, categoryIsDisplayed)
  const categoryValues = categories.map((value, index) => value instanceof Date ? value.toISOString() : `${index}:${String(value ?? '')}`)
  const tooltipLabels = categories.map((value) => typeof value === 'number' ? formatXAxisNumber(value, config) : formatTimeValue(value, table.timeProfiles?.[config.xField], config.dateLabelFormat))
  return {
  animation: true,
  backgroundColor: config.canvasBackground ?? '#ffffff',
  color: config.palette?.length ? config.palette : [config.color, ...PALETTE.slice(1)],
  textStyle: { fontFamily: xAxisLabelText.fontFamily },
  title: { text: config.title, subtext: config.subtitle, left: alignedLeft(config.titleText.align, contentLeft), right: config.titleText.align === 'right' ? contentRight : undefined, top: Math.max(0, contentTop - 8), textAlign: config.titleText.align, textStyle: text(config.titleText), subtextStyle: text(config.subtitleText), itemGap: 7, triggerEvent: true },
  tooltip: { trigger: 'axis', formatter: (input: unknown) => {
    const items = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number; seriesName?: string; value?: unknown; marker?: string }>
    const index = items[0]?.dataIndex ?? 0
    const rows = items.filter((item) => item.seriesName && !item.seriesName.startsWith('__')).map((item) => {
      const rawValue = Array.isArray(item.value) ? item.value.at(-1) : item.value
      const value = rawValue
      return `${item.marker ?? ''}${escapeHtml(item.seriesName)}: <b>${escapeHtml(value == null ? 'пропуск' : formatChartNumber(value, config))}</b>`
    })
    return [`<b>${escapeHtml(tooltipLabels[index] ?? categoryLabels[index] ?? '')}</b>`, ...rows].join('<br/>')
  } },
  legend: {
    show: standardLegend,
    data: prepared.series.map((series, index) => ({ name: series.name, icon: ({ circle: 'circle', square: 'rect', line: 'path://M0 4H24V7H0Z', diamond: 'diamond', triangle: 'triangle' } as const)[config.legendMarker as 'circle' | 'square' | 'line' | 'diamond' | 'triangle'] ?? (isBarChart(config.kind) ? 'rect' : 'path://M0 4H24V7H0Z'), itemStyle: { color: getSeriesColor(config, series.name, index), borderWidth: 0 } })),
    orient: sideLegend ? 'vertical' : 'horizontal',
    top: legendPosition === 'top' ? (config.subtitle ? 72 : 54) : legendPosition === 'bottom' ? undefined : 'middle',
    bottom: legendPosition === 'bottom' ? (config.note || config.source ? 42 : 8) : undefined,
    left: legendPosition === 'right' ? undefined : contentLeft,
    right: legendPosition === 'right' ? contentRight : undefined,
    itemWidth: (config.legendMarker ?? 'auto') === 'line' || ((config.legendMarker ?? 'auto') === 'auto' && !isBarChart(config.kind)) ? 24 : 10,
    itemHeight: 10,
    itemGap: 18,
    textStyle: { ...text(config.legendText), align: sideLegend ? config.legendText.align : 'center' },
  },
  grid: { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom, containLabel: true },
  graphic: [
    config.showYAxisTitle && config.yAxisTitle && { id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? contentLeft : undefined, right: config.yAxisPosition === 'right' ? contentRight : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: config.yAxisTitle, ...graphicText(yAxisTitleText), lineHeight: yAxisTitleLineHeight, align: 'center', verticalAlign: 'middle' } },
    config.note && { id: 'chart-note', type: 'text', left: contentLeft, bottom: config.source ? contentBottom + 16 : contentBottom, style: { text: config.note, ...graphicText(config.noteText), width: Math.max(80, (config.canvasWidth ?? 1000) - contentLeft - contentRight), overflow: 'break', align: config.noteText.align } },
    config.source && { id: 'chart-source', type: 'text', left: contentLeft, bottom: contentBottom, style: { text: config.source, ...graphicText(config.sourceText), width: Math.max(80, (config.canvasWidth ?? 1000) - contentLeft - contentRight), overflow: 'break', align: config.sourceText.align } },
  ].filter(Boolean),
  xAxis: {
    type: 'category',
    boundaryGap: isBarChart(config.kind),
    position: config.xAxisPosition,
    name: config.showXAxisTitle ? config.xAxisTitle : '',
    nameLocation: 'middle',
    nameGap: xScaleLabelsHeight + config.xAxisTitleGap,
    data: categoryValues,
    nameTextStyle: text(xAxisTitleText),
    triggerEvent: true,
    axisLabel: { ...text(xAxisLabelText), show: config.showXAxisLabels ?? true, fontSize: effectiveXLabelSize, lineHeight: Math.round(effectiveXLabelSize * xAxisLabelText.lineHeight / 100), margin: config.xAxisLabelGap ?? 8, rotate: xLabelRotate, width: config.xAxisLabelOverflow === 'wrap' ? Math.max(24, estimatedCategoryStep - 6) : undefined, overflow: config.xAxisLabelOverflow === 'truncate' ? 'truncate' : undefined, inside: false, formatter: (_value: string, index: number) => { const position = xCategoryEdgePosition(index); if (usesXAxisEdgeOverlay(config) && typeof categories[index] === 'number' && axisAffixApplies(config.xAxisAffixScope, position)) return ''; const label = categoryLabels[index] ?? ''; return categoricalText && config.xAxisLabelOverflow === 'wrap' ? wrapMeasuredText(label, effectiveXLabelSize, Math.max(24, estimatedCategoryStep - 6), xAxisLabelText.fontFamily, xAxisLabelText.weight).text : label }, interval: categoryInterval, hideOverlap: categoricalText || dateCategories ? false : config.xAxisStep == null && anchorIndex < 0, showMinLabel: true, showMaxLabel: categoricalText || config.xAxisAffixScope != null && config.xAxisAffixScope !== 'all' ? true : undefined },
    axisLine: { show: config.showXAxisLine, onZero: false, lineStyle: axisLineStyle },
    axisTick: { show: config.showXTicks, inside: false, alignWithLabel: true, interval: categoryInterval, length: config.tickLength, lineStyle: axisLineStyle },
    splitLine: { show: config.showVerticalGrid && !isBarChart(config.kind), interval: categoryInterval, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  },
  yAxis: {
    type: config.yAxisScaleType === 'log' ? 'log' : 'value', logBase: config.yAxisScaleType === 'log' ? 10 : undefined, min: effectiveYMin, max: effectiveYMax, interval: config.yAxisScaleType === 'log' ? undefined : config.yAxisStep ?? autoScale.step,
    position: config.yAxisPosition,
    name: '',
    nameLocation: 'middle',
    nameRotate: 90,
    nameGap: config.yAxisTitleGap,
    nameTextStyle: text(yAxisTitleText),
    triggerEvent: true,
    axisLabel: { ...text(yAxisLabelText), show: config.showYAxisLabels ?? true, margin: config.yAxisLabelGap ?? 8, inside: false, formatter: (value: number) => { const position = axisTickPosition(value, effectiveYMin, effectiveYMax); return usesYAxisEdgeOverlay(config) && axisAffixApplies(config.yAxisAffixScope, position) ? '' : formatYAxisNumber(value, config, position) } },
    axisLine: { show: config.showYAxisLine, onZero: false, lineStyle: axisLineStyle },
    axisTick: { show: config.showYTicks, inside: false, length: config.tickLength, lineStyle: axisLineStyle },
    splitLine: { show: config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  },
  }
}

const cartesian = (id: Exclude<ChartConfig['kind'], 'scatter' | 'bubble' | 'dumbbell' | 'range-line' | 'step-range-line' | 'confidence-line'>, label: string, category: ChartPlugin['category']): LegacyChartPlugin => ({
  ...pluginModel(id),
  id,
  label,
  category,
  settings: {
    sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
    series: isBarChart(id) || isAreaChart(id) ? ['color'] : ['color', 'line', 'markers'],
    features: { directLabels: true, barLayout: isBarChart(id), dataPreparation: false, normalizedStack: isNormalizedStackedChart(id), areaLayout: isAreaChart(id), scatterLayout: false, distributionLayout: false, lineVariant: id === 'step-line' || category === 'smoothing' },
  },
  buildOption(table, sourceConfig) {
    const config = isHorizontalBarChart(id) ? { ...sourceConfig, barOrientation: 'horizontal' as const }
      : id === 'seasonal-line' ? { ...sourceConfig, dateLabelFormat: 'month-only-ru' as const, dateAxisStepUnit: 'month' as const, dateAxisAnchor: undefined, xAxisMin: '', xAxisMax: '', xAxisStep: 1 }
      : sourceConfig
    const area = isAreaChart(id), stacked = isStackedChart(id)
    const absorbBarLabels = isBarChart(id) && Boolean(config.barValueLabelAbsorption)
    const prepared = prepareVisibleChartData(table, config)
    const displayValue = (value: number | null) => formatChartNumber(value, config)
    const directLabels = Boolean(config.showDirectLabels)
    const directLabelsLeft = directLabels && id !== 'seasonal-line' && config.barOrientation !== 'horizontal' && config.yAxisPosition === 'right'
    const directWidth = directLabelWidth(config, prepared.series)
    const hasLineOverrides = new Set(!isBarChart(id) && !area && id !== 'spline' ? prepared.series.flatMap((series) => prepared.categories.some((category) => {
      const override = config.elementStyles[elementKey(series.name, category)]
      return override && (override.color != null || override.lineWidth != null || override.lineType != null)
    }) ? [series.name] : []) : [])
    const baseSeries = prepared.series.map((series, seriesIndex) => {
      const style = config.seriesStyles[series.name]
      const seasonal = id === 'seasonal-line'
      const accentYears = config.seasonalAccentYears ?? []
      const accented = accentYears.includes(series.name)
      const showSeriesDirectLabel = Boolean(config.showDirectLabels) && (style?.showDirectLabel ?? (!seasonal || accented))
      const color = getSeriesColor(config, series.name, seriesIndex)
      const lineOpacity = seasonal && !accented && style?.color == null ? config.seasonalMutedOpacity ?? .45 : 1
      const layerZ = seasonal && accented ? 1000 + seriesIndex : 30 + (prepared.series.length - seriesIndex) * 10
      const firstIndex = series.data.findIndex((value) => value != null)
      const lastIndex = series.data.reduce((result, value, index) => value == null ? result : index, -1)
      const directTextStyle = style?.directLabelText ?? config.directLabelText ?? config.legendText
      const directName = style?.legendLabel?.trim() || series.name
      const directText = style?.legendNote ? `{name|${directName}}\n{note|${style.legendNote}}` : `{name|${directName}}`
      const showLeader = style?.showLegendLine ?? config.showDirectLabelLines ?? false
      const valueLabelLayout = (params: { dataIndex?: number; rect?: { width: number; height: number }; labelRect?: { width: number; height: number } }) => {
        if (showSeriesDirectLabel && params.dataIndex === lastIndex) return { align: 'left', moveOverlap: 'shiftY', hideOverlap: false }
        return { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: config.barOrientation === 'horizontal' ? 'shiftY' : 'shiftX' }
      }
      const directLabelStyle = {
        formatter: directText,
        color,
        fontFamily: directTextStyle.fontFamily,
        fontSize: directTextStyle.size,
        fontWeight: directTextStyle.weight,
        fontStyle: directTextStyle.italic ? 'italic' : 'normal',
        width: directWidth,
        overflow: 'break',
        align: 'left',
        lineHeight: Math.round(directTextStyle.size * directTextStyle.lineHeight / 100),
        rich: {
          name: { color: style?.directLabelText?.color ?? color, fontFamily: directTextStyle.fontFamily, fontWeight: directTextStyle.weight, fontStyle: directTextStyle.italic ? 'italic' : 'normal', fontSize: directTextStyle.size },
          note: { color: style?.directLabelText?.color ?? color, fontFamily: directTextStyle.fontFamily, fontSize: Math.max(8, directTextStyle.size - 2), opacity: .75 },
        },
      }
      const seriesValueLabel = { show: config.showValues && !absorbBarLabels, position: valueLabelPosition(config, id), formatter: (params: { value?: unknown }) => { const value = Array.isArray(params.value) ? params.value.at(-1) : params.value; return formatChartNumber(value, config) }, ...text(config.valueText), color: isBarChart(id) && isInsideValueLabel(config) && (config.valueLabelAutoContrast ?? true) ? contrastText(color) : config.valueText.color }
      return {
      name: series.name,
      type: isBarChart(id) ? 'bar' : 'line',
      stack: stacked ? 'total' : undefined,
      triggerEvent: true,
      smooth: id === 'spline' ? 0.45 : false,
      smoothMonotone: id === 'spline' ? 'x' : undefined,
      step: id === 'step-line' ? (config.stepPosition ?? 'end') : undefined,
      showSymbol: !isBarChart(id),
      symbol: style?.markerShape ?? 'circle',
      symbolSize: style?.markerSize ?? 8,
      connectNulls: !isBarChart(id) && config.missingMode === 'connect',
      clip: true,
      itemStyle: isBarChart(id) ? { color, opacity: style?.fillOpacity ?? config.barFillOpacity ?? 1, borderWidth: 0, borderRadius: config.barBorderRadius ?? 0 } : { color: style?.markerFill ?? '#ffffff', borderColor: style?.markerBorder ?? color, borderWidth: style?.markerBorderWidth ?? 2 },
      barCategoryGap: isBarChart(id) ? `${100 - Math.max(10, Math.min(100, config.barWidth ?? 68))}%` : undefined,
      barGap: isBarChart(id) ? `${config.barSeriesGap ?? 30}%` : undefined,
      lineStyle: { color, width: style?.lineWidth ?? 3, type: style?.lineType ?? 'solid', opacity: hasLineOverrides.has(series.name) ? 0 : lineOpacity },
      areaStyle: area ? { color, opacity: style?.fillOpacity ?? config.areaFillOpacity ?? .32 } : undefined,
      emphasis: isBarChart(id) ? undefined : { scale: false },
      z: layerZ,
      label: seriesValueLabel,
      markLine: seriesIndex === 0 && config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: config.zeroLineColor ?? '#8a8791', width: config.zeroLineWidth ?? 1, type: config.zeroLineType ?? 'solid' }, label: { show: false } } : undefined,
      endLabel: !isBarChart(id) && showSeriesDirectLabel && !directLabelsLeft ? { show: true, distance: config.directLabelGap ?? 14, ...directLabelStyle } : undefined,
      labelLine: showSeriesDirectLabel ? { show: showLeader, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } : undefined,
      labelLayout: isBarChart(id) ? valueLabelLayout : showSeriesDirectLabel
        ? { align: directLabelsLeft ? 'right' : 'left', moveOverlap: 'shiftY', hideOverlap: false }
        : { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: 'shiftY' },
      data: series.data.map((value, index) => {
        const category = prepared.categories[index]
          const point = pointData(config, series.name, category, value)
        if (isBarChart(id)) {
          const element = config.elementStyles[elementKey(series.name, category)]
          const itemStyle = element && (element.color != null || element.fillOpacity != null || element.borderColor != null || element.borderWidth != null) ? { color: element.color ?? color, opacity: element.fillOpacity ?? style?.fillOpacity ?? config.barFillOpacity ?? 1, borderColor: element.borderColor ?? style?.borderColor ?? config.barBorderColor ?? color, borderWidth: element.borderWidth ?? style?.borderWidth ?? config.barBorderWidth ?? 0 } : point.itemStyle
          const customWidth = element?.barWidth != null || style?.barWidth != null
          const fillItemStyle = itemStyle ? Object.fromEntries(Object.entries(itemStyle).filter(([key]) => key !== 'borderColor' && key !== 'borderWidth')) : undefined
          const pointItemStyle = customWidth ? { ...fillItemStyle, color: 'rgba(0,0,0,0)', opacity: 1 } : fillItemStyle
          const labelStyle = element?.valueText ?? config.valueText
          const label = !absorbBarLabels && (point.label || customWidth && config.showValues) ? { formatter: formatChartNumber(value, config), ...(point.label ?? { show: true, ...text(labelStyle) }), position: valueLabelPosition(config, id), color: isInsideValueLabel(config) && (config.valueLabelAutoContrast ?? true) ? contrastText(element?.color ?? color) : labelStyle.color } : undefined
          const barPoint = { ...point, ...(pointItemStyle ? { itemStyle: pointItemStyle } : {}), ...(absorbBarLabels ? { label: { show: false }, emphasis: { label: { show: false } } } : label ? { label, emphasis: { label } } : {}) }
          return showSeriesDirectLabel && index === lastIndex ? { ...barPoint, directLegendLabel: true, valueLabel: barPoint.label ?? seriesValueLabel, label: { show: true, position: 'right', distance: config.directLabelGap ?? 14, ...directLabelStyle }, labelLine: { show: showLeader, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } } : barPoint
        }
        const marker = config.elementStyles[elementKey(series.name, category)]
        const visible = marker?.showMarker ?? style?.showMarker ?? false
        const directLabel = showSeriesDirectLabel && directLabelsLeft && index === firstIndex
        return {
          ...point,
          symbol: marker?.markerShape ?? style?.markerShape ?? 'circle',
          symbolSize: visible ? marker?.markerSize ?? style?.markerSize ?? 8 : 0,
          itemStyle: {
            color: marker?.markerFill ?? style?.markerFill ?? '#ffffff',
            borderColor: marker?.markerBorder ?? style?.markerBorder ?? marker?.color ?? color,
            borderWidth: marker?.markerBorderWidth ?? style?.markerBorderWidth ?? 2,
          },
          ...(directLabel ? { directLegendLabel: true, label: { show: true, position: 'left', distance: config.directLabelGap ?? 14, ...directLabelStyle, align: 'right' }, labelLine: { show: showLeader, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } } : {}),
        }
      }),
    }})
    const individualBarSeries = isBarChart(id) ? prepared.series.flatMap((series, seriesIndex) => series.data.flatMap((value, dataIndex) => {
      if (value == null) return []
      const category = prepared.categories[dataIndex], element = config.elementStyles[elementKey(series.name, category)], seriesStyle = config.seriesStyles[series.name]
      const widthPercent = element?.barWidth ?? seriesStyle?.barWidth
      const color = element?.color ?? getSeriesColor(config, series.name, seriesIndex)
      const opacity = element?.fillOpacity ?? seriesStyle?.fillOpacity ?? config.barFillOpacity ?? 1
      const borderColor = element?.borderColor ?? seriesStyle?.borderColor ?? config.barBorderColor ?? color
      const borderWidth = element?.borderWidth ?? seriesStyle?.borderWidth ?? config.barBorderWidth ?? 0
      const customWidth = widthPercent != null
      if (!customWidth && borderWidth <= 0) return []
      return [{
        name: series.name, customBarOf: series.name, type: 'custom', coordinateSystem: 'cartesian2d', clip: true, z: 80, tooltip: { show: false },
        renderItem: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number]; style(overrides?: Record<string, unknown>): Record<string, unknown> }) => {
          const index = api.value(0), numeric = api.value(1), horizontal = config.barOrientation === 'horizontal'
          const stacked = isStackedBarChart(id)
          const previous = stacked ? prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => { const part = candidate.data[dataIndex] ?? 0; return Math.sign(part) === Math.sign(numeric) ? sum + part : sum }, 0) : 0
          const endpoint = stacked ? previous + numeric : numeric
          const point = api.coord(horizontal ? [endpoint, index] : [index, endpoint]), zero = api.coord(horizontal ? [0, index] : [index, 0])
          const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
          const { width: normalWidth, offset } = barSeriesGeometry(band, config, prepared.series.length, seriesIndex, stacked)
          const thickness = normalWidth * (customWidth ? Math.max(.1, Math.min(2, widthPercent / 100)) : 1)
          const segmentStart = stacked ? api.coord(horizontal ? [previous, index] : [index, previous]) : zero
          const length = Math.max(1, Math.abs(segmentStart[horizontal ? 0 : 1] - point[horizontal ? 0 : 1]))
          const inset = Math.min(borderWidth / 2, thickness / 2, length / 2)
          const shape = horizontal
            ? { x: Math.min(point[0], segmentStart[0]) + inset, y: point[1] + offset - thickness / 2 + inset, width: Math.max(0, length - inset * 2), height: Math.max(0, thickness - inset * 2), r: Math.max(0, config.barBorderRadius ?? 0) }
            : { x: point[0] + offset - thickness / 2 + inset, y: Math.min(point[1], segmentStart[1]) + inset, width: Math.max(0, thickness - inset * 2), height: Math.max(0, length - inset * 2), r: Math.max(0, config.barBorderRadius ?? 0) }
          const visual = api.style()
          const fill = customWidth ? String(visual.fill ?? visual.color ?? color) : 'rgba(0,0,0,0)'
          const visualOpacity = typeof visual.opacity === 'number' ? visual.opacity : opacity
          const stroke = String(visual.stroke ?? visual.borderColor ?? borderColor)
          const lineWidth = Number(visual.lineWidth ?? visual.borderWidth ?? borderWidth)
          return { type: 'rect', shape, style: { fill, opacity: visualOpacity, stroke, lineWidth } }
        },
        data: [{ value: [dataIndex, value], elementKey: elementKey(series.name, category), sourceSeriesName: series.name, displayValue: displayValue(value), displayCategory: category instanceof Date ? formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(category ?? ''), itemStyle: { color, opacity, borderColor, borderWidth } }],
      }]
    })) : []
    const absorbedLabelSeries = absorbBarLabels ? prepared.series.map((series, seriesIndex) => {
      const horizontal = config.barOrientation === 'horizontal'
      const maximumLabelMetrics = series.data.reduce((maximum, value, dataIndex) => {
        if (value == null) return maximum
        const category = prepared.categories[dataIndex], override = config.elementStyles[elementKey(series.name, category)]
        if (!(override?.showLabel ?? config.showValues)) return maximum
        const labelStyle = override?.valueText ?? config.valueText
        const label = override?.label || displayValue(value)
        return {
          width: Math.max(maximum.width, measureTextWidth(label, labelStyle.size, labelStyle.fontFamily, labelStyle.weight)),
          height: Math.max(maximum.height, Math.round(labelStyle.size * labelStyle.lineHeight / 100)),
        }
      }, { width: 0, height: 0 })
      return {
      name: `__bar-value-labels:${series.name}`,
      type: 'custom',
      coordinateSystem: 'cartesian2d',
      clip: false,
      z: 110,
      tooltip: { show: false },
      renderItem: (params: { coordSys?: { x: number; y: number; width: number; height: number } }, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
        const dataIndex = api.value(0), value = series.data[dataIndex]
        if (value == null) return null
        const category = prepared.categories[dataIndex], key = elementKey(series.name, category), override = config.elementStyles[key]
        if (!(override?.showLabel ?? config.showValues)) return null
        const previous = stacked ? prepared.series.slice(0, seriesIndex).reduce((sum, candidate) => {
          const part = candidate.data[dataIndex] ?? 0
          const sameSide = Math.sign(part) === Math.sign(value)
          return sameSide ? sum + part : sum
        }, 0) : 0
        const endpoint = stacked ? previous + value : value
        const start = api.coord(horizontal ? [previous, dataIndex] : [dataIndex, previous])
        const end = api.coord(horizontal ? [endpoint, dataIndex] : [dataIndex, endpoint])
        const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
        const { width: barThickness, offset } = barSeriesGeometry(band, config, prepared.series.length, seriesIndex, stacked)
        end[horizontal ? 1 : 0] += offset
        const labelStyle = override?.valueText ?? config.valueText, label = override?.label || displayValue(value)
        const textWidth = measureTextWidth(label, labelStyle.size, labelStyle.fontFamily, labelStyle.weight)
        const textHeight = Math.round(labelStyle.size * labelStyle.lineHeight / 100)
        const stride = denseValueLabelStride(horizontal, band, maximumLabelMetrics.width || textWidth, maximumLabelMetrics.height || textHeight, config.valueLabelHideOverlap ?? false)
        if (!showDenseValueLabel(dataIndex, prepared.categories.length, stride)) return null
        const placement = absorbedBarLabelPlacement(horizontal, start[horizontal ? 0 : 1], end[horizontal ? 0 : 1], end[horizontal ? 1 : 0], textWidth, textHeight, config.barValueLabelAbsorptionPadding ?? 10, config.barValueLabelInsidePosition ?? 'end', config.barValueLabelOutsidePosition ?? 'end', barThickness)
        if (params.coordSys && horizontal) placement.y = Math.max(params.coordSys.y + textHeight / 2 + 2, Math.min(params.coordSys.y + params.coordSys.height - textHeight / 2 - 2, placement.y))
        else if (params.coordSys) placement.x = Math.max(params.coordSys.x + textWidth / 2 + 2, Math.min(params.coordSys.x + params.coordSys.width - textWidth / 2 - 2, placement.x))
        const fill = placement.inside && (config.valueLabelAutoContrast ?? true) ? contrastText(override?.color ?? getSeriesColor(config, series.name, seriesIndex)) : labelStyle.color
        return { type: 'text', style: { x: placement.x, y: placement.y, text: label, ...graphicText(labelStyle), fill, align: placement.align, verticalAlign: placement.verticalAlign } }
      },
      data: series.data.flatMap((value, dataIndex) => value == null ? [] : [{
        value: [dataIndex, value],
        elementKey: elementKey(series.name, prepared.categories[dataIndex]),
        sourceSeriesName: series.name,
        displayValue: displayValue(value),
        displayCategory: prepared.categories[dataIndex] instanceof Date ? formatTimeValue(prepared.categories[dataIndex], table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(prepared.categories[dataIndex] ?? ''),
      }]),
      }
    }) : []
    const segmentSeries = !isBarChart(id) ? prepared.series.flatMap((series, seriesIndex) => {
      if (!hasLineOverrides.has(series.name)) return []
      const layerZ = 30 + (prepared.series.length - seriesIndex) * 10
      const valid = series.data.flatMap((value, index) => value == null ? [] : [index])
      const pairs = valid.slice(1).flatMap((right, pairIndex) => {
        const left = valid[pairIndex]
        return config.missingMode === 'connect' || right === left + 1 ? [[left, right] as const] : []
      })
      const baseStyle = config.seriesStyles[series.name]
      const groups = new Map<string, { lineStyle: { color: string; width: number; type: string }; data: Array<[string, number | null] | null> }>()
      pairs.forEach(([left, right]) => {
        const rightStyle = config.elementStyles[elementKey(series.name, prepared.categories[right])]
        const firstStyle = left === 0 ? config.elementStyles[elementKey(series.name, prepared.categories[left])] : undefined
        const candidate = rightStyle ?? firstStyle
        const override = candidate && (candidate.color != null || candidate.lineWidth != null || candidate.lineType != null) ? candidate : undefined
        const lineStyle = { color: override?.color ?? getSeriesColor(config, series.name, seriesIndex), width: override?.lineWidth ?? baseStyle?.lineWidth ?? 3, type: override?.lineType ?? baseStyle?.lineType ?? 'solid' }
        const key = `${lineStyle.color}\u001f${lineStyle.width}\u001f${lineStyle.type}`
        const group = groups.get(key) ?? { lineStyle, data: [] }
        const categoryValue = (index: number) => prepared.categories[index] instanceof Date ? prepared.categories[index].toISOString() : `${index}:${String(prepared.categories[index] ?? '')}`
        group.data.push([categoryValue(left), series.data[left]], [categoryValue(right), series.data[right]], null)
        groups.set(key, group)
      })
      return [...groups.values()].map((group) => ({
          name: series.name,
          segmentOf: series.name,
          type: 'line',
          data: group.data,
          symbol: 'none',
          silent: true,
          animation: false,
          tooltip: { show: false },
          lineStyle: group.lineStyle,
          z: layerZ,
        }))
    }) : []
    const hitSeries = !isBarChart(id) ? prepared.series.map((series) => ({
      name: `__hit__:${series.name}`,
      type: 'line',
      triggerEvent: true,
      smooth: id === 'spline' ? 0.45 : false,
      smoothMonotone: id === 'spline' ? 'x' : undefined,
      data: series.data.map((value, index) => ({ value, elementKey: elementKey(series.name, prepared.categories[index]), sourceSeriesName: series.name, displayValue: value == null ? 'пропуск' : formatChartNumber(value, config), displayCategory: formatTimeValue(prepared.categories[index], table.timeProfiles?.[config.xField], config.dateLabelFormat) })),
      symbol: config.seriesStyles[series.name]?.markerShape ?? 'circle',
      symbolSize: config.seriesStyles[series.name]?.markerSize ?? 8,
      lineStyle: { color: 'rgba(0,0,0,0)', width: 14, opacity: 0 },
      itemStyle: { opacity: 0 },
      tooltip: { show: false },
      animation: false,
      z: 50,
    })) : []
    const common = commonOption(table, config, prepared)
    const numericCategories = prepared.categories.flatMap((value, index) => typeof value === 'number' ? [{ value, coordinate: `${index}:${String(value)}` }] : [])
    const categoryEdges = numericCategories.length ? [{ ...numericCategories[0], cross: common.yAxis.min, position: 'first' as const }, { ...numericCategories.at(-1)!, cross: common.yAxis.min, position: 'last' as const }] : []
    const option = { ...common, series: [...baseSeries, ...individualBarSeries, ...absorbedLabelSeries, ...segmentSeries, ...hitSeries, ...(!isHorizontalBarChart(id) ? [...yAxisEdgeAffixSeries(config, Number(common.yAxis.min), Number(common.yAxis.max)), ...xAxisEdgeAffixSeries(config, categoryEdges)] : [])] }
    if (isBarChart(id) && config.barOrientation === 'horizontal') {
      const mutable = option as unknown as { xAxis: Record<string, unknown>; yAxis: Record<string, unknown>; grid: { top: number; bottom: number; left: number; right: number; containLabel?: boolean }; legend: Record<string, unknown>; graphic: Array<Record<string, unknown>>; series: Array<Record<string, unknown>> }
      const categoryAxis = mutable.xAxis, valueAxis = mutable.yAxis
      const valueLabelText = config.yAxisLabelText ?? config.axisLabelText
      const valueLabelHeight = (config.showYAxisLabels ?? true) ? Math.round(valueLabelText.size * valueLabelText.lineHeight / 100) : 0
      const xTitleStyle = config.xAxisTitleText ?? config.axisTitleText, yTitleStyle = config.yAxisTitleText ?? config.axisTitleText
      const categoryLabelText = config.xAxisLabelText ?? config.axisLabelText
      const commonCategoryFormatter = (categoryAxis.axisLabel as { formatter?: (value: string, index: number) => string } | undefined)?.formatter
      const categoryLabels = prepared.categories.map((_value, index) => commonCategoryFormatter?.('', index) ?? '')
      const categoryLabelWidth = Math.max(0, ...categoryLabels.map((label) => Math.max(...label.split('\n').map((line) => measureTextWidth(line, categoryLabelText.size, categoryLabelText.fontFamily, categoryLabelText.weight)))))
      const categoryLabelSpace = (config.showXAxisLabels ?? true) ? Math.ceil(categoryLabelWidth + (config.xAxisLabelGap ?? 8)) : 0
      const xTitleReserve = config.showXAxisTitle && config.xAxisTitle ? Math.round(xTitleStyle.size * xTitleStyle.lineHeight / 100) * Math.max(1, config.xAxisTitle.split('\n').length) + config.xAxisTitleGap : 0
      const yTitleReserve = config.showYAxisTitle && config.yAxisTitle ? Math.round(yTitleStyle.size * yTitleStyle.lineHeight / 100) * Math.max(1, config.yAxisTitle.split('\n').length) + config.yAxisTitleGap : 0
      const horizontalReserveDelta = yTitleReserve - xTitleReserve
      if (config.xAxisPosition === 'top') mutable.grid.top = Math.max(0, mutable.grid.top + horizontalReserveDelta)
      else mutable.grid.bottom = Math.max(0, mutable.grid.bottom + horizontalReserveDelta)
      mutable.grid.containLabel = false
      // The category labels and the rotated category-axis title need separate rails.
      // ECharts only reserves the label rail here; without this extra title rail the
      // title is painted directly on top of the labels.
      const categoryTitleRail = xTitleReserve
      if (config.yAxisPosition === 'right') mutable.grid.right = (config.canvasMarginRight ?? 24) + categoryTitleRail + categoryLabelSpace
      else mutable.grid.left = (config.canvasMarginLeft ?? CONTENT_LEFT) + categoryTitleRail + categoryLabelSpace
      mutable.xAxis = { ...valueAxis, position: config.xAxisPosition, name: config.showYAxisTitle ? config.yAxisTitle : '', nameRotate: 0, nameGap: valueLabelHeight + (config.showXTicks ? config.tickLength : 0) + ((config.showYAxisLabels ?? true) ? config.yAxisLabelGap ?? 8 : 0) + config.yAxisTitleGap, axisLabel: { ...(valueAxis.axisLabel as object), show: config.showYAxisLabels ?? true, margin: config.yAxisLabelGap ?? 8, formatter: (value: number) => {
        const position = axisTickPosition(value, Number(valueAxis.min), Number(valueAxis.max))
        if (isNormalizedStackedChart(id)) return usesYAxisEdgeOverlay(config) && axisAffixApplies(config.yAxisAffixScope, position) ? '' : formatYAxisNumber(value, config, position)
        return usesXAxisEdgeOverlay(config) && axisAffixApplies(config.xAxisAffixScope, position) ? '' : formatXAxisNumber(value, config, position)
      } } }
      const categoryPosition = config.yAxisPosition
      mutable.yAxis = { ...categoryAxis, inverse: config.categoryAxisInverse ?? true, position: categoryPosition, name: '', axisLine: { ...(categoryAxis.axisLine as object) }, axisLabel: { ...(categoryAxis.axisLabel as object), show: config.showXAxisLabels ?? true, align: categoryPosition === 'right' ? 'left' : 'right', margin: config.xAxisLabelGap ?? 8, rotate: 0, width: categoryLabelWidth, overflow: undefined, hideOverlap: false, formatter: (_value: string, index: number) => categoryLabels[index] ?? '' } }
      mutable.graphic = [
        ...mutable.graphic.filter((item) => item.id !== 'chart-y-axis-title'),
        ...(config.showXAxisTitle && config.xAxisTitle ? [{ id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? config.canvasMarginLeft ?? CONTENT_LEFT : undefined, right: config.yAxisPosition === 'right' ? config.canvasMarginRight ?? 24 : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: config.xAxisTitle, ...graphicText(xTitleStyle), lineHeight: Math.round(xTitleStyle.size * xTitleStyle.lineHeight / 100), align: 'center', verticalAlign: 'middle' } }] : []),
      ]
      const cross = (mutable.yAxis.data as unknown[] | undefined)?.[0]
      if (cross != null) mutable.series.push(...xAxisEdgeAffixSeries(config, [{ coordinate: Number(valueAxis.min), cross, value: Number(valueAxis.min), position: 'first' }, { coordinate: Number(valueAxis.max), cross, value: Number(valueAxis.max), position: 'last' }]))
      mutable.series.forEach((series) => { const markLine = series.markLine as { data: Array<Record<string, number>> } | undefined; if (markLine) markLine.data = [{ xAxis: 0 }] })
    }
    return option
  },
})

const nativeIntervalPlugin = (id: 'range-line' | 'step-range-line' | 'confidence-line', label: string): LegacyChartPlugin => {
  const base = cartesian(id === 'step-range-line' ? 'step-line' : 'line', label, 'trend')
  return { ...base, ...pluginModel(id), id, label, settings: { ...base.settings, features: { ...base.settings.features, lineVariant: true } } }
}

const dumbbellBase = cartesian('bar', 'Гантельная', 'comparison')
const dumbbell: LegacyChartPlugin = {
  ...dumbbellBase, ...pluginModel('dumbbell'),
  id: 'dumbbell',
  label: 'Гантельная',
  category: 'comparison',
  settings: { ...dumbbellBase.settings, series: ['color', 'markers'], features: { ...dumbbellBase.settings.features, directLabels: false, barLayout: false, lineVariant: true } },
  buildOption(table, config) {
    const startField = config.dumbbellStartField, endField = config.dumbbellEndField
    const configured = startField && endField && startField !== endField
    const fields = configured ? [startField, endField] : [config.yField]
    const orientation = config.dumbbellOrientation ?? 'horizontal'
    const scoped = { ...config, seriesField: '', yFields: fields, yField: fields[0], barOrientation: orientation }
    const option = dumbbellBase.buildOption(table, scoped) as { xAxis: { data?: unknown[]; axisLabel?: Record<string, unknown>; boundaryGap?: boolean }; yAxis: { data?: unknown[]; axisLabel?: Record<string, unknown> }; legend?: Record<string, unknown>; tooltip?: Record<string, unknown>; series: Array<Record<string, unknown>> }
    const edgeAffixes = option.series.filter((series) => series.name === '__x-axis-edge-affixes' || series.name === '__y-axis-edge-affixes')
    if (!configured) { option.series = []; return option }
    if (orientation === 'vertical') option.xAxis.boundaryGap = true
    const prepared = prepareVisibleChartData(table, scoped)
    const start = prepared.series.find((series) => series.name === startField)
    const end = prepared.series.find((series) => series.name === endField)
    if (!start || !end) { option.series = []; return option }
    const rows = prepared.categories.flatMap((category, index) => {
      const startValue = start.data[index], endValue = end.data[index]
      return startValue == null || endValue == null ? [] : [{ category, start: startValue, end: endValue }]
    })
    const sort = config.dumbbellSort ?? 'none'
    if (sort !== 'none') {
      const value = (row: typeof rows[number]) => sort === 'difference' ? row.end - row.start : sort === 'start' ? row.start : row.end
      const direction = config.dumbbellSortDirection === 'asc' ? 1 : -1
      rows.sort((left, right) => (value(left) - value(right)) * direction)
    }
    const items = rows.map((row, index) => ({
      ...row,
      key: row.category instanceof Date ? row.category.toISOString() : `${index}:${String(row.category ?? '')}`,
      label: row.category instanceof Date ? formatTimeValue(row.category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(row.category ?? ''),
    }))
    const labels = new Map(items.map((item) => [item.key, item.label]))
    const categoryAxis = orientation === 'horizontal' ? option.yAxis : option.xAxis
    categoryAxis.data = items.map((item) => item.key)
    categoryAxis.axisLabel = { ...categoryAxis.axisLabel, formatter: (value: string) => labels.get(value) ?? value }
    const startColor = getSeriesColor(config, startField, 0), endColor = getSeriesColor(config, endField, 1)
    const point = (item: typeof items[number], field: string, value: number, otherValue: number, color: string) => {
      const lower = field === startField ? value <= otherValue : value < otherValue
      return {
      value: orientation === 'horizontal' ? [value, item.key] : [item.key, value],
      elementKey: elementKey(field, item.category),
      sourceSeriesName: field,
      displayValue: formatChartNumber(value, config),
      displayCategory: item.label,
      itemStyle: { color: config.elementStyles[elementKey(field, item.category)]?.color ?? color },
      label: { show: config.showValues && (field === startField ? config.dumbbellShowStartValue ?? true : config.dumbbellShowEndValue ?? true), position: orientation === 'horizontal' ? lower ? 'left' : 'right' : lower ? 'bottom' : 'top', formatter: formatChartNumber(value, config), ...text(config.valueText) },
    }
    }
    const changeLabel = (item: typeof items[number]) => formatChange(describeChange(item.start, item.end), config.dumbbellDifferenceFormat ?? 'absolute', config, config.dumbbellPercentDecimals ?? 0)
    const changeColor = (item: typeof items[number]) => !config.dumbbellColorByChange
      ? config.dumbbellConnectorColor ?? config.gridColor
      : semanticChangeColor(describeChange(item.start, item.end), config.dumbbellIncreaseColor ?? '#168a72', config.dumbbellDecreaseColor ?? '#db5a5a', config.dumbbellNeutralColor ?? '#777580')
    option.series = [
      {
        name: '__dumbbell-connectors', type: 'custom', silent: true, tooltip: { show: false }, z: 0, zlevel: 0,
        data: items.map((item) => orientation === 'horizontal' ? [item.start, item.end, item.key] : [item.key, item.start, item.end]),
        renderItem: (_params: { dataIndex: number }, api: { value(index: number): number | string; coord(value: unknown[]): number[] }) => {
          const left = orientation === 'horizontal' ? api.coord([api.value(0), api.value(2)]) : api.coord([api.value(0), api.value(1)])
          const right = orientation === 'horizontal' ? api.coord([api.value(1), api.value(2)]) : api.coord([api.value(0), api.value(2)])
          const item = items[_params.dataIndex]
          const color = item ? changeColor(item) : config.dumbbellConnectorColor ?? config.gridColor
          const connectorType = config.dumbbellConnectorType ?? 'solid'
          return { type: 'group', children: [
            { type: 'line', shape: { x1: left[0], y1: left[1], x2: right[0], y2: right[1] }, style: { stroke: color, opacity: config.dumbbellConnectorOpacity ?? 1, lineWidth: config.dumbbellConnectorWidth ?? 3, lineDash: connectorType === 'dashed' ? [8, 5] : connectorType === 'dotted' ? [2, 4] : undefined, lineCap: 'round' } },
            ...(config.dumbbellShowDifference && item ? [(() => {
              const position = config.dumbbellDifferencePosition ?? 'middle'
              const offset = config.valueText.size / 2 + (orientation === 'horizontal' ? 6 : 8)
              const middle = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2]
              const style = orientation === 'horizontal'
                ? position === 'start' ? { x: Math.min(left[0], right[0]) - offset, y: middle[1], textAlign: 'right', textVerticalAlign: 'middle' } : position === 'end' ? { x: Math.max(left[0], right[0]) + offset, y: middle[1], textAlign: 'left', textVerticalAlign: 'middle' } : { x: middle[0], y: middle[1] - offset, textAlign: 'center', textVerticalAlign: 'middle' }
                : position === 'start' ? { x: middle[0], y: Math.min(left[1], right[1]) - 8, textAlign: 'center', textVerticalAlign: 'bottom' } : position === 'end' ? { x: middle[0], y: Math.max(left[1], right[1]) + 8, textAlign: 'center', textVerticalAlign: 'top' } : { x: middle[0] + offset, y: middle[1], textAlign: 'left', textVerticalAlign: 'middle' }
              return { type: 'text', style: { ...style, text: changeLabel(item), fill: config.dumbbellColorByChange ? color : config.valueText.color, font: `${config.valueText.italic ? 'italic ' : ''}${config.valueText.weight} ${config.valueText.size}px ${config.valueText.fontFamily}` } }
            })()] : []),
          ] }
        },
      },
      { name: startField, type: 'scatter', triggerEvent: true, symbol: config.seriesStyles[startField]?.markerShape ?? 'circle', symbolSize: config.seriesStyles[startField]?.markerSize ?? 12, itemStyle: { color: startColor }, data: items.map((item) => point(item, startField, item.start, item.end, startColor)), z: 10, zlevel: 1 },
      { name: endField, type: 'scatter', triggerEvent: true, symbol: config.seriesStyles[endField]?.markerShape ?? 'circle', symbolSize: config.seriesStyles[endField]?.markerSize ?? 12, itemStyle: { color: endColor }, data: items.map((item) => point(item, endField, item.end, item.start, endColor)), z: 10, zlevel: 1 },
      ...edgeAffixes,
    ]
    if (option.legend) option.legend.data = [startField, endField]
    option.tooltip = { trigger: 'axis', formatter: (input: unknown) => {
      const entries = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number }>
      const item = items[entries[0]?.dataIndex ?? 0]
      return item ? `<b>${escapeHtml(item.label)}</b><br/>${escapeHtml(startField)}: <b>${escapeHtml(formatChartNumber(item.start, config))}</b><br/>${escapeHtml(endField)}: <b>${escapeHtml(formatChartNumber(item.end, config))}</b><br/>Изменение: <b>${escapeHtml(changeLabel(item))}</b>` : ''
    } }
    return option
  },
}

export function waterfallElementColor(table: DataTable, config: ChartConfig, key: string) {
  const prepared = prepareVisibleChartData(table, { ...config, yFields: [config.yFields[0] ?? config.yField], seriesField: '', barCategorySort: 'none' })
  const source = prepared.series[0]
  if (!source) return undefined
  const totalLabel = config.waterfallTotalLabel?.trim() || 'Итого'
  if (key === elementKey(source.name, totalLabel)) return config.waterfallTotalColor ?? '#6956e8'
  const index = prepared.categories.findIndex((category) => elementKey(source.name, category) === key)
  const delta = index < 0 ? null : waterfallSteps(source.data).steps[index]?.delta
  return delta == null ? undefined : delta >= 0 ? config.waterfallIncreaseColor ?? '#36a476' : config.waterfallDecreaseColor ?? '#db5a5a'
}

export function chartElementColor(table: DataTable, config: ChartConfig, key: string) {
  const plugin = getChartPlugin(config.kind)
  if (plugin.compilerMode === 'native') {
    if (!plugin.validate(table, config).ok) return undefined
    const scene = plugin.compile(table, config)
    if (scene.migrationMode !== 'native') throw new Error(`Native plugin ${plugin.id} returned a legacy scene.`)
    return nativeMarkSelections(scene).find((mark) => mark.legacyKey === key)?.color
  }
  const option = plugin.buildOption(table, config) as { series?: Array<{ name?: string; itemStyle?: { color?: unknown }; data?: unknown[]; labelItems?: unknown[] }> }
  const nested = (items: unknown[]): Array<Record<string, unknown>> => items.flatMap((item) => item && typeof item === 'object'
    ? [item as Record<string, unknown>, ...nested((item as { children?: unknown[] }).children ?? [])]
    : [])
  for (const [seriesIndex, series] of (option.series ?? []).entries()) {
    const point = nested([...(series.data ?? []), ...(series.labelItems ?? [])]).find((item) => item.elementKey === key)
    if (!point) continue
    const color = (point.itemStyle as { color?: unknown } | undefined)?.color ?? series.itemStyle?.color
    if (typeof color === 'string') return color
    return getSeriesColor(config, String(point.sourceSeriesName ?? series.name ?? ''), seriesIndex)
  }
  return undefined
}

const waterfallBase = cartesian('bar', 'Waterfall', 'comparison')
const waterfall: LegacyChartPlugin = { ...waterfallBase, ...pluginModel('waterfall'), id: 'waterfall', label: 'Waterfall', settings: { ...waterfallBase.settings, series: [], features: { ...waterfallBase.settings.features, directLabels: false } }, buildOption: legacyWaterfallBuilderGuard }

const lollipop = (id: 'lollipop' | 'horizontal-lollipop', label: string): LegacyChartPlugin => {
  const horizontal = id === 'horizontal-lollipop'
  const base = cartesian(horizontal ? 'horizontal-bar' : 'bar', label, horizontal ? 'bar-horizontal' : 'comparison')
  return {
    ...base, ...pluginModel(id), id, label,
    settings: { ...base.settings, series: ['color', 'markers'], features: { ...base.settings.features, barLayout: false } },
    buildOption(table, config) {
      const option = base.buildOption(table, { ...config, barOrientation: horizontal ? 'horizontal' : 'vertical', barValueLabelAbsorption: false }) as { series: Array<Record<string, unknown>>; xAxis: { data?: string[] }; yAxis: { data?: string[] }; grid?: { left?: number; right?: number; top?: number; bottom?: number } }
      const bars = option.series.filter((series) => series.type === 'bar')
      const edgeAffixes = option.series.filter((series) => series.name === '__x-axis-edge-affixes' || series.name === '__y-axis-edge-affixes')
      const categoryData = (horizontal ? option.yAxis.data : option.xAxis.data) ?? []
      const categoryExtent = horizontal
        ? (config.canvasHeight ?? 563) - Number(option.grid?.top ?? 0) - Number(option.grid?.bottom ?? 0)
        : (config.canvasWidth ?? 1000) - Number(option.grid?.left ?? 0) - Number(option.grid?.right ?? 0)
      const categoryBand = Math.max(1, categoryExtent / Math.max(1, categoryData.length))
      const stems = bars.flatMap((series) => {
        const name = String(series.name ?? ''), style = config.seriesStyles[name]
        const color = style?.color ?? (series.itemStyle as { color?: string } | undefined)?.color ?? config.color
        return (series.data as Array<Record<string, unknown>>).flatMap((point, index) => typeof point.value === 'number' ? [[categoryData[index], point.value, color, Math.max(1, style?.lineWidth ?? 2), index] as const] : [])
      }).sort((left, right) => left[4] - right[4] || Math.abs(right[1]) - Math.abs(left[1]))
      option.series = [
        { name: '__lollipop-stems', type: 'custom', coordinateSystem: 'cartesian2d', encode: horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }, silent: true, tooltip: { show: false }, z: 2, data: stems, renderItem: (_params: { dataIndex: number }, api: { value(index: number): string | number; coord(value: [string | number, string | number]): [number, number] }) => {
          const category = api.value(0), value = Number(api.value(1)), color = String(api.value(2)), width = Number(api.value(3))
          const start = horizontal ? api.coord([0, category]) : api.coord([category, 0])
          const end = horizontal ? api.coord([value, category]) : api.coord([category, value])
          return { type: 'line', shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] }, style: { stroke: color, lineWidth: width, opacity: .72, lineCap: 'round' } }
        } },
        ...bars.flatMap((series) => {
        const name = String(series.name ?? '')
        const style = config.seriesStyles[name]
        const color = style?.color ?? (series.itemStyle as { color?: string } | undefined)?.color ?? config.color
        const markerSize = style?.markerSize ?? 12
        const points = series.data as Array<Record<string, unknown>>
        return [{ ...series, type: 'scatter', barWidth: undefined, barGap: undefined, symbol: style?.markerShape ?? 'circle', symbolSize: markerSize, itemStyle: { color: style?.markerFill ?? color, borderColor: style?.markerBorder ?? color, borderWidth: style?.markerBorderWidth ?? 1 }, labelLayout: { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: horizontal ? 'shiftY' : 'shiftX' }, data: points.map((point, index) => {
          const label = (point.directLegendLabel ? point.valueLabel : point.label) as Record<string, unknown> | undefined
          const labelStyle = label ?? { show: true, formatter: point.displayValue, ...text(config.valueText) }
          const baseSize = Number(labelStyle.fontSize ?? config.valueText.size), lineHeight = Number(labelStyle.lineHeight ?? Math.round(baseSize * config.valueText.lineHeight / 100))
          const content = String(labelStyle.formatter ?? point.displayValue ?? '')
          const textWidth = measureTextWidth(content, baseSize, String(labelStyle.fontFamily ?? config.valueText.fontFamily), Number(labelStyle.fontWeight ?? config.valueText.weight))
          const stride = denseValueLabelStride(horizontal, categoryBand, textWidth, lineHeight, config.valueLabelHideOverlap ?? false)
          return { ...point, symbolSize: markerSize, itemStyle: { ...(point.itemStyle as object), color: style?.markerFill ?? (point.itemStyle as { color?: string } | undefined)?.color ?? color, borderColor: style?.markerBorder ?? color, borderWidth: style?.markerBorderWidth ?? 1 }, label: label || config.showValues ? { ...labelStyle, show: Boolean(labelStyle.show ?? config.showValues) && showDenseValueLabel(index, points.length, stride), position: horizontal ? 'right' : 'top', distance: 7, color: String(labelStyle.color ?? config.valueText.color), fontSize: baseSize, lineHeight } : undefined }
        }), z: 3 }]
      }),
        ...edgeAffixes,
      ]
      return option
    },
  }
}

const slope: LegacyChartPlugin = (() => {
  const base = cartesian('line', 'Наклонный график', 'trend')
  return {
    ...base, ...pluginModel('slope'), id: 'slope', label: 'Наклонный график',
    settings: { ...base.settings, features: { ...base.settings.features, lineVariant: true } },
    validate(table, config) {
      const result = validateMapping(table, config)
      const positions = new Set(table.rows.map((row) => slopePositionKey(row[config.xField])))
      const selected = config.slopeXValues ?? []
      const validSelection = selected.length === 2 && new Set(selected).size === 2 && selected.every((value) => positions.has(value))
      if (!validSelection && positions.size !== 2) result.errors.push({ field: 'slopeXValues', message: 'Выберите две позиции по оси X для наклонного графика.' })
      return { ok: result.errors.length === 0, errors: result.errors }
    },
    buildOption(table, config) {
      const showSlopeValues = config.slopeShowValues ?? true
      const showSlopeNames = config.slopeShowSeriesNames ?? true
      const option = base.buildOption(table, { ...config, showValues: showSlopeValues || showSlopeNames, showLegend: false, showDirectLabels: false }) as { grid: { left: number; right: number }; xAxis: Record<string, unknown>; series: Array<Record<string, unknown>>; yAxis: Record<string, unknown> }
      const axisLine = option.xAxis.axisLine as { lineStyle?: object } | undefined
      option.xAxis = { ...option.xAxis, boundaryGap: true, axisLine: { ...axisLine, show: false }, splitLine: { ...(option.xAxis.splitLine as object), show: false } }
      const yAxis = option.yAxis as { min?: unknown; max?: unknown; interval?: unknown }
      const yMin = Number(yAxis.min), yMax = Number(yAxis.max), yStep = Number(yAxis.interval)
      const yGridValues = (config.showHorizontalGrid || config.slopeShowYAxis) && Number.isFinite(yMin) && Number.isFinite(yMax) && yStep > 0
        ? Array.from({ length: Math.min(50, Math.round((yMax - yMin) / yStep) + 1) }, (_, index) => yMin + index * yStep)
        : []
      const yLabelStyle = config.yAxisLabelText ?? config.axisLabelText
      const gridDash = config.gridType === 'dashed' ? [6, 4] : config.gridType === 'dotted' ? [2, 3] : undefined
      const lineDash = config.axisLineType === 'dashed' ? [6, 4] : config.axisLineType === 'dotted' ? [2, 3] : undefined
      option.series.push({ name: '__slope-guides__', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, animation: false, z: 1, data: [[0, 0]], renderItem: (params: { coordSys: { x: number; y: number; width: number; height: number } }, api: { coord(values: [number, number]): [number, number] }) => {
        const { x, y, width, height } = params.coordSys
        const first = x + width / 4, last = x + width * 3 / 4, axisY = config.xAxisPosition === 'top' ? y : y + height
        const extension = Math.min(80, width * .16)
        return { type: 'group', children: [
          ...yGridValues.flatMap((value) => {
            const yPosition = api.coord([0, value])[1]
            return [
              ...(config.showHorizontalGrid ? [{ type: 'line', shape: { x1: first - extension, y1: yPosition, x2: last + extension, y2: yPosition }, style: { stroke: config.gridColor, lineWidth: config.gridWidth, lineDash: gridDash } }] : []),
              ...(config.slopeShowYAxis && (config.showYAxisLabels ?? true) ? [{ type: 'text', style: { text: formatYAxisNumber(value, config, axisTickPosition(value, yMin, yMax)), x: first - extension - (config.yAxisLabelGap ?? 8), y: yPosition, fill: yLabelStyle.color, fontFamily: yLabelStyle.fontFamily, fontSize: yLabelStyle.size, fontWeight: yLabelStyle.weight, fontStyle: yLabelStyle.italic ? 'italic' : 'normal', textAlign: 'right', textVerticalAlign: 'middle' } }] : []),
            ]
          }),
          ...(config.showVerticalGrid ? [first, last].map((position) => ({ type: 'line', shape: { x1: position, y1: y, x2: position, y2: y + height }, style: { stroke: config.gridColor, lineWidth: config.gridWidth, lineDash: gridDash } })) : []),
          ...(config.showXAxisLine ? [{ type: 'line', shape: { x1: first - extension, y1: axisY, x2: last + extension, y2: axisY }, style: { stroke: config.axisLineColor, lineWidth: config.axisLineWidth, lineDash } }] : []),
        ] }
      }})
      option.yAxis = { ...option.yAxis, axisLabel: { ...(option.yAxis.axisLabel as object), show: false }, splitLine: { ...(option.yAxis.splitLine as object), show: false } }
      option.series = option.series.map((series) => {
        if (series.type !== 'line' || String(series.name ?? '').startsWith('__')) return series
        const name = String(series.name ?? ''), style = config.seriesStyles[name]
        const color = style?.color ?? (series.lineStyle as { color?: string } | undefined)?.color ?? config.color
        const labelName = style?.legendLabel?.trim() || name
        const labelFormatter = (value: unknown, index: number) => index === 1 && showSlopeNames
          ? showSlopeValues ? `{value|${String(value ?? '')}} {name|${labelName}}` : `{name|${labelName}}`
          : showSlopeValues ? String(value ?? '') : ''
        return { ...series, showSymbol: true, symbol: style?.markerShape ?? 'circle', symbolSize: style?.markerSize ?? 11, lineStyle: { ...(series.lineStyle as object), width: style?.lineWidth ?? 2.5 }, itemStyle: { color: style?.markerFill ?? color, borderColor: style?.markerBorder ?? config.canvasBackground ?? '#ffffff', borderWidth: style?.markerBorderWidth ?? 2 }, labelLayout: { moveOverlap: 'shiftY', hideOverlap: false }, data: (series.data as Array<Record<string, unknown>>).map((point, index) => { const showLabel = showSlopeValues || index === 1 && showSlopeNames; return { ...point, symbolSize: style?.markerSize ?? 11, itemStyle: { ...(point.itemStyle as object), color: style?.markerFill ?? color, borderColor: style?.markerBorder ?? color, borderWidth: style?.markerBorderWidth ?? 2 }, label: showLabel ? { show: true, formatter: labelFormatter(point.displayValue, index), position: index === 0 ? 'left' : 'right', distance: 8, ...text(config.valueText), color, rich: { value: { color, fontWeight: config.valueText.weight }, name: { color, fontWeight: config.valueText.weight } } } : { ...(point.label as object), show: false } } }) }
      })
      return option
    },
  }
})()

const indexedLine: LegacyChartPlugin = (() => {
  const base = cartesian('indexed-line', 'Индекс к дате', 'trend')
  return {
    ...base, ...pluginModel('indexed-line'), id: 'indexed-line', label: 'Индекс к дате',
    settings: { ...base.settings, features: { ...base.settings.features, lineVariant: true } },
    validate(table, config) {
      const result = validateMapping(table, config)
      const positions = new Set(table.rows.map((row) => slopePositionKey(row[config.xField])))
      if (!config.indexBaseXValue || !positions.has(config.indexBaseXValue)) result.errors.push({ field: 'indexBaseXValue', message: 'Выберите базовую дату для индекса.' })
      else if (!table.rows.some((row) => slopePositionKey(row[config.xField]) === config.indexBaseXValue && config.yFields.some((field) => typeof row[field] === 'number' && row[field] !== 0))) result.errors.push({ field: 'indexBaseXValue', message: 'В базовую дату должно быть ненулевое значение.' })
      return { ok: result.errors.length === 0, errors: result.errors }
    },
  }
})()

const seasonalLine: LegacyChartPlugin = (() => {
  const base = cartesian('seasonal-line', 'Сравнение по годам', 'trend')
  return {
    ...base, ...pluginModel('seasonal-line'), id: 'seasonal-line', label: 'Сравнение по годам',
    settings: { ...base.settings, features: { ...base.settings.features, lineVariant: true } },
    validate(table, config) {
      const result = validateMapping(table, config)
      const dates = table.rows.map((row) => row[config.xField]).filter((value): value is Date => value instanceof Date)
      if (!dates.length) result.errors.push({ field: 'xField', message: 'Для сравнения по годам выберите колонку с датами.' })
      else if (new Set(dates.map((date) => date.getFullYear())).size < 2) result.errors.push({ field: 'xField', message: 'Для сравнения нужны данные минимум за два года.' })
      return { ok: result.errors.length === 0, errors: result.errors }
    },
  }
})()

const heatmap: LegacyChartPlugin = {
  ...pluginModel('heatmap'),
  id: 'heatmap',
  label: heatmapChartDefinitions[0][1],
  category: 'heatmap',
  defaultConfig: { kind: 'heatmap', showYAxisTitle: false, showLegend: false, showDirectLabels: false, showValues: false },
  settings: {
    sections: ['annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
    series: ['color'],
    features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: false, lineVariant: false },
  },
  validate(table, config) {
    return validateMapping(table, config)
  },
  buildOption(table, config) {
    const prepared = prepareVisibleChartData(table, { ...config, seriesField: '' })
    const base = commonOption(table, config, prepared) as Record<string, unknown> & { grid: { top: number; right: number; bottom: number; left: number }; legend: Record<string, unknown>; xAxis: Record<string, unknown> & { axisLabel?: { formatter?: (value: string, index: number) => string } } }
    const xLabels = prepared.categories.map((value) => value instanceof Date ? formatTimeValue(value, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(value ?? ''))
    const rowMetric = (data: Array<number | null>) => {
      const values = data.filter((value): value is number => value != null && Number.isFinite(value))
      if (!values.length) return Number.NEGATIVE_INFINITY
      if (config.heatmapRowSort === 'min') return Math.min(...values)
      if (config.heatmapRowSort === 'max') return Math.max(...values)
      if (config.heatmapRowSort === 'last') return values.at(-1)!
      return values.reduce((sum, value) => sum + value, 0) / values.length
    }
    const sortedSeries = prepared.series.map((series, index) => ({ series, index }))
    if ((config.heatmapRowSort ?? 'none') !== 'none') sortedSeries.sort((left, right) => ((rowMetric(left.series.data) - rowMetric(right.series.data)) * (config.heatmapRowSortDirection === 'ascending' ? 1 : -1)) || left.index - right.index)
    const rows = sortedSeries.map(({ series }) => series)
    const yLabels = rows.map((series) => series.name)
    const missingColor = config.heatmapMissingColor ?? '#e8e7eb', missingLabel = config.heatmapMissingLabel ?? '—'
    const values = rows.flatMap((series) => series.data.filter((value): value is number => value != null && Number.isFinite(value)))
    const minimum = values.length ? Math.min(...values) : 0, maximum = values.length ? Math.max(...values) : 1
    const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
    const low = config.heatmapLowColor ?? '#2c6aa8', middle = config.heatmapMidColor ?? '#f5f5f2', high = config.heatmapHighColor ?? '#c83e4d'
    const diverging = (config.heatmapScaleMode ?? 'diverging') === 'diverging', midpoint = config.heatmapMidpoint ?? 0
    const distance = Math.max(Math.abs(minimum - midpoint), Math.abs(maximum - midpoint), 1)
    const automaticMinimum = diverging ? midpoint - distance : minimum, automaticMaximum = diverging ? midpoint + distance : maximum === minimum ? minimum + 1 : maximum
    const requestedMinimum = config.heatmapScaleMin != null && Number.isFinite(config.heatmapScaleMin) ? config.heatmapScaleMin : undefined
    const requestedMaximum = config.heatmapScaleMax != null && Number.isFinite(config.heatmapScaleMax) ? config.heatmapScaleMax : undefined
    let scaleMinimum = requestedMinimum ?? automaticMinimum, scaleMaximum = requestedMaximum ?? automaticMaximum
    if (scaleMaximum <= scaleMinimum) {
      if (requestedMinimum != null && requestedMaximum == null) scaleMaximum = scaleMinimum + 1
      else if (requestedMaximum != null && requestedMinimum == null) scaleMinimum = scaleMaximum - 1
      else if (requestedMinimum != null && requestedMaximum != null && requestedMinimum !== requestedMaximum) [scaleMinimum, scaleMaximum] = [requestedMaximum, requestedMinimum]
      else { scaleMinimum = automaticMinimum; scaleMaximum = automaticMaximum }
    }
    const colorMidpoint = Math.min(scaleMaximum, Math.max(scaleMinimum, midpoint))
    const midpointRatio = (colorMidpoint - scaleMinimum) / (scaleMaximum - scaleMinimum)
    const cellColor = (value: number) => diverging
      ? value <= colorMidpoint
        ? mixHexColors(low, middle, (value - scaleMinimum) / Math.max(Number.EPSILON, colorMidpoint - scaleMinimum))
        : mixHexColors(middle, high, (value - colorMidpoint) / Math.max(Number.EPSILON, scaleMaximum - colorMidpoint))
      : mixHexColors(low, high, (value - scaleMinimum) / (scaleMaximum - scaleMinimum))
    const points = rows.flatMap((series, y) => series.data.map((value, x) => {
      const color = value == null ? missingColor : cellColor(value)
      return {
        value: [x, y, value],
        elementKey: elementKey(series.name, prepared.categories[x]),
        sourceSeriesName: series.name,
        displayValue: value == null ? missingLabel : formatChartNumber(value, config),
        displayCategory: `${xLabels[x]} · ${series.name}`,
        itemStyle: { color },
        label: { color: config.valueLabelAutoContrast ?? true ? contrastText(color) : config.valueText.color },
      }
    }))
    const showScale = config.heatmapShowScale ?? true
    const scalePosition = config.heatmapScalePosition ?? 'right', verticalScale = scalePosition === 'right' || scalePosition === 'left'
    const scaleReserve = showScale ? verticalScale ? 80 : 60 : 0
    const grid = {
      ...base.grid,
      right: base.grid.right + (scalePosition === 'right' ? scaleReserve : 0),
      left: base.grid.left + (scalePosition === 'left' ? scaleReserve : 0),
      top: base.grid.top + (scalePosition === 'top' ? scaleReserve : 0),
      bottom: base.grid.bottom + (scalePosition === 'bottom' ? scaleReserve : 0),
    }
    const graphic = Array.isArray(base.graphic) ? base.graphic.map((item) => {
      if (scalePosition !== 'left' || !showScale || config.yAxisPosition !== 'left' || typeof item !== 'object' || item == null || (item as { id?: string }).id !== 'chart-y-axis-title') return item
      return { ...item, left: (config.canvasMarginLeft ?? 32) + scaleReserve }
    }) : base.graphic
    const canvasWidth = config.canvasWidth ?? 1000, canvasHeight = config.canvasHeight ?? 750
    const middleValue = diverging ? colorMidpoint : (scaleMinimum + scaleMaximum) / 2
    const scaleStops = diverging
      ? [{ offset: 0, color: low }, { offset: midpointRatio, color: middle }, { offset: 1, color: high }]
      : [{ offset: 0, color: low }, { offset: 1, color: high }]
    const scaleText = (value: number) => formatYAxisNumber(value, config)
    const scaleTextStyle = { ...graphicText(config.legendText), verticalAlign: 'middle' }
    const scaleGraphics: Array<Record<string, unknown>> = []
    if (showScale && !verticalScale) {
      const width = Math.min(520, Math.max(220, canvasWidth * .52)), height = 12, x = (canvasWidth - width) / 2
      const y = scalePosition === 'top' ? base.grid.top + 8 : canvasHeight - base.grid.bottom - 40
      scaleGraphics.push(
        { id: 'heatmap-scale-bar', type: 'rect', z: 90, silent: true, shape: { x, y: y + 24, width, height }, style: { fill: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: scaleStops } } },
        ...[[0, scaleMinimum], [diverging ? midpointRatio : .5, middleValue], [1, scaleMaximum]].flatMap(([ratio, value], index) => {
          const tickX = x + width * ratio
          return [
            { id: `heatmap-scale-tick-${index}`, type: 'line', z: 91, silent: true, info: { ratio }, shape: { x1: tickX, y1: y + 14, x2: tickX, y2: y + 22 }, style: { stroke: config.legendText.color, lineWidth: 1 } },
            { id: `heatmap-scale-label-${index}`, type: 'text', z: 91, silent: true, info: { ratio }, style: { ...scaleTextStyle, x: tickX, y: y + 5, text: scaleText(value), align: 'center' } },
          ]
        }),
      )
    } else if (showScale) {
      const width = 12, height = Math.min(180, Math.max(90, canvasHeight * .24)), y = base.grid.top + 8
      const x = scalePosition === 'left' ? config.canvasMarginLeft ?? 32 : canvasWidth - (config.canvasMarginRight ?? 24) - width
      const labelX = scalePosition === 'left' ? x + width + 8 : x - 8, align = scalePosition === 'left' ? 'left' : 'right'
      scaleGraphics.push(
        { id: 'heatmap-scale-bar', type: 'rect', z: 90, silent: true, shape: { x, y, width, height }, style: { fill: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: scaleStops.map((stop) => ({ offset: 1 - stop.offset, color: stop.color })).reverse() } } },
        ...[[0, scaleMaximum], [diverging ? 1 - midpointRatio : .5, middleValue], [1, scaleMinimum]].flatMap(([ratio, value], index) => {
          const tickY = y + height * ratio
          return [
            { id: `heatmap-scale-tick-${index}`, type: 'line', z: 91, silent: true, info: { ratio }, shape: { x1: x - 3, y1: tickY, x2: x + width + 3, y2: tickY }, style: { stroke: config.legendText.color, lineWidth: 1 } },
            { id: `heatmap-scale-label-${index}`, type: 'text', z: 91, silent: true, info: { ratio }, style: { ...scaleTextStyle, x: labelX, y: tickY, text: scaleText(value), align } },
          ]
        }),
      )
    }
    return {
      ...base,
      grid,
      graphic: [...(Array.isArray(graphic) ? graphic : []), ...scaleGraphics],
      legend: { ...base.legend, show: false },
      tooltip: { trigger: 'item', formatter: (params: { data?: { value?: Array<number | null> } }) => { const [x = 0, y = 0, value] = params.data?.value ?? []; return `<b>${escapeHtml(yLabels[Number(y)])}</b><br/>${escapeHtml(xLabels[Number(x)])}: <b>${escapeHtml(value == null ? missingLabel : formatChartNumber(value, config))}</b>` } },
      visualMap: { show: false, min: scaleMinimum, max: scaleMaximum, seriesIndex: 0, calculable: false, inRange: { color: diverging ? [low, middle, high] : [low, high] } },
      xAxis: { ...base.xAxis, data: xLabels, boundaryGap: true, splitArea: { show: false }, splitLine: { show: config.showVerticalGrid, interval: (base.xAxis.axisLabel as { interval?: unknown } | undefined)?.interval, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } } },
      yAxis: { type: 'category', data: yLabels, inverse: true, position: config.yAxisPosition, name: '', axisLabel: { ...text(config.yAxisLabelText ?? config.axisLabelText), show: config.showYAxisLabels ?? true, margin: config.yAxisLabelGap ?? 8 }, axisLine: { show: config.showYAxisLine, lineStyle: axisLineStyle }, axisTick: { show: config.showYTicks, length: config.tickLength, lineStyle: axisLineStyle }, splitArea: { show: false }, splitLine: { show: config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } } },
      series: [{ name: 'Тепловая карта', type: 'heatmap', data: points, progressive: 1000, animationDuration: 240, itemStyle: { borderColor: config.canvasBackground ?? '#ffffff', borderWidth: config.heatmapCellGap ?? 1, borderRadius: 0 }, emphasis: { itemStyle: { borderColor: config.axisLineColor, borderWidth: 1 } }, label: { show: config.showValues, formatter: (params: { value?: Array<number | null> }) => params.value?.[2] == null ? missingLabel : formatChartNumber(params.value[2], config), ...text(config.valueText) } }],
    }
  },
}

type TreemapNode = {
  name: string
  value: number
  children?: TreemapNode[]
  itemStyle?: Record<string, unknown>
  label?: Record<string, unknown>
  upperLabel?: Record<string, unknown>
  elementKey?: string
  sourceSeriesName?: string
  displayCategory?: string
  displayValue?: string
  displayLabel?: string
}

const treemap: LegacyChartPlugin = {
  ...pluginModel('treemap'),
  id: 'treemap',
  label: treemapChartDefinitions[0][1],
  category: 'hierarchy',
  defaultConfig: { kind: 'treemap', aggregation: 'sum', showValues: true, showLegend: false, showDirectLabels: false, showXAxisTitle: false, showYAxisTitle: false },
  settings: {
    sections: ['series', 'annotations', 'text', 'headings', 'legend-values', 'credits'],
    series: ['color'],
    features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: false, lineVariant: false },
  },
  inferMapping,
  validate(table, config) {
    const errors: Array<{ field: string; message: string }> = []
    if (!config.xField || !table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку с категориями.' })
    if (config.treemapSubcategoryField && !table.columns.includes(config.treemapSubcategoryField)) errors.push({ field: 'treemapSubcategoryField', message: 'Выберите существующую колонку с подкатегориями.' })
    if (config.treemapSubcategoryField === config.xField) errors.push({ field: 'treemapSubcategoryField', message: 'Категория и подкатегория должны быть разными колонками.' })
    if (!config.yField || !table.columns.includes(config.yField) || !table.rows.some((row) => {
      const value = row[config.yField]
      return typeof value === 'number' && Number.isFinite(value) && value > 0
    })) errors.push({ field: 'yField', message: 'Выберите числовую колонку, содержащую положительные значения.' })
    return { ok: errors.length === 0, errors }
  },
  buildOption(table, config) {
    const prepared = prepareVisibleChartData(table, { ...config, seriesField: '', aggregation: 'sum' })
    const base = commonOption(table, { ...config, showXAxisLabels: false, showYAxisLabels: false, showXAxisTitle: false, showYAxisTitle: false, showXAxisLine: false, showYAxisLine: false, showXTicks: false, showYTicks: false, showHorizontalGrid: false, showVerticalGrid: false, showLegend: false }, prepared) as Record<string, unknown> & { grid: { top: number; right: number; bottom: number; left: number }; legend: Record<string, unknown> }
    const groups = new Map<string, Map<string, number[]>>()
    for (const row of table.rows) {
      const raw = row[config.yField]
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) continue
      const category = String(row[config.xField] ?? 'Без категории')
      const subcategory = config.treemapSubcategoryField ? String(row[config.treemapSubcategoryField] ?? 'Без подкатегории') : category
      const leaves = groups.get(category) ?? new Map<string, number[]>()
      leaves.set(subcategory, [...(leaves.get(subcategory) ?? []), raw])
      groups.set(category, leaves)
    }
    const aggregate = (values: number[]) => {
      if (config.aggregation === 'count') return values.length
      if (config.aggregation === 'average') return values.reduce((sum, value) => sum + value, 0) / values.length
      if (config.aggregation === 'min') return Math.min(...values)
      if (config.aggregation === 'max') return Math.max(...values)
      return values.reduce((sum, value) => sum + value, 0)
    }
    const hiddenCategories = new Set(config.treemapHiddenCategories ?? [])
    const visibleGroups = [...groups.entries()].map(([category, leaves], index) => ({ category, leaves, index })).filter(({ category }) => !hiddenCategories.has(category))
    const total = visibleGroups.reduce((sum, { leaves }) => sum + [...leaves.values()].reduce((leafSum, values) => leafSum + aggregate(values), 0), 0)
    const formatTreemapValue = (value: number) => config.treemapValueFormat === 'percent'
      ? formatChartNumber(total ? value / total * 100 : 0, { ...config, valueMode: 'percent', numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', valueLabelAffixesLinked: true })
      : formatChartNumber(value, config)
    const palette = config.palette?.length ? config.palette : [config.color, ...PALETTE.slice(1)]
    const leaf = (category: string, name: string, values: number[], color: string, categoryLabelColor: string, suppressDefaultValue = false): TreemapNode => {
      const value = aggregate(values)
      const key = elementKey(category, name)
      const override = config.elementStyles[key]
      const labelStyle = override?.valueText ?? config.treemapLeafText ?? config.valueText
      const fill = override?.color ?? color
      const labelColor = (override?.labelAutoContrast ?? config.valueLabelAutoContrast ?? true) ? (override?.color ? contrastText(fill) : categoryLabelColor) : labelStyle.color
      const duplicateGroupName = Boolean(config.treemapSubcategoryField && name === category)
      const labelsVisible = config.treemapShowLeafLabels ?? true
      const showName = override?.showLabel === false ? false : override?.showName ?? (labelsVisible && !duplicateGroupName)
      const showValue = override?.showLabel === false ? false : override?.showValue ?? ((config.treemapShowLeafValues ?? (labelsVisible && config.showValues)) && !suppressDefaultValue)
      const position = override?.treemapLabelPosition ?? config.treemapLabelPosition ?? 'bottom-right'
      const share = value / total
      const adaptiveSize = treemapAdaptiveFontSize(labelStyle.size, share, 6)
      const lines = [
        showName ? override?.label || name : '',
        showValue ? formatTreemapValue(value) : '',
      ].filter(Boolean).join('\n')
      return {
        name,
        value,
        elementKey: key,
        sourceSeriesName: category,
        displayCategory: config.treemapSubcategoryField ? `${category} · ${name}` : category,
        displayValue: formatTreemapValue(value),
        displayLabel: override?.label || name,
        itemStyle: { color: fill, borderColor: config.canvasBackground ?? '#ffffff', borderWidth: 0 },
        label: {
          show: Boolean(lines),
          formatter: lines,
          position: treemapLabelPosition(position),
          overflow: 'break',
          padding: adaptiveSize <= 8 ? 2 : 4,
          ...text(labelStyle),
          fontSize: adaptiveSize,
          color: labelColor,
          fontWeight: labelStyle.weight,
          lineHeight: Math.round(adaptiveSize * 1.18),
        },
      }
    }
    const data: TreemapNode[] = orderedTreemapNodes(visibleGroups.map(({ category, leaves, index }) => {
      const groupKey = `treemap-group:${category}`
      const groupOverride = config.elementStyles[groupKey]
      const color = groupOverride?.color ?? config.seriesStyles[category]?.color ?? palette[index % palette.length]
      const categoryLabelColor = contrastText(color)
      const groupLabelsVisible = config.treemapShowGroupLabels ?? true
      const groupShowValue = groupOverride?.showLabel === false ? false : groupOverride?.showValue ?? (config.treemapShowGroupValues ?? (groupLabelsVisible && config.showValues))
      const children = orderedTreemapNodes([...leaves.entries()].map(([name, values], leafIndex) => leaf(
        category,
        name,
        values,
        config.treemapSubcategoryField ? mixHexColors(color, '#ffffff', Math.min(.3, leafIndex * .08)) : color,
        categoryLabelColor,
        Boolean(config.treemapSubcategoryField && leaves.size === 1 && groupShowValue),
      )), config.treemapLeafOrder?.[category])
      if (!config.treemapSubcategoryField) return { ...children[0], itemStyle: { ...children[0].itemStyle, color } }
      const value = children.reduce((sum, child) => sum + child.value, 0)
      const key = groupKey
      const override = groupOverride
      const labelStyle = override?.valueText ?? config.treemapGroupText ?? config.valueText
      const labelColor = (override?.labelAutoContrast ?? config.valueLabelAutoContrast ?? true) ? categoryLabelColor : labelStyle.color
      const showName = override?.showLabel === false ? false : override?.showName ?? groupLabelsVisible
      const showValue = groupShowValue
      const position = override?.treemapLabelPosition ?? config.treemapGroupLabelPosition ?? 'top-left'
      const share = value / total
      const adaptiveSize = treemapAdaptiveFontSize(labelStyle.size, share, 7)
      const groupLabel = [showName ? override?.label || category : '', showValue ? formatTreemapValue(value) : ''].filter(Boolean).join('\n')
      return {
        name: category,
        value,
        children,
        elementKey: key,
        sourceSeriesName: category,
        displayCategory: category,
        displayValue: formatTreemapValue(value),
        displayLabel: override?.label || category,
        itemStyle: { color, borderColor: config.canvasBackground ?? '#ffffff', borderWidth: 0 },
        label: {
          show: Boolean(groupLabel),
          formatter: groupLabel,
          opacity: 1,
          position: treemapLabelPosition(position),
          padding: adaptiveSize <= 9 ? 3 : 4,
          textBorderColor: color,
          textBorderWidth: 3,
          overflow: 'break',
          ...text(labelStyle),
          fontSize: adaptiveSize,
          color: labelColor,
          fontWeight: Math.max(700, labelStyle.weight),
          lineHeight: Math.round(adaptiveSize * 1.15),
        },
      }
    }), config.treemapGroupOrder)
    const hasGroups = data.some((node) => node.children)
    const groupLabels = data.map((node) => ({
      ...node,
      children: undefined,
      upperLabel: undefined,
      label: node.children ? node.label : { show: false },
      itemStyle: { color: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0 },
    }))
    const layout = {
      left: base.grid.left,
      top: base.grid.top,
      right: base.grid.right,
      bottom: base.grid.bottom,
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      sort: false,
      squareRatio: 1.15,
    }
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    return {
      ...base,
      legend: { ...base.legend, show: false },
      xAxis: undefined,
      yAxis: undefined,
      tooltip: { trigger: 'item', confine: true, enterable: false, extraCssText: 'max-width:280px;white-space:normal;pointer-events:none;', formatter: (params: { data?: TreemapNode; treePathInfo?: Array<{ name: string }> }) => {
        const item = params.data
        if (!item) return ''
        const path = params.treePathInfo?.slice(1).map((part) => part.name).filter(Boolean).join(' · ') || item.name
        return `<b>${escapeHtml(path)}</b><br/>${escapeHtml(item.displayValue ?? formatChartNumber(item.value, config))}`
      } },
      series: [{
        name: 'Treemap',
        type: 'treemap',
        ...layout,
        data,
        visibleMin: 0,
        childrenVisibleMin: 0,
        label: { show: true, position: treemapLabelPosition(config.treemapLabelPosition ?? 'bottom-right'), overflow: 'break', padding: 7 },
        upperLabel: { show: false },
        itemStyle: { borderColor: config.canvasBackground ?? '#ffffff', borderWidth: 0, gapWidth: config.treemapGap ?? 2 },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: config.treemapGroupGap ?? 5 } },
          { colorSaturation: [.42, .7], upperLabel: { show: false }, itemStyle: { borderColorSaturation: .3, borderWidth: 0, gapWidth: config.treemapGap ?? 2 } },
          { colorSaturation: [.3, .65], itemStyle: { borderWidth: 0, gapWidth: config.treemapGap ?? 2 } },
        ],
        emphasis: { itemStyle: { borderColor: config.axisLineColor, borderWidth: Math.max(2, config.treemapGap ?? 2) } },
        animationDuration: reducedMotion ? 0 : 420,
        animationDurationUpdate: reducedMotion ? 0 : 280,
        animationEasingUpdate: 'cubicOut',
      }, ...(hasGroups ? [{
        name: '__treemap-groups',
        type: 'treemap',
        ...layout,
        data: groupLabels,
        silent: true,
        z: 5,
        zlevel: 1,
        visibleMin: 0,
        label: { show: true, overflow: 'break', opacity: 1 },
        upperLabel: { show: false },
        itemStyle: { color: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, gapWidth: config.treemapGroupGap ?? 5 },
        levels: [
          { itemStyle: { color: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, gapWidth: config.treemapGroupGap ?? 5 } },
          { itemStyle: { color: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, gapWidth: config.treemapGroupGap ?? 5 } },
        ],
        emphasis: { disabled: true },
        animationDuration: 0,
        animationDurationUpdate: reducedMotion ? 0 : 280,
        animationEasingUpdate: 'cubicOut',
      }] : [])],
    }
  },
}

const relationshipSettings: LegacyChartPlugin['settings'] = {
  sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
  series: ['color', 'markers'],
  features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: true, distributionLayout: false, lineVariant: false },
}
export const legacyRelationshipBuilderGuard = () => { throw new Error('Legacy Scatter/Bubble builder was removed; use the native XY compiler.') }
const scatter: LegacyChartPlugin = { ...pluginModel('scatter'), id: 'scatter', label: relationshipChartDefinitions[0][1], category: 'relationship', settings: relationshipSettings, buildOption: legacyRelationshipBuilderGuard }
const bubble: LegacyChartPlugin = { ...pluginModel('bubble'), id: 'bubble', label: relationshipChartDefinitions[1][1], category: 'relationship', settings: relationshipSettings, buildOption: legacyRelationshipBuilderGuard }

export const legacyDistributionBuilderGuard = () => { throw new Error('Legacy Distribution builder was removed; use the native Distribution compiler.') }
const distribution: LegacyChartPlugin = {
  ...pluginModel('boxplot'), id: 'boxplot', label: distributionChartDefinitions[0][1], category: 'distribution',
  settings: { sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'], series: ['color', 'markers'], features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: true, lineVariant: false } },
  validate(table, config) {
    const fields = config.yFields.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
    return fields.length ? { ok: true, errors: [] } : { ok: false, errors: [{ field: 'yFields', message: 'Выберите хотя бы один числовой показатель для распределения.' }] }
  },
  buildOption: legacyDistributionBuilderGuard,
}

const legacyChartRegistry = [
  ...barChartDefinitions.flatMap(([id, label, category]) => id === 'waterfall' || id === 'lollipop' || id === 'horizontal-lollipop' ? [] : [cartesian(id, label, category)]),
  waterfall,
  lollipop('lollipop', 'Леденцовая'),
  lollipop('horizontal-lollipop', 'Леденцовая горизонтальная'),
  dumbbell,
  ...lineChartDefinitions.flatMap(([id, label]) => id === 'slope' || id === 'indexed-line' || id === 'seasonal-line' ? [] : [cartesian(id, label, 'trend')]),
  indexedLine,
  seasonalLine,
  slope,
  ...smoothingChartDefinitions.map(([id, label]) => cartesian(id, label, 'smoothing')),
  ...intervalChartDefinitions.map(([id, label]) => nativeIntervalPlugin(id, label)),
  ...areaChartDefinitions.map(([id, label]) => cartesian(id, label, 'area')),
  scatter,
  bubble,
  ...distributionChartDefinitions.map(([id, label]) => ({ ...distribution, ...pluginModel(id), id, label, buildOption: legacyDistributionBuilderGuard })),
  heatmap,
  treemap,
]

const nativeBarCapabilities: ChartPlugin['capabilities'] = {
  coordinateSystem: 'cartesian',
  axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } },
  guides: ['legend', 'direct-series'],
  valueLabels: true,
  markers: false,
  orientation: ['vertical', 'horizontal'],
  stacking: ['none', 'stacked', 'normalized'],
}

const nativeLineCapabilities: ChartPlugin['capabilities'] = {
  coordinateSystem: 'cartesian',
  axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } },
  guides: ['legend', 'direct-series'], valueLabels: true, markers: true,
}

const nativeAreaCapabilities: ChartPlugin['capabilities'] = {
  ...nativeLineCapabilities, stacking: ['none', 'stacked', 'normalized'],
}

const nativeSlopeCapabilities: ChartPlugin['capabilities'] = {
  coordinateSystem: 'cartesian',
  axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } },
  guides: [], valueLabels: true, markers: true, endpointLabels: true,
}

const nativeSmoothingCapabilities: ChartPlugin['capabilities'] = {
  coordinateSystem: 'cartesian',
  axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } },
  guides: ['legend', 'direct-series'], valueLabels: true, markers: true,
}

const nativeIntervalCapabilities: ChartPlugin['capabilities'] = {
  coordinateSystem: 'cartesian',
  axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } },
  guides: ['legend', 'direct-series'], valueLabels: true, markers: true,
}

const nativeXYCapabilities = (kind: 'scatter' | 'bubble'): ChartPlugin['capabilities'] => ({
  coordinateSystem: 'cartesian', axes: { x: { scaleTypes: ['linear', 'date'] }, y: { scaleTypes: ['linear', 'log'] } },
  guides: kind === 'bubble' ? ['legend', 'size-scale'] : ['legend'], valueLabels: true, markers: true,
})

const nativeDistributionCapabilities: ChartPlugin['capabilities'] = {
  coordinateSystem: 'cartesian', axes: { lane: { placements: ['side'] }, value: { scaleTypes: ['linear'] } },
  guides: ['legend'], valueLabels: true, markers: true, orientation: ['horizontal', 'vertical'],
}

export const chartRegistry: ChartPlugin[] = legacyChartRegistry.map((plugin) => {
  const compiler = plugin.id === 'waterfall' ? compileNativeWaterfallScene : plugin.id === 'butterfly' ? compileNativeButterflyScene : isNativeBarKind(plugin.id) ? compileNativeBarScene : isNativeLineKind(plugin.id) ? compileNativeLineScene : isNativeAreaKind(plugin.id) ? compileNativeAreaScene : plugin.id === 'slope' ? compileNativeSlopeScene : isNativeSmoothingKind(plugin.id) ? compileNativeSmoothingScene : isNativeIntervalKind(plugin.id) ? compileNativeIntervalScene : isNativeXYKind(plugin.id) ? compileNativeXYScene : isNativeDistributionKind(plugin.id) ? compileNativeDistributionScene : undefined
  if (compiler) return {
    ...plugin, compilerMode: 'native' as const,
    capabilities: plugin.id === 'waterfall' ? { ...nativeBarCapabilities, orientation: ['vertical'] } : plugin.id === 'butterfly' ? { ...nativeBarCapabilities, axes: { category: { placements: ['side', 'internal'] }, value: { scaleTypes: ['linear'] } }, orientation: ['horizontal'], stacking: ['stacked'] } : isNativeBarKind(plugin.id) ? nativeBarCapabilities : isNativeLineKind(plugin.id) ? nativeLineCapabilities : isNativeAreaKind(plugin.id) ? nativeAreaCapabilities : plugin.id === 'slope' ? nativeSlopeCapabilities : isNativeSmoothingKind(plugin.id) ? nativeSmoothingCapabilities : isNativeIntervalKind(plugin.id) ? nativeIntervalCapabilities : isNativeXYKind(plugin.id) ? nativeXYCapabilities(plugin.id) : nativeDistributionCapabilities,
    validate: plugin.id === 'butterfly' ? validateNativeButterflyMapping : isNativeXYKind(plugin.id) ? validateNativeXYMapping : isNativeDistributionKind(plugin.id) ? validateNativeDistributionMapping : plugin.validate,
    compile: compiler,
    buildOption: (table: DataTable, config: ChartConfig) => renderScene(compiler(table, config)),
  }
  return { ...plugin, compilerMode: 'legacy' as const, capabilities: semanticCapabilities(plugin), compile: (table: DataTable, config: ChartConfig) => compileLegacyScene(table, config, plugin.buildOption) }
})

export function getChartPlugin(id: ChartConfig['kind']) {
  return chartRegistry.find((plugin) => plugin.id === id) ?? chartRegistry[0]
}

export function chartValueLabelSelections(table: DataTable, config: ChartConfig): ChartElementSelection[] {
  const listingConfig = config
  const plugin = getChartPlugin(config.kind)
  if (plugin.compilerMode === 'native') {
    if (!plugin.validate(table, listingConfig).ok) return []
    const scene = plugin.compile(table, listingConfig)
    if (scene.migrationMode !== 'native') throw new Error(`Native plugin ${plugin.id} returned a legacy scene.`)
    return nativeMarkSelections(scene).filter((mark) => mark.value != null).map((mark) => ({ key: mark.legacyKey, seriesName: mark.seriesName, category: mark.displayCategory, value: mark.displayValue, label: listingConfig.elementStyles[mark.legacyKey]?.label ?? mark.displayLabel, color: listingConfig.elementStyles[mark.legacyKey]?.color ?? (config.kind === 'waterfall' || config.kind === 'butterfly' ? mark.color : undefined), target: 'value-label' as const }))
  }
  const option = plugin.buildOption(table, listingConfig) as { series?: Array<{ name?: string; data?: unknown[]; labelItems?: unknown[] }> }
  const nestedItems = (items: unknown[]): unknown[] => items.flatMap((raw) => raw && typeof raw === 'object' ? [raw, ...nestedItems((raw as { children?: unknown[] }).children ?? [])] : [])
  const selections = option.series?.flatMap((series) => nestedItems([...(series.data ?? []), ...(series.labelItems ?? [])]).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as { elementKey?: string; sourceSeriesName?: string; displayCategory?: string; displayValue?: string; displayLabel?: string; displayColor?: string; itemStyle?: { color?: unknown }; value?: unknown }
    if (!item.elementKey) return []
    const color = item.displayColor ?? (typeof item.itemStyle?.color === 'string' ? item.itemStyle.color : undefined)
    return [{ key: item.elementKey, seriesName: item.sourceSeriesName ?? series.name ?? '', category: item.displayCategory ?? '', value: item.displayValue ?? String(Array.isArray(item.value) ? item.value.at(-1) ?? '' : item.value ?? ''), label: item.displayLabel, color, target: 'value-label' as const }]
  })) ?? []
  return [...new Map(selections.map((selection) => [selection.key, selection])).values()]
}
