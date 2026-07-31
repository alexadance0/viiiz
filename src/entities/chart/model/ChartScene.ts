import type { ChartElement } from './ChartElement'
import type { ChartDocument } from './ChartDocument'
import type { Rect } from '../../../features/chart-layout/geometry'

export interface ChartScene {
  document: ChartDocument
  elements: ChartElement[]
  rendererPayload: unknown
}

export interface ResolvedScene extends ChartScene {
  geometry: { canvas: Rect; content: Rect; plot: Rect }
}
