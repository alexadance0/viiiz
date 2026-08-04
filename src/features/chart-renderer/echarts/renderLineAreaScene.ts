import { axisAffixApplies, formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { ChartTextStyle } from '../../../core/types'
import type { AreaSeriesScene, CartesianAreaPlotScene, CartesianLinePlotScene, LineSeriesScene, NativeChartScene, ResolvedSceneGeometry, SmoothingLayerScene } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import type { Rect } from '../../chart-layout/geometry'
import type { CategoricalLegendItem } from '../../chart-layout/guides/types'

type PointPlot = CartesianLinePlotScene | CartesianAreaPlotScene
export type ResolvedPointScene = NativeChartScene & { plot: PointPlot; geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
export type ResolvedCartesianPointRenderModel = Omit<ResolvedPointScene, 'plot'> & {
  plot: {
    mode: 'line' | 'area'
    stacking: 'none' | 'stacked' | 'normalized'
    categoryPlacement: PointPlot['categoryPlacement']
    categories: PointPlot['categories']
    categoryLabelPlan: PointPlot['categoryLabelPlan']
    categoryAxis: PointPlot['categoryAxis']
    valueAxis: PointPlot['valueAxis']
    valueDomain: PointPlot['valueDomain']
    series: Array<LineSeriesScene | AreaSeriesScene | SmoothingLayerScene>
  }
}
const textStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
const graphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = textStyle(style); return { ...rest, fill: color } }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const stacking = (plot: ResolvedCartesianPointRenderModel['plot']) => plot.stacking
const interpolationOption = (value: PointPlot['series'][number]['interpolation']) => ({ smooth: value === 'spline' ? .45 : false, smoothMonotone: value === 'spline' ? 'x' : undefined, step: value === 'step-start' ? 'start' : value === 'step-end' ? 'end' : undefined })

function legendGroupGraphics(items: CategoricalLegendItem[], rail: Rect | undefined, config: ResolvedCartesianPointRenderModel['compatibilityConfig']) {
  if (!rail) return []
  const visible = items.filter((item) => item.visible)
  const horizontal = config.legendPosition === 'top' || config.legendPosition === 'bottom'
  const marker = config.legendMarker ?? 'auto', markerWidth = 24, gap = 18
  const lineHeight = Math.round(config.legendText.size * config.legendText.lineHeight / 100)
  let x = rail.x, y = rail.y
  return visible.flatMap((item) => {
    const width = markerWidth + 10 + measureTextWidth(item.label, config.legendText.size, config.legendText.fontFamily, config.legendText.weight)
    if (horizontal && x > rail.x && x + width > rail.x + rail.width) { x = rail.x; y += lineHeight + 7 }
    const currentX = x, currentY = y
    if (horizontal) x += width + gap
    else y += lineHeight + gap
    if (item.target.kind !== 'group') return []
    const center = lineHeight / 2
    const markerGraphic = marker === 'circle'
      ? { type: 'circle', shape: { cx: markerWidth / 2, cy: center, r: 5 }, style: { fill: item.color } }
      : marker === 'diamond'
      ? { type: 'polygon', shape: { points: [[markerWidth / 2, center - 6], [markerWidth / 2 + 6, center], [markerWidth / 2, center + 6], [markerWidth / 2 - 6, center]] }, style: { fill: item.color } }
      : marker === 'triangle'
      ? { type: 'polygon', shape: { points: [[markerWidth / 2, center - 6], [markerWidth / 2 + 7, center + 6], [markerWidth / 2 - 7, center + 6]] }, style: { fill: item.color } }
      : marker === 'square'
      ? { type: 'rect', shape: { x: markerWidth / 2 - 5, y: center - 5, width: 10, height: 10 }, style: { fill: item.color } }
      : { type: 'line', shape: { x1: 0, y1: center, x2: markerWidth, y2: center }, style: { stroke: item.color, lineWidth: 3 } }
    return [{ id: `categorical-legend:${item.id}`, type: 'group', x: currentX, y: currentY, silent: true, children: [markerGraphic, { type: 'text', x: markerWidth + 10, y: center, style: { text: item.label, ...graphicTextStyle(config.legendText), align: 'left', verticalAlign: 'middle' } }] }]
  })
}

function categoryAxis(scene: ResolvedCartesianPointRenderModel) {
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

function valueAxis(scene: ResolvedCartesianPointRenderModel) {
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

const usesYAxisEdgeOverlay = (config: ResolvedCartesianPointRenderModel['compatibilityConfig']) => (config.showYAxisLabels ?? true) && config.yAxisAffixScope != null && config.yAxisAffixScope !== 'all' && Boolean(config.numberPrefix || config.numberSuffix)
const usesXAxisEdgeOverlay = (config: ResolvedCartesianPointRenderModel['compatibilityConfig']) => (config.showXAxisLabels ?? true) && config.xAxisAffixScope != null && config.xAxisAffixScope !== 'all' && Boolean(config.xAxisNumberPrefix || config.xAxisNumberSuffix)

function axisAffixSeries(scene: ResolvedCartesianPointRenderModel) {
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

function segmentSeries(scene: ResolvedCartesianPointRenderModel) {
  if (scene.plot.mode !== 'line') return []
  return scene.plot.series.flatMap((series) => !('segments' in series) ? [] : series.segments.map((segment) => ({
    id: segment.id, name: series.name, segmentOf: series.name, type: 'line', symbol: 'none', silent: true, animation: false, tooltip: { show: false }, z: 40,
    ...interpolationOption(series.interpolation), lineStyle: segment.stroke,
    data: [series.points[segment.fromIndex], series.points[segment.toIndex]].map((point) => [scene.plot.categories[point.categoryIndex]?.coordinate, point.value]).concat([null]),
  })))
}

export function renderCartesianPointBase(scene: ResolvedCartesianPointRenderModel): Record<string, unknown> {
  const config = scene.compatibilityConfig
  const legendGuide = scene.guides.find((guide) => guide.kind === 'categorical-legend')
  const directGuide = scene.guides.find((guide) => guide.kind === 'direct-series')
  const directItems = new Map(directGuide?.items.map((item) => [item.seriesId, item]) ?? [])
  const seriesNames = new Map(scene.plot.series.map((item) => [item.id, item.name]))
  const legendItems = legendGuide?.items.flatMap((item) => {
    if (!item.visible || item.target.kind === 'group') return []
    const targetId = item.target.kind === 'series' ? item.target.seriesId : item.target.layerId
    return [{ ...item, rendererName: seriesNames.get(targetId) ?? targetId }]
  }) ?? []
  const legendLabels = new Map(legendItems.map((item) => [item.rendererName, item.label]))
  const legendRail = scene.geometry.reservations['guide:legend']
  const directLeft = directGuide?.side === 'left'
  const series = scene.plot.series.map((item, seriesIndex) => {
    const firstIndex = item.points.findIndex((point) => point.value != null)
    const direct = directItems.get(item.id)
    const showDirect = directGuide?.visible && direct?.visible
    const directText = direct?.note ? `{name|${direct.label}}\n{note|${direct.note}}` : `{name|${direct?.label ?? item.name}}`
    const directStyle = direct?.style ?? config.directLabelText ?? config.legendText
    const directLabel = { show: true, distance: config.directLabelGap ?? 14, formatter: directText, width: Math.max(80, scene.geometry.reservations['guide:direct-series']?.width ?? 120), overflow: 'break', ...textStyle(directStyle), rich: { name: textStyle(directStyle), note: { ...textStyle(directStyle), fontSize: Math.max(8, directStyle.size - 2), opacity: .75 } } }
    const defaultZ = 30 + (scene.plot.series.length - seriesIndex) * 10
    const z = item.presentation?.emphasis === 'accent' ? 1000 + (item.presentation.layerPriority ?? seriesIndex) : defaultZ + (item.presentation?.layerPriority ?? 0)
    return {
      id: item.id, name: item.name, type: 'line', stack: scene.plot.mode === 'area' && scene.plot.stacking !== 'none' ? 'total' : undefined, triggerEvent: true, clip: true, z,
      ...interpolationOption(item.interpolation), showSymbol: true, symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: item.missing === 'connect',
      lineStyle: { ...item.stroke, opacity: item.presentation?.opacity ?? item.stroke.opacity }, itemStyle: { color: item.marker.fill, borderColor: item.marker.stroke, borderWidth: item.marker.strokeWidth },
      areaStyle: scene.plot.mode === 'area' && 'fill' in scene.plot.series[seriesIndex] ? scene.plot.series[seriesIndex].fill : undefined, emphasis: { scale: false },
      label: { show: config.showValues, position: config.valueLabelPosition === 'auto' || config.valueLabelPosition == null ? 'top' : config.valueLabelPosition, formatter: (params: { dataIndex?: number }) => params.dataIndex == null ? '' : item.points[params.dataIndex]?.label.text ?? '', ...textStyle(config.valueText) },
      markLine: seriesIndex === 0 && config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: config.zeroLineColor, width: config.zeroLineWidth, type: config.zeroLineType }, label: { show: false } } : undefined,
      endLabel: showDirect && !directLeft ? directLabel : undefined,
      labelLine: showDirect ? { show: direct?.leaderLine ?? false, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color: direct?.color ?? item.color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } : undefined,
      labelLayout: showDirect ? { align: directLeft ? 'right' : 'left', moveOverlap: 'shiftY', hideOverlap: false } : { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: 'shiftY' },
      data: item.points.map((point, index) => {
        const pointLabel = { show: point.label.visible, formatter: point.label.text, position: point.label.position === 'auto' ? 'top' : point.label.position, ...textStyle(point.label.style) }
        const directPoint = showDirect && directLeft && index === firstIndex
        return {
          value: point.value, name: scene.plot.categories[index]?.coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory, displayColor: item.color,
          symbol: point.marker.shape, symbolSize: point.marker.visible ? point.marker.size : 0, itemStyle: { color: point.marker.fill, borderColor: point.marker.stroke, borderWidth: point.marker.strokeWidth }, label: directPoint ? { ...directLabel, position: 'left', align: 'right' } : pointLabel, emphasis: { label: pointLabel }, directLegendLabel: directPoint,
        }
      }),
    }
  })
  const hits = scene.plot.series.map((item) => ({ name: `__hit__:${item.name}`, type: 'line', triggerEvent: true, ...interpolationOption(item.interpolation), symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: item.missing === 'connect', lineStyle: { color: 'rgba(0,0,0,0)', width: 14, opacity: 0 }, itemStyle: { opacity: 0 }, tooltip: { show: false }, silent: false, z: 100, data: item.points.map((point) => ({ value: point.value, name: scene.plot.categories[point.categoryIndex]?.coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory })) }))
  const plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const title = scene.frameElements.find((item) => item.role === 'title'), subtitle = scene.frameElements.find((item) => item.role === 'subtitle')
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'break', ...graphicTextStyle(item.style) } }))
  const verticalTitle = scene.plot.valueAxis.title?.visible && scene.plot.valueAxis.title.text ? [{ id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? scene.geometry.content.x : undefined, right: config.yAxisPosition === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: scene.plot.valueAxis.title.text, ...graphicTextStyle(scene.plot.valueAxis.title.style), align: 'center', verticalAlign: 'middle' } }] : []
  const legendGroups = legendGuide ? legendGroupGraphics(legendGuide.items, legendRail, config) : []
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: title?.text ?? '', subtext: subtitle?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: title ? textStyle(title.style) : undefined, subtextStyle: subtitle ? textStyle(subtitle.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'axis', formatter: (input: unknown) => { const items = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number; seriesName?: string; value?: unknown; data?: { displayValue?: string; displayCategory?: string } }>; const visible = items.filter((entry) => entry.seriesName && !entry.seriesName.startsWith('__')); const index = visible[0]?.dataIndex ?? 0; return [`<b>${escapeHtml(visible[0]?.data?.displayCategory ?? scene.plot.series[0]?.points[index]?.displayCategory ?? '')}</b>`, ...visible.map((entry) => `${escapeHtml(entry.seriesName)}: <b>${escapeHtml(entry.data?.displayValue ?? formatYAxisNumber(entry.value as number, config))}</b>`)].join('<br/>') } },
    legend: { show: Boolean(legendGuide?.visible && legendItems.length), data: legendItems.map((item) => ({ name: item.rendererName, icon: item.marker?.kind === 'point' ? 'circle' : config.legendMarker === 'circle' ? 'circle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'triangle' ? 'triangle' : config.legendMarker === 'square' ? 'rect' : 'path://M0 4H24V7H0Z', itemStyle: { color: item.color, opacity: item.marker?.opacity ?? 1, borderWidth: 0 } })), formatter: (name: string) => legendLabels.get(name) ?? name, orient: legendGuide?.kind === 'categorical-legend' && (legendGuide.position === 'left' || legendGuide.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, right: legendGuide?.kind === 'categorical-legend' && legendGuide.position === 'right' ? canvas.width - (legendRail?.x ?? 0) - (legendRail?.width ?? 0) : undefined, itemWidth: 24, itemHeight: 10, itemGap: 18, textStyle: textStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false },
    xAxis: categoryAxis(scene), yAxis: valueAxis(scene), series: [...series, ...segmentSeries(scene), ...hits, ...axisAffixSeries(scene)], graphic: [...verticalTitle, ...legendGroups, ...footer],
  }
}

export function renderNativePointScene(scene: ResolvedPointScene): Record<string, unknown> {
  return renderCartesianPointBase({
    ...scene,
    plot: {
      ...scene.plot,
      mode: scene.plot.kind,
      stacking: scene.plot.kind === 'area' ? scene.plot.stacking : 'none',
    },
  })
}
