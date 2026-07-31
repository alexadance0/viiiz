import type { ChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'

export function renderScene(scene: ChartScene | ResolvedScene): Record<string, unknown> {
  return scene.rendererPayload as Record<string, unknown>
}
