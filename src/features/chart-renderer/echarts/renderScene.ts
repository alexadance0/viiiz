import type { ChartScene, NativeSlopeChartScene, NativeXYChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
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

export function renderScene(scene: ChartScene | ResolvedScene): Record<string, unknown> {
  if (scene.migrationMode === 'legacy') return scene.legacyRendererPayload
  const resolved = 'geometry' in scene ? scene : scene.plot.kind === 'slope' ? resolveNativeSlopeScene(scene as NativeSlopeChartScene) : scene.plot.kind === 'xy' ? resolveNativeXYScene(scene as NativeXYChartScene) : resolveNativeCartesianScene(scene)
  if (resolved.plot.kind === 'bar') return renderNativeBarScene(resolved as ResolvedNativeBarScene)
  if (resolved.plot.kind === 'line' || resolved.plot.kind === 'area') return renderNativePointScene(resolved as ResolvedPointScene)
  if (resolved.plot.kind === 'smoothing') return renderSmoothingScene(resolved as ResolvedSmoothingScene)
  if (resolved.plot.kind === 'interval') return renderIntervalScene(resolved as ResolvedIntervalScene)
  if (resolved.plot.kind === 'slope') return renderNativeSlopeScene(resolved as ReturnType<typeof resolveNativeSlopeScene>)
  if (resolved.plot.kind === 'xy') return renderXYScene(resolved as ReturnType<typeof resolveNativeXYScene>)
  return resolved.plot satisfies never
}
