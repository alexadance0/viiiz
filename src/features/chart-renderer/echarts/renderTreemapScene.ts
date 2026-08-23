import type { TreemapNodeScene } from '../../../entities/chart/model/ChartScene'
import { nativeGraphicTextStyle, renderNativeBarScene } from './renderBarScene'
import type { ResolvedTreemapScene } from '../../chart-types/treemap/layout'

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function renderTreemapScene(scene: ResolvedTreemapScene): Record<string, unknown> {
  const config = scene.compatibilityConfig, hiddenStyle = config.axisLabelText
  const hiddenAxis = (id: string, orientation: 'horizontal' | 'vertical') => ({ id, channel: 'value' as const, orientation, placement: { kind: 'side' as const, side: orientation === 'horizontal' ? 'bottom' as const : 'left' as const }, line: { visible: false }, ticks: { visible: false, length: 0 }, labels: { visible: false, size: 0, gap: 0, style: hiddenStyle } })
  const fake = { ...scene, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: [], categoryAxis: { ...hiddenAxis('category', 'horizontal'), channel: 'category' as const }, valueAxis: hiddenAxis('value', 'vertical'), valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: [] } }
  const option = renderNativeBarScene(fake)
  const all = scene.plot.nodes.flatMap((node) => [node, ...node.children])
  const nodeById = new Map(all.map((node) => [node.id, node]))
  const ordered = [...scene.plot.nodes, ...scene.plot.nodes.flatMap((node) => node.children)]
  const selectionHits = ordered.flatMap((node) => { const geometry = scene.geometry.treemap.nodes[node.id]; return geometry ? [{ rect: geometry.rect, info: { elementKey: node.legacyKey, sourceSeriesName: node.groupName, displayCategory: node.displayCategory, displayValue: node.displayValue, displayLabel: node.displayLabel, displayColor: node.color } }] : [] })
  const series = { id: 'native-treemap', name: 'Treemap', type: 'custom', coordinateSystem: 'none', triggerEvent: true, clip: true, z: 5, data: ordered.map((node) => ({ value: node.value, elementId: node.id, datumId: node.datumId, seriesId: node.seriesId, elementKey: node.legacyKey, sourceSeriesName: node.groupName, displayCategory: node.displayCategory, displayValue: node.displayValue, displayLabel: node.displayLabel, displayColor: node.color })), renderItem: (params: { dataIndex: number }) => {
    const node = ordered[params.dataIndex], geometry = node && scene.geometry.treemap.nodes[node.id]
    if (!node || !geometry) return null
    const info = { elementId: node.id, datumId: node.datumId, seriesId: node.seriesId, elementKey: node.legacyKey, sourceSeriesName: node.groupName, displayCategory: node.displayCategory, displayValue: node.displayValue, displayLabel: node.displayLabel, displayColor: node.color }
    const label = geometry.labelRect && geometry.labelText ? [{ type: 'text', silent: false, info, style: { x: geometry.labelRect.x + (node.label.position.endsWith('right') ? geometry.labelRect.width - 4 : node.label.position.endsWith('center') || node.label.position === 'center' ? geometry.labelRect.width / 2 : 4), y: geometry.labelRect.y + geometry.labelRect.height / 2, text: geometry.labelText, ...nativeGraphicTextStyle(node.label.style), fill: node.label.color, fontSize: geometry.fontSize, lineHeight: geometry.lineHeight, fontWeight: node.role === 'group' ? Math.max(700, node.label.style.weight) : node.label.style.weight, align: node.label.position.endsWith('right') ? 'right' : node.label.position.endsWith('center') || node.label.position === 'center' ? 'center' : 'left', verticalAlign: 'middle' } }] : []
    return { type: 'group', info, children: [{ type: 'rect', info, shape: geometry.rect, style: { fill: node.color, stroke: config.canvasBackground, lineWidth: node.role === 'group' ? scene.plot.groupGap : scene.plot.leafGap }, emphasis: { style: { stroke: config.axisLineColor, lineWidth: Math.max(2, scene.plot.leafGap) } } }, ...label] }
  } }
  const lookup = (dataIndex: number): TreemapNodeScene | undefined => nodeById.get(ordered[dataIndex]?.id)
  const plot = scene.geometry.plot
  return { ...option, xAxis: undefined, yAxis: undefined, legend: { show: false }, tooltip: { trigger: 'item', confine: true, formatter: (params: { dataIndex?: number }) => { const node = lookup(params.dataIndex ?? -1); return node ? `<b>${escapeHtml(node.displayCategory)}</b><br/>${escapeHtml(node.displayValue)}` : '' } }, series: [series], nativeSelectionHits: selectionHits, nativeTreemapHits: selectionHits, nativePlotBounds: { left: plot.x, right: plot.x + plot.width, top: plot.y, bottom: plot.y + plot.height }, graphic: option.graphic }
}
