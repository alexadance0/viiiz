import type { ChartTextStyle } from '../../../core/types'
import type { CartesianPointScene } from '../../../entities/chart/model/ChartScene'
import type { ResolvedComparisonStemScene } from '../../chart-types/comparison-stem/layout'
import { nativeGraphicTextStyle, nativeTextStyle, renderNativeCartesianAxis } from './renderBarScene'

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const dash = (type: 'solid' | 'dashed' | 'dotted') => type === 'dashed' ? [8, 5] : type === 'dotted' ? [2, 4] : undefined
const markerShape = (point: CartesianPointScene, x: number, y: number) => {
  const size = point.marker.size, half = size / 2
  if (point.marker.shape === 'circle') return { type: 'circle', shape: { cx: x, cy: y, r: half } }
  if (point.marker.shape === 'diamond') return { type: 'polygon', shape: { points: [[x, y - half], [x + half, y], [x, y + half], [x - half, y]] } }
  if (point.marker.shape === 'triangle') return { type: 'polygon', shape: { points: [[x, y - half], [x + half, y + half], [x - half, y + half]] } }
  return { type: 'rect', shape: { x: x - half, y: y - half, width: size, height: size, r: point.marker.shape === 'roundRect' ? Math.min(4, half) : 0 } }
}
const pointInfo = (point: CartesianPointScene, seriesName: string, color: string) => ({ elementId: point.id, datumId: point.datumId, seriesId: point.seriesId, elementKey: point.legacyKey, sourceSeriesName: seriesName, displayValue: point.displayValue, displayCategory: point.displayCategory, displayColor: color })
const font = (style: ChartTextStyle) => `${style.italic ? 'italic ' : ''}${style.weight} ${style.size}px ${style.fontFamily}`

