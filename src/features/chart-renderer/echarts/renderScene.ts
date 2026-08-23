import type { ChartScene, NativeButterflyChartScene, NativeComparisonStemChartScene, NativeDistributionChartScene, NativeHeatmapChartScene, NativeSlopeChartScene, NativeWaterfallChartScene, NativeXYChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { renderNativeBarScene } from './renderBarScene'
import { renderNativePointScene } from './renderLineAreaScene'
import type { ResolvedNativeBarScene } from './renderBarScene'
import type { ResolvedPointScene } from './renderLineAreaScene'
import { resolveNativeSlopeScene } from '../../chart-types/slope/layout'
import { renderNativeSlopeScene } from './renderSlopeScene'
import { renderSmoothingScene, type ResolvedSmoothingScene } from './renderSmoothingScene'
import { renderIntervalScene, type ResolvedIntervalScene } from './renderIntervalScene'
import { resolveNativeXYScene } from '../../chart-types/xy/layout'
import { renderXYScene } from './renderXYScene'
import { resolveNativeDistributionScene } from '../../chart-types/distribution/layout'
import { renderDistributionScene } from './renderDistributionScene'
import { resolveNativeComparisonStemScene } from '../../chart-types/comparison-stem/layout'
import { renderComparisonStemScene } from './renderComparisonStemScene'
import { resolveNativeWaterfallScene } from '../../chart-types/waterfall/layout'
import { renderWaterfallScene } from './renderWaterfallScene'
import { resolveNativeButterflyScene } from '../../chart-types/butterfly/layout'
import { renderButterflyScene } from './renderButterflyScene'
import { resolveNativeHeatmapScene } from '../../chart-types/heatmap/layout'
import { renderHeatmapScene } from './renderHeatmapScene'

export function renderScene(scene: ChartScene | ResolvedScene): Record<string, unknown> {
  if (scene.migrationMode === 'legacy') return scene.legacyRendererPayload
  const resolved = 'geometry' in scene ? scene : scene.plot.kind === 'slope' ? resolveNativeSlopeScene(scene as NativeSlopeChartScene) : scene.plot.kind === 'xy' ? resolveNativeXYScene(scene as NativeXYChartScene) : scene.plot.kind === 'distribution' ? resolveNativeDistributionScene(scene as NativeDistributionChartScene) : scene.plot.kind === 'comparison-stem' ? resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene) : scene.plot.kind === 'waterfall' ? resolveNativeWaterfallScene(scene as NativeWaterfallChartScene) : scene.plot.kind === 'butterfly' ? resolveNativeButterflyScene(scene as NativeButterflyChartScene) : scene.plot.kind === 'heatmap' ? resolveNativeHeatmapScene(scene as NativeHeatmapChartScene) : resolveNativeCartesianScene(scene)
  if (resolved.plot.kind === 'bar') return renderNativeBarScene(resolved as ResolvedNativeBarScene)
  if (resolved.plot.kind === 'line' || resolved.plot.kind === 'area') return renderNativePointScene(resolved as ResolvedPointScene)
  if (resolved.plot.kind === 'smoothing') return renderSmoothingScene(resolved as ResolvedSmoothingScene)
  if (resolved.plot.kind === 'interval') return renderIntervalScene(resolved as ResolvedIntervalScene)
  if (resolved.plot.kind === 'slope') return renderNativeSlopeScene(resolved as ReturnType<typeof resolveNativeSlopeScene>)
  if (resolved.plot.kind === 'xy') return renderXYScene(resolved as ReturnType<typeof resolveNativeXYScene>)
  if (resolved.plot.kind === 'distribution') return renderDistributionScene(resolved as ReturnType<typeof resolveNativeDistributionScene>)
  if (resolved.plot.kind === 'comparison-stem') return renderComparisonStemScene(resolved as ReturnType<typeof resolveNativeComparisonStemScene>)
  if (resolved.plot.kind === 'waterfall') return renderWaterfallScene(resolved as ReturnType<typeof resolveNativeWaterfallScene>)
  if (resolved.plot.kind === 'butterfly') return renderButterflyScene(resolved as ReturnType<typeof resolveNativeButterflyScene>)
  if (resolved.plot.kind === 'heatmap') return renderHeatmapScene(resolved as ReturnType<typeof resolveNativeHeatmapScene>)
  return resolved.plot satisfies never
}
