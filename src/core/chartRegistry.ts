import type { ChartConfig, ChartElementSelection, ChartPlugin, DataTable } from './types'
import { formatTimeValue, isoWeekParts } from './timeFrequency'
import { axisAffixApplies, formatChartNumber, formatXAxisNumber, formatYAxisNumber, type AxisTickPosition } from './numberFormat'
import { measureTextWidth, wrapMeasuredText } from './textMetrics'
import { axisValue, dateValue, niceNumericScale, orderedBounds, prepareVisibleChartData, slopePositionKey } from './chartScale'
import { continuousDateLabel, effectiveDateStepUnit, moveDateContextToVisibleLabels, planCategoryDateLabels, stackedContextFormat } from './chartDateAxis'
import { isAreaChart, isBarChart, isDistributionChart, isHorizontalBarChart, isNormalizedStackedChart, isStackedBarChart, isStackedChart } from './chartKinds'
import { barChartDefinitions } from '../features/chart-types/bar'
import { lineChartDefinitions, intervalChartDefinitions } from '../features/chart-types/line'
import { areaChartDefinitions } from '../features/chart-types/area'
import { relationshipChartDefinitions } from '../features/chart-types/relationship'
import { smoothingChartDefinitions } from '../features/chart-types/smoothing'
import { heatmapChartDefinitions } from '../features/chart-types/heatmap'
import { treemapChartDefinitions } from '../features/chart-types/treemap'
import { distributionChartDefinitions } from '../features/chart-types/distribution'
import { repeatedChartCategories } from './chartData'
import { absorbedBarLabelPlacement, barSeriesGeometry, denseValueLabelStride, isInsideValueLabel, showDenseValueLabel, valueLabelPosition } from './chartLabels'
import { hyphenateSync as hyphenateRussian } from 'hyphen/ru'

export { niceNumericScale, prepareVisibleChartData } from './chartScale'

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
  if (config.kind === 'butterfly') {
    const left = config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1)
    const right = config.butterflyRightFields?.length ? config.butterflyRightFields : config.yFields.slice(1, 2)
    if (!left.length || !right.length || new Set([...left, ...right]).size !== left.length + right.length || ![...left, ...right].every(numeric)) errors.push({ field: 'yFields', message: 'Для Butterfly выберите хотя бы по одному разному числовому показателю с каждой стороны.' })
  }
  if ((config.kind === 'range-line' || config.kind === 'step-range-line') && (!numeric(config.rangeLowerField) || !numeric(config.rangeUpperField) || config.rangeLowerField === config.rangeUpperField)) errors.push({ field: 'rangeFields', message: 'Выберите две разные числовые границы диапазона.' })
  if (config.kind === 'confidence-line' && !(config.intervalGroups?.some((group) => new Set([group.main, group.lower, group.upper]).size === 3 && numeric(group.main) && numeric(group.lower) && numeric(group.upper)) || config.yFields.length >= 3 && new Set(config.yFields.slice(0, 3)).size === 3 && config.yFields.slice(0, 3).every(numeric))) errors.push({ field: 'intervalGroups', message: 'Настройте три разных числовых поля: основное значение и две границы.' })
  if (config.aggregation === 'none' && repeatedChartCategories(table, config).length) errors.push({ field: 'aggregation', message: 'Для повторяющихся значений X выберите способ агрегации.' })
  return { ok: errors.length === 0, errors }
}

const pluginModel = (id: ChartConfig['kind']) => ({ defaultConfig: { kind: id }, inferMapping, validate: validateMapping })

export const prepareButterflyChartData = (table: DataTable, config: ChartConfig) => {
  const left = config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1)
  const right = config.butterflyRightFields?.length ? config.butterflyRightFields : config.yFields.slice(1, 2)
  const fields = [...left, ...right]
  const prepared = prepareVisibleChartData(table, { ...config, seriesField: '', yFields: fields, yField: fields[0] ?? config.yField })
  return {
    ...prepared,
    series: prepared.series.map((series) => ({
      ...series,
      data: series.data.map((value) => value == null ? null : Math.abs(value)),
    })),
  }
}

