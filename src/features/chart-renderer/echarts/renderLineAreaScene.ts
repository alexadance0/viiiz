import { axisAffixApplies, formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { ChartTextStyle } from '../../../core/types'
import type { CartesianAreaPlotScene, CartesianLinePlotScene, NativeChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'

type PointPlot = CartesianLinePlotScene | CartesianAreaPlotScene
export type ResolvedPointScene = NativeChartScene & { plot: PointPlot; geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
const textStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
const graphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = textStyle(style); return { ...rest, fill: color } }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const stacking = (plot: PointPlot) => plot.kind === 'area' ? plot.stacking : 'none'
const interpolationOption = (value: PointPlot['series'][number]['interpolation']) => ({ smooth: value === 'spline' ? .45 : false, smoothMonotone: value === 'spline' ? 'x' : undefined, step: value === 'step-start' ? 'start' : value === 'step-end' ? 'end' : undefined })

function categoryAxis(scene: ResolvedPointScene) {
  const config = scene.compatibilityConfig, axis = scene.plot.categoryAxis
  const side = axis.placement.kind === 'side' ? axis.placement.side : undefined
  const lineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const interval = scene.plot.categoryLabelPlan.interval
  const nameGap = (axis.ticks.visible ? axis.ticks.length : 0) + (axis.labels.visible ? axis.labels.gap + axis.labels.size : 0) + (axis.title?.gap ?? 0)
  const slot = scene.geometry.plot.width / Math.max(1, scene.plot.categories.length - 1)
  return {
    type: 'category', boundaryGap: false, position: side, data: scene.plot.categories.map((category) => category.coordinate), triggerEvent: true,
    name: axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, alignWithLabel: true, interval, length: axis.ticks.length, lineStyle },
    axisLabel: { show: axis.labels.visible, inside: false, margin: axis.labels.gap, rotate: scene.plot.categoryLabelPlan.rotation, interval, hideOverlap: scene.plot.categoryLabelPlan.hideOverlap, showMinLabel: true, showMaxLabel: scene.plot.categoryLabelPlan.showMaxLabel, width: config.xAxisLabelOverflow === 'wrap' ? Math.max(20, slot - 8) : undefined, overflow: config.xAxisLabelOverflow === 'wrap' ? 'break' : config.xAxisLabelOverflow === 'truncate' ? 'truncate' : undefined, formatter: (_value: string, index: number) => { const numeric = scene.plot.categories.flatMap((category, categoryIndex) => typeof category.value === 'number' ? [categoryIndex] : []); const position = index === numeric[0] ? 'first' : index === numeric.at(-1) ? 'last' : 'middle'; return typeof scene.plot.categories[index]?.value === 'number' && usesXAxisEdgeOverlay(config) && axisAffixApplies(config.xAxisAffixScope, position) ? '' : scene.plot.categories[index]?.label ?? '' }, ...textStyle(axis.labels.style), align: 'center', fontSize: scene.plot.categoryLabelPlan.fontSize },
    splitLine: { show: config.showVerticalGrid, interval, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  }
}

function valueAxis(scene: ResolvedPointScene) {
  const config = scene.compatibilityConfig, axis = scene.plot.valueAxis
  const side = axis.placement.kind === 'side' ? axis.placement.side : undefined
  const lineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const nameGap = (axis.ticks.visible ? axis.ticks.length : 0) + (axis.labels.visible ? axis.labels.gap + axis.labels.size : 0) + (axis.title?.gap ?? 0)
  const normalized = stacking(scene.plot) === 'normalized'
  return {
    type: config.yAxisScaleType === 'log' ? 'log' : 'value', logBase: config.yAxisScaleType === 'log' ? 10 : undefined, position: side, min: scene.plot.valueDomain.min, max: scene.plot.valueDomain.max, interval: config.yAxisScaleType === 'log' ? undefined : scene.plot.valueDomain.step,
    name: '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined, triggerEvent: true,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, length: axis.ticks.length, lineStyle },
    axisLabel: { show: axis.labels.visible, inside: false, margin: axis.labels.gap, formatter: (value: number) => { const position = Math.abs(value - scene.plot.valueDomain.min) < 1e-9 ? 'first' : Math.abs(value - scene.plot.valueDomain.max) < 1e-9 ? 'last' : 'middle'; return usesYAxisEdgeOverlay(config) && axisAffixApplies(config.yAxisAffixScope, position) ? '' : formatYAxisNumber(value, config, position) }, ...textStyle(axis.labels.style), align: side === 'right' ? 'left' : 'right' },
    splitLine: { show: config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } }, normalized,
  }
}

const usesYAxisEdgeOverlay = (config: ResolvedPointScene['compatibilityConfig']) => (config.showYAxisLabels ?? true) && config.yAxisAffixScope != null && config.yAxisAffixScope !== 'all' && Boolean(config.numberPrefix || config.numberSuffix)
const usesXAxisEdgeOverlay = (config: ResolvedPointScene['compatibilityConfig']) => (config.showXAxisLabels ?? true) && config.xAxisAffixScope != null && config.xAxisAffixScope !== 'all' && Boolean(config.xAxisNumberPrefix || config.xAxisNumberSuffix)

function axisAffixSeries(scene: ResolvedPointScene) {
  const config = scene.compatibilityConfig
  const yStyle = config.yAxisLabelText ?? config.axisLabelText
  const yPositions = config.yAxisAffixScope === 'first' ? [['first', scene.plot.valueDomain.min] as const] : config.yAxisAffixScope === 'last' ? [['last', scene.plot.valueDomain.max] as const] : [['first', scene.plot.valueDomain.min] as const, ['last', scene.plot.valueDomain.max] as const]
  const ySeries = usesYAxisEdgeOverlay(config) ? [{
    name: '__y-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100,
    data: yPositions.map(([position, value]) => [0, value, position === 'first' ? 0 : 1]),
    renderItem: (params: { coordSys: { x: number; width: number } }, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => {
      const value = Number(api.value(1)), position = api.value(2) === 0 ? 'first' : 'last'
      const bare = formatYAxisNumber(value, { ...config, numberPrefix: '', numberSuffix: '', yAxisAffixScope: 'all' })
      const label = formatYAxisNumber(value, config, position)
      const prefix = config.numberPrefix && label.startsWith(config.numberPrefix) ? config.numberPrefix : ''
      const bareWidth = measureTextWidth(bare, yStyle.size, yStyle.fontFamily, yStyle.weight) + measureTextWidth(prefix, yStyle.size, yStyle.fontFamily, yStyle.weight)
      const left = config.yAxisPosition === 'left', edge = left ? params.coordSys.x - (config.yAxisLabelGap ?? 8) : params.coordSys.x + params.coordSys.width + (config.yAxisLabelGap ?? 8)
      return { type: 'text', style: { x: left ? edge - bareWidth : edge + bareWidth, y: api.coord([0, value])[1], text: label, ...graphicTextStyle(yStyle), align: left ? 'left' : 'right', verticalAlign: 'middle', backgroundColor: config.canvasBackground ?? '#ffffff', padding: left ? [1, 3, 1, 0] : [1, 0, 1, 3] } }
    },
  }] : []
  const numeric = scene.plot.categories.flatMap((category) => typeof category.value === 'number' ? [category] : [])
  const edges = numeric.length ? [{ category: numeric[0], position: 'first' as const }, { category: numeric.at(-1)!, position: 'last' as const }] : []
  const xStyle = config.xAxisLabelText ?? config.axisLabelText
  const xSeries = usesXAxisEdgeOverlay(config) && edges.length ? [{
    name: '__x-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100,
    data: edges.filter((edge) => axisAffixApplies(config.xAxisAffixScope, edge.position)).map((edge) => [edge.category.coordinate, scene.plot.valueDomain.min, edge.category.value, edge.position === 'first' ? 0 : 1]),
    renderItem: (params: { coordSys: { y: number; height: number } }, api: { value(index: number): unknown; coord(value: unknown[]): [number, number] }) => {
      const value = Number(api.value(2)), first = api.value(3) === 0, top = config.xAxisPosition === 'top'
      return { type: 'text', style: { x: api.coord([api.value(0), api.value(1)])[0], y: top ? params.coordSys.y - (config.xAxisLabelGap ?? 8) : params.coordSys.y + params.coordSys.height + (config.xAxisLabelGap ?? 8), text: formatXAxisNumber(value, config, first ? 'first' : 'last'), ...graphicTextStyle(xStyle), align: first ? 'left' : 'right', verticalAlign: top ? 'bottom' : 'top', backgroundColor: config.canvasBackground ?? '#ffffff', padding: top ? [0, 2, 2, 2] : [2, 2, 0, 2] } }
    },
  }] : []
  return [...ySeries, ...xSeries]
}

function segmentSeries(scene: ResolvedPointScene) {
  if (scene.plot.kind !== 'line') return []
  return scene.plot.series.flatMap((series) => series.segments.map((segment) => ({
    id: segment.id, name: series.name, segmentOf: series.name, type: 'line', symbol: 'none', silent: true, animation: false, tooltip: { show: false }, z: 40,
    ...interpolationOption(series.interpolation), lineStyle: segment.stroke,
    data: [series.points[segment.fromIndex], series.points[segment.toIndex]].map((point) => [scene.plot.categories[point.categoryIndex]?.coordinate, point.value]).concat([null]),
  })))
}

export function renderNativePointScene(scene: ResolvedPointScene): Record<string, unknown> {
  const config = scene.compatibilityConfig
  const legendGuide = scene.guides.find((guide) => guide.kind === 'categorical-legend')
  const legendRail = scene.geometry.reservations['guide:legend']
  const directLeft = config.yAxisPosition === 'right'
  const series = scene.plot.series.map((item, seriesIndex) => {
    const style = config.seriesStyles[item.name]
    const firstIndex = item.points.findIndex((point) => point.value != null)
    const showDirect = config.showDirectLabels && style?.showDirectLabel !== false
    const directText = style?.legendNote ? `{name|${style.legendLabel?.trim() || item.name}}\n{note|${style.legendNote}}` : `{name|${style?.legendLabel?.trim() || item.name}}`
    const directStyle = style?.directLabelText ?? config.directLabelText ?? config.legendText
    const directLabel = { show: true, distance: config.directLabelGap ?? 14, formatter: directText, width: Math.max(80, scene.geometry.reservations['guide:direct-series']?.width ?? 120), overflow: 'break', ...textStyle(directStyle), color: item.color, rich: { name: { ...textStyle(directStyle), color: style?.directLabelText?.color ?? item.color }, note: { ...textStyle(directStyle), color: style?.directLabelText?.color ?? item.color, fontSize: Math.max(8, directStyle.size - 2), opacity: .75 } } }
    return {
      id: item.id, name: item.name, type: 'line', stack: scene.plot.kind === 'area' && scene.plot.stacking !== 'none' ? 'total' : undefined, triggerEvent: true, clip: true, z: 30 + (scene.plot.series.length - seriesIndex) * 10,
      ...interpolationOption(item.interpolation), showSymbol: true, symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: item.missing === 'connect',
      lineStyle: item.stroke, itemStyle: { color: item.marker.fill, borderColor: item.marker.stroke, borderWidth: item.marker.strokeWidth },
      areaStyle: scene.plot.kind === 'area' ? scene.plot.series[seriesIndex].fill : undefined, emphasis: { scale: false },
      label: { show: config.showValues, position: config.valueLabelPosition === 'auto' || config.valueLabelPosition == null ? 'top' : config.valueLabelPosition, formatter: (params: { dataIndex?: number }) => params.dataIndex == null ? '' : item.points[params.dataIndex]?.label.text ?? '', ...textStyle(config.valueText) },
      markLine: seriesIndex === 0 && config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: config.zeroLineColor, width: config.zeroLineWidth, type: config.zeroLineType }, label: { show: false } } : undefined,
      endLabel: showDirect && !directLeft ? directLabel : undefined,
      labelLine: showDirect ? { show: style?.showLegendLine ?? config.showDirectLabelLines ?? false, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color: item.color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } : undefined,
      labelLayout: showDirect ? { align: directLeft ? 'right' : 'left', moveOverlap: 'shiftY', hideOverlap: false } : { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: 'shiftY' },
      data: item.points.map((point, index) => {
        const pointLabel = { show: point.label.visible, formatter: point.label.text, position: point.label.position === 'auto' ? 'top' : point.label.position, ...textStyle(point.label.style) }
        const direct = showDirect && directLeft && index === firstIndex
        return {
          value: point.value, name: scene.plot.categories[index]?.coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory, displayColor: item.color,
          symbol: point.marker.shape, symbolSize: point.marker.visible ? point.marker.size : 0, itemStyle: { color: point.marker.fill, borderColor: point.marker.stroke, borderWidth: point.marker.strokeWidth }, label: direct ? { ...directLabel, position: 'left', align: 'right' } : pointLabel, emphasis: { label: pointLabel }, directLegendLabel: direct,
        }
      }),
    }
  })
  const hits = scene.plot.series.map((item) => ({ name: `__hit__:${item.name}`, type: 'line', triggerEvent: true, ...interpolationOption(item.interpolation), symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: item.missing === 'connect', lineStyle: { color: 'rgba(0,0,0,0)', width: 14, opacity: 0 }, itemStyle: { opacity: 0 }, tooltip: { show: false }, silent: false, z: 100, data: item.points.map((point) => ({ value: point.value, name: scene.plot.categories[point.categoryIndex]?.coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory })) }))
  const plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const title = scene.frameElements.find((item) => item.role === 'title'), subtitle = scene.frameElements.find((item) => item.role === 'subtitle')
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'break', ...graphicTextStyle(item.style) } }))
  const verticalTitle = scene.plot.valueAxis.title?.visible && scene.plot.valueAxis.title.text ? [{ id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? scene.geometry.content.x : undefined, right: config.yAxisPosition === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: scene.plot.valueAxis.title.text, ...graphicTextStyle(scene.plot.valueAxis.title.style), align: 'center', verticalAlign: 'middle' } }] : []
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: title?.text ?? '', subtext: subtitle?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: title ? textStyle(title.style) : undefined, subtextStyle: subtitle ? textStyle(subtitle.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'axis', formatter: (input: unknown) => { const items = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number; seriesName?: string; value?: unknown; data?: { displayValue?: string; displayCategory?: string } }>; const visible = items.filter((entry) => entry.seriesName && !entry.seriesName.startsWith('__')); const index = visible[0]?.dataIndex ?? 0; return [`<b>${escapeHtml(visible[0]?.data?.displayCategory ?? scene.plot.series[0]?.points[index]?.displayCategory ?? '')}</b>`, ...visible.map((entry) => `${escapeHtml(entry.seriesName)}: <b>${escapeHtml(entry.data?.displayValue ?? formatYAxisNumber(entry.value as number, config))}</b>`)].join('<br/>') } },
    legend: { show: legendGuide?.visible ?? false, data: scene.plot.series.map((item) => ({ name: item.name, icon: config.legendMarker === 'circle' ? 'circle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'triangle' ? 'triangle' : config.legendMarker === 'square' ? 'rect' : 'path://M0 4H24V7H0Z', itemStyle: { color: item.color, borderWidth: 0 } })), orient: legendGuide?.kind === 'categorical-legend' && (legendGuide.position === 'left' || legendGuide.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, right: legendGuide?.kind === 'categorical-legend' && legendGuide.position === 'right' ? canvas.width - (legendRail?.x ?? 0) - (legendRail?.width ?? 0) : undefined, itemWidth: 24, itemHeight: 10, itemGap: 18, textStyle: textStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false },
    xAxis: categoryAxis(scene), yAxis: valueAxis(scene), series: [...series, ...segmentSeries(scene), ...hits, ...axisAffixSeries(scene)], graphic: [...verticalTitle, ...footer],
  }
}
