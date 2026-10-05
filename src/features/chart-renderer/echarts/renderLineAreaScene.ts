import { legendLabelText } from '../../chart-layout/legendLayout'
import { axisAffixApplies, formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { valueLabelAlignment } from '../../../core/chartLabels'
import { missingCalendarPeriod } from '../../../core/chartDateAxis'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import type { ChartTextStyle } from '../../../core/types'
import type { AreaSeriesScene, CartesianAreaPlotScene, CartesianLinePlotScene, LineSeriesScene, NativeChartScene, ResolvedSceneGeometry, SmoothingLayerScene } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import { rotatedSize, type Rect } from '../../chart-layout/geometry'
import type { CategoricalLegendItem } from '../../chart-layout/guides/types'
import { horizontalCategoryLabelPlacement, verticalAxisLabelPlacement, reservedAxisLabelGap } from '../../chart-layout/axisLabelPlacement'

type PointPlot = CartesianLinePlotScene | CartesianAreaPlotScene
export type ResolvedPointScene = NativeChartScene & { plot: PointPlot; geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
export type ResolvedCartesianPointRenderModel = Omit<ResolvedPointScene, 'plot'> & {
  plot: {
    mode: 'line' | 'area'
    stacking: 'none' | 'stacked' | 'normalized'
    categoryPlacement: PointPlot['categoryPlacement']
    categories: PointPlot['categories']
    categoryLabelPlan: PointPlot['categoryLabelPlan']
    dateAxis?: PointPlot['dateAxis']
    categoryAxis: PointPlot['categoryAxis']
    valueAxis: PointPlot['valueAxis']
    valueDomain: PointPlot['valueDomain']
    valueAxisInverse?: boolean
    series: Array<LineSeriesScene | AreaSeriesScene | SmoothingLayerScene>
  }
}
const textStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
const graphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = textStyle(style); return { ...rest, fill: color } }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const stacking = (plot: ResolvedCartesianPointRenderModel['plot']) => plot.stacking
const interpolationOption = (value: PointPlot['series'][number]['interpolation']) => ({ smooth: value === 'spline' ? .45 : false, smoothMonotone: value === 'spline' ? 'x' : undefined, step: value === 'step-start' ? 'start' : value === 'step-end' ? 'end' : undefined })
const categoryCoordinate = (scene: ResolvedCartesianPointRenderModel, index: number) => scene.plot.dateAxis ? Number(scene.plot.categories[index]?.value) : scene.plot.categories[index]?.coordinate
const pointValue = (scene: ResolvedCartesianPointRenderModel, index: number, value: number | null) => scene.plot.dateAxis ? [categoryCoordinate(scene, index), value] : value

function withCalendarGaps<T>(scene: ResolvedCartesianPointRenderModel, series: ResolvedCartesianPointRenderModel['plot']['series'][number], data: T[]) {
  if (series.missing !== 'gap' || !scene.plot.dateAxis) return data
  return data.flatMap((datum, index): Array<T | { value: [number, null] }> => {
    const gap = index ? missingCalendarPeriod(scene.plot.categories[index - 1]?.value, scene.plot.categories[index]?.value, scene.plot.dateAxis?.frequency) : null
    return gap ? [{ value: [+gap, null] }, datum] : [datum]
  })
}

function legendGroupGraphics(items: CategoricalLegendItem[], rail: Rect | undefined, config: ResolvedCartesianPointRenderModel['compatibilityConfig']) {
  if (!rail) return []
  const visible = items.filter((item) => item.visible)
  const horizontal = config.legendPosition === 'top' || config.legendPosition === 'bottom'
  const marker = config.legendMarker ?? 'auto', markerWidth = 24, gap = 18
  const lineHeight = Math.round(config.legendText.size * config.legendText.lineHeight / 100)
  let x = rail.x, y = rail.y
  return visible.flatMap((item) => {
    const label = legendLabelText(item.label, config.legendText, rail, config.legendPosition)
    const width = markerWidth + 10 + Math.max(...label.split('\n').map((line) => measureTextWidth(line, config.legendText.size, config.legendText.fontFamily, config.legendText.weight)))
    if (horizontal && x > rail.x && x + width > rail.x + rail.width) { x = rail.x; y += lineHeight + 7 }
    const currentX = x, currentY = y
    if (horizontal) x += width + gap
    else y += lineHeight * label.split('\n').length + gap
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
    return [{ id: `categorical-legend:${item.id}`, type: 'group', x: currentX, y: currentY, silent: true, children: [markerGraphic, { type: 'text', x: markerWidth + 10, y: center, style: { text: label, ...graphicTextStyle(config.legendText), align: 'left', verticalAlign: 'middle' } }] }]
  })
}

// Point categories at the edges may use the label rail, without moving the grid.
const usesEdgeCategoryLabels = (scene: ResolvedCartesianPointRenderModel) => scene.plot.categoryAxis.labels.visible && scene.compatibilityConfig.xAxisLabelOverflow !== 'truncate' && scene.plot.categories.every((category) => typeof category.value === 'string')
function edgeCategoryLabels(scene: ResolvedCartesianPointRenderModel) {
  if (!usesEdgeCategoryLabels(scene)) return []
  const { categories, categoryAxis: axis } = scene.plot
  const { plot, content } = scene.geometry
  const top = axis.placement.kind === 'side' && axis.placement.side === 'top'
  const indices = [...new Set([0, categories.length - 1])].filter((index) => index >= 0)
  const interval = scene.plot.categoryLabelPlan.interval
  return indices.flatMap((index) => {
    if (typeof interval === 'number' && index % (interval + 1) || typeof interval === 'function' && !interval(index)) return []
    const category = categories[index]
    const width = Math.max(...category.label.split('\n').map((line) => measureTextWidth(line, axis.labels.style.size, axis.labels.style.fontFamily, axis.labels.style.weight)))
    const rotation = scene.plot.categoryLabelPlan.rotation
    const height = category.label.split('\n').length * Math.round(axis.labels.style.size * axis.labels.style.lineHeight / 100)
    const bounds = rotatedSize({ width, height }, rotation)
    const center = categories.length === 1 ? plot.x + plot.width / 2 : index ? plot.x + plot.width : plot.x
    const x = Math.max(content.x + bounds.width / 2, Math.min(center, content.x + content.width - bounds.width / 2))
    const info = { elementKey: `category-label:x:${category.coordinate}`, sourceSeriesName: '', displayCategory: category.coordinate, displayValue: category.label, selectionTarget: 'category-label' as const, selectionMode: 'axis-label' as const, axis: 'x' as const }
    const y = top ? plot.y - axis.labels.gap - bounds.height / 2 : plot.y + plot.height + axis.labels.gap + bounds.height / 2
    const angle = rotation * Math.PI / 180
    return [{ rect: { x: x - bounds.width / 2, y: y - bounds.height / 2, width: bounds.width, height: bounds.height }, layout: { axis: 'x' as const, category: category.coordinate, left: x - height / 2 * Math.sin(angle) - width / 2, top: y - height / 2 * Math.cos(angle), width, size: axis.labels.style.size, rotation: -rotation, style: { ...axis.labels.style, align: 'center' as const } }, info, graphic: { id: `category-edge:${category.id}`, type: 'text', x, y, rotation: angle, z: 30, cursor: 'pointer', info, style: { text: category.label, ...graphicTextStyle(axis.labels.style), align: 'center', verticalAlign: 'middle' } } }]
  })
}

function categoryAxis(scene: ResolvedCartesianPointRenderModel) {
  const config = scene.compatibilityConfig, axis = scene.plot.categoryAxis
  const side = axis.placement.kind === 'side' ? axis.placement.side : undefined
  const lineStyle = { color: config.axisLineColor, width: config.axisLineWidth, type: config.axisLineType }
  const interval = scene.plot.categoryLabelPlan.interval
  const nameGap = (axis.ticks.visible ? axis.ticks.length : 0) + (axis.labels.visible ? axis.labels.gap + axis.labels.size : 0) + (axis.title?.gap ?? 0)
  const slot = scene.geometry.plot.width / Math.max(1, scene.plot.categories.length - 1)
  if (scene.plot.dateAxis) {
    const { min, max, ticks } = scene.plot.dateAxis
    const values = ticks.map((tick) => tick.value), labels = new Map(ticks.map((tick) => [tick.value, tick.label]))
    return {
      type: 'time', min, max: min === max ? max + 86400000 : max, boundaryGap: false, position: side, triggerEvent: true,
      name: axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
      axisLine: { show: axis.line.visible, onZero: false, lineStyle },
      axisTick: { show: axis.ticks.visible, customValues: values, length: axis.ticks.length, lineStyle },
      axisLabel: { show: axis.labels.visible, customValues: values, formatter: (value: number) => labels.get(value) ?? '', hideOverlap: false, showMinLabel: true, showMaxLabel: true, margin: axis.labels.gap, rotate: scene.plot.categoryLabelPlan.rotation, ...textStyle(axis.labels.style), ...horizontalCategoryLabelPlacement(side as 'top' | 'bottom' | undefined, scene.plot.categoryLabelPlan.rotation) },
      splitLine: { show: config.showVerticalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
    }
  }
  return {
    type: 'category', boundaryGap: false, position: side, data: scene.plot.categories.map((category) => category.coordinate), triggerEvent: true,
    name: axis.title?.visible ? axis.title.text : '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, alignWithLabel: true, interval, length: axis.ticks.length, lineStyle },
    axisLabel: { show: axis.labels.visible, inside: false, margin: axis.labels.gap, rotate: scene.plot.categoryLabelPlan.rotation, interval, hideOverlap: scene.plot.categoryLabelPlan.hideOverlap, showMinLabel: true, showMaxLabel: scene.plot.categoryLabelPlan.showMaxLabel, width: !scene.plot.categoryLabelPlan.rotation && config.xAxisLabelOverflow === 'truncate' ? Math.max(20, slot - 8) : undefined, overflow: config.xAxisLabelOverflow === 'truncate' ? 'truncate' : undefined, formatter: (_value: string, index: number) => { const numeric = scene.plot.categories.flatMap((category, categoryIndex) => typeof category.value === 'number' ? [categoryIndex] : []); const position = index === numeric[0] ? 'first' : index === numeric.at(-1) ? 'last' : 'middle'; if (usesEdgeCategoryLabels(scene) && (index === 0 || index === scene.plot.categories.length - 1)) return ''; const label = scene.plot.categories[index]?.label ?? ''; const categoryText = config.xAxisLabelOverflow === 'wrap' && !scene.plot.categoryLabelPlan.rotation ? wrapMeasuredText(label, axis.labels.style.size, Math.max(20, slot - 8), axis.labels.style.fontFamily, axis.labels.style.weight, false).text : label; return typeof scene.plot.categories[index]?.value === 'number' && usesXAxisEdgeOverlay(config) && axisAffixApplies(config.xAxisAffixScope, position) ? '' : categoryText }, ...textStyle(axis.labels.style), ...horizontalCategoryLabelPlacement(side as 'top' | 'bottom' | undefined, scene.plot.categoryLabelPlan.rotation), fontSize: scene.plot.categoryLabelPlan.fontSize },
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
    inverse: scene.plot.valueAxisInverse,
    type: config.yAxisScaleType === 'log' ? 'log' : 'value', logBase: config.yAxisScaleType === 'log' ? 10 : undefined, position: side, min: scene.plot.valueDomain.min, max: scene.plot.valueDomain.max, interval: config.yAxisScaleType === 'log' ? undefined : scene.plot.valueDomain.step,
    name: '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined, triggerEvent: true,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle }, axisTick: { show: axis.ticks.visible, inside: false, length: axis.ticks.length, lineStyle },
    axisLabel: { show: axis.labels.visible, inside: false, formatter: (value: number) => { const position = Math.abs(value - scene.plot.valueDomain.min) < 1e-9 ? 'first' : Math.abs(value - scene.plot.valueDomain.max) < 1e-9 ? 'last' : 'middle'; return usesYAxisEdgeOverlay(config) && axisAffixApplies(config.yAxisAffixScope, position) ? '' : formatYAxisNumber(value, config, position) }, ...textStyle(axis.labels.style), ...verticalAxisLabelPlacement(side as 'left' | 'right' | undefined, axis.labels.size, reservedAxisLabelGap(axis, scene.geometry.plot, scene.geometry.axes.value), axis.ticks.visible ? axis.ticks.length : 0, 'outer') },
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
  return scene.plot.series.flatMap((series) => !('segments' in series) ? [] : series.segments.filter((segment) => series.missing !== 'gap' || !missingCalendarPeriod(scene.plot.categories[segment.fromIndex]?.value, scene.plot.categories[segment.toIndex]?.value, scene.plot.dateAxis?.frequency)).map((segment) => ({
    id: segment.id, name: series.name, segmentOf: series.name, type: 'line', symbol: 'none', silent: true, animation: false, tooltip: { show: false }, z: 40,
    ...interpolationOption(series.interpolation), lineStyle: segment.stroke,
    data: [series.points[segment.fromIndex], series.points[segment.toIndex]].map((point) => [categoryCoordinate(scene, point.categoryIndex), point.value]).concat([null]),
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
  const pointGuides: Record<string, unknown>[] = []
  const series = scene.plot.series.map((item, seriesIndex) => {
    const firstIndex = item.points.findIndex((point) => point.value != null)
    const lastIndex = item.points.findLastIndex((point) => point.value != null)
    const direct = directItems.get(item.id)
    const showDirect = firstIndex >= 0 && directGuide?.visible && direct?.visible
    const directStyle = direct?.style ?? config.directLabelText ?? config.legendText
    const directWidth = Math.max(1, (scene.geometry.reservations['guide:direct-series']?.width ?? 120) - (config.directLabelGap ?? 14))
    const name = wrapMeasuredText(direct?.label ?? item.name, directStyle.size, directWidth, directStyle.fontFamily, directStyle.weight, false).text
    const note = direct?.note ? wrapMeasuredText(direct.note, Math.max(8, directStyle.size - 2), directWidth, directStyle.fontFamily, directStyle.weight, false).text : ''
    const directText = `{name|${name}}${note ? `\n{note|${note}}` : ''}`
    const directLabel = { show: true, distance: config.directLabelGap ?? 14, formatter: config.kind === 'bump' ? `${name}${note ? `\n${note}` : ''}` : directText, verticalAlign: 'middle', ...textStyle(directStyle), rich: config.kind === 'bump' ? undefined : { name: textStyle(directStyle), note: { ...textStyle(directStyle), fontSize: Math.max(8, directStyle.size - 2), opacity: .75 } } }
    const defaultZ = 30 + (scene.plot.series.length - seriesIndex) * 10
    const z = item.presentation?.emphasis === 'accent' ? 1000 + (item.presentation.layerPriority ?? seriesIndex) : defaultZ + (item.presentation?.layerPriority ?? 0)
    return {
      id: item.id, name: item.name, type: 'line', stack: scene.plot.mode === 'area' && scene.plot.stacking !== 'none' ? 'total' : undefined, triggerEvent: true, clip: true, z,
      ...interpolationOption(item.interpolation), showSymbol: true, symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: item.missing === 'connect',
      lineStyle: { ...item.stroke, opacity: item.presentation?.opacity ?? item.stroke.opacity }, itemStyle: { color: item.marker.fill, borderColor: item.marker.stroke, borderWidth: item.marker.strokeWidth },
      areaStyle: scene.plot.mode === 'area' && 'fill' in scene.plot.series[seriesIndex] ? scene.plot.series[seriesIndex].fill : undefined, emphasis: { scale: false },
      label: { show: config.showValues, position: config.valueLabelPosition === 'auto' || config.valueLabelPosition == null ? 'top' : config.valueLabelPosition, formatter: (params: { dataIndex?: number }) => params.dataIndex == null ? '' : item.points[params.dataIndex]?.label.text ?? '', ...textStyle(config.valueText), ...valueLabelAlignment(config.valueLabelPosition === 'auto' || config.valueLabelPosition == null ? 'top' : config.valueLabelPosition) },
      markLine: seriesIndex === 0 && config.showZeroLine && config.yAxisScaleType !== 'log' ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: config.zeroLineColor, width: config.zeroLineWidth, type: config.zeroLineType }, label: { show: false } } : undefined,
      // ECharts clips the entering end label against point 0. A leading gap has
      // no y coordinate, so anchor this label to the last valid datum instead.
      endLabel: showDirect && !directLeft && firstIndex === 0 ? directLabel : undefined,
      labelLine: showDirect ? { show: direct?.leaderLine ?? false, length: config.directLabelGap ?? 14, length2: 8, lineStyle: { color: direct?.color ?? item.color, width: config.directLabelLineWidth ?? 1, type: config.directLabelLineType ?? 'solid' } } : undefined,
      labelLayout: { hideOverlap: config.valueLabelHideOverlap ?? false, moveOverlap: 'shiftY' },
      data: withCalendarGaps(scene, item, item.points.map((point, index) => {
        const resolvedLabelPosition = point.label.position === 'auto' ? 'top' : point.label.position
        const pointLabel = { show: point.value != null && Number.isFinite(point.value) && point.label.visible, formatter: point.label.text, position: resolvedLabelPosition, ...textStyle(point.label.style), ...valueLabelAlignment(resolvedLabelPosition) }
        const directAtEnd = !directLeft && firstIndex > 0 && index === lastIndex
        const directPoint = showDirect && ((directLeft || config.kind === 'bump' && (config.bumpShowStartLabels ?? false)) && index === firstIndex || directAtEnd)
        if (directPoint) {
          const endpoint = point.value == null ? null : point.value + (scene.plot.mode === 'area' && scene.plot.stacking !== 'none' ? scene.plot.series.slice(0, seriesIndex).reduce((sum, series) => {
            const value = series.points[index]?.value ?? 0
            return Math.sign(value) === Math.sign(point.value!) ? sum + value : sum
          }, 0) : 0)
          pointGuides.push({
            name: `__point-direct-label:${item.name}:${index}`, segmentOf: item.name, type: 'line', showSymbol: true, symbolSize: 0, lineStyle: { opacity: 0 }, z: 50, clip: false, tooltip: { show: false },
            labelLayout: { hideOverlap: false, moveOverlap: 'shiftY' },
            data: [{ value: [categoryCoordinate(scene, index), endpoint], elementId: point.id, elementKey: point.legacyKey, sourceSeriesName: item.name, directLegendLabel: true, selectionTarget: 'guide',
              label: { ...directLabel, position: directAtEnd ? 'right' : 'left', align: directAtEnd ? 'left' : 'right' } }],
        })
        }
        return {
          id: point.id, value: pointValue(scene, index, point.value), name: scene.plot.categories[index]?.coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory, displayColor: item.color,
          symbol: point.marker.shape, symbolSize: point.marker.visible ? point.marker.size : 0, itemStyle: { color: point.marker.fill, borderColor: point.marker.stroke, borderWidth: point.marker.strokeWidth }, label: pointLabel, emphasis: { label: pointLabel },
        }
      })),
    }
  })
  const hits = scene.plot.series.map((item) => ({ name: `__hit__:${item.name}`, interactionLayer: 'hit', type: 'line', triggerEvent: true, ...interpolationOption(item.interpolation), symbol: item.marker.shape, symbolSize: item.marker.size, connectNulls: item.missing === 'connect', lineStyle: { color: 'rgba(0,0,0,0)', width: 14, opacity: 0 }, itemStyle: { opacity: 0 }, tooltip: { show: false }, silent: false, z: 100, data: withCalendarGaps(scene, item, item.points.map((point) => ({ id: point.id, value: pointValue(scene, point.categoryIndex, point.value), name: scene.plot.categories[point.categoryIndex]?.coordinate, elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: item.name, displayValue: point.displayValue, displayCategory: point.displayCategory }))) }))
  const plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const title = scene.frameElements.find((item) => item.role === 'title'), subtitle = scene.frameElements.find((item) => item.role === 'subtitle')
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'gap', ...graphicTextStyle(item.style) } }))
  const verticalTitle = scene.plot.valueAxis.title?.visible && scene.plot.valueAxis.title.text ? [{ id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? scene.geometry.content.x : undefined, right: config.yAxisPosition === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: scene.plot.valueAxis.title.text, ...graphicTextStyle(scene.plot.valueAxis.title.style), align: 'center', verticalAlign: 'middle' } }] : []
  const legendGroups = legendGuide ? legendGroupGraphics(legendGuide.items, legendRail, config) : []
  const edgeLabels = edgeCategoryLabels(scene)
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: title?.text ?? '', subtext: subtitle?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: title ? textStyle(title.style) : undefined, subtextStyle: subtitle ? textStyle(subtitle.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'axis', formatter: (input: unknown) => { const items = (Array.isArray(input) ? input : [input]) as Array<{ dataIndex?: number; seriesName?: string; value?: unknown; data?: { displayValue?: string; displayCategory?: string; streamBand?: boolean } }>; const visible = items.filter((entry) => entry.seriesName && !entry.seriesName.startsWith('__') && !entry.data?.streamBand); const index = visible[0]?.dataIndex ?? 0; return [`<b>${escapeHtml(visible[0]?.data?.displayCategory ?? scene.plot.series[0]?.points[index]?.displayCategory ?? '')}</b>`, ...visible.map((entry) => `${escapeHtml(entry.seriesName)}: <b>${escapeHtml(entry.data?.displayValue ?? formatYAxisNumber(entry.value as number, config))}</b>`)].join('<br/>') } },
    legend: { show: Boolean(legendGuide?.visible && legendItems.length), data: legendItems.map((item) => ({ name: item.rendererName, icon: item.marker?.kind === 'point' ? 'circle' : config.legendMarker === 'circle' ? 'circle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'triangle' ? 'triangle' : config.legendMarker === 'square' ? 'rect' : 'path://M0 4H24V7H0Z', itemStyle: { color: item.color, opacity: item.marker?.opacity ?? 1, borderWidth: 0 } })), formatter: (name: string) => legendLabelText(legendLabels.get(name) ?? name, config.legendText, legendRail, config.legendPosition), orient: legendGuide?.kind === 'categorical-legend' && (legendGuide.position === 'left' || legendGuide.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, right: legendGuide?.kind === 'categorical-legend' && legendGuide.position === 'right' ? canvas.width - (legendRail?.x ?? 0) - (legendRail?.width ?? 0) : undefined, itemWidth: 24, itemHeight: 10, itemGap: 18, textStyle: textStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false, outerBoundsMode: scene.plot.categories.every((category) => typeof category.value === 'string') ? 'none' : 'auto' },
    nativeSelectionHits: edgeLabels.map(({ rect, info }) => ({ rect, info })),
    nativeCategoryLayouts: edgeLabels.map((item) => item.layout),
    xAxis: categoryAxis(scene), yAxis: valueAxis(scene), series: [...series, ...pointGuides, ...segmentSeries(scene), ...hits, ...axisAffixSeries(scene)], graphic: [...verticalTitle, ...legendGroups, ...footer, ...edgeLabels.map((item) => item.graphic)],
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