const text = (style: ChartConfig['titleText']) => ({
  fontFamily: style.fontFamily, fontSize: style.size, color: style.color, fontWeight: style.weight,
  fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100),
})
const graphicText = (style: ChartConfig['titleText']) => {
  const { color, ...rest } = text(style)
  return { ...rest, fill: color }
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const PALETTE = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']
export const getSeriesColor = (config: ChartConfig, name: string, index: number) => {
  const palette = config.palette?.length ? config.palette : [config.color, ...PALETTE.slice(1)]
  return config.seriesStyles[name]?.color
    ?? (config.kind === 'seasonal-line' ? config.seasonalAccentYears?.includes(name) ? config.color : config.seasonalMutedColor ?? '#d9d7df' : undefined)
    ?? (isBarChart(config.kind) ? config.barFillColor : undefined)
    ?? palette[index % palette.length]
}
const niceLegendValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return value
  const power = 10 ** Math.floor(Math.log10(value))
  const candidates = [1, 2, 3, 5, 7, 10].map((factor) => factor * power)
  return candidates.reduce((best, candidate) => candidate <= value && candidate > best ? candidate : best, candidates[0])
}
export const movingAverage = (values: Array<number | null>, window: number) => values.map((_, index) => {
  const sample = values.slice(index - window + 1, index + 1)
  return sample.length === window && sample.every((value): value is number => value != null && Number.isFinite(value))
    ? sample.reduce((sum, value) => sum + value, 0) / window
    : null
})
const CONTENT_LEFT = 32
const axisTickPosition = (value: number, minimum: number, maximum: number): AxisTickPosition => {
  const tolerance = Math.max(1, Math.abs(maximum - minimum)) * 1e-9
  if (Math.abs(value - minimum) <= tolerance) return 'first'
  if (Math.abs(value - maximum) <= tolerance) return 'last'
  return 'middle'
}
const alignedLeft = (align: ChartConfig['titleText']['align'], left = CONTENT_LEFT) => align === 'left' ? left : align === 'center' ? 'center' : undefined
const elementKey = (series: string, category: unknown) => `${series}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
const pointLabelPlacement = (position: 'top' | 'right' | 'bottom' | 'left') => ({
  align: position === 'left' ? 'right' : position === 'right' ? 'left' : 'center',
  verticalAlign: position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : 'middle',
  opacity: 1,
})
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
  const directLabels = config.kind !== 'scatter' && visibleDirectSeries.length > 0 && (Boolean(config.showDirectLabels) || config.kind === 'seasonal-line' && Boolean(config.seasonalAccentYears?.length))
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
      const value = config.kind === 'butterfly' && typeof rawValue === 'number' ? Math.abs(rawValue) : rawValue
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

const cartesian = (id: Exclude<ChartConfig['kind'], 'scatter' | 'bubble' | 'dumbbell' | 'range-line' | 'step-range-line' | 'confidence-line'>, label: string, category: ChartPlugin['category']): ChartPlugin => ({
  ...pluginModel(id),
  id,
  label,
  category,
  settings: {
    sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
    series: isBarChart(id) || isAreaChart(id) ? ['color'] : ['color', 'line', 'markers'],
    features: { directLabels: true, barLayout: isBarChart(id), dataPreparation: false, normalizedStack: isNormalizedStackedChart(id), areaLayout: isAreaChart(id), scatterLayout: false, distributionLayout: false, lineVariant: id === 'step-line' || id === 'moving-average-line' || id === 'moving-average-scatter' },
  },
  buildOption(table, sourceConfig) {
    const config = isHorizontalBarChart(id) ? { ...sourceConfig, barOrientation: 'horizontal' as const }
      : id === 'seasonal-line' ? { ...sourceConfig, dateLabelFormat: 'month-only-ru' as const, dateAxisStepUnit: 'month' as const, dateAxisAnchor: undefined, xAxisMin: '', xAxisMax: '', xAxisStep: 1 }
      : sourceConfig
    const area = isAreaChart(id), stacked = isStackedChart(id)
    const absorbBarLabels = isBarChart(id) && Boolean(config.barValueLabelAbsorption)
    const prepared = id === 'butterfly' ? prepareButterflyChartData(table, config) : prepareVisibleChartData(table, config)
    const butterflyLeftFields = new Set(config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1))
    const displayValue = (value: number | null) => formatChartNumber(id === 'butterfly' && value != null ? Math.abs(value) : value, config)
    const directLabels = Boolean(config.showDirectLabels) || id === 'seasonal-line' && Boolean(config.seasonalAccentYears?.length)
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
      const showSeriesDirectLabel = style?.showDirectLabel !== false && (Boolean(config.showDirectLabels) || seasonal && accented)
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
      const butterflyPosition = (configured = config.valueLabelPosition ?? 'auto') => butterflyLeftFields.has(series.name)
        ? ({ auto: 'left', top: 'left', bottom: 'right', 'inside-top': 'insideLeft', 'inside-center': 'inside', 'inside-bottom': 'insideRight' } as const)[configured]
        : valueLabelPosition(config, id)
      const seriesValueLabel = { show: config.showValues && !absorbBarLabels, position: id === 'butterfly' ? butterflyPosition() : valueLabelPosition(config, id), formatter: (params: { value?: unknown }) => { const value = Array.isArray(params.value) ? params.value.at(-1) : params.value; return formatChartNumber(id === 'butterfly' && typeof value === 'number' ? Math.abs(value) : value, config) }, ...text(config.valueText), color: isBarChart(id) && isInsideValueLabel(config) && (config.valueLabelAutoContrast ?? true) ? contrastText(color) : config.valueText.color }
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
          if (id === 'butterfly' && value != null) point.displayValue = formatChartNumber(Math.abs(value), config)
        if (isBarChart(id)) {
          const element = config.elementStyles[elementKey(series.name, category)]
          const itemStyle = element && (element.color != null || element.fillOpacity != null || element.borderColor != null || element.borderWidth != null) ? { color: element.color ?? color, opacity: element.fillOpacity ?? style?.fillOpacity ?? config.barFillOpacity ?? 1, borderColor: element.borderColor ?? style?.borderColor ?? config.barBorderColor ?? color, borderWidth: element.borderWidth ?? style?.borderWidth ?? config.barBorderWidth ?? 0 } : point.itemStyle
          const customWidth = element?.barWidth != null || style?.barWidth != null
          const fillItemStyle = itemStyle ? Object.fromEntries(Object.entries(itemStyle).filter(([key]) => key !== 'borderColor' && key !== 'borderWidth')) : undefined
          const pointItemStyle = customWidth ? { ...fillItemStyle, color: 'rgba(0,0,0,0)', opacity: 1 } : fillItemStyle
          const labelStyle = element?.valueText ?? config.valueText
          const label = !absorbBarLabels && (point.label || customWidth && config.showValues) ? { formatter: formatChartNumber(id === 'butterfly' && value != null ? Math.abs(value) : value, config), ...(point.label ?? { show: true, ...text(labelStyle) }), position: id === 'butterfly' ? butterflyPosition() : valueLabelPosition(config, id), color: isInsideValueLabel(config) && (config.valueLabelAutoContrast ?? true) ? contrastText(element?.color ?? color) : labelStyle.color } : undefined
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
    const smoothing = id === 'moving-average-line' || id === 'moving-average-scatter'
    const smoothingWindow = Math.max(2, Math.round(config.movingAverageWindow ?? 12))
    const renderedBaseSeries = smoothing ? baseSeries.flatMap((series, seriesIndex) => {
      const source = prepared.series[seriesIndex], color = getSeriesColor(config, source.name, seriesIndex)
      const rawPoints = id === 'moving-average-scatter'
      const raw = {
        ...series, name: `${source.name} · исходные ${rawPoints ? 'значения' : 'данные'}`, type: rawPoints ? 'scatter' : 'line',
        showSymbol: rawPoints, symbolSize: rawPoints ? config.seriesStyles[source.name]?.markerSize ?? 7 : 0,
        data: rawPoints ? (series.data as Array<Record<string, unknown>>).map((point) => ({ ...point, symbolSize: config.seriesStyles[source.name]?.markerSize ?? 7, itemStyle: { color, borderWidth: 0, opacity: config.movingAverageRawOpacity ?? .22 } })) : series.data,
        lineStyle: rawPoints ? { opacity: 0 } : { ...(series.lineStyle as object), color, width: Math.max(1, Number((series.lineStyle as { width?: number })?.width ?? 3) * .55), opacity: config.movingAverageRawOpacity ?? .22 },
        itemStyle: { color, borderWidth: 0, opacity: config.movingAverageRawOpacity ?? .22 }, endLabel: undefined, labelLine: undefined, label: { show: false }, z: 10 + seriesIndex,
      }
      const averages = movingAverage(source.data, smoothingWindow)
      const smoothed = {
        ...series, name: `${source.name} · среднее (${smoothingWindow})`, showSymbol: false,
        data: (series.data as Array<Record<string, unknown>>).map((point, index) => ({ ...point, value: averages[index], displayValue: averages[index] == null ? 'пропуск' : formatChartNumber(averages[index], config) })),
        lineStyle: { ...(series.lineStyle as object), color, opacity: 1 }, itemStyle: { color, borderColor: color, borderWidth: 0 }, z: 100 + seriesIndex,
      }
      return [raw, smoothed]
    }) : baseSeries
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
          const sameSide = id === 'butterfly' ? butterflyLeftFields.has(candidate.name) === butterflyLeftFields.has(series.name) : Math.sign(part) === Math.sign(value)
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
    const option = { ...common, series: [...renderedBaseSeries, ...individualBarSeries, ...absorbedLabelSeries, ...segmentSeries, ...hitSeries, ...(!isHorizontalBarChart(id) ? [...yAxisEdgeAffixSeries(config, Number(common.yAxis.min), Number(common.yAxis.max)), ...xAxisEdgeAffixSeries(config, categoryEdges)] : [])] }
    if (smoothing) option.legend = { ...option.legend, data: renderedBaseSeries.map((series, index) => ({ name: series.name, icon: series.type === 'scatter' ? 'circle' : 'path://M0 4H24V7H0Z', itemStyle: { color: (series.lineStyle as { color?: string })?.color ?? (series.itemStyle as { color?: string })?.color ?? getSeriesColor(config, prepared.series[Math.floor(index / 2)].name, Math.floor(index / 2)), borderWidth: 0 } })) }
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
      if (id === 'butterfly') {
        const categoryPosition = config.butterflyCategoryPosition ?? 'center'
        const titlePosition = categoryPosition === 'center' ? config.yAxisPosition : categoryPosition
        const leftCategoryRail = categoryPosition === 'left' ? categoryLabelSpace : 0
        const rightCategoryRail = categoryPosition === 'right' ? categoryLabelSpace : 0
        const leftTitleRail = titlePosition === 'left' ? categoryTitleRail : 0
        const rightTitleRail = titlePosition === 'right' ? categoryTitleRail : 0
        mutable.grid.left = (config.canvasMarginLeft ?? CONTENT_LEFT) + leftCategoryRail + leftTitleRail
        mutable.grid.right = (config.canvasMarginRight ?? 24) + rightCategoryRail + rightTitleRail
        if (config.xAxisPosition === 'top' && config.showLegend && config.legendPosition === 'top') {
          const legendBottom = (config.subtitle ? 72 : 54) + Math.round(config.legendText.size * config.legendText.lineHeight / 100)
          mutable.grid.top = Math.max(mutable.grid.top, legendBottom + valueLabelHeight + (config.showXTicks ? config.tickLength : 0) + (config.yAxisLabelGap ?? 8) + 18)
        }
        mutable.legend = { ...mutable.legend, left: 'center', right: undefined }
      }
      mutable.xAxis = { ...valueAxis, position: config.xAxisPosition, name: config.showYAxisTitle ? config.yAxisTitle : '', nameRotate: 0, nameGap: valueLabelHeight + (config.showXTicks ? config.tickLength : 0) + ((config.showYAxisLabels ?? true) ? config.yAxisLabelGap ?? 8 : 0) + config.yAxisTitleGap, axisLabel: { ...(valueAxis.axisLabel as object), show: config.showYAxisLabels ?? true, margin: config.yAxisLabelGap ?? 8, formatter: (value: number) => {
        const position = axisTickPosition(value, Number(valueAxis.min), Number(valueAxis.max))
        if (isNormalizedStackedChart(id)) return usesYAxisEdgeOverlay(config) && axisAffixApplies(config.yAxisAffixScope, position) ? '' : formatYAxisNumber(value, config, position)
        return usesXAxisEdgeOverlay(config) && axisAffixApplies(config.xAxisAffixScope, position) ? '' : formatXAxisNumber(id === 'butterfly' ? Math.abs(value) : value, config, position)
      } } }
      const butterflyCategoryPosition = config.butterflyCategoryPosition ?? 'center'
      const categoryPosition = id === 'butterfly' && butterflyCategoryPosition !== 'center' ? butterflyCategoryPosition : config.yAxisPosition
      mutable.yAxis = { ...categoryAxis, inverse: config.categoryAxisInverse ?? true, position: categoryPosition, name: '', axisLine: { ...(categoryAxis.axisLine as object), onZero: id === 'butterfly' && butterflyCategoryPosition === 'center' }, axisLabel: { ...(categoryAxis.axisLabel as object), show: id === 'butterfly' ? butterflyCategoryPosition !== 'center' && (config.showXAxisLabels ?? true) : config.showXAxisLabels ?? true, align: categoryPosition === 'right' ? 'left' : 'right', margin: config.xAxisLabelGap ?? 8, rotate: 0, width: categoryLabelWidth, overflow: undefined, hideOverlap: false, formatter: (_value: string, index: number) => categoryLabels[index] ?? '' } }
      if (id === 'butterfly') {
        const maximum = Math.max(0, ...prepared.categories.flatMap((_category, index) => {
          const sides = prepared.series.reduce<[number, number]>((totals, series) => {
            const value = series.data[index] ?? 0
            totals[butterflyLeftFields.has(series.name) ? 0 : 1] += Math.abs(value)
            return totals
          }, [0, 0])
          return sides
        }))
        const scale = niceNumericScale([-maximum, maximum], true)
        const extent = Math.max(Math.abs(scale.min), Math.abs(scale.max), 1)
        mutable.xAxis.min = -extent
        mutable.xAxis.max = extent
        mutable.xAxis.interval = scale.step
      }
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

const intervalLine = (id: 'range-line' | 'step-range-line' | 'confidence-line', label: string): ChartPlugin => {
  const base = cartesian(id === 'step-range-line' ? 'step-line' : 'line', label, 'trend')
  const autoGroups = (config: ChartConfig) => config.yFields.slice(0, Math.floor(config.yFields.length / 3) * 3).reduce<Array<{ main: string; lower: string; upper: string; showBounds?: boolean }>>((groups, field, index, fields) => {
    if (index % 3 === 0 && fields[index + 1] && fields[index + 2]) groups.push({ main: field, lower: fields[index + 1], upper: fields[index + 2] })
    return groups
  }, [])
  return {
    ...base, ...pluginModel(id), id, label,
    settings: { ...base.settings, features: { ...base.settings.features, lineVariant: true } },
    buildOption(table, config) {
      if (id === 'confidence-line') {
        const groups = (config.intervalGroups?.length ? config.intervalGroups : autoGroups(config)).filter((group) => group.main && group.lower && group.upper && new Set([group.main, group.lower, group.upper]).size === 3 && [group.main, group.lower, group.upper].every((field) => table.columns.includes(field)))
        const scaleFields = [...new Set(groups.flatMap((group) => [group.main, group.lower, group.upper]))]
        if (!groups.length || scaleFields.length < 3) {
          const empty = base.buildOption(table, { ...config, seriesField: '', yFields: [config.yField] }) as { series: Array<Record<string, unknown>> }
          empty.series = []
          return empty
        }
        const option = base.buildOption(table, { ...config, seriesField: '', yFields: scaleFields, yField: scaleFields[0] }) as { series: Array<Record<string, unknown>>; legend?: { data?: unknown[] } }
        const prepared = prepareVisibleChartData(table, { ...config, seriesField: '', yFields: scaleFields, yField: scaleFields[0] })
        const seriesByName = new Map(prepared.series.map((series) => [series.name, series]))
        const visibleNames = new Set(groups.flatMap((group) => [group.main, ...(group.showBounds ? [group.lower, group.upper] : [])]))
        const kept = option.series.filter((series) => {
          const name = String(series.name ?? '')
          if (name === '__x-axis-edge-affixes' || name === '__y-axis-edge-affixes') return true
          const owner = String(series.segmentOf ?? name).replace(/^__hit__:/, '')
          return visibleNames.has(owner)
        })
        groups.forEach((group, groupIndex) => {
          const main = seriesByName.get(group.main), lower = seriesByName.get(group.lower), upper = seriesByName.get(group.upper)
          if (!main || !lower || !upper) return
          const lineColor = getSeriesColor(config, main.name, Math.max(0, scaleFields.indexOf(main.name)))
          const bandColor = config.intervalFillMode === 'custom' ? config.intervalFillColor ?? config.color : lineColor
          const stack = `__confidence-line-band-${groupIndex}`
          const bounds = upper.data.map((value, index) => {
            const low = lower.data[index], center = main.data[index]
            return value == null || low == null || center == null || low > center || center > value ? null : { base: low, span: value - low }
          })
          kept.unshift(
            { name: `${stack}-base`, type: 'line', data: bounds.map((point) => point?.base ?? null), stack, symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, z: 0 },
            { name: `${stack}-fill`, type: 'line', data: bounds.map((point) => point?.span ?? null), stack, symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, areaStyle: { color: bandColor, opacity: config.intervalFillOpacity ?? .18 }, z: 0 },
          )
          ;[lower, upper].forEach((series) => {
            const normal = kept.find((item) => item.name === series.name)
            if (normal) {
              const boundaryStyle = config.seriesStyles[series.name]
              normal.symbol = 'none'
              normal.lineStyle = {
                ...(normal.lineStyle as object),
                color: lineColor,
                width: boundaryStyle?.lineWidth ?? 1.25,
                type: boundaryStyle?.lineType ?? 'dashed',
                opacity: boundaryStyle?.fillOpacity ?? .58,
              }
              return
            }
          })
        })
        option.series = kept
        if (option.legend && Array.isArray(option.legend.data)) option.legend.data = option.legend.data.filter((item) => visibleNames.has(typeof item === 'string' ? item : String((item as { name?: string }).name ?? '')))
        return option
      }
      const visibleFields = [config.rangeLowerField, config.rangeUpperField].filter((field): field is string => Boolean(field))
      const scopedConfig = { ...config, seriesField: '', yFields: visibleFields.length === 2 ? visibleFields : [config.yField], yField: visibleFields[0] ?? config.yField }
      const option = base.buildOption(table, scopedConfig) as { series: Array<Record<string, unknown>>; legend?: { data?: unknown[] }; xAxis?: unknown }
      if (visibleFields.length !== 2 || visibleFields[0] === visibleFields[1]) {
        option.series = []
        return option
      }
      const prepared = prepareVisibleChartData(table, { ...config, yFields: visibleFields, yField: visibleFields[0] ?? config.yField })
      const fields = prepared.series
      const lowerIndex = 0, upperIndex = 1
      const lower = fields[lowerIndex], upper = fields[upperIndex]
      if (!lower || !upper) return option
      const lowerColor = getSeriesColor(config, lower.name, lowerIndex)
      const upperColor = getSeriesColor(config, upper.name, upperIndex)
      const fillColor = (boundaryColor: string) => config.intervalFillMode === 'custom' ? config.intervalFillColor ?? config.color : boundaryColor
      const bandData = prepared.categories.slice(0, -1).flatMap((_category, index) => {
        const firstLow = lower.data[index], firstHigh = upper.data[index], nextLow = lower.data[index + 1], nextHigh = upper.data[index + 1]
        if (firstLow == null || firstHigh == null || nextLow == null || nextHigh == null) return []
        const firstDelta = firstHigh - firstLow, nextDelta = nextHigh - nextLow
        const segment = (from: number, to: number, startLow: number, startHigh: number, endLow: number, endHigh: number, color: string) => ({
          value: [index, Math.min(startLow, startHigh), Math.max(startLow, startHigh), index + 1, Math.min(endLow, endHigh), Math.max(endLow, endHigh), from, to],
          itemStyle: { color, opacity: config.intervalFillOpacity ?? .18 },
        })
        if (id === 'step-range-line') {
          const useNext = (config.stepPosition ?? 'end') === 'start'
          const stepLow = useNext ? nextLow : firstLow, stepHigh = useNext ? nextHigh : firstHigh
          return [segment(0, 1, stepLow, stepHigh, stepLow, stepHigh, fillColor(stepHigh >= stepLow ? upperColor : lowerColor))]
        }
        if (firstDelta * nextDelta < 0) {
          const ratio = Math.abs(firstDelta) / (Math.abs(firstDelta) + Math.abs(nextDelta))
          const crossing = firstLow + (nextLow - firstLow) * ratio
          return [
            segment(0, ratio, firstLow, firstHigh, crossing, crossing, fillColor(firstDelta > 0 ? upperColor : lowerColor)),
            segment(ratio, 1, crossing, crossing, nextLow, nextHigh, fillColor(nextDelta > 0 ? upperColor : lowerColor)),
          ]
        }
        return [segment(0, 1, firstLow, firstHigh, nextLow, nextHigh, fillColor((firstDelta || nextDelta) >= 0 ? upperColor : lowerColor))]
      })
      option.series = [{
        name: `__${id}-band`, type: 'custom', data: bandData, silent: true, tooltip: { show: false }, z: 0,
        renderItem: (params: { dataIndex: number }, api: { value(index: number): unknown; coord(value: unknown[]): number[] }) => {
          const left = api.coord([api.value(0), api.value(1)]), right = api.coord([api.value(3), api.value(4)])
          const startX = left[0] + (right[0] - left[0]) * Number(api.value(6))
          const endX = left[0] + (right[0] - left[0]) * Number(api.value(7))
          const topLeft = [startX, api.coord([api.value(0), api.value(2)])[1]]
          const topRight = [endX, api.coord([api.value(3), api.value(5)])[1]]
          const bottomRight = [endX, right[1]]
          const bottomLeft = [startX, left[1]]
          const itemStyle = bandData[params.dataIndex]?.itemStyle
          return { type: 'polygon', shape: { points: [topLeft, topRight, bottomRight, bottomLeft] }, style: { fill: itemStyle?.color, opacity: itemStyle?.opacity } }
        },
      }, ...option.series]
      return option
    },
  }
}

const dumbbellBase = cartesian('bar', 'Гантельная', 'comparison')
const dumbbell: ChartPlugin = {
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
    const changeLabel = (item: typeof items[number]) => {
      const difference = item.end - item.start
      const absolute = `${difference > 0 ? '+' : ''}${formatChartNumber(difference, config)}`
      if ((config.dumbbellDifferenceFormat ?? 'absolute') === 'absolute') return absolute
      return item.start === 0 ? 'н/д' : `${difference > 0 ? '+' : ''}${formatChartNumber(difference / Math.abs(item.start) * 100, { ...config, valueMode: 'absolute', numberOperation: 'none', numberFactor: 1, numberDecimals: config.dumbbellPercentDecimals ?? 0, valueLabelAffixesLinked: false, valueLabelPrefix: '', valueLabelSuffix: '' })}%`
    }
    const changeColor = (item: typeof items[number]) => !config.dumbbellColorByChange
      ? config.dumbbellConnectorColor ?? config.gridColor
      : item.end > item.start ? config.dumbbellIncreaseColor ?? '#168a72' : item.end < item.start ? config.dumbbellDecreaseColor ?? '#db5a5a' : config.dumbbellNeutralColor ?? '#777580'
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
      return item ? `<b>${escapeHtml(item.label)}</b><br/>${escapeHtml(startField)}: <b>${escapeHtml(formatChartNumber(item.start, config))}</b><br/>${escapeHtml(endField)}: <b>${escapeHtml(formatChartNumber(item.end, config))}</b><br/>Изменение: <b>${escapeHtml(formatChartNumber(item.end - item.start, config))}</b>` : ''
    } }
    return option
  },
}

export const waterfallSteps = (values: Array<number | null>) => {
  let total = 0
  const steps = values.map((delta) => {
    const start = total
    if (delta != null && Number.isFinite(delta)) total += delta
    return { delta, start, end: total }
  })
  return { steps, total }
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
  const option = getChartPlugin(config.kind).buildOption(table, config) as { series?: Array<{ name?: string; itemStyle?: { color?: unknown }; data?: unknown[]; labelItems?: unknown[] }> }
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

export const formatWaterfallChange = (value: number, config: ChartConfig) => {
  const mode = config.waterfallSignMode ?? 'negative-only'
  if (mode === 'negative-only') return formatChartNumber(value, config)
  const unsigned = formatChartNumber(Math.abs(value), config)
  if (mode === 'none' || value === 0) return unsigned
  if (mode === 'plus-minus') return `${value > 0 ? '+' : '-'}${unsigned}`
  return `${value > 0 ? config.waterfallPositivePrefix ?? '' : config.waterfallNegativePrefix ?? ''}${unsigned}`
}

export const waterfallValueLabel = (change: number, cumulative: number, total: boolean, config: ChartConfig) => {
  if (total) return formatChartNumber(cumulative, config)
  const changeLabel = formatWaterfallChange(change, config)
  const cumulativeLabel = formatChartNumber(cumulative, config)
  return config.waterfallLabelContent === 'cumulative' ? cumulativeLabel
    : config.waterfallLabelContent === 'both' ? `${changeLabel} → ${cumulativeLabel}`
    : changeLabel
}

export const waterfallLabelPlacement = (
  startY: number,
  endY: number,
  barWidth: number,
  labelWidth: number,
  labelHeight: number,
  position: NonNullable<ChartConfig['valueLabelPosition']>,
  gap: number,
) => {
  const direction = endY <= startY ? -1 : 1
  const fits = Math.abs(startY - endY) >= labelHeight + gap * 2 && barWidth >= labelWidth + 8
  const resolved = position === 'auto' ? fits ? 'inside-center' : 'top' : position
  if (resolved === 'inside-center') return { y: (startY + endY) / 2, verticalAlign: 'middle' as const, inside: true }
  if (resolved === 'inside-top') return { y: endY - direction * gap, verticalAlign: direction < 0 ? 'top' as const : 'bottom' as const, inside: true }
  if (resolved === 'inside-bottom') return { y: startY + direction * gap, verticalAlign: direction < 0 ? 'bottom' as const : 'top' as const, inside: true }
  if (resolved === 'bottom') return { y: startY - direction * gap, verticalAlign: direction < 0 ? 'top' as const : 'bottom' as const, inside: false }
  return { y: endY + direction * gap, verticalAlign: direction < 0 ? 'bottom' as const : 'top' as const, inside: false }
}

const waterfall: ChartPlugin = (() => {
  const base = cartesian('bar', 'Waterfall', 'comparison')
  return {
    ...base,
    ...pluginModel('waterfall'),
    id: 'waterfall',
    label: 'Waterfall',
    settings: { ...base.settings, series: [], features: { ...base.settings.features, directLabels: false } },
    buildOption(table, config) {
      const prepared = prepareVisibleChartData(table, { ...config, yFields: [config.yFields[0] ?? config.yField], seriesField: '', barCategorySort: 'none' })
      const source = prepared.series[0] ?? { name: config.yField, data: [] }
      const { steps, total } = waterfallSteps(source.data)
      const showTotal = config.waterfallShowTotal ?? true
      const totalLabel = config.waterfallTotalLabel?.trim() || 'Итого'
      const categoryLabels = prepared.categories.map((category) => category instanceof Date ? formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(category ?? ''))
      const rows = [...categoryLabels, ...(showTotal ? [totalLabel] : [])].map((category, index) => ({ __waterfall_category: category, __waterfall_value: index }))
      const synthetic: DataTable = { name: table.name, columns: ['__waterfall_category', '__waterfall_value'], rows }
      const scoped = { ...config, xField: '__waterfall_category', yField: '__waterfall_value', yFields: ['__waterfall_value'], seriesField: '', barCategorySort: 'none' as const, barValueLabelAbsorption: false, showDirectLabels: false }
      const option = base.buildOption(synthetic, scoped) as {
        tooltip?: Record<string, unknown>
        legend?: Record<string, unknown>
        grid?: { left?: number; right?: number }
        xAxis: Record<string, unknown>
        yAxis: { min?: number; max?: number; interval?: number }
        series: Array<Record<string, unknown>>
      }
      const entries = [
        ...steps.map((step, index) => ({ ...step, category: prepared.categories[index], label: categoryLabels[index], total: false })),
        ...(showTotal ? [{ delta: total, start: 0, end: total, category: totalLabel, label: totalLabel, total: true }] : []),
      ]
      const increase = config.waterfallIncreaseColor ?? '#36a476'
      const decrease = config.waterfallDecreaseColor ?? '#db5a5a'
      const totalColor = config.waterfallTotalColor ?? '#6956e8'
      if (option.grid) {
        const widestLabel = entries.reduce((width, entry) => {
          const element = config.elementStyles[elementKey(source.name, entry.category)]
          if (entry.delta == null || !(element?.showLabel ?? config.showValues) || entry.total && !(config.waterfallShowTotalValue ?? true)) return width
          const style = element?.valueText ?? config.valueText
          const label = element?.label || waterfallValueLabel(entry.delta, entry.end, entry.total, config)
          return Math.max(width, ...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
        }, 0)
        const sideReserve = Math.ceil(widestLabel / 2 + 6)
        option.grid.right = Number(option.grid.right ?? 0) + sideReserve
      }
      const data = entries.map((entry, index) => {
        const element = config.elementStyles[elementKey(source.name, entry.category)]
        return {
          value: [index, entry.start, entry.end],
          elementKey: elementKey(source.name, entry.category),
          sourceSeriesName: source.name,
          displayCategory: entry.label,
          displayValue: entry.delta == null ? 'пропуск' : waterfallValueLabel(entry.delta, entry.end, entry.total, config),
          displayChange: entry.delta == null ? 'пропуск' : formatWaterfallChange(entry.delta, config),
          displayCumulative: formatChartNumber(entry.end, config),
          waterfallTotal: entry.total,
          itemStyle: { color: element?.color ?? (entry.total ? totalColor : (entry.delta ?? 0) >= 0 ? increase : decrease), opacity: element?.fillOpacity ?? config.barFillOpacity ?? 1 },
        }
      })
      const bars = {
        name: source.name,
        type: 'custom',
        coordinateSystem: 'cartesian2d',
        clip: false,
        z: 40,
        renderItem: (params: { dataIndex: number }, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
          const entry = entries[params.dataIndex]
          if (!entry || entry.delta == null) return null
          const index = api.value(0), start = api.coord([index, api.value(1)]), end = api.coord([index, api.value(2)])
          const element = config.elementStyles[elementKey(source.name, entry.category)]
          const width = Math.abs(api.size([1, 0])[0]) * Math.max(.1, Math.min(1, (element?.barWidth ?? config.barWidth ?? 68) / 100))
          const height = Math.max(1, Math.abs(start[1] - end[1]))
          const style = element?.valueText ?? config.valueText
          const showLabel = (element?.showLabel ?? config.showValues) && (!entry.total || (config.waterfallShowTotalValue ?? true))
          const color = element?.color ?? (entry.total ? totalColor : entry.delta >= 0 ? increase : decrease)
          const label = element?.label || waterfallValueLabel(entry.delta, entry.end, entry.total, config)
          const lineHeight = Math.round(style.size * style.lineHeight / 100)
          const labelWidth = Math.max(...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
          const labelHeight = lineHeight * label.split('\n').length
          const requestedPosition = element?.waterfallLabelPosition ?? config.valueLabelPosition ?? 'auto'
          const position = entry.total ? requestedPosition === 'bottom' ? 'top' : requestedPosition === 'inside-bottom' ? 'inside-top' : requestedPosition : requestedPosition
          const placement = waterfallLabelPlacement(start[1], end[1], width, labelWidth, labelHeight, position, config.waterfallLabelGap ?? 6)
          const categoryBand = Math.abs(api.size([1, 0])[0])
          const labelStride = Math.max(1, Math.ceil((labelWidth + 8) / Math.max(1, categoryBand)))
          const showRenderedLabel = showLabel && (element?.showLabel === true || !(config.valueLabelHideOverlap ?? false) || entry.total || index % labelStride === 0)
          const info = { elementKey: elementKey(source.name, entry.category), sourceSeriesName: source.name, displayCategory: entry.label, displayValue: entry.delta == null ? 'пропуск' : waterfallValueLabel(entry.delta, entry.end, entry.total, config), displayColor: color }
          return {
            type: 'group',
            info,
            children: [
              { type: 'rect', info, shape: { x: end[0] - width / 2, y: Math.min(start[1], end[1]), width, height, r: Math.max(0, config.barBorderRadius ?? 0) }, style: { fill: color, opacity: data[params.dataIndex]?.itemStyle.opacity ?? 1, stroke: element?.borderColor ?? config.barBorderColor ?? color, lineWidth: element?.borderWidth ?? config.barBorderWidth ?? 0 } },
              ...(showRenderedLabel ? [{ type: 'text', info, style: { x: end[0], y: placement.y, text: label, ...graphicText(style), fill: placement.inside && (config.valueLabelAutoContrast ?? true) ? contrastText(color) : style.color, align: 'center', verticalAlign: placement.verticalAlign } }] : []),
            ],
          }
        },
        data,
      }
      const connectors = {
        name: '__waterfall-connectors',
        type: 'custom',
        coordinateSystem: 'cartesian2d',
        silent: true,
        tooltip: { show: false },
        clip: true,
        z: 35,
        renderItem: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => {
          const index = api.value(0), y = api.value(1)
          const from = api.coord([index, y]), to = api.coord([index + 1, y])
          const half = Math.abs(api.size([1, 0])[0]) * Math.max(.1, Math.min(1, (config.barWidth ?? 68) / 100)) / 2
          return { type: 'line', shape: { x1: from[0] + half, y1: from[1], x2: to[0] - half, y2: to[1] }, style: { stroke: config.waterfallConnectorColor ?? '#8a8791', lineWidth: 1, lineDash: [4, 3] } }
        },
        data: entries.slice(0, -1).map((entry, index) => [index, entry.end]),
      }
      const scale = niceNumericScale(entries.flatMap((entry) => [entry.start, entry.end]), true)
      if (config.yAxisMin == null) option.yAxis.min = scale.min
      if (config.yAxisMax == null) option.yAxis.max = scale.max
      if (config.yAxisStep == null) option.yAxis.interval = scale.step
      option.legend = { ...(option.legend ?? {}), show: false }
      option.tooltip = {
        trigger: 'item',
        formatter: (input: unknown) => {
          const item = input as { data?: { displayCategory?: string; displayChange?: string; displayCumulative?: string; waterfallTotal?: boolean }; marker?: string }
          return item.data?.waterfallTotal
            ? `<b>${escapeHtml(item.data.displayCategory ?? '')}</b><br/>${item.marker ?? ''}${escapeHtml(source.name)}: <b>${escapeHtml(item.data.displayCumulative ?? '')}</b>`
            : `<b>${escapeHtml(item.data?.displayCategory ?? '')}</b><br/>${item.marker ?? ''}Изменение: <b>${escapeHtml(item.data?.displayChange ?? '')}</b><br/>После шага: <b>${escapeHtml(item.data?.displayCumulative ?? '')}</b>`
        },
      }
      option.series = [connectors, bars]
      return option
    },
  }
})()

const lollipop = (id: 'lollipop' | 'horizontal-lollipop', label: string): ChartPlugin => {
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

const slope: ChartPlugin = (() => {
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

const indexedLine: ChartPlugin = (() => {
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

const seasonalLine: ChartPlugin = (() => {
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

const heatmap: ChartPlugin = {
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

const treemap: ChartPlugin = {
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

const scatter: ChartPlugin = {
  ...pluginModel('scatter'),
  id: 'scatter',
  label: 'Точечный',
  category: 'relationship',
  settings: {
    sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
    series: ['color', 'markers'],
    features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: true, distributionLayout: false, lineVariant: false },
  },
  buildOption(table, config) {
    const xAxisTitleText = config.xAxisTitleText ?? config.axisTitleText
    const xAxisLabelText = config.xAxisLabelText ?? config.axisLabelText
    const yFields = config.yFields.length ? config.yFields : [config.yField]
    const dateAxis = table.rows.some((row) => row[config.xField] instanceof Date)
    const validRows = table.rows.filter((row) => {
      const x = row[config.xField]
      const validX = (typeof x === 'number' && Number.isFinite(x)) || (x instanceof Date && !Number.isNaN(x.getTime()))
      return validX && yFields.some((field) => typeof row[field] === 'number' && Number.isFinite(row[field] as number))
    })
    const xValues = validRows.map((row) => row[config.xField] instanceof Date ? (row[config.xField] as Date).getTime() : row[config.xField] as number)
    const xScale = niceNumericScale(xValues)
    const [manualMin, manualMax] = orderedBounds(dateAxis ? dateValue(config.xAxisMin) : axisValue(config.xAxisMin), dateAxis ? dateValue(config.xAxisMax) : axisValue(config.xAxisMax))
    const effectiveXMin = manualMin ?? (dateAxis ? undefined : xScale.min), effectiveXMax = manualMax ?? (dateAxis ? undefined : xScale.max)
    const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
    const bubbleMode = config.kind === 'bubble'
    const sizeValues = bubbleMode && config.scatterSizeField ? validRows.flatMap((row) => typeof row[config.scatterSizeField!] === 'number' && Number.isFinite(row[config.scatterSizeField!] as number) ? [row[config.scatterSizeField!] as number] : []) : []
    const sizeMagnitudes = sizeValues.map(Math.abs)
    const sizeMinValue = sizeMagnitudes.length ? Math.min(...sizeMagnitudes) : 0, sizeMaxValue = sizeMagnitudes.length ? Math.max(...sizeMagnitudes) : 1
    const minimumBubbleSize = Math.min(config.scatterSizeMin ?? 6, config.scatterSizeMax ?? 42)
    const maximumBubbleSize = Math.max(config.scatterSizeMin ?? 6, config.scatterSizeMax ?? 42)
    const bubbleSize = (value: unknown) => {
      if (!bubbleMode || !config.scatterSizeField || typeof value !== 'number' || !Number.isFinite(value)) return config.scatterPointSize ?? 10
      return minimumBubbleSize + (maximumBubbleSize - minimumBubbleSize) * Math.sqrt(Math.abs(value) / (sizeMaxValue || 1))
    }
    const groupValues = config.scatterColorField ? [...new Set(validRows.map((row) => String(row[config.scatterColorField!] ?? 'Без категории')))] : ['']
    const defaultLabelField = config.scatterLabelField || table.columns.find((column) =>
      column !== config.xField &&
      !yFields.includes(column) &&
      column !== config.scatterSizeField &&
      column !== config.scatterColorField &&
      validRows.some((row) => typeof row[column] === 'string' && String(row[column]).trim())
    )
    const dataSeries = yFields.flatMap((field, fieldIndex) => groupValues.map((group, groupIndex) => {
      const baseName = field
      const seriesName = config.scatterColorField ? (yFields.length === 1 ? group : `${field} · ${group}`) : baseName
      const seriesStyle = config.seriesStyles[seriesName]
      const seriesColor = seriesStyle?.color ?? getSeriesColor(config, config.scatterColorField ? group : seriesName, config.scatterColorField ? groupIndex : fieldIndex)
      return {
        name: seriesName,
        type: 'scatter',
        triggerEvent: true,
        symbol: seriesStyle?.markerShape ?? 'circle',
        symbolSize: (_value: unknown, params: { data?: { bubbleSize?: number } }) => params.data?.bubbleSize ?? seriesStyle?.markerSize ?? config.scatterPointSize ?? 10,
        itemStyle: { color: config.scatterHollow ? 'transparent' : seriesStyle?.markerFill ?? seriesColor, borderColor: seriesStyle?.markerBorder ?? seriesStyle?.color ?? seriesColor, borderWidth: seriesStyle?.markerBorderWidth ?? config.scatterBorderWidth ?? 1, opacity: seriesStyle?.fillOpacity ?? config.scatterOpacity ?? .78 },
        labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
        emphasis: { focus: 'series', scale: 1.12 },
        label: { show: config.scatterShowLabels ?? config.showValues, position: config.scatterLabelPosition ?? 'right', distance: 5, ...text(config.valueText), ...pointLabelPlacement(config.scatterLabelPosition ?? 'right'), formatter: (params: { data?: { displayLabel?: string } }) => params.data?.displayLabel ?? '' },
        data: validRows.flatMap((row) => {
          if (typeof row[field] !== 'number' || !Number.isFinite(row[field] as number)) return []
          if (config.scatterColorField && String(row[config.scatterColorField] ?? 'Без категории') !== group) return []
          const category = row[config.xField], x = category instanceof Date ? category.getTime() : category
          const base = pointData(config, seriesName, category, row[field] as number)
          const override = config.elementStyles[base.elementKey]
          const displayLabel = override?.label || (defaultLabelField ? String(row[defaultLabelField] ?? '') : formatChartNumber(row[field] as number, config))
          const labelStyle = override?.valueText ?? config.valueText
          const labelPosition = override?.labelPosition ?? config.scatterLabelPosition ?? 'right'
          return [{ ...base, value: [x, row[field]], sourceSeriesName: seriesName, displayLabel, bubbleValue: bubbleMode && config.scatterSizeField ? row[config.scatterSizeField] : undefined, symbol: override?.markerShape, bubbleSize: override?.markerSize ?? (bubbleMode ? bubbleSize(config.scatterSizeField ? row[config.scatterSizeField] : undefined) : seriesStyle?.markerSize ?? config.scatterPointSize ?? 10), itemStyle: override ? { color: config.scatterHollow ? 'transparent' : override.markerFill ?? override.color ?? seriesStyle?.markerFill ?? seriesColor, borderColor: override.markerBorder ?? override.color ?? seriesStyle?.markerBorder ?? seriesColor, borderWidth: override.markerBorderWidth ?? config.scatterBorderWidth ?? 1, opacity: override.fillOpacity ?? seriesStyle?.fillOpacity ?? config.scatterOpacity ?? .78 } : undefined, label: override ? { show: override.showLabel ?? config.scatterShowLabels, formatter: override.label || displayLabel, position: labelPosition, ...text(labelStyle), ...pointLabelPlacement(labelPosition) } : undefined }]
        }),
      }
    }))
    const trendFor = (name: string, points: Array<[number, number]>, seriesColor: string) => {
      const style = config.seriesStyles[name]
      const enabled = style?.scatterTrendline ?? config.scatterTrendline
      if (!enabled || points.length < 2) return []
      const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length
      const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length
      const sxx = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0)
      const slope = sxx ? points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / sxx : 0
      const intercept = meanY - slope * meanX
      const minX = Math.min(...points.map(([x]) => x), effectiveXMin ?? Infinity), maxX = Math.max(...points.map(([x]) => x), effectiveXMax ?? -Infinity)
      const samples = Array.from({ length: 31 }, (_, index) => {
        const x = minX + (maxX - minX) * index / 30, predicted = intercept + slope * x
        const residual = Math.sqrt(points.reduce((sum, [px, py]) => sum + (py - intercept - slope * px) ** 2, 0) / Math.max(1, points.length - 2))
        const delta = 1.96 * residual * Math.sqrt(1 / points.length + (sxx ? (x - meanX) ** 2 / sxx : 0))
        return { x, predicted, lower: predicted - delta, range: delta * 2 }
      })
      const color = style?.scatterTrendColor ?? style?.color ?? seriesColor
      const stack = `__trend-band:${name}`
      const series: Array<Record<string, unknown>> = []
      if (style?.scatterTrendBand ?? config.scatterTrendBand) series.push(
        { name: `${stack}:base`, type: 'line', data: samples.map(({ x, lower }) => [x, lower]), stack, symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, z: 0 },
        { name: `${stack}:fill`, type: 'line', data: samples.map(({ x, range }) => [x, range]), stack, symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, areaStyle: { color, opacity: style?.scatterTrendBandOpacity ?? config.scatterTrendBandOpacity ?? .12 }, z: 0 },
      )
      series.push({ name: `Тренд: ${name}`, type: 'line', data: samples.map(({ x, predicted }) => [x, predicted]), symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { color, width: style?.scatterTrendWidth ?? config.scatterTrendWidth ?? 2, type: style?.scatterTrendType ?? config.scatterTrendType ?? 'dashed' }, z: 2 })
      return series
    }
    const trendSeries = dataSeries.flatMap((series) => trendFor(series.name, series.data.flatMap((point) => {
      const value = point.value as unknown[]
      const x = Number(value[0]), y = Number(value[1])
      return Number.isFinite(x) && Number.isFinite(y) ? [[x, y] as [number, number]] : []
    }), (series.itemStyle as { borderColor: string }).borderColor))
    const baseOption = commonOption(table, config) as { yAxis?: { min?: number; max?: number }; [key: string]: unknown }
    const firstSeries = dataSeries[0] as Record<string, unknown> | undefined
    if (firstSeries) {
      const referenceData: unknown[] = []
      if (config.scatterXReference != null && Number.isFinite(config.scatterXReference)) referenceData.push({ xAxis: config.scatterXReference })
      if (config.scatterYReference != null && Number.isFinite(config.scatterYReference)) referenceData.push({ yAxis: config.scatterYReference })
      if (config.showZeroLine && config.yAxisScaleType !== 'log' && !referenceData.some((item) => typeof item === 'object' && item != null && !Array.isArray(item) && 'yAxis' in item && item.yAxis === 0)) referenceData.push({ yAxis: 0 })
      if (config.scatterDiagonal) {
        const diagonalMin = Math.max(effectiveXMin ?? Math.min(...xValues), Number(baseOption.yAxis?.min))
        const diagonalMax = Math.min(effectiveXMax ?? Math.max(...xValues), Number(baseOption.yAxis?.max))
        if (Number.isFinite(diagonalMin) && Number.isFinite(diagonalMax)) referenceData.push([{ coord: [diagonalMin, diagonalMin], lineStyle: { color: config.scatterDiagonalColor ?? '#8a8791', width: config.scatterDiagonalWidth ?? 1.5, type: config.scatterDiagonalType ?? 'dashed' } }, { coord: [diagonalMax, diagonalMax] }])
      }
      if (referenceData.length) firstSeries.markLine = { silent: true, symbol: 'none', data: referenceData, lineStyle: { color: config.scatterReferenceColor ?? config.zeroLineColor ?? '#8a8791', width: config.scatterReferenceWidth ?? config.zeroLineWidth ?? 1.5, type: config.scatterReferenceType ?? config.zeroLineType ?? 'dashed' }, label: { show: false } }
    }
    if (baseOption.legend && typeof baseOption.legend === 'object') {
      const legend = baseOption.legend as Record<string, unknown>
      const configuredIcon = ({ circle: 'circle', square: 'rect', line: 'path://M0 4H24V7H0Z', diamond: 'diamond', triangle: 'triangle' } as const)[config.legendMarker as 'circle' | 'square' | 'line' | 'diamond' | 'triangle']
      legend.data = dataSeries.map((series) => ({ name: series.name, icon: configuredIcon ?? 'circle', itemStyle: { color: (series.itemStyle as { borderColor: string }).borderColor } }))
      legend.itemWidth = config.legendMarker === 'line' ? 24 : 10
    }
    const sizeLegendSeries: Array<Record<string, unknown>> = []
    if (bubbleMode && config.scatterSizeField && config.scatterSizeLegend !== false && sizeValues.length) {
      const large = niceLegendValue(sizeMaxValue)
      const small = sizeMinValue
      const legendValues = large === small ? [large] : [large, small]
      const radii = legendValues.map((value) => bubbleSize(value) / 2)
      const maxRadius = Math.max(...radii)
      const legendFontSize = config.legendText.size
      const legendLineHeight = Math.round(legendFontSize * config.legendText.lineHeight / 100)
      const legendTextStyle = { ...graphicText(config.legendText), fontSize: legendFontSize, lineHeight: legendLineHeight }
      const titleHeight = legendLineHeight + 10
      const baseline = titleHeight + maxRadius * 2
      const legendTitle = config.scatterSizeLegendTitle || config.scatterSizeField
      const formattedLegendValues = legendValues.map((value) => formatChartNumber(value, config))
      const titleWidth = measureTextWidth(legendTitle, legendFontSize, config.legendText.fontFamily, 600)
      const valueWidth = Math.max(...formattedLegendValues.map((value) => measureTextWidth(value, legendFontSize, config.legendText.fontFamily, 600)))
      const boxWidth = Math.ceil(Math.max(titleWidth, maxRadius * 2 + 20 + valueWidth)), boxHeight = Math.round(baseline + 8)
      const position = config.scatterSizeLegendPosition ?? 'top-left'
      const yAxis = baseOption.yAxis ?? {}
      const legendX = position.endsWith('right') ? effectiveXMax ?? Math.max(...xValues) : effectiveXMin ?? Math.min(...xValues)
      const legendY = position.startsWith('bottom') ? Number(yAxis.min) : Number(yAxis.max)
      if (Number.isFinite(legendX) && Number.isFinite(legendY)) sizeLegendSeries.push({
        name: '__bubble-size-legend', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100,
        data: [[legendX, legendY]],
        renderItem: (_params: unknown, api: { value(index: number): number; coord(value: number[]): number[] }) => {
          const [anchorX, anchorY] = api.coord([api.value(0), api.value(1)])
          const x = position.endsWith('right') ? anchorX - boxWidth - 6 : anchorX + 6
          const y = position.startsWith('bottom') ? anchorY - boxHeight - 6 : anchorY + 6
          return { type: 'group', x, y, children: [
            { type: 'rect', shape: { x: 0, y: 0, width: boxWidth, height: boxHeight }, style: { fill: 'transparent', stroke: 'transparent' }, silent: true },
            { type: 'text', x: 0, y: 0, style: { text: legendTitle, ...legendTextStyle, fontWeight: 600 } },
            ...legendValues.flatMap((_value, index) => {
              const radius = radii[index]
              const cy = baseline - radius
              const guideY = cy - radius
              return [
                { type: 'circle', shape: { cx: maxRadius, cy, r: radius }, style: { fill: 'transparent', stroke: config.legendText.color, lineWidth: 1 } },
                { type: 'line', shape: { x1: maxRadius, y1: guideY, x2: maxRadius * 2 + 14, y2: guideY }, style: { stroke: config.legendText.color, opacity: .55, lineWidth: 1, lineDash: [3, 3] } },
                { type: 'text', x: maxRadius * 2 + 20, y: guideY, style: { text: formattedLegendValues[index], ...legendTextStyle, fontWeight: 600, align: 'left', verticalAlign: 'middle' } },
              ]
            }),
          ] }
        },
      })
    }
    if (firstSeries && config.scatterQuadrants && config.scatterXReference != null && config.scatterYReference != null) {
      const xmin = effectiveXMin ?? Math.min(...xValues), xmax = effectiveXMax ?? Math.max(...xValues)
      const ymin = Number(baseOption.yAxis?.min), ymax = Number(baseOption.yAxis?.max)
      const [tl, tr, br, bl] = config.scatterQuadrantColors ?? ['#dfeee8','#e7eef8','#f8e5e3','#f2eadb']
      const labels = config.scatterQuadrantLabels ?? ['', '', '', '']
      if ([xmin, xmax, ymin, ymax].every(Number.isFinite)) firstSeries.markArea = { silent: true, label: { show: false }, data: [
        [{ xAxis: xmin, yAxis: config.scatterYReference, itemStyle: { color: tl, opacity: .22 }, label: { show: Boolean(labels[0]), formatter: labels[0], position: 'insideTopLeft', ...text(config.valueText) } }, { xAxis: config.scatterXReference, yAxis: ymax }],
        [{ xAxis: config.scatterXReference, yAxis: config.scatterYReference, itemStyle: { color: tr, opacity: .22 }, label: { show: Boolean(labels[1]), formatter: labels[1], position: 'insideTopRight', ...text(config.valueText) } }, { xAxis: xmax, yAxis: ymax }],
        [{ xAxis: config.scatterXReference, yAxis: ymin, itemStyle: { color: br, opacity: .22 }, label: { show: Boolean(labels[2]), formatter: labels[2], position: 'insideBottomRight', ...text(config.valueText) } }, { xAxis: xmax, yAxis: config.scatterYReference }],
        [{ xAxis: xmin, yAxis: ymin, itemStyle: { color: bl, opacity: .22 }, label: { show: Boolean(labels[3]), formatter: labels[3], position: 'insideBottomLeft', ...text(config.valueText) } }, { xAxis: config.scatterXReference, yAxis: config.scatterYReference }],
      ] }
    }
    return {
      ...baseOption,
      tooltip: { trigger: 'item', formatter: (params: unknown) => {
        const item = params as { seriesName?: string; value?: unknown; marker?: string; data?: { bubbleValue?: unknown } }
        const values = Array.isArray(item.value) ? item.value : [item.value]
        const coordinates = values.map((value, index) => escapeHtml(index === 0 ? dateAxis ? formatTimeValue(new Date(Number(value)), table.timeProfiles?.[config.xField], config.dateLabelFormat) : formatXAxisNumber(value, config) : formatChartNumber(value, config))).join(' · ')
        const size = bubbleMode && config.scatterSizeField && typeof item.data?.bubbleValue === 'number' && Number.isFinite(item.data.bubbleValue)
          ? `<br/>${escapeHtml(config.scatterSizeField)}: <b>${escapeHtml(formatChartNumber(item.data.bubbleValue, config))}</b>`
          : ''
        return `${item.marker ?? ''}${escapeHtml(item.seriesName ?? '')}<br/><b>${coordinates}</b>${size}`
      } },
      xAxis: {
        type: dateAxis ? 'time' : 'value', min: effectiveXMin, max: effectiveXMax,
        interval: dateAxis ? undefined : config.xAxisStep ?? xScale.step,
        position: config.xAxisPosition, name: config.showXAxisTitle && config.axisTitleMode !== 'editorial' ? config.xAxisTitle : '', nameLocation: 'middle',
        nameTextStyle: { ...text(xAxisTitleText), align: config.axisTitleMode === 'editorial' ? 'right' : config.xAxisTitleText?.align },
        nameGap: ((config.showXAxisLabels ?? true) ? Math.round(xAxisLabelText.size * xAxisLabelText.lineHeight / 100) + (config.xAxisLabelGap ?? 8) : 0) + (config.showXTicks ? config.tickLength : 0) + config.xAxisTitleGap,
        triggerEvent: true,
        axisLabel: { ...text(xAxisLabelText), show: config.showXAxisLabels ?? true, margin: config.xAxisLabelGap ?? 8, inside: false, hideOverlap: true, rotate: typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0, formatter: dateAxis ? (value: number, index: number) => continuousDateLabel(new Date(value), table.timeProfiles?.[config.xField], config.dateLabelFormat, index === 0) : (value: number) => { const position = axisTickPosition(value, effectiveXMin ?? xScale.min, effectiveXMax ?? xScale.max); return usesXAxisEdgeOverlay(config) && axisAffixApplies(config.xAxisAffixScope, position) ? '' : formatXAxisNumber(value, config, position) } },
        axisLine: { show: config.showXAxisLine, onZero: false, lineStyle: axisLineStyle },
        axisTick: { show: config.showXTicks, inside: false, alignWithLabel: true, length: config.tickLength, lineStyle: axisLineStyle },
        splitLine: { show: config.showVerticalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
      },
      series: [...trendSeries.filter((series) => String(series.name ?? '').startsWith('__trend-band:')), ...dataSeries, ...trendSeries.filter((series) => !String(series.name ?? '').startsWith('__trend-band:')), ...sizeLegendSeries, ...yAxisEdgeAffixSeries(config, Number(baseOption.yAxis?.min), Number(baseOption.yAxis?.max)), ...(!dateAxis ? xAxisEdgeAffixSeries(config, [{ coordinate: effectiveXMin ?? xScale.min, cross: Number(baseOption.yAxis?.min), value: effectiveXMin ?? xScale.min, position: 'first' }, { coordinate: effectiveXMax ?? xScale.max, cross: Number(baseOption.yAxis?.min), value: effectiveXMax ?? xScale.max, position: 'last' }]) : [])],
    }
  },
}

const bubble: ChartPlugin = { ...scatter, ...pluginModel('bubble'), id: 'bubble', label: relationshipChartDefinitions[1][1] }

const quantile = (values: number[], position: number) => {
  if (!values.length) return 0
  const index = (values.length - 1) * position, lower = Math.floor(index), upper = Math.ceil(index)
  return values[lower] + (values[upper] - values[lower]) * (index - lower)
}

export const packSwarmOffsets = (positions: number[], diameter: number) => {
  const placed: Array<{ position: number; offset: number }> = []
  return positions.map((position) => {
    const candidates = [0]
    placed.forEach((point) => {
      const distance = Math.abs(position - point.position)
      if (distance >= diameter) return
      const cross = Math.sqrt(Math.max(0, diameter ** 2 - distance ** 2))
      candidates.push(point.offset - cross, point.offset + cross)
    })
    candidates.sort((left, right) => Math.abs(left) - Math.abs(right) || left - right)
    const offset = candidates.find((candidate) => placed.every((point) => (position - point.position) ** 2 + (candidate - point.offset) ** 2 >= (diameter - .01) ** 2)) ?? 0
    placed.push({ position, offset })
    return offset
  })
}

export const fitSwarmClouds = (positionClouds: number[][], preferredDiameter: number, maximumOffset: number) => {
  const diameter = Math.max(.25, preferredDiameter)
  const offsets = positionClouds.map((positions) => packSwarmOffsets(positions, diameter))
  const extent = Math.max(...offsets.flatMap((cloud) => cloud.map(Math.abs)), 0)
  const scale = extent > maximumOffset && extent > 0 ? maximumOffset / extent : 1
  return { offsets: offsets.map((cloud) => cloud.map((offset) => offset * scale)), diameter: diameter * scale }
}

export const fitSwarmOffsets = (positions: number[], preferredDiameter: number, maximumOffset: number) => {
  const fitted = fitSwarmClouds([positions], preferredDiameter, maximumOffset)
  return { offsets: fitted.offsets[0], diameter: fitted.diameter }
}

const distributionRandom = (index: number, group: number) => {
  let value = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(group + 1, 0x85ebca6b)
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  return ((value >>> 0) / 0xffffffff) * 2 - 1
}

const distribution: ChartPlugin = {
  ...pluginModel('boxplot'), id: 'boxplot', label: distributionChartDefinitions[0][1], category: 'distribution',
  settings: { sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'], series: ['color', 'markers'], features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: true, lineVariant: false } },
  validate(table, config) {
    const fields = config.yFields.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
    return fields.length ? { ok: true, errors: [] } : { ok: false, errors: [{ field: 'yFields', message: 'Выберите хотя бы один числовой показатель для распределения.' }] }
  },
  buildOption(table, config) {
    const fields = config.yFields.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
    const fieldOrder = new Map((config.seriesOrder ?? []).map((field, index) => [field, index]))
    const selectedFields = [...(fields.length ? fields : [config.yField])].sort((left, right) => (fieldOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (fieldOrder.get(right) ?? Number.MAX_SAFE_INTEGER))
    const groupField = config.distributionGroupField
    const discoveredCategories = groupField ? [...new Set(table.rows.flatMap((row) => selectedFields.some((field) => typeof row[field] === 'number' && Number.isFinite(row[field])) ? [String(row[groupField] ?? 'Без категории')] : []))] : []
    const orderedCategories = [...(config.distributionCategoryOrder ?? []).filter((category) => discoveredCategories.includes(category)), ...discoveredCategories.filter((category) => !(config.distributionCategoryOrder ?? []).includes(category))]
    const visibleCategories = orderedCategories.filter((category) => config.distributionCategoryStyles?.[category]?.visible !== false)
    const categories: Array<string | null> = groupField ? (visibleCategories.length ? visibleCategories : orderedCategories.slice(0, 1)) : [null]
    const categoryLabel = (category: string | null) => category == null ? '' : config.distributionCategoryStyles?.[category]?.label?.trim() || category
    const layoutMode = groupField ? config.distributionLayoutMode ?? 'measures' : 'measures'
    const splitOptions = layoutMode === 'measures' ? categories.filter((category): category is string => category != null) : selectedFields
    const splitFirst = splitOptions.includes(config.distributionViolinSplitFirst ?? '') ? config.distributionViolinSplitFirst! : splitOptions[0]
    const splitSecond = splitOptions.includes(config.distributionViolinSplitSecond ?? '') && config.distributionViolinSplitSecond !== splitFirst ? config.distributionViolinSplitSecond! : splitOptions.find((option) => option !== splitFirst)
    const splitSelection = new Set([splitFirst, splitSecond].filter((value): value is string => Boolean(value)))
    const groups = selectedFields.flatMap((field, fieldIndex) => categories.map((category, categoryIndex) => {
      const name = layoutMode === 'measures' ? groupField ? categoryLabel(category) : field : field
      const observations = table.rows.flatMap((row, rowIndex) => {
        const value = row[field]
        if ((groupField && String(row[groupField] ?? 'Без категории') !== category) || typeof value !== 'number' || !Number.isFinite(value)) return []
        const displayLabel = config.distributionLabelField ? String(row[config.distributionLabelField] ?? '') : formatChartNumber(value, config)
        return [{ value, displayLabel, displayValue: formatChartNumber(value, config), displayCategory: displayLabel || (groupField ? categoryLabel(category) : field), elementKey: elementKey(name, `row:${rowIndex}:${field}`), sourceSeriesName: name }]
      }).sort((left, right) => left.value - right.value)
      return {
        field,
        fieldIndex,
        category,
        categoryIndex,
        laneIndex: layoutMode === 'measures' ? fieldIndex : categoryIndex,
        subgroupIndex: layoutMode === 'measures' ? categoryIndex : fieldIndex,
        subgroupCount: layoutMode === 'measures' ? categories.length : selectedFields.length,
        seriesKey: layoutMode === 'measures' ? String(category ?? field) : field,
        name,
        displayName: groupField ? `${categoryLabel(category)} · ${field}` : field,
        observations,
        values: observations.map((observation) => observation.value),
      }
    })).filter((group) => group.values.length && (config.kind !== 'violinplot' || config.distributionViolinMode !== 'split' || splitSelection.size < 2 || splitSelection.has(group.seriesKey)))
    const groupColor = (group: typeof groups[number]) => layoutMode === 'measures' && groupField
      ? config.distributionCategoryStyles?.[String(group.category)]?.color ?? getSeriesColor(config, group.seriesKey, group.categoryIndex)
      : getSeriesColor(config, group.field, group.fieldIndex)
    const laneLabels = layoutMode === 'measures' ? selectedFields : categories.map(categoryLabel)
    const legendGroups = [...new Map(groups.map((group) => [group.name, group])).values()]
    const values = groups.flatMap((group) => group.values)
    const rawMin = Math.min(...values), rawMax = Math.max(...values), rawSpan = Math.max(1e-9, rawMax - rawMin)
    const bandwidthRatio = config.distributionBandwidth ?? .14
    const densityShape = config.kind === 'violinplot' || config.kind === 'raincloud' || config.kind === 'kde-plot' || config.kind === 'ridgeline'
    const violinTail = densityShape ? Math.max(...groups.map((group) => (group.values.at(-1)! - group.values[0]) * bandwidthRatio), rawSpan / 1000) * 1.75 : 0
    const scale = niceNumericScale(violinTail ? [...values, rawMin - violinTail, rawMax + violinTail] : values)
    const horizontal = (config.distributionOrientation ?? 'horizontal') === 'horizontal'
    const duplicateYAxisTitle = horizontal && laneLabels.some((label) => label.trim() === config.yAxisTitle.trim())
    const base = commonOption(table, duplicateYAxisTitle ? { ...config, showYAxisTitle: false } : config) as Record<string, unknown>
    const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
    const baseXAxis = base.xAxis as Record<string, unknown>, baseYAxis = base.yAxis as Record<string, unknown>
    const pointSize = config.distributionPointSize ?? 9, pointOpacity = config.distributionPointOpacity ?? .4
    const point = (value: number, group: number) => horizontal ? [value, group] : [group, value]
    const pointLabelPosition = config.distributionLabelPosition ?? (horizontal ? 'right' : 'top')
    const pointLabel = { show: config.distributionShowLabels ?? false, position: pointLabelPosition, distance: 5, ...text(config.valueText), ...pointLabelPlacement(pointLabelPosition), formatter: '{b}' }
    const pointLabelLayout = { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: horizontal ? 'shiftY' : 'shiftX' }
    const configuredLegendIcon = ({ circle: 'circle', square: 'rect', line: 'path://M0 4H24V7H0Z', diamond: 'diamond', triangle: 'triangle' } as const)[config.legendMarker as 'circle' | 'square' | 'line' | 'diamond' | 'triangle']
    const stats = groups.map((group) => {
      const q1 = quantile(group.values, .25), median = quantile(group.values, .5), q3 = quantile(group.values, .75), iqr = q3 - q1
      const inside = group.values.filter((value) => value >= q1 - iqr * 1.5 && value <= q3 + iqr * 1.5)
      return { min: inside[0] ?? q1, q1, median, mean: group.values.reduce((sum, value) => sum + value, 0) / group.values.length, q3, max: inside.at(-1) ?? q3, outliers: group.values.filter((value) => value < (inside[0] ?? q1) || value > (inside.at(-1) ?? q3)) }
    })
    if (config.kind === 'histogram' || config.kind === 'kde-plot') {
      const histogram = config.kind === 'histogram'
      const [requestedHistogramMin, requestedHistogramMax] = orderedBounds(config.distributionHistogramMin, config.distributionHistogramMax)
      const automaticDomainMin = histogram && rawMin === rawMax ? rawMin - .5 : histogram ? rawMin : scale.min
      const automaticDomainMax = histogram && rawMin === rawMax ? rawMax + .5 : histogram ? rawMax : scale.max
      const selectedDomainMin = histogram ? requestedHistogramMin ?? automaticDomainMin : automaticDomainMin
      const selectedDomainMax = histogram ? requestedHistogramMax ?? automaticDomainMax : automaticDomainMax
      const fallbackSpan = Math.max(1, automaticDomainMax - automaticDomainMin)
      const domainMin = selectedDomainMin === selectedDomainMax ? selectedDomainMin - .5 : selectedDomainMin > selectedDomainMax && requestedHistogramMin == null ? selectedDomainMax - fallbackSpan : selectedDomainMin
      const domainMax = selectedDomainMin === selectedDomainMax ? selectedDomainMax + .5 : selectedDomainMin > selectedDomainMax && requestedHistogramMax == null ? selectedDomainMin + fallbackSpan : selectedDomainMax
      const binCount = Math.min(80, Math.max(3, Math.round(config.distributionBinCount ?? 12)))
      const binWidth = (domainMax - domainMin) / binCount
      const sampleCount = 121
      const normalizer = Math.sqrt(2 * Math.PI)
      const distributions = groups.map((group, groupIndex) => {
        if (histogram) {
          const bins = Array.from({ length: binCount }, (_, index) => {
            const start = domainMin + index * binWidth, end = index === binCount - 1 ? domainMax : start + binWidth
            const count = group.values.filter((value) => value >= start && (index === binCount - 1 ? value <= end : value < end)).length
            return { start, end, center: (start + end) / 2, amount: count }
          })
          return { group, groupIndex, bins, points: [] as number[][] }
        }
        const bandwidth = Math.max((group.values.at(-1)! - group.values[0]) * bandwidthRatio, rawSpan / 1000)
        const samples = Array.from({ length: sampleCount }, (_, index) => domainMin + (domainMax - domainMin) * index / (sampleCount - 1))
        const points = samples.map((value) => [value, group.values.reduce((sum, current) => sum + Math.exp(-.5 * ((value - current) / bandwidth) ** 2), 0) / (group.values.length * bandwidth * normalizer)])
        points[0][1] = 0; points[points.length - 1][1] = 0
        return { group, groupIndex, bins: [] as Array<{ start: number; end: number; center: number; amount: number }>, points }
      })
      const amounts = distributions.flatMap((distribution) => histogram ? distribution.bins.map((bin) => bin.amount) : distribution.points.map((entry) => entry[1]))
      const frequencyScale = niceNumericScale([0, ...amounts], true)
      const frequencyMax = histogram ? Math.max(frequencyScale.max, 1) : frequencyScale.max
      const displayDomainScale = niceNumericScale([domainMin, domainMax])
      const displayDomainMin = histogram && requestedHistogramMin == null ? displayDomainScale.min : domainMin
      const displayDomainMax = histogram && requestedHistogramMax == null ? displayDomainScale.max : domainMax
      const rangeDecimals = Math.max(0, Math.min(6, Math.round(config.distributionHistogramRangeDecimals ?? 1)))
      const formatBoundary = (value: number) => value.toLocaleString(config.numberLocale ?? 'ru-RU', { minimumFractionDigits: rangeDecimals, maximumFractionDigits: rangeDecimals, useGrouping: config.numberGrouping })
      const formatRange = (range: [number, number]) => `${formatBoundary(range[0])}–${formatBoundary(range[1])}`
      const standardName = (group: typeof groups[number]) => selectedFields.length === 1 ? group.name : group.displayName
      const axis = (source: Record<string, unknown>, min: number, max: number, interval: number | undefined, showLine: boolean, showTicks: boolean, showGrid: boolean) => ({
        ...source,
        type: 'value',
        data: undefined,
        boundaryGap: false,
        min,
        max,
        interval,
        axisLabel: { ...(source.axisLabel as object), formatter: (value: number) => formatChartNumber(value, config) },
        axisLine: { show: showLine, onZero: false, lineStyle: axisLineStyle },
        axisTick: { show: showTicks, length: config.tickLength, lineStyle: axisLineStyle },
        splitLine: { show: showGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
      })
      const domainAxis = axis(horizontal ? baseXAxis : baseYAxis, config.yAxisMin ?? displayDomainMin, config.yAxisMax ?? displayDomainMax, config.yAxisStep ?? displayDomainScale.step, horizontal ? config.showXAxisLine : config.showYAxisLine, horizontal ? config.showXTicks : config.showYTicks, horizontal ? config.showVerticalGrid : config.showHorizontalGrid)
      const frequencyAxis = axis(horizontal ? baseYAxis : baseXAxis, 0, frequencyMax, frequencyScale.step, horizontal ? config.showYAxisLine : config.showXAxisLine, horizontal ? config.showYTicks : config.showXTicks, horizontal ? config.showHorizontalGrid : config.showVerticalGrid)
      const chartPoint = (value: number, amount: number) => horizontal ? [value, amount] : [amount, value]
      const standardOption = {
        ...base,
        animationDuration: 180,
        animationDurationUpdate: 180,
        legend: {
          ...(base.legend as object),
          show: Boolean(config.showLegend && groups.length > 1),
          data: groups.map((group) => ({ name: standardName(group), icon: configuredLegendIcon ?? (histogram ? 'rect' : 'path://M0 4H24V7H0Z'), itemStyle: { color: groupColor(group), borderWidth: 0 } })),
          itemWidth: configuredLegendIcon === 'path://M0 4H24V7H0Z' || (!configuredLegendIcon && !histogram) ? 24 : 10,
          itemHeight: 10,
        },
        grid: { ...(base.grid as object), containLabel: true },
        xAxis: { ...(horizontal ? domainAxis : frequencyAxis), position: config.xAxisPosition },
        yAxis: { ...(horizontal ? frequencyAxis : domainAxis), position: config.yAxisPosition },
        tooltip: { trigger: histogram ? 'item' : 'axis', formatter: (input: unknown) => {
          const items = (Array.isArray(input) ? input : [input]) as Array<{ marker?: string; seriesName?: string; data?: { range?: [number, number]; amount?: number }; value?: number[] }>
          if (histogram) {
            const item = items[0], range = item?.data?.range, amount = item?.data?.amount ?? 0
            return `${item?.marker ?? ''}<b>${escapeHtml(item?.seriesName ?? '')}</b><br/>${range ? escapeHtml(formatRange(range)) : ''}<br/>Наблюдений: <b>${amount}</b>`
          }
          const value = items[0]?.value?.[horizontal ? 0 : 1]
          return [`<b>${escapeHtml(formatChartNumber(value ?? 0, config))}</b>`, ...items.filter((item) => item.seriesName && !item.seriesName.startsWith('__')).map((item) => `${item.marker ?? ''}${escapeHtml(item.seriesName!)}: <b>${Number(item.value?.[horizontal ? 1 : 0] ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 4 })}</b>`)].join('<br/>')
        } },
        series: [] as Array<Record<string, unknown>>,
      }
      distributions.forEach(({ group, groupIndex, bins, points }) => {
        const color = groupColor(group)
        const stat = stats[groupIndex]
        const summaryColor = config.seriesStyles[group.name]?.distributionSummaryColor ?? config.seriesStyles[group.seriesKey]?.distributionSummaryColor ?? color
        const summaryWidth = config.seriesStyles[group.name]?.distributionSummaryWidth ?? config.seriesStyles[group.seriesKey]?.distributionSummaryWidth ?? config.distributionSummaryWidth ?? 3
        const summaryLength = (config.seriesStyles[group.name]?.distributionSummaryLength ?? config.seriesStyles[group.seriesKey]?.distributionSummaryLength ?? config.distributionSummaryLength ?? 100) / 100
        const summaryAmount = histogram
          ? bins.find((bin, index) => stat.median >= bin.start && (index === bins.length - 1 ? stat.median <= bin.end : stat.median < bin.end))?.amount ?? 0
          : points.reduce((closest, entry) => Math.abs(entry[0] - stat.median) < Math.abs(closest[0] - stat.median) ? entry : closest, points[0])[1]
        if (histogram) {
          standardOption.series.push({
            name: standardName(group),
            type: 'custom',
            coordinateSystem: 'cartesian2d',
            data: bins.map((bin) => ({ value: chartPoint(bin.center, bin.amount), range: [bin.start, bin.end], amount: bin.amount })),
            renderItem: (params: { dataIndex: number }, api: { coord(value: number[]): number[] }) => {
              const bin = bins[params.dataIndex]
              const zero = api.coord(chartPoint(bin.start, 0)), top = api.coord(chartPoint(bin.end, bin.amount))
              const rect = { type: 'rect', shape: horizontal
                ? { x: Math.min(zero[0], top[0]), y: Math.min(zero[1], top[1]), width: Math.max(1, Math.abs(top[0] - zero[0]) - 1), height: Math.abs(zero[1] - top[1]), r: 0 }
                : { x: Math.min(zero[0], top[0]), y: Math.min(zero[1], top[1]), width: Math.abs(top[0] - zero[0]), height: Math.max(1, Math.abs(zero[1] - top[1]) - 1), r: 0 },
              style: { fill: color, stroke: color, lineWidth: 1, opacity: config.distributionPointOpacity ?? .4 } }
              const labelMode = config.distributionHistogramLabels ?? 'none'
              if (labelMode === 'none' || !bin.amount) return rect
              const label = labelMode === 'count' ? String(bin.amount) : formatRange([bin.start, bin.end])
              const labelStyle = horizontal
                ? { x: (zero[0] + top[0]) / 2, y: Math.min(zero[1], top[1]) - 5, text: label, ...graphicText(config.valueText), align: 'center', verticalAlign: 'bottom' }
                : { x: Math.max(zero[0], top[0]) + 5, y: (zero[1] + top[1]) / 2, text: label, ...graphicText(config.valueText), align: 'left', verticalAlign: 'middle' }
              return { type: 'group', children: [rect, { type: 'text', style: labelStyle }] }
            },
            z: 3 + groupIndex,
          })
        } else {
          standardOption.series.push({
            name: standardName(group),
            type: 'line',
            data: points.map(([value, amount]) => chartPoint(value, amount)),
            showSymbol: false,
            symbol: 'none',
            smooth: false,
            lineStyle: { color, width: config.seriesStyles[group.name]?.lineWidth ?? config.seriesStyles[group.seriesKey]?.lineWidth ?? 2 },
            areaStyle: { color, opacity: config.distributionDensityFillOpacity ?? .2 },
            itemStyle: { color },
            z: 3 + groupIndex,
          })
        }
        if (config.distributionShowMedian ?? true) standardOption.series.push({
          name: standardName(group),
          type: 'custom',
          coordinateSystem: 'cartesian2d',
          silent: true,
          tooltip: { show: false },
          data: [chartPoint(stat.median, 0)],
          renderItem: (_params: unknown, api: { coord(value: number[]): number[] }) => {
            const start = api.coord(chartPoint(stat.median, 0)), end = api.coord(chartPoint(stat.median, summaryAmount * summaryLength))
            return { type: 'line', shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] }, style: { stroke: summaryColor, lineWidth: summaryWidth } }
          },
          z: 20,
        })
      })
      return standardOption
    }
    const valueAxis = { ...baseYAxis, type: 'value', min: config.yAxisMin ?? scale.min, max: config.yAxisMax ?? scale.max, interval: config.yAxisStep ?? scale.step, name: '', axisLine: { show: config.showYAxisLine, onZero: false, lineStyle: axisLineStyle }, axisTick: { show: config.showYTicks, length: config.tickLength, lineStyle: axisLineStyle }, splitLine: { show: horizontal ? config.showVerticalGrid : config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } } }
    // A numeric lane axis keeps fractional offsets intact. ECharts rounds fractional
    // coordinates on a category axis, which made strip, jitter and swarm identical.
    const fullGrid = config.showHorizontalGrid && config.showVerticalGrid
    const ridgeExtent = Math.min(1.6, Math.max(.15, (config.distributionWidth ?? 72) / 100) * (1 + (config.distributionRidgelineOverlap ?? 35) / 100))
    const singleLanePadding = laneLabels.length === 1 ? 1 : .5
    const categoryMin = config.kind === 'ridgeline' && horizontal ? -Math.ceil(ridgeExtent) : fullGrid ? -1 : -singleLanePadding
    const categoryMax = config.kind === 'ridgeline' && !horizontal ? laneLabels.length - 1 + Math.ceil(ridgeExtent) : fullGrid ? laneLabels.length : laneLabels.length - 1 + singleLanePadding
    const categoryAxis = { ...baseXAxis, type: 'value', data: laneLabels, min: categoryMin, max: categoryMax, interval: fullGrid ? 1 : .5, boundaryGap: false, name: '', axisLabel: { ...(baseXAxis.axisLabel as object), formatter: (value: number) => Number.isInteger(value) ? laneLabels[value] ?? '' : '' }, axisLine: { show: config.showXAxisLine, onZero: false, lineStyle: axisLineStyle }, axisTick: { show: config.showXTicks, alignWithLabel: true, length: config.tickLength, lineStyle: axisLineStyle }, splitLine: { show: horizontal ? config.showHorizontalGrid : config.showVerticalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } } }
    const categoryGridOnly = horizontal ? config.showHorizontalGrid && !config.showVerticalGrid : config.showVerticalGrid && !config.showHorizontalGrid
    const option = {
      ...base,
      animationDuration: 180,
      animationDurationUpdate: 180,
      legend: { ...(base.legend as object), show: Boolean(groupField && config.showLegend), data: groupField ? legendGroups.map((group) => ({ name: group.name, icon: configuredLegendIcon ?? 'circle', itemStyle: { color: groupColor(group), borderWidth: 0 } })) : undefined, itemWidth: configuredLegendIcon === 'path://M0 4H24V7H0Z' ? 24 : 10 },
      grid: { ...(base.grid as object), containLabel: true },
      xAxis: { ...(horizontal ? valueAxis : categoryAxis), position: config.xAxisPosition, axisLine: { ...(horizontal ? valueAxis : categoryAxis).axisLine, show: config.showXAxisLine }, axisTick: { ...(horizontal ? valueAxis : categoryAxis).axisTick, show: config.showXTicks }, splitLine: { ...(horizontal ? valueAxis : categoryAxis).splitLine, show: horizontal ? config.showVerticalGrid : config.showVerticalGrid && config.showHorizontalGrid } },
      yAxis: { ...(horizontal ? categoryAxis : valueAxis), position: config.yAxisPosition, ...(horizontal ? { inverse: true } : {}), axisLine: { ...(horizontal ? categoryAxis : valueAxis).axisLine, show: config.showYAxisLine }, axisTick: { ...(horizontal ? categoryAxis : valueAxis).axisTick, show: config.showYTicks }, splitLine: { ...(horizontal ? categoryAxis : valueAxis).splitLine, show: horizontal ? config.showHorizontalGrid && config.showVerticalGrid : config.showHorizontalGrid } },
      tooltip: { trigger: 'item', formatter: (params: { data?: { rawValue?: number; groupName?: string; displayLabel?: string; summary?: string; count?: number } }) => params.data?.summary ?? (params.data?.rawValue != null ? `${config.distributionLabelField && params.data.displayLabel ? `<b>${escapeHtml(params.data.displayLabel)}</b><br/>` : ''}${escapeHtml(params.data.groupName)}<br/>${escapeHtml(formatChartNumber(params.data.rawValue, config))}${params.data.count ? `<br/>Наблюдений: <b>${params.data.count}</b>` : ''}` : '') },
      series: [] as Array<Record<string, unknown>>,
    }
    if (categoryGridOnly) option.series.push({ name: '__distribution-grid', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, data: [point(Number(valueAxis.min), 0)], renderItem: (_params: unknown, api: { coord(value: number[]): number[] }) => ({ type: 'group', children: laneLabels.map((_label, laneIndex) => {
      const start = api.coord(point(Number(valueAxis.min), laneIndex)), end = api.coord(point(Number(valueAxis.max), laneIndex))
      return { type: 'line', shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] }, style: { stroke: config.gridColor, lineWidth: config.gridWidth, lineDash: config.gridType === 'dashed' ? [6, 4] : config.gridType === 'dotted' ? [2, 3] : undefined } }
    }) }), z: 0 })
    groups.forEach((group, groupIndex) => {
      const color = groupColor(group), stat = stats[groupIndex]
      const summaryColor = config.seriesStyles[group.name]?.distributionSummaryColor ?? config.seriesStyles[group.seriesKey]?.distributionSummaryColor ?? color
      const summaryWidth = config.seriesStyles[group.name]?.distributionSummaryWidth ?? config.seriesStyles[group.seriesKey]?.distributionSummaryWidth ?? config.distributionSummaryWidth ?? 3
      const summaryLength = (config.seriesStyles[group.name]?.distributionSummaryLength ?? config.seriesStyles[group.seriesKey]?.distributionSummaryLength ?? config.distributionSummaryLength ?? 100) / 100
      const tooltipSummary = `<b>${escapeHtml(group.displayName)}</b><br/>n = ${group.values.length}<br/>Медиана: ${escapeHtml(formatChartNumber(stat.median, config))}<br/>Среднее: ${escapeHtml(formatChartNumber(stat.mean, config))}<br/>Q1–Q3: ${escapeHtml(formatChartNumber(stat.q1, config))}–${escapeHtml(formatChartNumber(stat.q3, config))}`
      const rowWidth = Math.min(config.kind === 'ridgeline' ? 1.6 : .9, Math.max(.15, (config.distributionWidth ?? 72) / 100) * (config.kind === 'ridgeline' ? 1 + (config.distributionRidgelineOverlap ?? 35) / 100 : 1))
      const splitViolin = config.kind === 'violinplot' && config.distributionViolinMode === 'split' && splitSelection.size === 2
      const groupedShape = Boolean(groupField && (config.kind === 'boxplot' || config.kind === 'violinplot' || config.kind === 'raincloud' || config.kind === 'histogram'))
      const categorySlot = rowWidth / Math.max(1, group.subgroupCount)
      const laneOffset = groupedShape && !splitViolin ? (group.subgroupIndex - (group.subgroupCount - 1) / 2) * categorySlot : 0
      const lane = group.laneIndex + laneOffset
      const shapeWidth = groupedShape && !splitViolin ? categorySlot * .84 : rowWidth
      const pointStyle = { color: config.kind === 'raincloud' ? config.canvasBackground ?? '#ffffff' : color, opacity: pointOpacity, borderColor: color, borderWidth: config.kind === 'raincloud' ? 1.25 : 0 }
      const pointEmphasis = { disabled: true, scale: false }
      const barcodeHalf = (band: number) => Math.min(28, Math.max(4, band * shapeWidth / 2))
      const observationData = (observation: typeof group.observations[number], value: number[]) => {
        const override = config.elementStyles[observation.elementKey]
        const labelStyle = override?.valueText ?? config.valueText
        const labelPosition = override?.labelPosition ?? pointLabelPosition
        return {
          ...observation,
          name: override?.label || observation.displayLabel,
          value,
          symbol: override?.markerShape,
          symbolSize: override?.markerSize,
          itemStyle: { ...pointStyle, ...(override?.color ? { color: override.color, borderColor: override.color } : {}), ...(override?.markerFill ? { color: override.markerFill } : {}), ...(override?.markerBorder ? { borderColor: override.markerBorder } : {}), ...(override?.markerBorderWidth != null ? { borderWidth: override.markerBorderWidth } : {}), ...(override?.fillOpacity != null ? { opacity: override.fillOpacity } : {}) },
          label: override ? { ...pointLabel, show: override.showLabel ?? config.distributionShowLabels ?? false, formatter: override.label || observation.displayLabel, position: labelPosition, ...text(labelStyle), ...pointLabelPlacement(labelPosition) } : undefined,
        }
      }
      const addSummary = () => {
        const summaryValue = config.distributionSummaryStatistic === 'mean' ? stat.mean : stat.median
        if (config.distributionShowMedian ?? true) option.series.push({ name: group.name, type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, data: [point(summaryValue, lane)], renderItem: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => {
          const [x, y] = api.coord(point(summaryValue, lane))
          const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
          const widthRatio = config.kind === 'beeswarm' ? .94 : config.kind === 'jitter-plot' ? .72 : config.kind === 'counts-plot' ? .42 : .28
          const maximum = config.kind === 'beeswarm' ? 72 : config.kind === 'jitter-plot' ? 56 : config.kind === 'counts-plot' ? 44 : 28
          const half = (config.kind === 'barcode-plot' ? barcodeHalf(band) : Math.min(maximum / 2, Math.max(pointSize * 1.15, band * rowWidth * widthRatio / 2))) * summaryLength
          return { type: 'line', shape: horizontal ? { x1: x, y1: y - half, x2: x, y2: y + half } : { x1: x - half, y1: y, x2: x + half, y2: y }, style: { stroke: summaryColor, lineWidth: summaryWidth, lineCap: config.kind === 'barcode-plot' ? 'butt' : 'round' } }
        }, z: 10 })
      }
      if (config.kind === 'counts-plot') {
        const counts = [...group.values.reduce((result, value) => result.set(value, (result.get(value) ?? 0) + 1), new Map<number, number>())]
        option.series.push({ name: group.name, type: 'scatter', symbol: 'circle', data: counts.map(([value, count]) => {
          const key = elementKey(group.name, `count:${value}`), override = config.elementStyles[key], labelPosition = override?.labelPosition ?? pointLabelPosition
          return { value: point(value, group.laneIndex), rawValue: value, groupName: group.displayName, count, elementKey: key, sourceSeriesName: group.name, displayValue: formatChartNumber(value, config), displayCategory: group.displayName, displayLabel: formatChartNumber(value, config), name: override?.label || formatChartNumber(value, config), itemStyle: { ...pointStyle, ...(override?.color ? { color: override.color, borderColor: override.color } : {}), ...(override?.fillOpacity != null ? { opacity: override.fillOpacity } : {}) }, label: override ? { ...pointLabel, show: override.showLabel ?? config.distributionShowLabels ?? false, formatter: override.label || formatChartNumber(value, config), position: labelPosition, ...text(override.valueText ?? config.valueText), ...pointLabelPlacement(labelPosition) } : undefined }
        }), symbolSize: (_value: unknown, params: { data?: { count?: number } }) => pointSize * Math.sqrt(params.data?.count ?? 1), itemStyle: pointStyle, emphasis: pointEmphasis, label: pointLabel, labelLayout: pointLabelLayout, z: 5 })
        addSummary()
        return
      }
      if (config.kind === 'barcode-plot') {
        const data = group.observations.map((observation) => ({ ...observation, value: point(observation.value, lane), rawValue: observation.value, groupName: group.displayName }))
        option.series.push({ name: group.name, type: 'custom', coordinateSystem: 'cartesian2d', data, renderItem: (params: { dataIndex: number }, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => {
          const observation = group.observations[params.dataIndex]
          const override = config.elementStyles[observation.elementKey]
          const [x, y] = api.coord(point(observation.value, lane))
          const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
          const half = barcodeHalf(band)
          const stroke = override?.color ?? override?.markerFill ?? color
          const lineWidth = override?.lineWidth ?? config.distributionTickWidth ?? 2
          const position = override?.labelPosition ?? pointLabelPosition
          const labelStyle = override?.valueText ?? config.valueText
          const gap = half + 5
          const info = { elementKey: observation.elementKey, sourceSeriesName: observation.sourceSeriesName, displayCategory: observation.displayCategory, displayValue: observation.displayValue, displayLabel: observation.displayLabel }
          const line = { type: 'line', info, shape: horizontal ? { x1: x, y1: y - half, x2: x, y2: y + half } : { x1: x - half, y1: y, x2: x + half, y2: y }, style: { stroke, lineWidth, opacity: override?.fillOpacity ?? pointOpacity } }
          const label = override?.label || observation.displayLabel
          const labelX = x + (position === 'right' ? gap : position === 'left' ? -gap : 0)
          const labelY = y + (position === 'bottom' ? gap : position === 'top' ? -gap : 0)
          const textLabel = { type: 'text', info, style: { x: labelX, y: labelY, text: label, fill: labelStyle.color, font: `${labelStyle.italic ? 'italic ' : ''}${labelStyle.weight} ${labelStyle.size}px ${labelStyle.fontFamily}`, ...pointLabelPlacement(position) } }
          return { type: 'group', children: (override?.showLabel ?? config.distributionShowLabels) && label ? [line, textLabel] : [line] }
        }, z: 5 })
        addSummary()
        return
      }
      if (config.kind === 'ridgeline') {
        option.series.push({ name: group.name, type: 'custom', coordinateSystem: 'cartesian2d', itemStyle: { color }, data: [{ value: point(group.values[0], lane), summary: tooltipSummary }], renderItem: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => {
          const min = group.values[0], max = group.values.at(-1)!
          const bandwidth = Math.max((max - min) * bandwidthRatio, rawSpan / 1000)
          const start = min - bandwidth * 1.75, end = max + bandwidth * 1.75
          const samples = Array.from({ length: 81 }, (_, sample) => start + (end - start) * sample / 80)
          const density = samples.map((value) => group.values.reduce((sum, current) => sum + Math.exp(-.5 * ((value - current) / bandwidth) ** 2), 0))
          const peak = Math.max(...density, 1)
          density[0] = 0; density[density.length - 1] = 0
          const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
          const thickness = Math.max(8, band * shapeWidth)
          const baseline = samples.map((value) => api.coord(point(value, lane)))
          const curve = baseline.map(([x, y], index) => horizontal ? [x, y - density[index] / peak * thickness] : [x + density[index] / peak * thickness, y])
          const polygon = [...baseline, ...[...curve].reverse()]
          const medianBase = api.coord(point(stat.median, lane))
          const medianDensity = group.values.reduce((sum, current) => sum + Math.exp(-.5 * ((stat.median - current) / bandwidth) ** 2), 0) / peak * thickness * summaryLength
          const medianTip = horizontal ? [medianBase[0], medianBase[1] - medianDensity] : [medianBase[0] + medianDensity, medianBase[1]]
          return { type: 'group', children: [
            { type: 'polygon', shape: { points: polygon }, style: { fill: color, opacity: config.distributionDensityFillOpacity ?? .2 } },
            { type: 'polyline', shape: { points: curve }, style: { fill: 'none', stroke: color, lineWidth: config.seriesStyles[group.name]?.lineWidth ?? config.seriesStyles[group.seriesKey]?.lineWidth ?? 2 } },
            { type: 'line', shape: { x1: baseline[0][0], y1: baseline[0][1], x2: baseline.at(-1)![0], y2: baseline.at(-1)![1] }, style: { stroke: color, lineWidth: 1.25 } },
            ...(config.distributionShowMedian ?? true ? [{ type: 'line', shape: { x1: medianBase[0], y1: medianBase[1], x2: medianTip[0], y2: medianTip[1] }, style: { stroke: summaryColor, lineWidth: summaryWidth } }] : []),
          ] }
        }, z: 4 + group.laneIndex })
        return
      }
      if (config.kind === 'beeswarm') {
        option.series.push({ name: group.name, type: 'custom', coordinateSystem: 'cartesian2d', itemStyle: { color }, labelItems: group.observations, data: [{ value: [group.laneIndex], summary: tooltipSummary }], renderItem: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => {
          const clouds = [...new Set(groups.map((candidate) => candidate.laneIndex))].map((laneIndex) => {
            const entries = groups.filter((candidate) => candidate.laneIndex === laneIndex).flatMap((candidate) => candidate.observations.map((observation) => ({ ...observation, seriesKey: candidate.seriesKey })))
            const coordinates = entries.map((entry) => api.coord(point(entry.value, laneIndex)))
            return { laneIndex, entries, coordinates, primary: coordinates.map((coordinate) => coordinate[horizontal ? 0 : 1]) }
          })
          const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
          const maximumOffset = band * rowWidth / 2
          const fitted = fitSwarmClouds(clouds.map((cloud) => cloud.primary), pointSize / .9, maximumOffset)
          const cloudIndex = clouds.findIndex((cloud) => cloud.laneIndex === group.laneIndex)
          const cloud = clouds[cloudIndex]
          return { type: 'group', children: cloud.coordinates.flatMap(([x, y], index) => {
            if (cloud.entries[index].seriesKey !== group.seriesKey) return []
            const cx = horizontal ? x : x + fitted.offsets[cloudIndex][index], cy = horizontal ? y + fitted.offsets[cloudIndex][index] : y
            const observation = cloud.entries[index], override = config.elementStyles[observation.elementKey], labelStyle = override?.valueText ?? config.valueText
            const position = override?.labelPosition ?? pointLabelPosition, markerSize = override?.markerSize ?? pointSize, gap = markerSize / 2 + 5, label = override?.label || observation.displayLabel
            const labelX = cx + (position === 'right' ? gap : position === 'left' ? -gap : 0)
            const labelY = cy + (position === 'bottom' ? gap : position === 'top' ? -gap : 0)
            const info = { elementKey: observation.elementKey, sourceSeriesName: observation.sourceSeriesName, displayCategory: observation.displayCategory, displayValue: observation.displayValue, displayLabel: observation.displayLabel }
            const markerColor = override?.markerFill ?? override?.color ?? color, markerBorder = override?.markerBorder ?? override?.color ?? color
            const circle = { type: 'circle', info, shape: { cx, cy, r: markerSize / 2 }, style: { fill: markerColor, stroke: markerBorder, lineWidth: override?.markerBorderWidth ?? 0, opacity: override?.fillOpacity ?? pointOpacity } }
            const textLabel = { type: 'text', info, style: { x: labelX, y: labelY, text: label, fill: labelStyle.color, font: `${labelStyle.italic ? 'italic ' : ''}${labelStyle.weight} ${labelStyle.size}px ${labelStyle.fontFamily}`, ...pointLabelPlacement(position) } }
            return (override?.showLabel ?? config.distributionShowLabels) && label ? [circle, textLabel] : [circle]
          }) }
        }, z: 5 })
        addSummary()
        return
      }
      if (config.kind === 'strip-plot' || config.kind === 'jitter-plot') {
        const data = group.observations.map((observation, index) => ({ ...observationData(observation, point(observation.value, group.laneIndex + (config.kind === 'jitter-plot' ? distributionRandom(index, groupIndex) * (config.distributionJitter ?? .32) * rowWidth : 0))), rawValue: observation.value, groupName: group.displayName }))
        option.series.push({ name: group.name, type: 'scatter', data, symbol: 'circle', symbolSize: pointSize, itemStyle: pointStyle, emphasis: pointEmphasis, label: pointLabel, labelLayout: pointLabelLayout, z: 5 })
        addSummary()
        return
      }
      option.series.push({ name: group.name, type: 'custom', coordinateSystem: 'cartesian2d', itemStyle: { color }, data: [{ value: [group.laneIndex], summary: tooltipSummary }], renderItem: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => {
        const coord = (value: number, category = lane) => api.coord(point(value, category)), band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0])
        const maximumThickness = config.kind === 'boxplot' ? 56 : config.kind === 'raincloud' ? 84 : 88
        const thickness = Math.min(maximumThickness, Math.max(8, band * shapeWidth))
        if (config.kind === 'boxplot') {
          const low = coord(stat.min), q1 = coord(stat.q1), median = coord(stat.median), q3 = coord(stat.q3), high = coord(stat.max), half = thickness / 2, medianHalf = half * summaryLength
          const line = (a: number[], b: number[], width = 1.5, stroke = color) => ({ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke, lineWidth: width } })
          const children = horizontal
            ? [line(low, q1), line(q3, high), line([low[0], low[1] - half * .55], [low[0], low[1] + half * .55]), line([high[0], high[1] - half * .55], [high[0], high[1] + half * .55]), { type: 'rect', shape: { x: q1[0], y: q1[1] - half, width: Math.max(1, q3[0] - q1[0]), height: thickness, r: 0 }, style: { fill: color, opacity: .42, stroke: color, lineWidth: 1.5 } }, ...(config.distributionShowMedian ?? true ? [line([median[0], median[1] - medianHalf], [median[0], median[1] + medianHalf], summaryWidth, summaryColor)] : [])]
            : [line(low, q1), line(q3, high), line([low[0] - half * .55, low[1]], [low[0] + half * .55, low[1]]), line([high[0] - half * .55, high[1]], [high[0] + half * .55, high[1]]), { type: 'rect', shape: { x: q1[0] - half, y: q3[1], width: thickness, height: Math.max(1, q1[1] - q3[1]), r: 0 }, style: { fill: color, opacity: .42, stroke: color, lineWidth: 1.5 } }, ...(config.distributionShowMedian ?? true ? [line([median[0] - medianHalf, median[1]], [median[0] + medianHalf, median[1]], summaryWidth, summaryColor)] : [])]
          return { type: 'group', children }
        }
        const min = group.values[0], max = group.values.at(-1)!, bandwidth = Math.max((max - min) * bandwidthRatio, rawSpan / 1000), start = min - bandwidth * 1.75, end = max + bandwidth * 1.75, samples = Array.from({ length: 81 }, (_, sample) => start + (end - start) * sample / 80)
        const density = samples.map((value) => group.values.reduce((sum, current) => sum + Math.exp(-.5 * ((value - current) / bandwidth) ** 2), 0)), peak = Math.max(...density, 1)
        density[0] = 0; density[density.length - 1] = 0
        const center = samples.map((value) => coord(value))
        const side = center.map(([x, y], index) => horizontal ? [x, y - density[index] / peak * thickness / 2] : [x - density[index] / peak * thickness / 2, y])
        const other = [...center].reverse().map(([x, y], reversed) => { const index = center.length - reversed - 1; return horizontal ? [x, y + density[index] / peak * thickness / 2] : [x + density[index] / peak * thickness / 2, y] })
        const violinSide = config.kind === 'raincloud' ? -1 : splitViolin ? group.seriesKey === splitFirst ? -1 : 1 : config.distributionViolinMode === 'half' ? config.distributionViolinHalfSide === 'first' ? -1 : 1 : 0
        const polygonPoints = violinSide < 0 ? [...side, ...[...center].reverse()] : violinSide > 0 ? [...center, ...other] : [...side, ...other]
        const summaryLane = config.kind === 'raincloud' ? lane + shapeWidth * .16 : lane
        const summarySide = config.kind === 'raincloud' ? 0 : violinSide
        const q1 = coord(stat.q1, summaryLane), q3 = coord(stat.q3, summaryLane), median = coord(stat.median, summaryLane), boxThickness = Math.max(config.kind === 'raincloud' ? 12 : 6, pointSize * (config.kind === 'raincloud' ? 1.45 : 1)), medianLength = boxThickness * summaryLength
        const summaryLine = (value: number, lineWidth: number, lineDash?: number[]) => {
          const [x, y] = coord(value, summaryLane)
          const extent = group.values.reduce((sum, current) => sum + Math.exp(-.5 * ((value - current) / bandwidth) ** 2), 0) / peak * thickness / 2 * summaryLength
          return { type: 'line', shape: horizontal
            ? { x1: x, y1: y + (summarySide > 0 ? 0 : -extent), x2: x, y2: y + (summarySide < 0 ? 0 : extent) }
            : { x1: x + (summarySide > 0 ? 0 : -extent), y1: y, x2: x + (summarySide < 0 ? 0 : extent), y2: y },
          style: { stroke: summaryColor, lineWidth, lineDash } }
        }
        const whiskerStart = coord(stat.min, summaryLane), whiskerEnd = coord(stat.max, summaryLane)
        const whisker = { type: 'line', shape: { x1: whiskerStart[0], y1: whiskerStart[1], x2: whiskerEnd[0], y2: whiskerEnd[1] }, style: { stroke: summaryColor, lineWidth: Math.max(1, summaryWidth * .55) } }
        const box = horizontal
          ? { type: 'rect', shape: { x: q1[0], y: q1[1] + (summarySide < 0 ? -boxThickness / 2 : summarySide > 0 ? 0 : -boxThickness / 2), width: Math.max(1, q3[0] - q1[0]), height: summarySide ? boxThickness / 2 : boxThickness, r: 0 }, style: { fill: config.canvasBackground ?? '#ffffff', opacity: .78, stroke: color, lineWidth: 1.5 } }
          : { type: 'rect', shape: { x: q1[0] + (summarySide < 0 ? -boxThickness / 2 : summarySide > 0 ? 0 : -boxThickness / 2), y: q3[1], width: summarySide ? boxThickness / 2 : boxThickness, height: Math.max(1, q1[1] - q3[1]), r: 0 }, style: { fill: config.canvasBackground ?? '#ffffff', opacity: .78, stroke: color, lineWidth: 1.5 } }
        const medianMark = horizontal
          ? { type: 'line', shape: { x1: median[0], y1: median[1] + (summarySide > 0 ? 0 : -medianLength / 2), x2: median[0], y2: median[1] + (summarySide < 0 ? 0 : medianLength / 2) }, style: { stroke: summaryColor, lineWidth: summaryWidth } }
          : { type: 'line', shape: { x1: median[0] + (summarySide > 0 ? 0 : -medianLength / 2), y1: median[1], x2: median[0] + (summarySide < 0 ? 0 : medianLength / 2), y2: median[1] }, style: { stroke: summaryColor, lineWidth: summaryWidth } }
        const lineSummary = [summaryLine(stat.q1, Math.max(1, summaryWidth * .55), [4, 3]), ...(config.distributionShowMedian ?? true ? [summaryLine(stat.median, summaryWidth)] : []), summaryLine(stat.q3, Math.max(1, summaryWidth * .55), [4, 3])]
        const summary = (config.distributionViolinSummaryMode ?? 'box') === 'lines' ? lineSummary : [box, ...(config.distributionShowMedian ?? true ? [medianMark] : [])]
        return { type: 'group', children: [{ type: 'polygon', shape: { points: polygonPoints }, style: { fill: color, opacity: config.distributionDensityFillOpacity ?? .2, stroke: color, lineWidth: 1.25 } }, ...(config.distributionViolinShowWhiskers ?? true ? [whisker] : []), ...summary] }
      }, z: 3 })
      const individuallyLabelled = group.observations.filter((observation) => config.elementStyles[observation.elementKey]?.showLabel)
      const shownObservations = [...new Map(((config.kind === 'violinplot' || config.kind === 'raincloud') && (config.distributionShowPoints ?? true) ? group.observations : config.kind === 'boxplot' ? config.distributionShowAllPoints ? group.observations : (config.distributionShowOutliers ?? true) ? group.observations.filter((observation) => stat.outliers.includes(observation.value)) : [] : []).concat(individuallyLabelled).map((observation) => [observation.elementKey, observation])).values()]
      if (shownObservations.length) option.series.push({ name: group.name, type: 'scatter', data: shownObservations.map((observation, index) => {
        const random = distributionRandom(index, groupIndex)
        const violinSide = splitViolin ? group.seriesKey === splitFirst ? -1 : 1 : config.kind === 'violinplot' && config.distributionViolinMode === 'half' ? config.distributionViolinHalfSide === 'first' ? -1 : 1 : 0
        const pointLane = config.kind === 'raincloud'
          ? lane + ((config.distributionRaincloudPointMode ?? 'overlay') === 'separate' ? .36 + random * .08 : .16 + random * .1) * shapeWidth
          : lane + (violinSide ? violinSide * (.08 + Math.abs(random) * .12) : random * .1) * shapeWidth
        return { ...observationData(observation, point(observation.value, pointLane)), rawValue: observation.value, groupName: group.displayName }
      }), symbol: 'circle', symbolSize: pointSize, itemStyle: pointStyle, emphasis: pointEmphasis, label: pointLabel, labelLayout: pointLabelLayout, z: 6 })
    })
    if (!horizontal) option.series.push(...yAxisEdgeAffixSeries(config, Number((option.yAxis as { min?: number }).min), Number((option.yAxis as { max?: number }).max)))
    return option
  },
}

export const chartRegistry = [
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
  ...intervalChartDefinitions.map(([id, label]) => intervalLine(id, label)),
  ...areaChartDefinitions.map(([id, label]) => cartesian(id, label, 'area')),
  scatter,
  bubble,
  ...distributionChartDefinitions.map(([id, label]) => ({ ...distribution, ...pluginModel(id), id, label })),
  heatmap,
  treemap,
]

export function getChartPlugin(id: ChartConfig['kind']) {
  return chartRegistry.find((plugin) => plugin.id === id) ?? chartRegistry[0]
}

export function chartValueLabelSelections(table: DataTable, config: ChartConfig): ChartElementSelection[] {
  const listingConfig = isDistributionChart(config.kind) ? { ...config, distributionShowAllPoints: true, distributionShowPoints: true } : config
  const option = getChartPlugin(config.kind).buildOption(table, listingConfig) as { series?: Array<{ name?: string; data?: unknown[]; labelItems?: unknown[] }> }
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
