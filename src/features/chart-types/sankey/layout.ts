import type { NativeSankeyChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'
import { resolveNativeCartesianScene } from '../bar/layout'
import { nonCartesianFrame } from '../nonCartesianFrame'
import { wrapTreemapLabelText } from '../treemap/text'

export type SankeyNodeGeometry = { rect: Rect; label: { x: number; y: number; text: string; align: 'left' | 'right'; width: number; height: number; inside: boolean } }
export type ResolvedSankeyScene = ResolvedScene & NativeSankeyChartScene & { geometry: ResolvedScene['geometry'] & { sankey: { nodes: Record<string, SankeyNodeGeometry>; links: Record<string, string>; linkHits: Record<string, Array<[number, number]>> } } }

export function resolveNativeSankeyScene(scene: NativeSankeyChartScene): ResolvedSankeyScene {
  const base = resolveNativeCartesianScene(nonCartesianFrame(scene)), config = scene.compatibilityConfig, plot = base.geometry.plot
  const nodes: Record<string, SankeyNodeGeometry> = {}, links: Record<string, string> = {}, linkHits: Record<string, Array<[number, number]>> = {}
  const maxDepth = Math.max(1, ...scene.plot.nodes.map((node) => node.depth))
  const terminal = new Set(scene.plot.nodes.filter((node) => !scene.plot.links.some((link) => link.source === node.name)).map((node) => node.name))
  const columns = Array.from({ length: maxDepth + 1 }, (_, depth) => scene.plot.nodes.filter((node) => (config.sankeyNodeAlign === 'justify' && terminal.has(node.name) ? maxDepth : node.depth) === depth))
  const outside = config.sankeyLabelPosition !== 'inside'
  const rail = outside ? Math.min(180, plot.width * .22) : Math.min(90, plot.width * .12)
  const nodeWidth = Math.min(40, Math.max(1, config.sankeyNodeWidth ?? 10))
  const width = Math.max(nodeWidth * 2, plot.width - rail * 2)
  const gap = Math.min(Math.max(0, config.sankeyNodeGap ?? 24), plot.height / Math.max(2, ...columns.map((column) => column.length)) / 2)
  const scale = Math.max(0, Math.min(...columns.filter((column) => column.length).map((column) => (plot.height - gap * (column.length - 1)) / column.reduce((sum, node) => sum + node.value, 0))))
  for (const [depth, column] of columns.entries()) {
    let y = plot.y // Preserve the table's order, including branches that end early.
    const x = plot.x + rail + depth / maxDepth * (width - nodeWidth)
    for (const node of column) {
      const rect = { x, y, width: nodeWidth, height: node.value * scale }
      const isTerminal = terminal.has(node.name), inside = !outside || depth > 0 && !isTerminal
      const align = !outside && depth === 0 ? 'left' : depth === 0 || inside ? 'right' : 'left'
      const labelWidth = inside ? Math.max(30, (width - nodeWidth) / maxDepth - 24) : rail - 12
      const style = node.label.style, text = wrapTreemapLabelText(node.label.text, labelWidth, style.size, style.fontFamily, style.weight).join('\n')
      const height = text.split('\n').length * style.size * style.lineHeight / 100
      nodes[node.id] = { rect, label: { x: align === 'right' ? x - 10 : x + nodeWidth + 10, y: y + rect.height / 2, text, align, width: labelWidth, height, inside } }
      y += rect.height + gap
    }
    // Keep small endpoint captions readable without changing the flow thickness.
    const captions = column.filter((node) => node.label.visible && node.label.text && !nodes[node.id].label.inside)
    let bottom = plot.y
    for (const node of captions) {
      const label = nodes[node.id].label
      label.y = Math.max(label.y, bottom + label.height / 2)
      bottom = label.y + label.height / 2 + 6
    }
    let top = plot.y + plot.height
    for (const node of [...captions].reverse()) {
      const label = nodes[node.id].label
      label.y = Math.min(label.y, top - label.height / 2)
      top = label.y - label.height / 2 - 6
    }
  }
  const byName = new Map(scene.plot.nodes.map((node) => [node.name, nodes[node.id].rect]))
  const sourceOffsets = new Map<string, number>(), targetOffsets = new Map<string, number>()
  const orderedLinks = [...scene.plot.links].sort((a, b) => byName.get(a.source)!.y - byName.get(b.source)!.y || byName.get(a.target)!.y - byName.get(b.target)!.y)
  for (const link of orderedLinks) {
    const source = byName.get(link.source)!, target = byName.get(link.target)!
    const sy = source.y + (sourceOffsets.get(link.source) ?? 0), ty = target.y + (targetOffsets.get(link.target) ?? 0), h = link.value * scale
    const x1 = source.x + source.width, x2 = target.x, bend = (x2 - x1) * Math.min(1, Math.max(0, config.sankeyCurvature ?? .5))
    links[link.id] = `M${x1},${sy} C${x1 + bend},${sy} ${x2 - bend},${ty} ${x2},${ty} L${x2},${ty + h} C${x2 - bend},${ty + h} ${x1 + bend},${sy + h} ${x1},${sy + h} Z`
    const edge = Array.from({ length: 25 }, (_, index): [number, number] => {
      const t = index / 24, u = 1 - t
      return [u ** 3 * x1 + 3 * u ** 2 * t * (x1 + bend) + 3 * u * t ** 2 * (x2 - bend) + t ** 3 * x2, sy + (ty - sy) * (3 * t ** 2 - 2 * t ** 3)]
    })
    linkHits[link.id] = [...edge, ...[...edge].reverse().map(([x, y]): [number, number] => [x, y + h])]
    sourceOffsets.set(link.source, (sourceOffsets.get(link.source) ?? 0) + h)
    targetOffsets.set(link.target, (targetOffsets.get(link.target) ?? 0) + h)
  }
  return { ...scene, resolvedReservations: base.resolvedReservations, geometry: { ...base.geometry, elements: { ...base.geometry.elements, ...Object.fromEntries(Object.entries(nodes).map(([id, node]) => [id, node.rect])) }, sankey: { nodes, links, linkHits } } }
}
