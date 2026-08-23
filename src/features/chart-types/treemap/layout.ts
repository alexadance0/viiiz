import type { NativeTreemapChartScene, ResolvedScene, ResolvedTreemapGeometry, TreemapNodeScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'
import { resolveNativeCartesianScene } from '../bar/layout'
import { wrapTreemapLabelText } from './text'

export type ResolvedTreemapScene = ResolvedScene & NativeTreemapChartScene & { geometry: ResolvedScene['geometry'] & { treemap: ResolvedTreemapGeometry } }

const inset = (rect: Rect, amount: number): Rect => ({ x: rect.x + amount, y: rect.y + amount, width: Math.max(0, rect.width - amount * 2), height: Math.max(0, rect.height - amount * 2) })

function tile(nodes: TreemapNodeScene[], rect: Rect, gap: number, output: Record<string, Rect>) {
  if (!nodes.length) return
  if (nodes.length === 1) { output[nodes[0].id] = inset(rect, gap / 2); return }
  const total = nodes.reduce((sum, node) => sum + node.value, 0), target = total / 2
  let index = 1, sum = nodes[0].value
  while (index < nodes.length - 1 && Math.abs(sum + nodes[index].value - target) < Math.abs(sum - target)) { sum += nodes[index].value; index += 1 }
  const ratio = total ? sum / total : index / nodes.length, horizontal = rect.width >= rect.height
  const first = horizontal ? { ...rect, width: rect.width * ratio } : { ...rect, height: rect.height * ratio }
  const second = horizontal ? { x: rect.x + first.width, y: rect.y, width: rect.width - first.width, height: rect.height } : { x: rect.x, y: rect.y + first.height, width: rect.width, height: rect.height - first.height }
  tile(nodes.slice(0, index), first, gap, output); tile(nodes.slice(index), second, gap, output)
}

function fittedLabel(node: TreemapNodeScene, rect: Rect) {
  if (!node.label.visible || !node.label.text || rect.width < 8 || rect.height < 8) return undefined
  const padding = node.label.adaptiveSize <= 8 ? 2 : 4, width = Math.max(1, rect.width - padding * 2), height = Math.max(1, rect.height - padding * 2)
  let fontSize = node.label.adaptiveSize, lineHeight = Math.round(fontSize * (node.role === 'group' ? 1.15 : 1.18)), lines = wrapTreemapLabelText(node.label.text, width, fontSize, node.label.style.fontFamily, node.role === 'group' ? Math.max(700, node.label.style.weight) : node.label.style.weight)
  while (fontSize > 5 && lines.length * lineHeight > height) { fontSize -= 1; lineHeight = Math.max(6, Math.round(fontSize * (node.role === 'group' ? 1.15 : 1.18))); lines = wrapTreemapLabelText(node.label.text, width, fontSize, node.label.style.fontFamily, node.label.style.weight) }
  if (!lines.length || lines.length * lineHeight > height) return undefined
  const labelHeight = lines.length * lineHeight + padding * 2
  const vertical = node.label.position.startsWith('top') ? 'top' : node.label.position.startsWith('bottom') ? 'bottom' : 'center'
  const y = vertical === 'top' ? rect.y : vertical === 'bottom' ? rect.y + rect.height - labelHeight : rect.y + (rect.height - labelHeight) / 2
  return { rect: { x: rect.x, y, width: rect.width, height: labelHeight }, text: lines.join('\n'), fontSize, lineHeight }
}

export function resolveNativeTreemapScene(scene: NativeTreemapChartScene): ResolvedTreemapScene {
  const config = scene.compatibilityConfig, hiddenStyle = config.axisLabelText
  const hiddenAxis = (id: string, orientation: 'horizontal' | 'vertical') => ({ id, channel: 'value' as const, orientation, placement: { kind: 'side' as const, side: orientation === 'horizontal' ? 'bottom' as const : 'left' as const }, line: { visible: false }, ticks: { visible: false, length: 0 }, labels: { visible: false, size: 0, gap: 0, style: hiddenStyle } })
  const fake = { ...scene, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: [], categoryAxis: { ...hiddenAxis('category', 'horizontal'), channel: 'category' as const }, valueAxis: hiddenAxis('value', 'vertical'), valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: [] } }
  const base = resolveNativeCartesianScene(fake)
  const rects: Record<string, Rect> = {}; tile(scene.plot.nodes, base.geometry.plot, scene.plot.groupGap, rects)
  const nodes: ResolvedTreemapGeometry['nodes'] = {}
  for (const group of scene.plot.nodes) {
    const groupRect = rects[group.id]
    if (!groupRect) continue
    const groupLabel = group.role === 'group' ? fittedLabel(group, groupRect) : undefined
    nodes[group.id] = { rect: groupRect, ...(groupLabel ? { labelRect: groupLabel.rect, labelText: groupLabel.text, fontSize: groupLabel.fontSize, lineHeight: groupLabel.lineHeight } : {}) }
    if (!group.children.length) { if (!groupLabel) { const label = fittedLabel(group, groupRect); if (label) Object.assign(nodes[group.id], { labelRect: label.rect, labelText: label.text, fontSize: label.fontSize, lineHeight: label.lineHeight }) } continue }
    const reserved = groupLabel ? groupLabel.rect.height : 0
    const childRect = groupLabel && group.label.position.startsWith('bottom') ? { ...groupRect, height: Math.max(0, groupRect.height - reserved) } : groupLabel && !group.label.position.startsWith('center') ? { x: groupRect.x, y: groupRect.y + reserved, width: groupRect.width, height: Math.max(0, groupRect.height - reserved) } : groupRect
    const childRects: Record<string, Rect> = {}; tile(group.children, childRect, scene.plot.leafGap, childRects)
    for (const leaf of group.children) { const rect = childRects[leaf.id]; if (!rect) continue; const label = fittedLabel(leaf, rect); nodes[leaf.id] = { rect, ...(label ? { labelRect: label.rect, labelText: label.text, fontSize: label.fontSize, lineHeight: label.lineHeight } : {}) } }
  }
  return { ...scene, resolvedReservations: base.resolvedReservations, geometry: { ...base.geometry, elements: { ...base.geometry.elements, ...Object.fromEntries(Object.entries(nodes).map(([id, item]) => [id, item.rect])) }, treemap: { nodes } } }
}
