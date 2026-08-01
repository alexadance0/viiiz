import type { ChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { renderNativeBarScene } from './renderBarScene'
import { renderNativePointScene } from './renderLineAreaScene'
import type { ResolvedNativeBarScene } from './renderBarScene'
import type { ResolvedPointScene } from './renderLineAreaScene'

export function renderScene(scene: ChartScene | ResolvedScene): Record<string, unknown> {
  if (scene.migrationMode === 'legacy') return scene.legacyRendererPayload
  const resolved = 'geometry' in scene ? scene : resolveNativeCartesianScene(scene)
  if (resolved.plot.kind === 'bar') return renderNativeBarScene(resolved as ResolvedNativeBarScene)
  if (resolved.plot.kind === 'line' || resolved.plot.kind === 'area') return renderNativePointScene(resolved as ResolvedPointScene)
  return resolved.plot satisfies never
}
