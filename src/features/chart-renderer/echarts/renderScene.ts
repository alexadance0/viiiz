import type { ChartScene, NativeSlopeChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { renderNativeBarScene } from './renderBarScene'
import { renderNativePointScene } from './renderLineAreaScene'
import type { ResolvedNativeBarScene } from './renderBarScene'
import type { ResolvedPointScene } from './renderLineAreaScene'
import { resolveNativeSlopeScene } from '../../chart-types/slope/layout'
import { renderNativeSlopeScene } from './renderSlopeScene'

export function renderScene(scene: ChartScene | ResolvedScene): Record<string, unknown> {
  if (scene.migrationMode === 'legacy') return scene.legacyRendererPayload
  const resolved = 'geometry' in scene ? scene : scene.plot.kind === 'slope' ? resolveNativeSlopeScene(scene as NativeSlopeChartScene) : resolveNativeCartesianScene(scene)
  if (resolved.plot.kind === 'bar') return renderNativeBarScene(resolved as ResolvedNativeBarScene)
  if (resolved.plot.kind === 'line' || resolved.plot.kind === 'area') return renderNativePointScene(resolved as ResolvedPointScene)
  if (resolved.plot.kind === 'slope') return renderNativeSlopeScene(resolved as ReturnType<typeof resolveNativeSlopeScene>)
  return resolved.plot satisfies never
}
