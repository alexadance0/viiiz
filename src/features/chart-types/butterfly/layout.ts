import { measureTextWidth } from '../../../core/textMetrics'
import type { ElementId } from '../../../entities/chart/model/ChartElement'
import type { NativeButterflyChartScene, ResolvedNativeChartScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../bar/layout'

export type ResolvedButterflyScene = ResolvedNativeChartScene & { plot: NativeButterflyChartScene['plot']; butterflyGeometry: { marks: Record<ElementId, { x: number; y: number; width: number; height: number }>; labels: Record<ElementId, { x: number; y: number; align: 'left' | 'right'; verticalAlign: 'middle' }>; categories: Array<{ x: number; y: number; width: number; height: number }> ; centerGap: number } }

export function resolveNativeButterflyScene(source: NativeButterflyChartScene): ResolvedButterflyScene {
  const fake = { ...source, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'horizontal' as const, stacking: 'stacked' as const, categories: source.plot.categories, categoryAxis: source.plot.categoryAxis, valueAxis: source.plot.valueAxis, valueDomain: source.plot.valueDomain, barWidth: source.plot.barWidth, seriesGap: source.plot.seriesGap, series: source.plot.series } }
  const base = resolveNativeCartesianScene(fake)
  const plot = source.plot.categoryPlacement === 'center' ? { ...base.geometry.plot, x: base.geometry.content.x + 16, width: Math.max(1, base.geometry.content.width - 32) } : base.geometry.plot
  base.geometry.plot = plot
  const count = Math.max(1, source.plot.categories.length), band = plot.height / count
  const longest = Math.max(0, ...source.plot.categories.map((category) => measureTextWidth(category.label, source.plot.categoryAxis.labels.style.size, source.plot.categoryAxis.labels.style.fontFamily, source.plot.categoryAxis.labels.style.weight)))
  const centerGap = source.plot.categoryPlacement === 'center' ? Math.min(plot.width * .34, longest + 24) : 0
  const center = plot.x + plot.width / 2, half = Math.max(1, (plot.width - centerGap) / 2), extent = Math.max(Math.abs(source.plot.valueDomain.min), Math.abs(source.plot.valueDomain.max), 1)
  const marks: ResolvedButterflyScene['butterflyGeometry']['marks'] = {}
  const labels: ResolvedButterflyScene['butterflyGeometry']['labels'] = {}
  const sideCounts = { left: source.plot.series.filter((item) => item.side === 'left').length, right: source.plot.series.filter((item) => item.side === 'right').length }
  source.plot.series.forEach((series) => {
    const sideIndex = source.plot.series.filter((item) => item.side === series.side).indexOf(series)
    series.marks.forEach((mark, categoryIndex) => {
      if (mark.value == null) return
      const yBand = band * Math.max(.1, Math.min(1, source.plot.barWidth / 100)), barHeight = yBand / Math.max(1, sideCounts[series.side])
      const inner = center + (series.side === 'left' ? -centerGap / 2 : centerGap / 2)
      const start = inner + (series.side === 'left' ? -1 : 1) * half * mark.stackStart / extent
      const end = inner + (series.side === 'left' ? -1 : 1) * half * mark.stackEnd / extent
      const rect = { x: Math.min(start, end), y: plot.y + band * categoryIndex + (band - yBand) / 2 + sideIndex * barHeight, width: Math.max(1, Math.abs(end - start)), height: barHeight }
      marks[mark.id] = rect
      if (mark.label.visible) labels[mark.id] = { x: mark.side === 'left' ? rect.x - 5 : rect.x + rect.width + 5, y: rect.y + rect.height / 2, align: mark.side === 'left' ? 'right' : 'left', verticalAlign: 'middle' }
      base.geometry.elements[mark.id] = rect
    })
  })
  const categories = source.plot.categories.map((_category, index) => ({ x: center - centerGap / 2, y: plot.y + band * index, width: centerGap, height: band }))
  return { ...source, geometry: base.geometry, resolvedReservations: base.resolvedReservations, butterflyGeometry: { marks, labels, categories, centerGap } }
}
