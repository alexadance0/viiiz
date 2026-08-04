import type { NativeIntervalChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import { renderCartesianPointBase, type ResolvedCartesianPointRenderModel } from './renderLineAreaScene'

export type ResolvedIntervalScene = NativeIntervalChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }

export function renderIntervalScene(scene: ResolvedIntervalScene): Record<string, unknown> {
  const visibleSeries = scene.plot.series.filter((series) => series.visible)
  const pointScene: ResolvedCartesianPointRenderModel = {
    ...scene,
    plot: {
      mode: 'line', stacking: 'none', categoryPlacement: scene.plot.categoryPlacement, categories: scene.plot.categories,
      categoryLabelPlan: scene.plot.categoryLabelPlan, categoryAxis: scene.plot.categoryAxis,
      valueAxis: scene.plot.valueAxis, valueDomain: scene.plot.valueDomain, series: visibleSeries,
    },
  }
  const option = renderCartesianPointBase(pointScene)
  const bands = scene.plot.bands.map((band) => ({
    id: band.id, name: `__interval-band:${band.id}`, type: 'custom', coordinateSystem: 'cartesian2d', silent: true,
    tooltip: { show: false }, clip: true, z: 0, data: band.cells.map((_cell, index) => index),
    renderItem: (params: { dataIndex: number; coordSys: { x: number; y: number; width: number; height: number } }, api: { coord(value: unknown[]): [number, number] }) => {
      const cell = band.cells[params.dataIndex]
      if (!cell) return null
      const from = scene.plot.categories[cell.fromCategoryIndex]?.coordinate
      const to = scene.plot.categories[cell.toCategoryIndex]?.coordinate
      const fromBottom = api.coord([from, cell.startBottom]), fromTop = api.coord([from, cell.startTop])
      const toBottom = api.coord([to, cell.endBottom]), toTop = api.coord([to, cell.endTop])
      const startX = fromBottom[0] + (toBottom[0] - fromBottom[0]) * cell.fromT
      const endX = fromBottom[0] + (toBottom[0] - fromBottom[0]) * cell.toT
      const clampX = (value: number) => Math.max(params.coordSys.x, Math.min(params.coordSys.x + params.coordSys.width, value))
      const clampY = (value: number) => Math.max(params.coordSys.y, Math.min(params.coordSys.y + params.coordSys.height, value))
      return { type: 'polygon', shape: { points: [[clampX(startX), clampY(fromTop[1])], [clampX(endX), clampY(toTop[1])], [clampX(endX), clampY(toBottom[1])], [clampX(startX), clampY(fromBottom[1])]] }, style: { fill: cell.fillColor, opacity: cell.fillOpacity } }
    },
  }))
  option.series = [...bands, ...(option.series as unknown[])]
  return option
}
