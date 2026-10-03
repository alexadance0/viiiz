import type { NativeChartScene, ResolvedScene } from '../../entities/chart/model/ChartScene'

/** Reuse the shared frame reservations without adding axes or data marks. */
export function nonCartesianFrame(scene: NativeChartScene | ResolvedScene) {
  const config = scene.compatibilityConfig, hiddenStyle = config.axisLabelText
  const hiddenAxis = (id: string, orientation: 'horizontal' | 'vertical') => ({ id, channel: 'value' as const, orientation, placement: { kind: 'side' as const, side: orientation === 'horizontal' ? 'bottom' as const : 'left' as const }, line: { visible: false }, ticks: { visible: false, length: 0 }, labels: { visible: false, size: 0, gap: 0, style: hiddenStyle } })
  return { ...scene, compatibilityConfig: { ...config, showLegend: false, showDirectLabels: false, showValues: false }, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'vertical' as const, stacking: 'none' as const, categories: [], categoryAxis: { ...hiddenAxis('category', 'horizontal'), channel: 'category' as const }, valueAxis: hiddenAxis('value', 'vertical'), valueDomain: { min: 0, max: 1, step: 1 }, barWidth: 100, seriesGap: 0, series: [] } }
}
