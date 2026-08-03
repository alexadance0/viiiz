import type { NativeChartScene, NativeSmoothingChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import { renderNativePointScene, type ResolvedPointScene } from './renderLineAreaScene'

export type ResolvedSmoothingScene = NativeSmoothingChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }

export function renderSmoothingScene(scene: ResolvedSmoothingScene): Record<string, unknown> {
  const pointScene: ResolvedPointScene = {
    ...scene,
    plot: {
      kind: 'line', categoryPlacement: scene.plot.categoryPlacement, categories: scene.plot.categories,
      categoryLabelPlan: scene.plot.categoryLabelPlan, categoryAxis: scene.plot.categoryAxis,
      valueAxis: scene.plot.valueAxis, valueDomain: scene.plot.valueDomain, series: scene.plot.layers,
    },
  } as NativeChartScene as ResolvedPointScene
  const option = renderNativePointScene(pointScene)
  const layers = new Map<string, (typeof scene.plot.layers)[number]>(scene.plot.layers.map((layer) => [layer.id, layer]))
  option.series = (option.series as Array<Record<string, unknown>>).map((series) => {
    const layer = layers.get(String(series.id ?? ''))
    if (!layer) return series
    return {
      ...series,
      type: layer.renderMode === 'points' ? 'scatter' : 'line',
      showSymbol: layer.renderMode === 'points',
      lineStyle: { ...(series.lineStyle as object), opacity: layer.stroke.opacity },
      itemStyle: { ...(series.itemStyle as object), opacity: layer.role === 'raw' ? layer.presentation?.opacity ?? 1 : 1 },
    }
  })
  return option
}
