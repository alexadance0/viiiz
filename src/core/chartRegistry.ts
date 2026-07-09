import type { ChartConfig, ChartPlugin, DataTable } from './types'
import { formatTimeValue } from './timeFrequency'
import { formatChartNumber, formatXAxisNumber } from './numberFormat'
import { measureTextWidth, wrapMeasuredText } from './textMetrics'
import { axisValue, dateValue, niceNumericScale, orderedBounds, prepareVisibleChartData } from './chartScale'
import { effectiveDateStepUnit, formatCategories, stackedContextFormat } from './chartDateAxis'
import { isAreaChart, isBarChart, isHorizontalBarChart, isNormalizedStackedChart, isStackedBarChart, isStackedChart } from './chartKinds'

export { niceNumericScale, prepareVisibleChartData } from './chartScale'

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
  return config.seriesStyles[name]?.color ?? (isBarChart(config.kind) ? config.barFillColor : undefined) ?? palette[index % palette.length]
}
const niceLegendValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return value
  const power = 10 ** Math.floor(Math.log10(value))
  const candidates = [1, 2, 3, 5, 7, 10].map((factor) => factor * power)
  return candidates.reduce((best, candidate) => candidate <= value && candidate > best ? candidate : best, candidates[0])
}
const CONTENT_LEFT = 32
const alignedLeft = (align: ChartConfig['titleText']['align'], left = CONTENT_LEFT) => align === 'left' ? left : align === 'center' ? 'center' : undefined
const elementKey = (series: string, category: unknown) => `${series}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
const valueLabelPosition = (config: ChartConfig, kind: ChartConfig['kind']) => {
  const configured = config.valueLabelPosition ?? 'auto'
  if (isBarChart(kind) && config.barOrientation === 'horizontal') return ({ auto: 'right', top: 'right', bottom: 'left', 'inside-top': 'insideRight', 'inside-center': 'inside', 'inside-bottom': 'insideLeft' } as const)[configured]
  if (configured === 'auto') return 'top'
  return ({ 'inside-top': 'insideTop', 'inside-center': 'inside', 'inside-bottom': 'insideBottom' } as const)[configured as 'inside-top' | 'inside-center' | 'inside-bottom'] ?? configured
}
const isInsideValueLabel = (config: ChartConfig) => ['inside-top', 'inside-center', 'inside-bottom'].includes(config.valueLabelPosition ?? '')
const contrastText = (color: string) => {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1]
  if (!hex) return '#ffffff'
  const [red, green, blue] = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  return red * .299 + green * .587 + blue * .114 > 165 ? '#202027' : '#ffffff'
}
const directLabelWidth = (config: ChartConfig, series: Array<{ name: string }>) => {
  const style = config.directLabelText ?? config.legendText
  const canvasWidth = Math.min(1000, config.canvasWidth ?? 1000)
  const noteSize = Math.max(8, style.size - 2)
  const lineWidth = (value: string, size: number, weight: number) => Math.max(0, ...value.split('\n').map((line) => measureTextWidth(line, size, style.fontFamily, weight)))
  const content = series.reduce((result, item) => {
    const override = config.seriesStyles[item.name]
    return Math.max(result, lineWidth(override?.legendLabel?.trim() || item.name, style.size, style.weight), lineWidth(override?.legendNote?.trim() || '', noteSize, 400))
  }, 0)
  return Math.round(Math.min(Math.max(120, canvasWidth - 120), Math.max(style.size * 3, content + 10)))
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
    : niceNumericScale(scaleValues, isBarChart(config.kind))
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
  const yAxisSpace = config.showYAxisTitle && config.yAxisTitle ? yAxisTitleHeight + config.yAxisTitleGap : 0
  const legendPosition = config.legendPosition ?? 'top'
  const directLabels = config.kind !== 'scatter' && Boolean(config.showDirectLabels)
  const standardLegend = config.showLegend && !directLabels
  const sideLegend = standardLegend && (legendPosition === 'left' || legendPosition === 'right')
  const plotLeft = (config.yAxisPosition === 'left' ? contentLeft + yAxisSpace : contentLeft) + (sideLegend && legendPosition === 'left' ? 120 : 0)
  const directWidth = directLabelWidth(config, prepared.series)
  const basePlotRight = (config.yAxisPosition === 'right' ? contentRight + yAxisSpace : directLabels ? 0 : Math.max(30, contentRight)) + (sideLegend && legendPosition === 'right' ? 120 : 0) + (directLabels ? directWidth + (config.directLabelGap ?? 14) + contentRight : 0)
  const dateCategories = categories.some((value) => value instanceof Date)
  const calendarStep = dateCategories && effectiveDateStepUnit(config)
  const categoryLabels = formatCategories(categories, table, config)
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
  const adaptiveLabelDensity = manualDateDensity || categoricalText
  const adaptivePlotWidth = Math.max(80, (config.canvasWidth ?? 1000) - plotLeft - basePlotRight - 20)
  const labelSlot = adaptivePlotWidth / Math.max(1, requestedLabels.length)
  const longestCharacters = requestedLabels.reduce((result, label) => Math.max(result, widestLineLength(label)), 0)
  const fittedDateSize = longestCharacters ? Math.floor((labelSlot - 5) / (longestCharacters * .58)) : xAxisLabelText.size
  const effectiveXLabelSize = adaptiveLabelDensity ? Math.max(8, Math.min(xAxisLabelText.size, fittedDateSize)) : xAxisLabelText.size
  const effectiveLabelWidth = longestCharacters * effectiveXLabelSize * .58
  const xLabelRotate = manualDateDensity && effectiveLabelWidth > labelSlot * 1.08 ? 45 : 0
  const labelLines = stackedContextFormat(config.dateLabelFormat) ? 2 : 1
  const rotatedLabelExtra = xLabelRotate ? Math.min(72, Math.round(effectiveLabelWidth * .72)) : 0
  const xScaleLabelsHeight = Math.round(effectiveXLabelSize * xAxisLabelText.lineHeight / 100) * labelLines + rotatedLabelExtra + 8 + (config.showXTicks ? config.tickLength : 0)
  const headerBottom = (config.subtitle || (standardLegend && legendPosition === 'top') ? 104 : 78) + Math.max(0, contentTop - 24)
  const plotTop = config.xAxisPosition === 'top' ? headerBottom + xScaleLabelsHeight + (config.showXAxisTitle && config.xAxisTitle ? xAxisTitleHeight + config.xAxisTitleGap : 0) : headerBottom
  const plotBottomBase = config.note || config.source
    ? (config.xAxisPosition === 'bottom' && config.showXAxisTitle && config.xAxisTitle ? 28 + xScaleLabelsHeight + xAxisTitleHeight + config.xAxisTitleGap : 56)
    : config.xAxisPosition === 'bottom' && config.showXAxisTitle && config.xAxisTitle ? 18 + xScaleLabelsHeight + xAxisTitleHeight + config.xAxisTitleGap : 38
  const plotBottom = plotBottomBase + Math.max(0, contentBottom - 24) + (standardLegend && legendPosition === 'bottom' ? 34 : 0)
  const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const lastVisibleLabel = categoryLabels.findLast((label) => Boolean(label)) ?? ''
  // Category and time labels are centred on their tick. Reserve half of the final
  // label width for every cartesian chart so it cannot escape the canvas edge.
  const numericCategories = categories.length > 0 && categories.every((value) => typeof value === 'number' && Number.isFinite(value))
  const numericPhysicalX = numericCategories || config.kind === 'scatter' || (isBarChart(config.kind) && config.barOrientation === 'horizontal')
  const endUnitSpace = numericPhysicalX && config.xAxisEndLabel ? Math.ceil(config.xAxisEndLabel.length * effectiveXLabelSize * .58) + 4 : 0
  const rightEdgeLabelSpace = (lastVisibleLabel ? Math.min(110, Math.ceil(widestLineLength(lastVisibleLabel) * effectiveXLabelSize * .3) + 10) : 0) + endUnitSpace
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
  const automaticDateVisible = new Set(visibleDateIndices.filter((_, ordinal) => ordinal % automaticDateStride === 0))
  const automaticDateCategory = (index: number) => automaticDateVisible.has(index)
  const anchoredInterval = (index: number) => index >= anchorIndex && (index - anchorIndex) % Math.max(1, Math.round(config.xAxisStep ?? 1)) === 0
  const categoryInterval: 'auto' | number | ((index: number) => boolean) = categoricalText && config.xAxisStep == null ? 0 : calendarStep ? config.xAxisStep == null && anchorIndex < 0 ? automaticDateCategory : visibleCategory : anchorIndex >= 0 ? anchoredInterval : config.xAxisStep == null ? dateCategories ? automaticDateStride - 1 : isBarChart(config.kind) ? automaticBarInterval : 'auto' : Math.max(0, Math.round(config.xAxisStep) - 1)
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
      const value = Array.isArray(item.value) ? item.value.at(-1) : item.value
      return `${item.marker ?? ''}${escapeHtml(item.seriesName)}: <b>${escapeHtml(value == null ? 'пропуск' : formatChartNumber(value, config))}</b>`
    })
    return [`<b>${escapeHtml(tooltipLabels[index] ?? categoryLabels[index] ?? '')}</b>`, ...rows].join('<br/>')
  } },
  legend: {
    show: standardLegend,
    data: prepared.series.map((series, index) => ({ name: series.name, icon: isBarChart(config.kind) ? 'rect' : 'path://M0 4H24V7H0Z', itemStyle: { color: getSeriesColor(config, series.name, index), borderWidth: 0 } })),
    orient: sideLegend ? 'vertical' : 'horizontal',
    top: legendPosition === 'top' ? (config.subtitle ? 72 : 54) : legendPosition === 'bottom' ? undefined : 'middle',
    bottom: legendPosition === 'bottom' ? (config.note || config.source ? 42 : 8) : undefined,
    left: legendPosition === 'right' ? undefined : contentLeft,
    right: legendPosition === 'right' ? contentRight : undefined,
    itemWidth: isBarChart(config.kind) ? 10 : 24,
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
    axisLabel: { ...text(xAxisLabelText), fontSize: effectiveXLabelSize, lineHeight: Math.round(effectiveXLabelSize * xAxisLabelText.lineHeight / 100), rotate: config.xAxisLabelRotate ?? xLabelRotate, width: config.xAxisLabelOverflow === 'wrap' || categoricalText ? Math.max(24, estimatedCategoryStep - 6) : undefined, overflow: config.xAxisLabelOverflow === 'truncate' ? 'truncate' : undefined, inside: false, formatter: (_value: string, index: number) => { const label = categoryLabels[index] ?? ''; if (numericCategories && ((config.xAxisStartLabel && index === categoryLabels.findIndex(Boolean)) || (config.xAxisEndLabel && index === categoryLabels.findLastIndex(Boolean)))) return ''; return categoricalText ? wrapMeasuredText(label, effectiveXLabelSize, Math.max(24, estimatedCategoryStep - 6), xAxisLabelText.fontFamily, xAxisLabelText.weight).text : label }, interval: categoryInterval, hideOverlap: categoricalText ? false : dateCategories ? false : config.xAxisStep == null && anchorIndex < 0, showMinLabel: true, showMaxLabel: categoricalText ? true : undefined },
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
    axisLabel: { ...text(yAxisLabelText), inside: false, formatter: (value: number) => (config.numberPrefix || config.numberSuffix) && config.barOrientation !== 'horizontal' && Math.abs(value - effectiveYMax) <= Math.max(1, Math.abs(effectiveYMax)) * 1e-9 ? '' : formatChartNumber(value, config) },
    axisLine: { show: config.showYAxisLine, onZero: false, lineStyle: axisLineStyle },
    axisTick: { show: config.showYTicks, inside: false, length: config.tickLength, lineStyle: axisLineStyle },
    splitLine: { show: config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  },
  }
}

const cartesian = (id: Exclude<ChartConfig['kind'], 'scatter' | 'bubble' | 'range-line' | 'step-range-line' | 'confidence-line'>, label: string, category: ChartPlugin['category']): ChartPlugin => ({
  id,
  label,
  category,
  settings: {
    sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
    series: isBarChart(id) || isAreaChart(id) ? ['color'] : ['color', 'line', 'markers'],
    features: { directLabels: true, barLayout: isBarChart(id), dataPreparation: false, normalizedStack: isNormalizedStackedChart(id), areaLayout: isAreaChart(id), scatterLayout: false, lineVariant: id === 'step-line' },
  },
  buildOption(table, sourceConfig) {
    const config = isHorizontalBarChart(id) ? { ...sourceConfig, barOrientation: 'horizontal' as const } : sourceConfig
    const area = isAreaChart(id), stacked = isStackedChart(id)
    const prepared = prepareVisibleChartData(table, config)
    const directLabels = Boolean(config.showDirectLabels)
    const directWidth = directLabelWidth(config, prepared.series)
    const hasLineOverrides = new Set(!isBarChart(id) && !area ? prepared.series.flatMap((series) => prepared.categories.some((category) => {
      const override = config.elementStyles[elementKey(series.name, category)]
      return override && (override.color != null || override.lineWidth != null || override.lineType != null)
    }) ? [series.name] : []) : [])
    const baseSeries = prepared.series.map((series, seriesIndex) => {
      const style = config.seriesStyles[series.name]
      const color = getSeriesColor(config, series.name, seriesIndex)
      const layerZ = 30 + (prepared.series.length - seriesIndex) * 10
      const lastIndex = series.data.reduce((result, value, index) => value == null ? result : index, -1)
      const directTextStyle = config.directLabelText ?? config.legendText
      const directName = style?.legendLabel?.trim() || series.name
      const directText = style?.legendNote ? `{name|${directName}}\n{note|${style.legendNote}}` : `{name|${directName}}`
      const showLeader = style?.showLegendLine ?? config.showDirectLabelLines ?? false
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
          name: { color, fontFamily: directTextStyle.fontFamily, fontWeight: directTextStyle.weight, fontStyle: directTextStyle.italic ? 'italic' : 'normal', fontSize: directTextStyle.size },
          note: { color, fontFamily: directTextStyle.fontFamily, fontSize: Math.max(8, directTextStyle.size - 2), opacity: .75 },
        },
      }
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
      barCategoryGap: isBarChart(id) ? `${100 - Math.max(10, Math.min(95, config.barWidth ?? 68))}%` : undefined,
      barGap: isBarChart(id) ? `${config.barSeriesGap ?? 30}%` : undefined,
      lineStyle: { color, width: style?.lineWidth ?? 3, type: style?.lineType ?? 'solid', opacity: hasLineOverrides.has(series.name) ? 0 : 1 },
      areaStyle: area ? { color, opacity: style?.fillOpacity ?? config.areaFillOpacity ?? .32 } : undefined,
      emphasis: isBarChart(id) ? undefined : { scale: false },
      z: layerZ,
      label: { show: config.showValues, position: valueLabelPosition(config, id), formatter: (params: { value?: unknown }) => formatChartNumber(Array.isArray(params.value) ? params.value.at(-1) : params.value, config), ...text(config.valueText), color: isBarChart(id) && isInsideValueLabel(config) && (config.valueLabelAutoContrast ?? true) ? contrastText(color) : config.valueText.color },
      markLine: seriesIndex === 0 && config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: config.zeroLineColor ?? '#8a8791', width: config.zeroLineWidth ?? 1, type: config.zeroLineType ?? 'solid' }, label: { show: false } } : undefined,
      endLabel: !isBarChart(id) && directLabels ? { show: true, distance: config.directLabelGap ?? 14, ...directLabelStyle } : undefined,
      labelLine: directLabels ? { show: showLeader, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } : undefined,
      labelLayout: directLabels ? isBarChart(id)
        ? (params: { dataIndex?: number }) => params.dataIndex === lastIndex ? { align: 'left', moveOverlap: 'shiftY', hideOverlap: false } : {}
        : { align: 'left', moveOverlap: 'shiftY', hideOverlap: false } : { hideOverlap: config.valueLabelHideOverlap ?? true, moveOverlap: 'shiftY' },
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
          const label = point.label ? { ...point.label, position: valueLabelPosition(config, id), color: isInsideValueLabel(config) && (config.valueLabelAutoContrast ?? true) ? contrastText(element?.color ?? color) : labelStyle.color } : undefined
          const barPoint = { ...point, ...(pointItemStyle ? { itemStyle: pointItemStyle } : {}), ...(label ? { label, emphasis: { label } } : {}) }
          return directLabels && index === lastIndex ? { ...barPoint, directLegendLabel: true, label: { show: true, position: 'right', distance: config.directLabelGap ?? 14, ...directLabelStyle }, labelLine: { show: showLeader, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } } : barPoint
        }
        const marker = config.elementStyles[elementKey(series.name, category)]
        const visible = marker?.showMarker ?? style?.showMarker ?? false
        return {
          ...point,
          symbol: marker?.markerShape ?? style?.markerShape ?? 'circle',
          symbolSize: visible ? marker?.markerSize ?? style?.markerSize ?? 8 : 0,
          itemStyle: {
            color: marker?.markerFill ?? style?.markerFill ?? '#ffffff',
            borderColor: marker?.markerBorder ?? style?.markerBorder ?? marker?.color ?? color,
            borderWidth: marker?.markerBorderWidth ?? style?.markerBorderWidth ?? 2,
          },
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
          const band = Math.abs(api.size(horizontal ? [0, 1] : [1, 0])[horizontal ? 1 : 0]), groupWidth = band * Math.max(.1, Math.min(.95, (config.barWidth ?? 68) / 100))
          const count = stacked ? 1 : Math.max(1, prepared.series.length), gapRatio = Math.max(-.9, (config.barSeriesGap ?? 30) / 100), normalWidth = groupWidth / Math.max(.1, count + Math.max(0, count - 1) * gapRatio)
          const offset = stacked ? 0 : -groupWidth / 2 + normalWidth / 2 + seriesIndex * normalWidth * (1 + gapRatio)
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
        data: [{ value: [dataIndex, value], elementKey: elementKey(series.name, category), sourceSeriesName: series.name, displayValue: formatChartNumber(value, config), displayCategory: category instanceof Date ? formatTimeValue(category, table.timeProfiles?.[config.xField], config.dateLabelFormat) : String(category ?? ''), itemStyle: { color, opacity, borderColor, borderWidth } }],
      }]
    })) : []
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
      itemStyle: { color: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, opacity: 0 },
      tooltip: { show: false },
      animation: false,
      z: 50,
    })) : []
    const option = { ...commonOption(table, config, prepared), series: [...baseSeries, ...individualBarSeries, ...segmentSeries, ...hitSeries] }
    if (isBarChart(id) && config.barOrientation === 'horizontal') {
      const mutable = option as unknown as { xAxis: Record<string, unknown>; yAxis: Record<string, unknown>; grid: { top: number; bottom: number; left: number; right: number }; graphic: Array<Record<string, unknown>>; series: Array<{ markLine?: { data: Array<Record<string, number>> } }> }
      const categoryAxis = mutable.xAxis, valueAxis = mutable.yAxis
      const physicalXMin = Number(valueAxis.min), physicalXMax = Number(valueAxis.max)
      const valueLabelText = config.yAxisLabelText ?? config.axisLabelText
      const valueLabelHeight = Math.round(valueLabelText.size * valueLabelText.lineHeight / 100)
      const xTitleStyle = config.xAxisTitleText ?? config.axisTitleText, yTitleStyle = config.yAxisTitleText ?? config.axisTitleText
      const xTitleReserve = config.showXAxisTitle && config.xAxisTitle ? Math.round(xTitleStyle.size * xTitleStyle.lineHeight / 100) * Math.max(1, config.xAxisTitle.split('\n').length) + config.xAxisTitleGap : 0
      const yTitleReserve = config.showYAxisTitle && config.yAxisTitle ? Math.round(yTitleStyle.size * yTitleStyle.lineHeight / 100) * Math.max(1, config.yAxisTitle.split('\n').length) + config.yAxisTitleGap : 0
      const horizontalReserveDelta = yTitleReserve - xTitleReserve
      const verticalReserveDelta = xTitleReserve - yTitleReserve
      if (config.xAxisPosition === 'top') mutable.grid.top = Math.max(0, mutable.grid.top + horizontalReserveDelta)
      else mutable.grid.bottom = Math.max(0, mutable.grid.bottom + horizontalReserveDelta)
      if (config.yAxisPosition === 'right') mutable.grid.right = Math.max(0, mutable.grid.right + verticalReserveDelta)
      else mutable.grid.left = Math.max(0, mutable.grid.left + verticalReserveDelta)
      mutable.xAxis = { ...valueAxis, position: config.xAxisPosition, name: config.showYAxisTitle ? config.yAxisTitle : '', nameRotate: 0, nameGap: valueLabelHeight + (config.showXTicks ? config.tickLength : 0) + 8 + config.yAxisTitleGap, axisLabel: { ...(valueAxis.axisLabel as object), formatter: (value: number) => ((config.xAxisStartLabel && Number.isFinite(physicalXMin) && value === physicalXMin) || (config.xAxisEndLabel && Number.isFinite(physicalXMax) && value === physicalXMax)) ? '' : formatXAxisNumber(value, config) } }
      mutable.yAxis = { ...categoryAxis, inverse: config.categoryAxisInverse ?? true, position: config.yAxisPosition, name: config.showXAxisTitle ? config.xAxisTitle : '', nameRotate: config.yAxisPosition === 'right' ? -90 : 90 }
      mutable.graphic = mutable.graphic.filter((item) => item.id !== 'chart-y-axis-title')
      mutable.series.forEach((series) => { if (series.markLine) series.markLine.data = [{ xAxis: 0 }] })
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
    ...base, id, label,
    settings: { ...base.settings, features: { ...base.settings.features, lineVariant: true } },
    buildOption(table, config) {
      if (id === 'confidence-line') {
        const groups = (config.intervalGroups?.length ? config.intervalGroups : autoGroups(config)).filter((group) => group.main && group.lower && group.upper)
        const scaleFields = [...new Set(groups.flatMap((group) => [group.main, group.lower, group.upper]))]
        if (!groups.length || scaleFields.length < 3) return base.buildOption(table, { ...config, yFields: config.yFields.slice(0, 1), yField: config.yFields[0] ?? config.yField })
        const option = base.buildOption(table, { ...config, yFields: scaleFields, yField: scaleFields[0] }) as { series: Array<Record<string, unknown>>; legend?: { data?: unknown[] } }
        const prepared = prepareVisibleChartData(table, { ...config, yFields: scaleFields, yField: scaleFields[0] })
        const seriesByName = new Map(prepared.series.map((series) => [series.name, series]))
        const visibleNames = new Set(groups.flatMap((group) => [group.main, ...(group.showBounds ? [group.lower, group.upper] : [])]))
        const kept = option.series.filter((series) => {
          const name = String(series.name ?? '')
          const owner = String(series.segmentOf ?? name).replace(/^__hit__:/, '')
          return visibleNames.has(owner)
        })
        groups.forEach((group, groupIndex) => {
          const main = seriesByName.get(group.main), lower = seriesByName.get(group.lower), upper = seriesByName.get(group.upper)
          if (!main || !lower || !upper) return
          const bandColor = getSeriesColor(config, main.name, Math.max(0, scaleFields.indexOf(main.name)))
          const stack = `__confidence-line-band-${groupIndex}`
          const bounds = upper.data.map((value, index) => {
            const low = lower.data[index]
            return value == null || low == null ? null : { base: Math.min(low, value), span: Math.abs(value - low) }
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
                color: bandColor,
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
      const visibleFields = config.yFields.slice(0, 2)
      const scopedConfig = { ...config, yFields: visibleFields, yField: visibleFields[0] ?? config.yField }
      const option = base.buildOption(table, scopedConfig) as { series: Array<Record<string, unknown>>; legend?: { data?: unknown[] }; xAxis?: unknown }
      const prepared = prepareVisibleChartData(table, { ...config, yFields: visibleFields, yField: visibleFields[0] ?? config.yField })
      const fields = prepared.series
      const lowerIndex = 0, upperIndex = 1
      const lower = fields[lowerIndex], upper = fields[upperIndex]
      if (!lower || !upper) return option
      const originalLabels = prepared.categories.map((category, index) => category instanceof Date ? category.toISOString() : `${index}:${String(category ?? '')}`)
      const lowerColor = getSeriesColor(config, lower.name, lowerIndex)
      const upperColor = getSeriesColor(config, upper.name, upperIndex)
      const bandData = prepared.categories.slice(0, -1).flatMap((_category, index) => {
        const firstLow = lower.data[index], firstHigh = upper.data[index], nextLow = lower.data[index + 1], nextHigh = upper.data[index + 1]
        if (firstLow == null || firstHigh == null || nextLow == null || nextHigh == null) return []
        const firstDelta = firstHigh - firstLow, nextDelta = nextHigh - nextLow
        const segment = (from: number, to: number, startLow: number, startHigh: number, endLow: number, endHigh: number, color: string) => ({
          value: [originalLabels[index], Math.min(startLow, startHigh), Math.max(startLow, startHigh), originalLabels[index + 1], Math.min(endLow, endHigh), Math.max(endLow, endHigh), from, to],
          itemStyle: { color, opacity: config.intervalFillOpacity ?? .18 },
        })
        if (id === 'step-range-line') {
          const useNext = (config.stepPosition ?? 'end') === 'start'
          const stepLow = useNext ? nextLow : firstLow, stepHigh = useNext ? nextHigh : firstHigh
          return [segment(0, 1, stepLow, stepHigh, stepLow, stepHigh, stepHigh >= stepLow ? upperColor : lowerColor)]
        }
        if (firstDelta * nextDelta < 0) {
          const ratio = Math.abs(firstDelta) / (Math.abs(firstDelta) + Math.abs(nextDelta))
          const crossing = firstLow + (nextLow - firstLow) * ratio
          return [
            segment(0, ratio, firstLow, firstHigh, crossing, crossing, firstDelta > 0 ? upperColor : lowerColor),
            segment(ratio, 1, crossing, crossing, nextLow, nextHigh, nextDelta > 0 ? upperColor : lowerColor),
          ]
        }
        return [segment(0, 1, firstLow, firstHigh, nextLow, nextHigh, (firstDelta || nextDelta) >= 0 ? upperColor : lowerColor)]
      })
      option.series = [{
        name: `__${id}-band`, type: 'custom', data: bandData, silent: true, tooltip: { show: false }, z: 0,
        renderItem: (_params: unknown, api: { value(index: number): unknown; coord(value: unknown[]): number[]; style(): Record<string, unknown> }) => {
          const left = api.coord([api.value(0), api.value(1)]), right = api.coord([api.value(3), api.value(4)])
          const startX = left[0] + (right[0] - left[0]) * Number(api.value(6))
          const endX = left[0] + (right[0] - left[0]) * Number(api.value(7))
          const topLeft = [startX, api.coord([api.value(0), api.value(2)])[1]]
          const topRight = [endX, api.coord([api.value(3), api.value(5)])[1]]
          const bottomRight = [endX, right[1]]
          const bottomLeft = [startX, left[1]]
          return { type: 'polygon', shape: { points: [topLeft, topRight, bottomRight, bottomLeft] }, style: api.style() }
        },
      }, ...option.series]
      return option
    },
  }
}

const scatter: ChartPlugin = {
  id: 'scatter',
  label: 'Точечный',
  category: 'relationship',
  settings: {
    sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
    series: ['color', 'markers'],
    features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: true, lineVariant: false },
  },
  buildOption(table, config) {
    const xAxisTitleText = config.xAxisTitleText ?? config.axisTitleText
    const xAxisLabelText = config.xAxisLabelText ?? config.axisLabelText
    const yFields = config.yFields.length ? config.yFields : [config.yField]
    const dateAxis = table.rows.some((row) => row[config.xField] instanceof Date)
    const xValues = table.rows.flatMap((row) => {
      const value = row[config.xField]
      return typeof value === 'number' && Number.isFinite(value) ? [value] : value instanceof Date && !Number.isNaN(value.getTime()) ? [value.getTime()] : []
    })
    const xScale = niceNumericScale(xValues)
    const [manualMin, manualMax] = orderedBounds(dateAxis ? dateValue(config.xAxisMin) : axisValue(config.xAxisMin), dateAxis ? dateValue(config.xAxisMax) : axisValue(config.xAxisMax))
    const effectiveXMin = manualMin ?? (dateAxis ? undefined : xScale.min), effectiveXMax = manualMax ?? (dateAxis ? undefined : xScale.max)
    const axisLineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
    const validRows = table.rows.filter((row) => {
      const x = row[config.xField]
      return (typeof x === 'number' && Number.isFinite(x)) || (x instanceof Date && !Number.isNaN(x.getTime()))
    })
    const bubbleMode = config.kind === 'bubble'
    const sizeValues = bubbleMode && config.scatterSizeField ? validRows.flatMap((row) => typeof row[config.scatterSizeField!] === 'number' && Number.isFinite(row[config.scatterSizeField!] as number) ? [row[config.scatterSizeField!] as number] : []) : []
    const sizeMinValue = sizeValues.length ? Math.min(...sizeValues) : 0, sizeMaxValue = sizeValues.length ? Math.max(...sizeValues) : 1
    const bubbleSize = (value: unknown) => {
      if (!bubbleMode || !config.scatterSizeField || typeof value !== 'number' || !Number.isFinite(value)) return config.scatterPointSize ?? 10
      const ratio = sizeMaxValue === sizeMinValue ? .5 : Math.max(0, Math.min(1, (value - sizeMinValue) / (sizeMaxValue - sizeMinValue)))
      return (config.scatterSizeMin ?? 6) + Math.sqrt(ratio) * ((config.scatterSizeMax ?? 42) - (config.scatterSizeMin ?? 6))
    }
    const groupValues = config.scatterColorField ? [...new Set(validRows.map((row) => String(row[config.scatterColorField!] ?? 'Без категории')))] : ['']
    let colorIndex = 0
    const defaultLabelField = config.scatterLabelField || table.columns.find((column) =>
      column !== config.xField &&
      !yFields.includes(column) &&
      column !== config.scatterSizeField &&
      column !== config.scatterColorField &&
      validRows.some((row) => typeof row[column] === 'string' && String(row[column]).trim())
    )
    const dataSeries = yFields.flatMap((field) => groupValues.map((group) => {
      const baseName = field
      const seriesName = config.scatterColorField ? (yFields.length === 1 ? group : `${field} · ${group}`) : baseName
      const seriesColor = getSeriesColor(config, seriesName, colorIndex++)
      const seriesStyle = config.seriesStyles[seriesName]
      return {
        name: seriesName,
        type: 'scatter',
        triggerEvent: true,
        symbol: seriesStyle?.markerShape ?? 'circle',
        symbolSize: (_value: unknown, params: { data?: { bubbleSize?: number } }) => params.data?.bubbleSize ?? seriesStyle?.markerSize ?? config.scatterPointSize ?? 10,
        itemStyle: { color: config.scatterHollow ? 'transparent' : seriesStyle?.markerFill ?? seriesColor, borderColor: seriesStyle?.markerBorder ?? seriesStyle?.color ?? seriesColor, borderWidth: seriesStyle?.markerBorderWidth ?? config.scatterBorderWidth ?? 1, opacity: seriesStyle?.fillOpacity ?? config.scatterOpacity ?? .78 },
        labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
        emphasis: { focus: 'series', scale: 1.12 },
        label: { show: config.scatterShowLabels ?? config.showValues, position: config.scatterLabelPosition ?? 'right', distance: 5, ...text(config.valueText), formatter: (params: { data?: { displayLabel?: string } }) => params.data?.displayLabel ?? '' },
        data: validRows.flatMap((row) => {
          if (typeof row[field] !== 'number' || !Number.isFinite(row[field] as number)) return []
          if (config.scatterColorField && String(row[config.scatterColorField] ?? 'Без категории') !== group) return []
          const category = row[config.xField], x = category instanceof Date ? category.getTime() : category
          const base = pointData(config, seriesName, category, row[field] as number)
          const override = config.elementStyles[base.elementKey]
          const displayLabel = override?.label || (defaultLabelField ? String(row[defaultLabelField] ?? '') : formatChartNumber(row[field] as number, config))
          return [{ ...base, value: [x, row[field]], sourceSeriesName: seriesName, displayLabel, symbol: override?.markerShape, bubbleSize: override?.markerSize ?? (bubbleMode ? bubbleSize(config.scatterSizeField ? row[config.scatterSizeField] : undefined) : seriesStyle?.markerSize ?? config.scatterPointSize ?? 10), itemStyle: override ? { color: config.scatterHollow ? 'transparent' : override.markerFill ?? override.color ?? seriesStyle?.markerFill ?? seriesColor, borderColor: override.markerBorder ?? override.color ?? seriesStyle?.markerBorder ?? seriesColor, borderWidth: override.markerBorderWidth ?? config.scatterBorderWidth ?? 1, opacity: override.fillOpacity ?? seriesStyle?.fillOpacity ?? config.scatterOpacity ?? .78 } : undefined, label: override ? { show: override.showLabel ?? config.scatterShowLabels, formatter: displayLabel, position: config.scatterLabelPosition ?? 'right', ...text(override.valueText ?? config.valueText) } : undefined }]
        }),
      }
    }))
    const trendFor = (name: string, points: Array<[number, number]>, seriesIndex: number) => {
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
      const color = style?.scatterTrendColor ?? style?.color ?? getSeriesColor(config, name, seriesIndex)
      const stack = `__trend-band:${name}`
      const series: Array<Record<string, unknown>> = []
      if (style?.scatterTrendBand ?? config.scatterTrendBand) series.push(
        { name: `${stack}:base`, type: 'line', data: samples.map(({ x, lower }) => [x, lower]), stack, symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, z: 0 },
        { name: `${stack}:fill`, type: 'line', data: samples.map(({ x, range }) => [x, range]), stack, symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { opacity: 0 }, areaStyle: { color, opacity: style?.scatterTrendBandOpacity ?? config.scatterTrendBandOpacity ?? .12 }, z: 0 },
      )
      series.push({ name: `Тренд: ${name}`, type: 'line', data: samples.map(({ x, predicted }) => [x, predicted]), symbol: 'none', silent: true, tooltip: { show: false }, lineStyle: { color, width: style?.scatterTrendWidth ?? config.scatterTrendWidth ?? 2, type: style?.scatterTrendType ?? config.scatterTrendType ?? 'dashed' }, z: 2 })
      return series
    }
    const trendSeries = dataSeries.flatMap((series, index) => trendFor(series.name, series.data.flatMap((point) => {
      const value = point.value as unknown[]
      const x = Number(value[0]), y = Number(value[1])
      return Number.isFinite(x) && Number.isFinite(y) ? [[x, y] as [number, number]] : []
    }), index))
    const layoutConfig = config.axisTitleMode === 'editorial' ? { ...config, showXAxisTitle: false, showYAxisTitle: false } : config
    const baseOption = commonOption(table, layoutConfig) as { yAxis?: { min?: number; max?: number }; [key: string]: unknown }
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
      legend.data = dataSeries.map((series) => ({ name: series.name, icon: 'circle', itemStyle: { color: (series.itemStyle as { borderColor: string }).borderColor } }))
      legend.itemWidth = 10
    }
    if (config.axisTitleMode === 'editorial') {
      const graphic = Array.isArray(baseOption.graphic) ? baseOption.graphic as Array<Record<string, unknown>> : []
      const grid = baseOption.grid as { left?: number; right?: number; top?: number; bottom?: number } | undefined
      const plotLeft = Number(grid?.left ?? 80), plotTop = Number(grid?.top ?? 100)
      const plotRight = (config.canvasWidth ?? 1000) - Number(grid?.right ?? 80)
      const plotBottom = (config.canvasHeight ?? 750) - Number(grid?.bottom ?? 90)
      const titleWidth = Math.max(120, Math.min(320, plotRight - plotLeft))
      baseOption.graphic = [
        ...graphic.filter((item) => item.id !== 'chart-y-axis-title'),
        config.showYAxisTitle && config.yAxisTitle && { id: 'scatter-y-editorial-title', type: 'text', left: plotLeft + 2, top: plotTop + 6, silent: true, style: { text: `↑ ${config.yAxisTitle}`, ...graphicText(config.yAxisTitleText ?? config.axisTitleText), align: 'left', verticalAlign: 'top', width: titleWidth, overflow: 'break' } },
        config.showXAxisTitle && config.xAxisTitle && { id: 'scatter-x-editorial-title', type: 'text', left: Math.max(plotLeft, plotRight - titleWidth), top: plotBottom - Math.round((config.xAxisTitleText ?? config.axisTitleText).size * 1.15), silent: true, style: { text: `→ ${config.xAxisTitle}`, ...graphicText(config.xAxisTitleText ?? config.axisTitleText), align: 'right', verticalAlign: 'bottom', width: titleWidth, overflow: 'break' } },
      ].filter(Boolean)
    }
    if (bubbleMode && config.scatterSizeField && config.scatterSizeLegend !== false && sizeValues.length) {
      const graphic = Array.isArray(baseOption.graphic) ? baseOption.graphic as Array<Record<string, unknown>> : []
      const grid = baseOption.grid as { left?: number; right?: number; top?: number; bottom?: number } | undefined
      const plotLeft = Number(grid?.left ?? 80), plotTop = Number(grid?.top ?? 100)
      const plotRight = (config.canvasWidth ?? 1000) - Number(grid?.right ?? 80)
      const plotBottom = (config.canvasHeight ?? 750) - Number(grid?.bottom ?? 90)
      const large = niceLegendValue(sizeMaxValue)
      const small = Math.max(sizeMinValue, niceLegendValue(large / 10))
      const legendValues = large === small ? [large] : [large, small]
      const radii = legendValues.map((value) => bubbleSize(value) / 2)
      const maxRadius = Math.max(...radii), baseline = maxRadius * 2 + 30
      const boxWidth = Math.round(maxRadius * 2 + 138), boxHeight = Math.round(baseline + 14)
      const position = config.scatterSizeLegendPosition ?? 'top-left'
      const pad = 30
      const unclampedX = position.endsWith('right') ? plotRight - boxWidth - pad : plotLeft + pad
      const yOffset = config.axisTitleMode === 'editorial' && position === 'top-left' ? 38 : 0
      const unclampedY = position.startsWith('bottom') ? plotBottom - boxHeight - pad : plotTop + pad + yOffset
      const x = Math.max(plotLeft + 8, Math.min(plotRight - boxWidth - 8, unclampedX))
      const y = Math.max(plotTop + 8, Math.min(plotBottom - boxHeight - 8, unclampedY))
      graphic.push({ id: 'bubble-size-legend', type: 'group', x, y, silent: true, children: [
        { type: 'rect', shape: { x: -6, y: -6, width: boxWidth + 12, height: boxHeight + 12, r: 3 }, style: { fill: config.canvasBackground ?? '#ffffff', opacity: .82 } },
        { type: 'text', x: 0, y: 0, style: { text: config.scatterSizeLegendTitle || config.scatterSizeField, ...graphicText(config.legendText), fontWeight: 600 } },
        ...legendValues.flatMap((value, index) => {
          const radius = radii[index], cy = baseline - radius
          return [
            { type: 'circle', shape: { cx: maxRadius, cy, r: radius }, style: { fill: 'transparent', stroke: config.legendText.color, lineWidth: 1 } },
            { type: 'line', shape: { x1: maxRadius + radius, y1: cy, x2: maxRadius * 2 + 14, y2: cy }, style: { stroke: config.legendText.color, opacity: .55, lineWidth: 1, lineDash: [3, 3] } },
            { type: 'text', x: maxRadius * 2 + 20, y: cy, style: { text: formatChartNumber(value, config), ...graphicText(config.legendText), fontWeight: 600, align: 'left', verticalAlign: 'middle' } },
          ]
        }),
      ] })
      baseOption.graphic = graphic
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
      tooltip: { trigger: 'item', formatter: (params: unknown) => { const item = params as { seriesName?: string; value?: unknown; marker?: string }; const values = Array.isArray(item.value) ? item.value : [item.value]; return `${item.marker ?? ''}${escapeHtml(item.seriesName ?? '')}<br/><b>${values.map((value, index) => escapeHtml(index === 0 ? dateAxis ? formatTimeValue(new Date(Number(value)), table.timeProfiles?.[config.xField], config.dateLabelFormat) : formatXAxisNumber(value, config) : formatChartNumber(value, config))).join(' · ')}</b>` } },
      xAxis: {
        type: dateAxis ? 'time' : 'value', min: effectiveXMin, max: effectiveXMax,
        interval: dateAxis ? undefined : config.xAxisStep ?? xScale.step,
        position: config.xAxisPosition, name: config.showXAxisTitle && config.axisTitleMode !== 'editorial' ? config.xAxisTitle : '', nameLocation: 'middle',
        nameTextStyle: { ...text(xAxisTitleText), align: config.axisTitleMode === 'editorial' ? 'right' : config.xAxisTitleText?.align },
        nameGap: Math.round(xAxisLabelText.size * xAxisLabelText.lineHeight / 100) + 8 + (config.showXTicks ? config.tickLength : 0) + config.xAxisTitleGap,
        triggerEvent: true,
        axisLabel: { ...text(xAxisLabelText), inside: false, hideOverlap: true, rotate: config.xAxisLabelRotate ?? 0, formatter: dateAxis ? (value: number) => formatTimeValue(new Date(value), table.timeProfiles?.[config.xField], config.dateLabelFormat) : (value: number) => { if ((config.xAxisStartLabel && effectiveXMin != null && Math.abs(value - effectiveXMin) <= Math.max(1, Math.abs(effectiveXMin)) * 1e-9) || (config.xAxisEndLabel && effectiveXMax != null && Math.abs(value - effectiveXMax) <= Math.max(1, Math.abs(effectiveXMax)) * 1e-9)) return ''; return formatXAxisNumber(value, config) } },
        axisLine: { show: config.showXAxisLine, onZero: false, lineStyle: axisLineStyle },
        axisTick: { show: config.showXTicks, inside: false, alignWithLabel: true, length: config.tickLength, lineStyle: axisLineStyle },
        splitLine: { show: config.showVerticalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
      },
      series: [...trendSeries.filter((series) => String(series.name ?? '').startsWith('__trend-band:')), ...dataSeries, ...trendSeries.filter((series) => !String(series.name ?? '').startsWith('__trend-band:'))],
    }
  },
}

const bubble: ChartPlugin = { ...scatter, id: 'bubble', label: 'Пузырьковая диаграмма' }

export const chartRegistry = [
  cartesian('bar', 'Столбцы', 'comparison'),
  cartesian('stacked-bar', 'Столбцы с накоплением', 'comparison'),
  cartesian('normalized-stacked-bar', 'Нормированные столбцы', 'comparison'),
  cartesian('horizontal-bar', 'Линейчатая', 'bar-horizontal'),
  cartesian('horizontal-stacked-bar', 'Линейчатая с накоплением', 'bar-horizontal'),
  cartesian('horizontal-normalized-stacked-bar', 'Нормированная линейчатая', 'bar-horizontal'),
  cartesian('line', 'Линия', 'trend'),
  cartesian('spline', 'Сглаженная линия', 'trend'),
  cartesian('step-line', 'Ступенчатая линия', 'trend'),
  intervalLine('range-line', 'Диапазон между линиями'),
  intervalLine('step-range-line', 'Ступенчатый диапазон'),
  intervalLine('confidence-line', 'Линия с интервалом'),
  cartesian('area', 'Область', 'area'),
  cartesian('stacked-area', 'Области с накоплением', 'area'),
  cartesian('normalized-stacked-area', 'Нормированные области', 'area'),
  scatter,
  bubble,
]

export function getChartPlugin(id: ChartConfig['kind']) {
  return chartRegistry.find((plugin) => plugin.id === id) ?? chartRegistry[0]
}
