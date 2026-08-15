import { measureTextWidth } from '../../../core/textMetrics'
import type { ElementId } from '../../../entities/chart/model/ChartElement'
import type { NativeWaterfallChartScene, ResolvedNativeChartScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../bar/layout'
import { waterfallLabelPlacement } from './transform'

export interface ResolvedWaterfallMarkGeometry { rect: { x: number; y: number; width: number; height: number }; label?: { x: number; y: number; width: number; height: number; align: 'center'; verticalAlign: 'top' | 'middle' | 'bottom'; inside: boolean } }
export type ResolvedWaterfallScene = ResolvedNativeChartScene & { plot: NativeWaterfallChartScene['plot']; waterfallGeometry: { marks: Record<ElementId, ResolvedWaterfallMarkGeometry>; connectors: Record<string, { x1: number; y1: number; x2: number; y2: number }> } }

export function resolveNativeWaterfallScene(source: NativeWaterfallChartScene): ResolvedWaterfallScene {
  const fake = { ...source, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: source.plot.categories, categoryAxis: source.plot.categoryAxis, valueAxis: source.plot.valueAxis, valueDomain: source.plot.valueDomain, barWidth: source.plot.barWidth, seriesGap: 0, series: [{ id: source.plot.marks[0]?.seriesId ?? 'waterfall', name: '', color: '', visible: true, marks: source.plot.marks }] } }
  const base = resolveNativeCartesianScene(fake)
  const plot = base.geometry.plot, count = Math.max(1, source.plot.marks.length), band = plot.width / count
  const project = (value: number) => plot.y + plot.height * (source.plot.valueDomain.max - value) / Math.max(1e-9, source.plot.valueDomain.max - source.plot.valueDomain.min)
  const marks: ResolvedWaterfallScene['waterfallGeometry']['marks'] = {}
  source.plot.marks.forEach((mark, index) => {
    if (mark.value == null) return
    const width = band * Math.max(.1, Math.min(1, (mark.style.width ?? source.plot.barWidth) / 100)), x = plot.x + band * (index + .5) - width / 2
    const startY = project(mark.start), endY = project(mark.end), rect = { x, y: Math.min(startY, endY), width, height: Math.max(1, Math.abs(startY - endY)) }
    let label: ResolvedWaterfallMarkGeometry['label']
    if (mark.label.visible) {
      const labelWidth = Math.max(0, ...mark.label.text.split('\n').map((line) => measureTextWidth(line, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)))
      const labelHeight = Math.round(mark.label.style.size * mark.label.style.lineHeight / 100) * Math.max(1, mark.label.text.split('\n').length)
      const requested = mark.total && mark.label.position === 'bottom' ? 'top' : mark.total && mark.label.position === 'inside-bottom' ? 'inside-top' : mark.label.position ?? 'auto'
      const placement = waterfallLabelPlacement(startY, endY, width, labelWidth, labelHeight, requested, source.compatibilityConfig.waterfallLabelGap ?? 6)
      const stride = Math.max(1, Math.ceil((labelWidth + 8) / Math.max(1, band)))
      if (!source.compatibilityConfig.valueLabelHideOverlap || mark.total || source.compatibilityConfig.elementStyles[mark.legacyKey]?.showLabel === true || index % stride === 0) label = { x: x + width / 2, y: placement.y, width: labelWidth + 8, height: labelHeight + 4, align: 'center', verticalAlign: placement.verticalAlign, inside: placement.inside }
    }
    marks[mark.id] = { rect, label }
    base.geometry.elements[mark.id] = rect
  })
  const connectors = Object.fromEntries(source.plot.connectors.map((connector) => {
    const from = marks[connector.fromId]?.rect, to = marks[connector.toId]?.rect
    return [connector.id, from && to ? { x1: from.x + from.width, y1: project(connector.value), x2: to.x, y2: project(connector.value) } : { x1: 0, y1: 0, x2: 0, y2: 0 }]
  }))
  return { ...source, geometry: base.geometry, resolvedReservations: base.resolvedReservations, waterfallGeometry: { marks, connectors } }
}