export function renderComparisonStemScene(scene: ResolvedComparisonStemScene): Record<string, unknown> {
  if (scene.plot.kind !== 'comparison-stem') throw new Error('Comparison/stem renderer requires resolved comparison/stem geometry.')
  const config = scene.compatibilityConfig, horizontal = scene.plot.orientation === 'horizontal'
  const legendGuide = scene.guides.find((guide) => guide.kind === 'categorical-legend')
  const legendRail = scene.geometry.reservations['guide:legend']
  const names = new Map(scene.plot.series.map((series) => [series.id, series.name]))
  const legendItems = legendGuide?.items.flatMap((item) => item.visible && item.target.kind === 'series' ? [{ ...item, rendererName: names.get(item.target.seriesId) ?? String(item.target.seriesId) }] : []) ?? []
  const legendLabels = new Map(legendItems.map((item) => [item.rendererName, item.label]))
  const series = scene.plot.series.map((source) => ({
    id: source.id, name: source.name, type: 'custom', coordinateSystem: 'none', triggerEvent: true, silent: false, z: 10,
    data: source.points.map((point) => ({ value: point.categoryIndex, ...pointInfo(point, source.name, point.marker.fill) })),
    renderItem: (params: { dataIndex: number }) => {
      const point = source.points[params.dataIndex], resolved = point && scene.comparisonGeometry.points[point.id]
      if (!point || !resolved || point.value == null) return null
      const shape = markerShape(point, resolved.x, resolved.y)
      const info = pointInfo(point, source.name, point.marker.fill)
      const directGuide = scene.guides.find((guide) => guide.kind === 'direct-series')
      const directItem = directGuide?.items.find((item) => item.seriesId === source.id && item.visible)
      const direct = scene.comparisonGeometry.directLabels[source.id]
      return { type: 'group', info, children: [
        { ...shape, info, style: { fill: point.marker.fill, stroke: point.marker.stroke, lineWidth: point.marker.strokeWidth } },
        ...(resolved.label?.visible ? [{ type: 'text', info, style: { x: resolved.label.x, y: resolved.label.y, text: point.label.text, fill: point.label.style.color, font: font(point.label.style), align: resolved.label.align, verticalAlign: resolved.label.verticalAlign, lineHeight: Math.round(point.label.style.size * point.label.style.lineHeight / 100) } }] : []),
        ...(directItem && direct?.pointId === point.id ? [{ type: 'text', info: { seriesId: source.id, sourceSeriesName: source.name }, style: { x: direct.x, y: direct.y, text: directItem.label, fill: directItem.style.color, font: font(directItem.style), align: direct.align, verticalAlign: direct.verticalAlign } }] : []),
      ] }
    },
  }))
  const connectors = scene.plot.connectors.map((connector) => {
    const geometry = scene.comparisonGeometry.connectors[connector.id]
    return { id: connector.id, type: 'group', silent: true, z: 2, children: [
      { type: 'line', shape: { x1: geometry.x1, y1: geometry.y1, x2: geometry.x2, y2: geometry.y2 }, style: { stroke: connector.stroke.color, opacity: connector.stroke.opacity, lineWidth: connector.stroke.width, lineDash: dash(connector.stroke.type), lineCap: 'round' } },
      ...(connector.change?.visible && geometry.changeLabel ? [{ type: 'text', style: { x: geometry.changeLabel.x, y: geometry.changeLabel.y, text: connector.change.label, fill: connector.change.color, font: font(config.valueText), align: geometry.changeLabel.align, verticalAlign: geometry.changeLabel.verticalAlign } }] : []),
    ] }
  })
  const plot = scene.geometry.plot, canvas = scene.geometry.canvas
  const title = scene.frameElements.find((item) => item.role === 'title'), subtitle = scene.frameElements.find((item) => item.role === 'subtitle')
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source').map((item, index, items) => ({ id: `chart-${item.role}`, type: 'text', left: scene.geometry.content.x, bottom: canvas.height - scene.geometry.content.y - scene.geometry.content.height + (items.length - index - 1) * (Math.round(item.style.size * item.style.lineHeight / 100) + scene.document.composition.noteSource), style: { text: item.text, width: scene.geometry.content.width, overflow: 'break', ...nativeGraphicTextStyle(item.style) } }))
  const verticalAxis = horizontal ? scene.plot.categoryAxis : scene.plot.valueAxis, verticalTitle = verticalAxis.title
  const verticalTitleGraphic = verticalTitle?.visible && verticalTitle.text ? [{ id: 'chart-y-axis-title', type: 'text', left: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'left' ? scene.geometry.content.x : undefined, right: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'right' ? canvas.width - scene.geometry.content.x - scene.geometry.content.width : undefined, top: 'middle', rotation: verticalAxis.placement.kind === 'side' && verticalAxis.placement.side === 'right' ? -Math.PI / 2 : Math.PI / 2, style: { text: verticalTitle.text, ...nativeGraphicTextStyle(verticalTitle.style), align: 'center', verticalAlign: 'middle' } }] : []
  return {
    animation: true, backgroundColor: scene.document.canvas.background, color: scene.plot.series.map((item) => item.color), textStyle: { fontFamily: scene.document.theme.fontFamily },
    title: { text: title?.text ?? '', subtext: subtitle?.text ?? '', left: scene.geometry.content.x, top: Math.max(0, scene.geometry.content.y - 8), textStyle: title ? nativeTextStyle(title.style) : undefined, subtextStyle: subtitle ? nativeTextStyle(subtitle.style) : undefined, itemGap: scene.document.composition.titleSubtitle, triggerEvent: true },
    tooltip: { trigger: 'item', formatter: (input: { dataIndex?: number; seriesName?: string }) => {
      const source = scene.plot.series.find((item) => item.name === input.seriesName), point = source?.points[input.dataIndex ?? 0]
      if (!point) return ''
      if (scene.plot.variant === 'dumbbell') {
        const connector = scene.plot.connectors[point.categoryIndex], start = scene.plot.series[0]?.points[point.categoryIndex], end = scene.plot.series[1]?.points[point.categoryIndex]
        return `<b>${escapeHtml(point.displayCategory)}</b><br/>${escapeHtml(scene.plot.series[0]?.name)}: <b>${escapeHtml(start?.displayValue)}</b><br/>${escapeHtml(scene.plot.series[1]?.name)}: <b>${escapeHtml(end?.displayValue)}</b><br/>Изменение: <b>${escapeHtml(connector?.change?.label)}</b>`
      }
      return `<b>${escapeHtml(point.displayCategory)}</b><br/>${escapeHtml(source?.name)}: <b>${escapeHtml(point.displayValue)}</b>`
    } },
    legend: { show: Boolean(legendGuide?.visible && legendItems.length), data: legendItems.map((item) => ({ name: item.rendererName, icon: config.legendMarker === 'circle' ? 'circle' : config.legendMarker === 'diamond' ? 'diamond' : config.legendMarker === 'triangle' ? 'triangle' : 'rect', itemStyle: { color: item.color, borderWidth: 0 } })), formatter: (name: string) => legendLabels.get(name) ?? name, orient: legendGuide?.kind === 'categorical-legend' && (legendGuide.position === 'left' || legendGuide.position === 'right') ? 'vertical' : 'horizontal', left: legendRail?.x ?? scene.geometry.content.x, top: legendRail?.y, itemWidth: 10, itemHeight: 10, itemGap: 18, textStyle: nativeTextStyle(config.legendText) },
    grid: { left: plot.x, top: plot.y, right: canvas.width - plot.x - plot.width, bottom: canvas.height - plot.y - plot.height, containLabel: false },
    xAxis: horizontal ? renderNativeCartesianAxis(scene, 'value') : renderNativeCartesianAxis(scene, 'category'),
    yAxis: horizontal ? renderNativeCartesianAxis(scene, 'category') : renderNativeCartesianAxis(scene, 'value'),
    series,
    graphic: [...connectors, ...verticalTitleGraphic, ...footer],
  }
}
