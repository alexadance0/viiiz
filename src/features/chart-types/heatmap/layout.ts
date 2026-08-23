import { measureTextWidth } from '../../../core/textMetrics'
import type { NativeHeatmapChartScene, ResolvedHeatmapGeometry, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import type { Rect } from '../../chart-layout/geometry'
import type { LayoutReservation } from '../../chart-layout/reservations'
import { resolveNativeCartesianScene } from '../bar/layout'

export type ResolvedHeatmapScene = ResolvedScene & NativeHeatmapChartScene & { geometry: ResolvedScene['geometry'] & { heatmap: ResolvedHeatmapGeometry } }

export function resolveNativeHeatmapScene(scene: NativeHeatmapChartScene): ResolvedHeatmapScene {
  const rowStyle = scene.plot.rowAxis.labels.style
  const rowWidth = scene.plot.rowAxis.labels.visible ? Math.ceil(Math.max(0, ...scene.plot.rows.map((row) => measureTextWidth(row.name, rowStyle.size, rowStyle.fontFamily, rowStyle.weight))) + scene.plot.rowAxis.labels.gap + (scene.plot.rowAxis.ticks.visible ? scene.plot.rowAxis.ticks.length : 0)) : 0
  const titleWidth = scene.plot.rowAxis.title?.visible && scene.plot.rowAxis.title.text ? scene.plot.rowAxis.title.size + scene.plot.rowAxis.title.gap : 0
  const reservations: LayoutReservation[] = []
  if (rowWidth + titleWidth && scene.plot.rowAxis.placement.kind === 'side') reservations.push({ id: 'axis:row', side: scene.plot.rowAxis.placement.side, size: rowWidth + titleWidth, gap: 0, mode: 'outside', priority: 50 })
  const guide = scene.guides.find((item) => item.kind === 'color-scale')
  if (guide?.visible) reservations.push({ id: `guide:${guide.id}`, side: guide.position, size: guide.position === 'left' || guide.position === 'right' ? 80 : 60, gap: 0, mode: 'outside', priority: 40 })
  const hiddenValueAxis = { ...scene.plot.rowAxis, id: 'value', channel: 'value' as const, labels: { ...scene.plot.rowAxis.labels, visible: false }, line: { visible: false }, ticks: { ...scene.plot.rowAxis.ticks, visible: false }, title: scene.plot.rowAxis.title ? { ...scene.plot.rowAxis.title, visible: false } : undefined }
  const fake = { ...scene, guides: [], plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: scene.plot.categories, categoryAxis: scene.plot.categoryAxis, valueAxis: hiddenValueAxis, valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: [] } }
  const base = resolveNativeCartesianScene(fake, reservations)
  const plot = base.geometry.plot, columns = Math.max(1, scene.plot.categories.length), rows = Math.max(1, scene.plot.rows.length)
  const cells: Record<string, Rect> = {}
  scene.plot.rows.forEach((row, rowIndex) => row.cells.forEach((cell, columnIndex) => { cells[cell.id] = { x: plot.x + plot.width * columnIndex / columns, y: plot.y + plot.height * rowIndex / rows, width: plot.width / columns, height: plot.height / rows } }))
  const rowRail = base.geometry.reservations['axis:row']
  scene.plot.rows.forEach((row, rowIndex) => { if (rowRail) base.geometry.elements[`row-label:${row.id}`] = { x: rowRail.x, y: plot.y + plot.height * rowIndex / rows, width: rowRail.width, height: plot.height / rows } })
  let scale: ResolvedHeatmapGeometry['scale']
  const rail = guide ? base.geometry.reservations[`guide:${guide.id}`] : undefined
  if (guide?.visible && rail) {
    const vertical = guide.position === 'left' || guide.position === 'right'
    const bar: Rect = vertical ? { x: guide.position === 'left' ? rail.x + 8 : rail.x + rail.width - 20, y: Math.max(plot.y, rail.y + 8), width: 12, height: Math.min(plot.height, Math.max(90, rail.height - 16)) } : { x: Math.max(plot.x, rail.x + (rail.width - Math.min(520, plot.width)) / 2), y: guide.position === 'top' ? rail.y + rail.height - 20 : rail.y + 24, width: Math.min(520, plot.width), height: 12 }
    scale = { bar, ticks: (guide.ticks ?? []).map((tick) => vertical ? { x: guide.position === 'left' ? bar.x + bar.width + 8 : bar.x - 8, y: bar.y + bar.height * (1 - tick.offset), value: tick.value, label: tick.label, align: guide.position === 'left' ? 'left' : 'right' } : { x: bar.x + bar.width * tick.offset, y: bar.y - 10, value: tick.value, label: tick.label, align: 'center' }) }
  }
  return { ...scene, resolvedReservations: base.resolvedReservations, geometry: { ...base.geometry, axes: { ...base.geometry.axes, row: rowRail ?? { x: plot.x, y: plot.y, width: 0, height: plot.height } }, elements: { ...base.geometry.elements, ...cells }, heatmap: { cells, scale } } }
}
