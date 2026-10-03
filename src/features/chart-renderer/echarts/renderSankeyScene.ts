import { contrastText, mixHexColors } from '../../../core/color'
import { nonCartesianFrame } from '../../chart-types/nonCartesianFrame'
import type { ResolvedSankeyScene } from '../../chart-types/sankey/layout'
import { nativeGraphicTextStyle, renderNativeBarScene } from './renderBarScene'

export function renderSankeyScene(scene: ResolvedSankeyScene): Record<string, unknown> {
  const config = scene.compatibilityConfig
  const option = renderNativeBarScene({ ...nonCartesianFrame(scene), geometry: scene.geometry, resolvedReservations: scene.resolvedReservations })
  const items = [...scene.plot.links, ...scene.plot.nodes]
  const infoFor = (item: typeof items[number]) => ({ elementId: item.id, datumId: item.datumId, seriesId: item.seriesId, elementKey: item.legacyKey, sourceSeriesName: 'name' in item ? item.name : item.source, displayCategory: item.displayCategory, displayValue: item.displayValue, displayLabel: 'displayLabel' in item ? item.displayLabel : undefined, displayColor: item.color })
  return { ...option, xAxis: undefined, yAxis: undefined, legend: { show: false }, tooltip: { show: false }, nativePlotBounds: { left: scene.geometry.plot.x, top: scene.geometry.plot.y, right: scene.geometry.plot.x + scene.geometry.plot.width, bottom: scene.geometry.plot.y + scene.geometry.plot.height }, nativeSelectionHits: [...scene.plot.links.map((link) => {
    const source = scene.plot.nodes.find((node) => node.name === link.source)!, target = scene.plot.nodes.find((node) => node.name === link.target)!
    const start = scene.geometry.sankey.nodes[source.id].rect, end = scene.geometry.sankey.nodes[target.id].rect
    return { points: scene.geometry.sankey.linkHits[link.id], rect: { x: start.x + start.width, y: Math.min(start.y, end.y), width: end.x - start.x - start.width, height: Math.max(start.y + start.height, end.y + end.height) - Math.min(start.y, end.y) }, info: infoFor(link) }
  }), ...scene.plot.nodes.flatMap((node) => {
    const { rect, label } = scene.geometry.sankey.nodes[node.id]
    return [{ rect, info: infoFor(node) }, ...(node.label.visible && node.label.text ? [{ rect: { x: label.align === 'right' ? label.x - label.width : label.x, y: label.y - label.height / 2, width: label.width, height: label.height }, info: { ...infoFor(node), selectionTarget: 'value-label' } }] : [])]
  })], series: [{ id: 'native-sankey', name: 'Санкей', type: 'custom', triggerEvent: true, coordinateSystem: 'none', z: 5, data: items.map((item) => ({ value: item.value, ...infoFor(item) })), renderItem: (params: { dataIndex: number }) => {
    const item = items[params.dataIndex], info = infoFor(item)
    if (!('name' in item)) return { type: 'path', info, shape: { pathData: scene.geometry.sankey.links[item.id] }, style: { fill: item.color, opacity: config.elementStyles[item.legacyKey]?.fillOpacity ?? config.sankeyLinkOpacity ?? .45 }, emphasis: { style: { opacity: .8 } } }
    const { rect, label } = scene.geometry.sankey.nodes[item.id]
    const color = config.sankeyLabelColorByCategory ? item.color : label.inside && config.valueLabelAutoContrast !== false ? contrastText(mixHexColors(item.color, config.canvasBackground ?? '#ffffff', 1 - (config.sankeyLinkOpacity ?? .45))) : item.label.style.color
    const leader = !label.inside && Math.abs(label.y - (rect.y + rect.height / 2)) > 3 ? [{ type: 'line', silent: true, shape: { x1: label.align === 'left' ? rect.x + rect.width : rect.x, y1: rect.y + rect.height / 2, x2: label.x, y2: label.y }, style: { stroke: item.color, lineWidth: 1 } }] : []
    return { type: 'group', info, children: [{ type: 'rect', info, shape: rect, style: { fill: item.color } }, ...leader, ...(item.label.visible && item.label.text ? [{ type: 'text', silent: false, info, style: { x: label.x, y: label.y, text: label.text, ...nativeGraphicTextStyle(item.label.style), fill: color, align: label.align, verticalAlign: 'middle' } }] : [])] }
  } }] }
}
