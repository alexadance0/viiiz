import { colorScaleReservation, layoutColorScale } from '../../chart-layout/guides/colorScale'
import { measureTextWidth } from '../../../core/textMetrics'
import type { NativeHeatmapChartScene, ResolvedHeatmapGeometry, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'
import type { LayoutReservation } from '../../chart-layout/reservations'
import { resolveNativeCartesianScene } from '../bar/layout'
import { categoryAxisFraction } from '../../chart-layout/axisLayout'

export type ResolvedHeatmapScene = ResolvedScene & NativeHeatmapChartScene & { geometry: ResolvedScene['geometry'] & { heatmap: ResolvedHeatmapGeometry } }

export function resolveNativeHeatmapScene(scene: NativeHeatmapChartScene): ResolvedHeatmapScene {
  const rowStyle = scene.plot.rowAxis.labels.style
  const rowLabelWidth = scene.plot.rowAxis.labels.visible ? Math.ceil(Math.max(0, ...scene.plot.rows.map((row) => measureTextWidth(row.name, rowStyle.size, rowStyle.fontFamily, rowStyle.weight)))) : 0
  const outerAligned = scene.compatibilityConfig.categoryAxisLabelAlignment === 'outer'
  const rowWidth = rowLabelWidth ? rowLabelWidth + scene.plot.rowAxis.labels.gap + (scene.plot.rowAxis.ticks.visible ? Math.max(0, scene.plot.rowAxis.ticks.length - scene.plot.rowAxis.labels.gap) : 0) : 0
  const rowAxis = { ...scene.plot.rowAxis, labels: { ...scene.plot.rowAxis.labels, size: rowLabelWidth } }
  const reservations: LayoutReservation[] = []
  if (rowWidth && scene.plot.rowAxis.placement.kind === 'side') reservations.push({ id: 'axis:row', side: scene.plot.rowAxis.placement.side, size: rowWidth, gap: 0, mode: 'outside', priority: 50 })
  const guide = scene.guides.find((item) => item.kind === 'color-scale')
  if (guide) {
    const reservation = colorScaleReservation(guide, scene.compatibilityConfig, scene.compatibilityConfig.canvasWidth ?? 1000)
    if (reservation) reservations.push(reservation)
  }
  const hiddenValueAxis = { ...rowAxis, id: 'value', channel: 'value' as const, labels: { ...rowAxis.labels, visible: false }, line: { visible: false }, ticks: { ...rowAxis.ticks, visible: false }, title: rowAxis.title ? { ...rowAxis.title, visible: false } : undefined }
  const fake = { ...scene, guides: scene.guides.filter((guide) => guide.kind === 'categorical-legend'), plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: scene.plot.categories, categoryAxis: scene.plot.categoryAxis, valueAxis: hiddenValueAxis, valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: [] } }
  const base = resolveNativeCartesianScene(fake, reservations)
  const plot = base.geometry.plot, columns = Math.max(1, scene.plot.categories.length), rows = Math.max(1, scene.plot.rows.length)
  const centers = scene.plot.categories.map((_category, index) => categoryAxisFraction(scene.plot.categories, base.plot.categoryAxis, index))
  const widths = centers.map((center, index) => base.plot.categoryAxis.timeScale
    ? Math.min(1 / columns, index ? Math.abs(center - centers[index - 1]) : Infinity, index + 1 < centers.length ? Math.abs(centers[index + 1] - center) : Infinity)
    : 1 / columns)
  const cells: Record<string, Rect> = {}
  scene.plot.rows.forEach((row, rowIndex) => row.cells.forEach((cell, columnIndex) => {
    const center = centers[columnIndex], half = widths[columnIndex] / 2
    const start = Math.max(0, center - half), end = Math.min(1, center + half)
    cells[cell.id] = { x: plot.x + plot.width * start, y: plot.y + plot.height * rowIndex / rows, width: plot.width * (end - start), height: plot.height / rows }
  }))
  const rowRail = base.geometry.reservations['axis:row']
  const rowSide = scene.plot.rowAxis.placement.kind === 'side' ? scene.plot.rowAxis.placement.side : 'left'
  const rowLabelX = rowRail ? rowRail.x + (rowSide === 'right' && !outerAligned ? scene.plot.rowAxis.labels.gap : 0) : 0
  scene.plot.rows.forEach((row, rowIndex) => { if (rowRail) base.geometry.elements[`row-label:${row.id}`] = { x: rowLabelX, y: plot.y + plot.height * rowIndex / rows, width: rowLabelWidth, height: plot.height / rows } })
  let scale: ResolvedHeatmapGeometry['scale']
  const rail = guide ? base.geometry.reservations[`guide:${guide.id}`] : undefined
  if (guide?.visible && rail) scale = layoutColorScale(guide, plot, rail, scene.compatibilityConfig)
  return { ...scene, plot: { ...scene.plot, categoryAxis: base.plot.categoryAxis, rowAxis }, resolvedReservations: base.resolvedReservations, geometry: { ...base.geometry, axes: { ...base.geometry.axes, row: rowRail ?? { x: plot.x, y: plot.y, width: 0, height: plot.height } }, elements: { ...base.geometry.elements, ...cells }, heatmap: { cells, scale } } }
}
