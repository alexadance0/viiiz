import type { NativePieChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../bar/layout'

// Use the same measured headings, credits, legend and canvas spacing as the other families.
export function pieFrameScene(scene: NativePieChartScene) {
  const hiddenAxis = (id: string, orientation: 'horizontal' | 'vertical') => ({ id, channel: 'value' as const, orientation, placement: { kind: 'side' as const, side: orientation === 'horizontal' ? 'bottom' as const : 'left' as const }, line: { visible: false }, ticks: { visible: false, length: 0 }, labels: { visible: false, size: 0, gap: 0, style: scene.compatibilityConfig.axisLabelText } })
  return { ...scene, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: [], categoryAxis: { ...hiddenAxis('category', 'horizontal'), channel: 'category' as const }, valueAxis: hiddenAxis('value', 'vertical'), valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: scene.plot.slices.map((slice) => ({ id: slice.seriesId, name: slice.name, color: slice.color, visible: true, marks: [] })) } }
}

export function resolveNativePieScene(scene: NativePieChartScene): ResolvedScene & NativePieChartScene {
  const frame = resolveNativeCartesianScene(pieFrameScene(scene))
  return { ...scene, geometry: frame.geometry, resolvedReservations: frame.resolvedReservations }
}
