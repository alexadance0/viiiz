import { measureTextWidth } from '../../../core/textMetrics'
import type { ElementId } from '../../../entities/chart/model/ChartElement'
import type { NativeButterflyChartScene, ResolvedNativeChartScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../bar/layout'

export type ResolvedButterflyScene = ResolvedNativeChartScene & { plot: NativeButterflyChartScene['plot']; butterflyGeometry: { marks: Record<ElementId, { x: number; y: number; width: number; height: number }>; labels: Record<ElementId, { x: number; y: number; width: number; height: number; align: 'left' | 'center' | 'right'; verticalAlign: 'middle'; inside: boolean }>; categories: Array<{ x: number; y: number; width: number; height: number }> ; centerGap: number } }

export function resolveNativeButterflyScene(source: NativeButterflyChartScene): ResolvedButterflyScene {
  const fake = { ...source, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'horizontal' as const, stacking: 'stacked' as const, categories: source.plot.categories, categoryAxis: source.plot.categoryAxis, valueAxis: source.plot.valueAxis, valueDomain: source.plot.valueDomain, barWidth: source.plot.barWidth, seriesGap: source.plot.seriesGap, series: source.plot.series } }
  const base = resolveNativeCartesianScene(fake)
  const plot = source.plot.categoryPlacement === 'center' ? { ...base.geometry.plot, x: base.geometry.content.x + 16, width: Math.max(1, base.geometry.content.width - 32) } : base.geometry.plot
  base.geometry.plot = plot
  const count = Math.max(1, source.plot.categories.length), band = plot.height / count
  const longest = Math.max(0, ...source.plot.categories.map((category) => measureTextWidth(category.label, source.plot.categoryAxis.labels.style.size, source.plot.categoryAxis.labels.style.fontFamily, source.plot.categoryAxis.labels.style.weight)))
  const inwardLabelWidth = (side: 'left' | 'right') => Math.max(0, ...source.plot.series.filter((series) => series.side === side).flatMap((series) => series.marks.flatMap((mark) => mark.label.visible && mark.label.position === 'bottom' ? mark.label.text.split('\n').map((line) => measureTextWidth(line, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)) : [])))
  const centerGap = source.plot.categoryPlacement === 'center' ? Math.min(plot.width * .42, longest + inwardLabelWidth('left') + inwardLabelWidth('right') + 40) : 0
  const center = plot.x + plot.width / 2, half = Math.max(1, (plot.width - centerGap) / 2), extent = Math.max(Math.abs(source.plot.valueDomain.min), Math.abs(source.plot.valueDomain.max), 1)
  const marks: ResolvedButterflyScene['butterflyGeometry']['marks'] = {}
  const labels: ResolvedButterflyScene['butterflyGeometry']['labels'] = {}
  source.plot.series.forEach((series) => {
    series.marks.forEach((mark, categoryIndex) => {
      if (mark.value == null) return
      const barHeight = band * Math.max(.1, Math.min(1, source.plot.barWidth / 100))
      const inner = center + (series.side === 'left' ? -centerGap / 2 : centerGap / 2)
      const start = inner + (series.side === 'left' ? -1 : 1) * half * mark.stackStart / extent
      const end = inner + (series.side === 'left' ? -1 : 1) * half * mark.stackEnd / extent
      const rect = { x: Math.min(start, end), y: plot.y + band * categoryIndex + (band - barHeight) / 2, width: Math.max(1, Math.abs(end - start)), height: barHeight }
      marks[mark.id] = rect
      if (mark.label.visible) {
        const requested = mark.label.position ?? 'auto'
        const inward = requested === 'bottom'
        const inside = requested.startsWith('inside-')
        const endpoint = mark.side === 'left' ? rect.x : rect.x + rect.width
        const startpoint = mark.side === 'left' ? rect.x + rect.width : rect.x
        const x = inside
          ? requested === 'inside-center' ? rect.x + rect.width / 2 : requested === 'inside-bottom' ? startpoint + (mark.side === 'left' ? -5 : 5) : endpoint + (mark.side === 'left' ? 5 : -5)
          : inward ? startpoint + (mark.side === 'left' ? 5 : -5) : endpoint + (mark.side === 'left' ? -5 : 5)
        const align = inside && requested === 'inside-center' ? 'center'
          : inside ? requested === 'inside-bottom' ? mark.side === 'left' ? 'right' : 'left' : mark.side === 'left' ? 'left' : 'right'
            : inward ? mark.side === 'left' ? 'left' : 'right' : mark.side === 'left' ? 'right' : 'left'
        const width = Math.max(0, ...mark.label.text.split('\n').map((line) => measureTextWidth(line, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)))
        const height = Math.round(mark.label.style.size * mark.label.style.lineHeight / 100) * Math.max(1, mark.label.text.split('\n').length)
        labels[mark.id] = { x, y: rect.y + rect.height / 2, width, height, align, verticalAlign: 'middle', inside }
      }
      base.geometry.elements[mark.id] = rect
    })
  })
  const categories = source.plot.categories.map((_category, index) => ({ x: center - centerGap / 2, y: plot.y + band * index, width: centerGap, height: band }))
  return { ...source, geometry: base.geometry, resolvedReservations: base.resolvedReservations, butterflyGeometry: { marks, labels, categories, centerGap } }
}
