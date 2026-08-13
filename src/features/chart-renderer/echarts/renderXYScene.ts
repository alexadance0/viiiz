import { continuousDateLabel } from '../../../core/chartDateAxis'
import { axisAffixApplies, formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import type { ChartTextStyle } from '../../../core/types'
import type { XYQuadrantLayerScene, XYReferenceLineScene, XYTrendLayerScene } from '../../../entities/chart/model/ChartScene'
import type { ResolvedXYScene } from '../../chart-types/xy/layout'

const textStyle = (style: ChartTextStyle) => ({ color: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
const graphicTextStyle = (style: ChartTextStyle) => { const { color, ...rest } = textStyle(style); return { ...rest, fill: color } }
const pointLabelPlacement = (position: 'top' | 'right' | 'bottom' | 'left') => ({ align: position === 'left' ? 'right' : position === 'right' ? 'left' : 'center', verticalAlign: position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : 'middle', opacity: 1 })
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const axisSide = (axis: ResolvedXYScene['plot']['xAxis']) => axis.placement.kind === 'side' ? axis.placement.side : undefined
const axisLineStyle = (scene: ResolvedXYScene) => ({ color: scene.compatibilityConfig.axisLineColor, width: scene.compatibilityConfig.axisLineWidth, type: scene.compatibilityConfig.axisLineType })
const usesXAxisEdgeOverlay = (scene: ResolvedXYScene) => scene.plot.xScale.type !== 'time' && (scene.compatibilityConfig.showXAxisLabels ?? true) && scene.compatibilityConfig.xAxisAffixScope != null && scene.compatibilityConfig.xAxisAffixScope !== 'all' && Boolean(scene.compatibilityConfig.xAxisNumberPrefix || scene.compatibilityConfig.xAxisNumberSuffix)
const usesYAxisEdgeOverlay = (scene: ResolvedXYScene) => (scene.compatibilityConfig.showYAxisLabels ?? true) && scene.compatibilityConfig.yAxisAffixScope != null && scene.compatibilityConfig.yAxisAffixScope !== 'all' && Boolean(scene.compatibilityConfig.numberPrefix || scene.compatibilityConfig.numberSuffix)

function xAxis(scene: ResolvedXYScene) {
  const config = scene.compatibilityConfig, axis = scene.plot.xAxis, scale = scene.plot.xScale
  const minimum = scale.minimum ?? scale.automaticDomain.minimum, maximum = scale.maximum ?? scale.automaticDomain.maximum
  const nameGap = (axis.ticks.visible ? axis.ticks.length : 0) + (axis.labels.visible ? axis.labels.gap + axis.labels.size : 0) + (axis.title?.gap ?? 0)
  return {
    type: scale.type === 'time' ? 'time' : 'value', position: axisSide(axis), min: scale.minimum, max: scale.maximum, interval: scale.type === 'time' ? undefined : scale.step,
    name: axis.title?.visible && config.axisTitleMode !== 'editorial' ? axis.title.text : '', nameLocation: 'middle', nameGap, nameTextStyle: axis.title ? textStyle(axis.title.style) : undefined, triggerEvent: true,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle: axisLineStyle(scene) }, axisTick: { show: axis.ticks.visible, inside: false, alignWithLabel: true, length: axis.ticks.length, lineStyle: axisLineStyle(scene) },
    axisLabel: { show: axis.labels.visible, margin: axis.labels.gap, inside: false, hideOverlap: true, rotate: axis.labels.rotation ?? 0, ...textStyle(axis.labels.style), formatter: scale.type === 'time'
      ? (value: number, index: number) => continuousDateLabel(new Date(value), scale.timeProfile, scale.dateLabelFormat, index === 0)
      : (value: number) => { const tolerance = Math.max(1, Math.abs(maximum - minimum)) * 1e-9; const position = Math.abs(value - minimum) <= tolerance ? 'first' : Math.abs(value - maximum) <= tolerance ? 'last' : 'middle'; return usesXAxisEdgeOverlay(scene) && axisAffixApplies(config.xAxisAffixScope, position) ? '' : formatXAxisNumber(value, config, position) } },
    splitLine: { show: config.showVerticalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  }
}

function yAxis(scene: ResolvedXYScene) {
  const config = scene.compatibilityConfig, axis = scene.plot.yAxis, scale = scene.plot.yScale
  const minimum = scale.minimum ?? scale.automaticDomain.minimum, maximum = scale.maximum ?? scale.automaticDomain.maximum
  return {
    type: scale.type === 'log' ? 'log' : 'value', logBase: scale.type === 'log' ? 10 : undefined, position: axisSide(axis), min: scale.minimum, max: scale.maximum, interval: scale.type === 'log' ? undefined : scale.step,
    name: '', triggerEvent: true,
    axisLine: { show: axis.line.visible, onZero: false, lineStyle: axisLineStyle(scene) }, axisTick: { show: axis.ticks.visible, inside: false, length: axis.ticks.length, lineStyle: axisLineStyle(scene) },
    axisLabel: { show: axis.labels.visible, margin: axis.labels.gap, inside: false, ...textStyle(axis.labels.style), align: axisSide(axis) === 'right' ? 'left' : 'right', formatter: (value: number) => { const tolerance = Math.max(1, Math.abs(maximum - minimum)) * 1e-9; const position = Math.abs(value - minimum) <= tolerance ? 'first' : Math.abs(value - maximum) <= tolerance ? 'last' : 'middle'; return usesYAxisEdgeOverlay(scene) && axisAffixApplies(config.yAxisAffixScope, position) ? '' : formatYAxisNumber(value, config, position) } },
    splitLine: { show: config.showHorizontalGrid, lineStyle: { color: config.gridColor, width: config.gridWidth, type: config.gridType } },
  }
}

function referenceSeries(scene: ResolvedXYScene, layer: XYReferenceLineScene) {
  const xMin = scene.plot.xScale.minimum ?? scene.plot.xScale.automaticDomain.minimum, xMax = scene.plot.xScale.maximum ?? scene.plot.xScale.automaticDomain.maximum
  const yMin = scene.plot.yScale.minimum ?? scene.plot.yScale.automaticDomain.minimum, yMax = scene.plot.yScale.maximum ?? scene.plot.yScale.automaticDomain.maximum
  const data = layer.axis === 'x' ? [[layer.value, yMin], [layer.value, yMax]] : layer.axis === 'y' ? [[xMin, layer.value], [xMax, layer.value]] : layer.segment?.map((point) => [point.x, point.y]) ?? []
  return { id: layer.id, name: layer.id, type: 'line', data, symbol: 'none', silent: true, animation: false, tooltip: { show: false }, lineStyle: layer.stroke, z: 25 }
}

function trendSeries(layer: XYTrendLayerScene) {
  const band = layer.confidenceBand ? [{
    id: layer.confidenceBand.id, name: layer.confidenceBand.id, type: 'custom', coordinateSystem: 'cartesian2d', silent: true, animation: false, tooltip: { show: false }, z: 5, data: [[layer.samples[0]?.x, layer.samples[0]?.y]],
    renderItem: (_params: unknown, api: { coord(value: [number, number]): [number, number] }) => ({ type: 'polygon', shape: { points: [...layer.confidenceBand!.samples.map((sample) => api.coord([sample.x, sample.upper])), ...layer.confidenceBand!.samples.toReversed().map((sample) => api.coord([sample.x, sample.lower]))] }, style: { fill: layer.confidenceBand!.fillColor, opacity: layer.confidenceBand!.fillOpacity }, silent: true }),
  }] : []
  return [...band, { id: layer.id, name: layer.id, type: 'line', data: layer.samples.map((sample) => [sample.x, sample.y]), symbol: 'none', silent: true, animation: false, tooltip: { show: false }, lineStyle: layer.stroke, z: 20 }]
}

function quadrantSeries(layer: XYQuadrantLayerScene) {
  return layer.regions.map((region, index) => ({
    id: `${layer.id}:${region.position}`, name: `${layer.id}:${region.position}`, type: 'custom', coordinateSystem: 'cartesian2d', silent: true, animation: false, tooltip: { show: false }, z: 0, data: [[region.xMinimum, region.yMinimum, region.xMaximum, region.yMaximum]],
    renderItem: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => {
      const first = api.coord([api.value(0), api.value(1)]), second = api.coord([api.value(2), api.value(3)])
      const x = Math.min(first[0], second[0]), y = Math.min(first[1], second[1]), width = Math.abs(second[0] - first[0]), height = Math.abs(second[1] - first[1])
      const left = region.position.endsWith('left'), top = region.position.startsWith('top')
      return { type: 'group', silent: true, children: [{ type: 'rect', shape: { x, y, width, height }, style: { fill: region.fillColor, opacity: region.fillOpacity } }, ...(region.label ? [{ type: 'text', style: { x: left ? x + 8 : x + width - 8, y: top ? y + 8 : y + height - 8, text: region.label, ...graphicTextStyle(region.labelStyle), align: left ? 'left' : 'right', verticalAlign: top ? 'top' : 'bottom' } }] : [])] }
    },
    quadrantIndex: index,
  }))
}

function sizeGuideGraphics(scene: ResolvedXYScene) {
  const guide = scene.guides.find((item) => item.kind === 'size-scale' && item.visible), bounds = guide && scene.geometry.guides[guide.id]
  if (!guide || guide.kind !== 'size-scale' || !bounds) return []
  const maxRadius = Math.max(...guide.items.map((item) => item.diameter / 2)), titleHeight = Math.round(guide.style.size * guide.style.lineHeight / 100) + 10, baseline = titleHeight + maxRadius * 2
  return [{ id: `guide:${guide.id}`, type: 'group', x: bounds.x, y: bounds.y, silent: true, z: 100, children: [
    { type: 'text', x: 0, y: 0, style: { text: guide.title, ...graphicTextStyle(guide.style), fontWeight: 600 } },
    ...guide.items.flatMap((item) => { const radius = item.diameter / 2, cy = baseline - radius, lineY = cy - radius; return [
      { type: 'circle', shape: { cx: maxRadius, cy, r: radius }, style: { fill: 'transparent', stroke: guide.marker.stroke, lineWidth: guide.marker.strokeWidth } },
      { type: 'line', shape: { x1: maxRadius, y1: lineY, x2: maxRadius * 2 + 14, y2: lineY }, style: { stroke: guide.marker.stroke, opacity: .55, lineWidth: 1, lineDash: [3, 3] } },
      { type: 'text', x: maxRadius * 2 + 20, y: lineY, style: { text: item.label, ...graphicTextStyle(guide.style), fontWeight: 600, align: 'left', verticalAlign: 'middle' } },
    ] }),
  ] }]
}

function affixSeries(scene: ResolvedXYScene) {
  const config = scene.compatibilityConfig, xMin = scene.plot.xScale.minimum ?? scene.plot.xScale.automaticDomain.minimum, xMax = scene.plot.xScale.maximum ?? scene.plot.xScale.automaticDomain.maximum, yMin = scene.plot.yScale.minimum ?? scene.plot.yScale.automaticDomain.minimum, yMax = scene.plot.yScale.maximum ?? scene.plot.yScale.automaticDomain.maximum
  const yStyle = config.yAxisLabelText ?? config.axisLabelText
  const yValues = config.yAxisAffixScope === 'first' ? [['first', yMin] as const] : config.yAxisAffixScope === 'last' ? [['last', yMax] as const] : [['first', yMin] as const, ['last', yMax] as const]
  const y = usesYAxisEdgeOverlay(scene) ? [{ name: '__y-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100, data: yValues.map(([position, value]) => [xMin, value, position === 'first' ? 0 : 1]), renderItem: (params: { coordSys: { x: number; width: number } }, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => { const value = api.value(1), position = api.value(2) === 0 ? 'first' : 'last', left = config.yAxisPosition === 'left', edge = left ? params.coordSys.x - (config.yAxisLabelGap ?? 8) : params.coordSys.x + params.coordSys.width + (config.yAxisLabelGap ?? 8); return { type: 'text', style: { x: edge, y: api.coord([xMin, value])[1], text: formatYAxisNumber(value, config, position), ...graphicTextStyle(yStyle), align: left ? 'right' : 'left', verticalAlign: 'middle', backgroundColor: config.canvasBackground ?? '#ffffff' } } } }] : []
  const xStyle = config.xAxisLabelText ?? config.axisLabelText
  const x = usesXAxisEdgeOverlay(scene) ? [{ name: '__x-axis-edge-affixes', type: 'custom', coordinateSystem: 'cartesian2d', silent: true, tooltip: { show: false }, clip: false, z: 100, data: [['first', xMin], ['last', xMax]].filter(([position]) => axisAffixApplies(config.xAxisAffixScope, position as 'first' | 'last')).map(([position, value]) => [value, yMin, position === 'first' ? 0 : 1]), renderItem: (params: { coordSys: { y: number; height: number } }, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => { const value = api.value(0), first = api.value(2) === 0, top = config.xAxisPosition === 'top'; return { type: 'text', style: { x: api.coord([value, yMin])[0], y: top ? params.coordSys.y - (config.xAxisLabelGap ?? 8) : params.coordSys.y + params.coordSys.height + (config.xAxisLabelGap ?? 8), text: formatXAxisNumber(value, config, first ? 'first' : 'last'), ...graphicTextStyle(xStyle), align: first ? 'left' : 'right', verticalAlign: top ? 'bottom' : 'top', backgroundColor: config.canvasBackground ?? '#ffffff' } } } }] : []
  return [...y, ...x]
}

export function renderXYScene(scene: ResolvedXYScene): Record<string, unknown> {
  const config = scene.compatibilityConfig, plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const legend = scene.guides.find((guide) => guide.kind === 'categorical-legend'), legendRail = scene.geometry.reservations['guide:legend']
  const legendItems = legend?.kind === 'categorical-legend' ? legend.items.filter((item) => item.visible && item.target.kind === 'series') : []
  const labels = new Map(legendItems.map((item) => [scene.plot.series.find((series) => series.id === (item.target.kind === 'series' ? item.target.seriesId : ''))?.name ?? '', item.label]))
  const pointSeries = scene.plot.series.map((series, index) => ({
    id: series.id, name: series.name, type: 'scatter', triggerEvent: true, clip: true, z: 40 + scene.plot.series.length - index, symbol: 'circle', itemStyle: { color: series.points[0]?.marker.fill ?? series.color, borderColor: series.color, borderWidth: series.points[0]?.marker.strokeWidth ?? 1 }, emphasis: { focus: 'series', scale: 1.12 }, labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
    data: series.points.map((point) => ({ value: [point.x, point.y], elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: series.name, displayCategory: point.displayX, displayValue: point.displayY, displayLabel: point.label.text, displayColor: series.color, bubbleValue: point.sizeValue, displaySizeValue: point.displaySizeValue, bubbleSize: point.marker.size, symbol: point.marker.shape, symbolSize: point.marker.size, itemStyle: { color: point.marker.fill, borderColor: point.marker.stroke, borderWidth: point.marker.strokeWidth, opacity: point.marker.opacity }, label: { show: point.label.visible, formatter: point.label.text, position: point.label.position, distance: 5, ...textStyle(point.label.style), ...pointLabelPlacement(point.label.position) }, emphasis: { label: { show: point.label.visible, formatter: point.label.text, position: point.label.position, ...textStyle(point.label.style), ...pointLabelPlacement(point.label.position) } } })),
  }))
  const derived = scene.plot.analyticalLayers.flatMap<Record<string, unknown>>((layer) => layer.kind === 'trend' ? trendSeries(layer) as Array<Record<string, unknown>> : layer.kind === 'reference' ? [referenceSeries(scene, layer) as Record<string, unknown>] : quadrantSeries(layer) as Array<Record<string, unknown>>)
  const title = scene.frameElements.find((item) => item.role === 'title'), subtitle = scene.frameElements.find((item) => item.role === 'subtitle')
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'break', ...graphicTextStyle(item.style) } }))
  const verticalTitle = scene.plot.yAxis.title?.visible && scene.plot.yAxis.title.text ? [{ id: 'chart-y-axis-title', type: 'text', left: config.yAxisPosition === 'left' ? scene.geometry.content.x : undefined, right: config.yAxisPosition === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: config.yAxisPosition === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: scene.plot.yAxis.title.text, ...graphicTextStyle(scene.plot.yAxis.title.style), align: 'center', verticalAlign: 'middle' } }] : []
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((series) => series.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: title?.text ?? '', subtext: subtitle?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: title ? textStyle(title.style) : undefined, subtextStyle: subtitle ? textStyle(subtitle.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'item', formatter: (input: unknown) => { const item = input as { marker?: string; seriesName?: string; data?: { displayCategory?: string; displayValue?: string; displaySizeValue?: string } }; const size = scene.plot.variant === 'bubble' && scene.plot.sizeEncoding && item.data?.displaySizeValue != null ? `<br/>${escapeHtml(scene.plot.sizeEncoding.field)}: <b>${escapeHtml(item.data.displaySizeValue)}</b>` : ''; return `${item.marker ?? ''}${escapeHtml(item.seriesName ?? '')}<br/><b>${escapeHtml(item.data?.displayCategory ?? '')} · ${escapeHtml(item.data?.displayValue ?? '')}</b>${size}` } },
    legend: { show: Boolean(legend?.visible && legendItems.length), data: legendItems.map((item) => ({ name: scene.plot.series.find((series) => series.id === (item.target.kind === 'series' ? item.target.seriesId : ''))?.name, icon: config.legendMarker === 'triangle' ? 'triangle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'square' ? 'rect' : config.legendMarker === 'line' ? 'path://M0 4H24V7H0Z' : 'circle', itemStyle: { color: item.color } })), formatter: (name: string) => labels.get(name) ?? name, orient: legend?.kind === 'categorical-legend' && (legend.position === 'left' || legend.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, right: legend?.kind === 'categorical-legend' && legend.position === 'right' ? canvas.width - (legendRail?.x ?? 0) - (legendRail?.width ?? 0) : undefined, itemWidth: config.legendMarker === 'line' ? 24 : 10, itemHeight: 10, itemGap: 18, textStyle: textStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false }, xAxis: xAxis(scene), yAxis: yAxis(scene),
    series: [...derived.filter((item) => Number(item.z) < 10), ...pointSeries, ...derived.filter((item) => Number(item.z) >= 10), ...affixSeries(scene)], graphic: [...verticalTitle, ...sizeGuideGraphics(scene), ...footer],
  }
}
