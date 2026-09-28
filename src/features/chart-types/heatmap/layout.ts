import { measureTextWidth } from '../../../core/textMetrics'
import type { NativeHeatmapChartScene, ResolvedHeatmapGeometry, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'
import type { LayoutReservation } from '../../chart-layout/reservations'
import { resolveNativeCartesianScene } from '../bar/layout'

export type ResolvedHeatmapScene = ResolvedScene & NativeHeatmapChartScene & { geometry: ResolvedScene['geometry'] & { heatmap: ResolvedHeatmapGeometry } }

export function resolveNativeHeatmapScene(scene: NativeHeatmapChartScene): ResolvedHeatmapScene {
  const rowStyle = scene.plot.rowAxis.labels.style
  const rowLabelWidth = scene.plot.rowAxis.labels.visible ? Math.ceil(Math.max(0, ...scene.plot.rows.map((row) => measureTextWidth(row.name, rowStyle.size, rowStyle.fontFamily, rowStyle.weight)))) : 0
  const outerAligned = scene.compatibilityConfig.categoryAxisLabelAlignment === 'outer'
  const rowWidth = rowLabelWidth ? rowLabelWidth + scene.plot.rowAxis.labels.gap + (outerAligned && scene.plot.rowAxis.ticks.visible ? scene.plot.rowAxis.ticks.length : 0) : 0
  const rowAxis = { ...scene.plot.rowAxis, labels: { ...scene.plot.rowAxis.labels, size: rowLabelWidth } }
  const reservations: LayoutReservation[] = []
  if (rowWidth && scene.plot.rowAxis.placement.kind === 'side') reservations.push({ id: 'axis:row', side: scene.plot.rowAxis.placement.side, size: rowWidth, gap: 0, mode: 'outside', priority: 50 })
  const guide = scene.guides.find((item) => item.kind === 'color-scale')
  if (guide?.visible) {
    const style = guide.style ?? scene.compatibilityConfig.legendText
    const vertical = guide.position === 'left' || guide.position === 'right'
    const labelWidth = Math.max(0, ...(guide.ticks ?? []).map((tick) => measureTextWidth(tick.label, style.size, style.fontFamily, style.weight)))
    const lineHeight = Math.round(style.size * style.lineHeight / 100)
    reservations.push({ id: `guide:${guide.id}`, side: guide.position, size: vertical ? Math.ceil(labelWidth + 40) : Math.ceil(lineHeight + 42), gap: guide.position === 'bottom' ? 12 : 0, mode: 'outside', priority: 40 })
  }
  const hiddenValueAxis = { ...rowAxis, id: 'value', channel: 'value' as const, labels: { ...rowAxis.labels, visible: false }, line: { visible: false }, ticks: { ...rowAxis.ticks, visible: false }, title: rowAxis.title ? { ...rowAxis.title, visible: false } : undefined }
  const fake = { ...scene, guides: [], plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: scene.plot.categories, categoryAxis: scene.plot.categoryAxis, valueAxis: hiddenValueAxis, valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: [] } }
  const base = resolveNativeCartesianScene(fake, reservations)
  const plot = base.geometry.plot, columns = Math.max(1, scene.plot.categories.length), rows = Math.max(1, scene.plot.rows.length)
  const cells: Record<string, Rect> = {}
  scene.plot.rows.forEach((row, rowIndex) => row.cells.forEach((cell, columnIndex) => { cells[cell.id] = { x: plot.x + plot.width * columnIndex / columns, y: plot.y + plot.height * rowIndex / rows, width: plot.width / columns, height: plot.height / rows } }))
  const rowRail = base.geometry.reservations['axis:row']
  const rowSide = scene.plot.rowAxis.placement.kind === 'side' ? scene.plot.rowAxis.placement.side : 'left'
  const rowLabelX = rowRail ? rowRail.x + (rowSide === 'right' && !outerAligned ? scene.plot.rowAxis.labels.gap : 0) : 0
  scene.plot.rows.forEach((row, rowIndex) => { if (rowRail) base.geometry.elements[`row-label:${row.id}`] = { x: rowLabelX, y: plot.y + plot.height * rowIndex / rows, width: rowLabelWidth, height: plot.height / rows } })
  let scale: ResolvedHeatmapGeometry['scale']
  const rail = guide ? base.geometry.reservations[`guide:${guide.id}`] : undefined
  if (guide?.visible && rail) {
    const vertical = guide.position === 'left' || guide.position === 'right'
    const horizontalWidth = Math.min(360, plot.width * .6)
    const verticalHeight = Math.min(plot.height, Math.max(90, Math.min(360, plot.height * .6)))
    const bar: Rect = vertical
      ? { x: guide.position === 'left' ? rail.x + 8 : rail.x + rail.width - 20, y: plot.y + (plot.height - verticalHeight) / 2, width: 12, height: verticalHeight }
      : { x: plot.x + (plot.width - horizontalWidth) / 2, y: guide.position === 'top' ? rail.y + rail.height - 20 : rail.y + 8, width: horizontalWidth, height: 12 }
    scale = { bar, ticks: (guide.ticks ?? []).map((tick) => vertical
      ? { x: guide.position === 'left' ? bar.x + bar.width + 8 : bar.x - 8, y: bar.y + bar.height * (1 - tick.offset), value: tick.value, label: tick.label, align: guide.position === 'left' ? 'left' : 'right', verticalAlign: 'middle' }
      : { x: bar.x + bar.width * tick.offset, y: guide.position === 'top' ? bar.y - 8 : bar.y + bar.height + 8, value: tick.value, label: tick.label, align: 'center', verticalAlign: guide.position === 'top' ? 'bottom' : 'top' }) }
  }
  return { ...scene, plot: { ...scene.plot, rowAxis }, resolvedReservations: base.resolvedReservations, geometry: { ...base.geometry, axes: { ...base.geometry.axes, row: rowRail ?? { x: plot.x, y: plot.y, width: 0, height: plot.height } }, elements: { ...base.geometry.elements, ...cells }, heatmap: { cells, scale } } }
}
