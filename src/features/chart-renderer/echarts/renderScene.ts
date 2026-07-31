import type { ChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { resolveNativeBarScene } from '../../chart-types/bar/layout'
import { renderNativeBarScene } from './renderBarScene'

export function renderScene(scene: ChartScene | ResolvedScene): Record<string, unknown> {
  if (scene.migrationMode === 'legacy') return scene.legacyRendererPayload
  return renderNativeBarScene('geometry' in scene ? scene : resolveNativeBarScene(scene))
}
