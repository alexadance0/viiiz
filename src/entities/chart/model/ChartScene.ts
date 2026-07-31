import type { ChartConfig, ChartTextStyle, DataValue } from '../../../core/types'
import type { AxisSpec } from '../../../features/chart-layout/axisLayout'
import type { Rect } from '../../../features/chart-layout/geometry'
import type { GuideSpec } from '../../../features/chart-layout/guides/types'
import type { ResolvedReservation } from '../../../features/chart-layout/reservations'
import type { ChartDocument } from './ChartDocument'
import type { ChartElement, DatumId, ElementId, SeriesId } from './ChartElement'

export interface ChartSceneBase {
  document: ChartDocument
  elements: ChartElement[]
}

export interface LegacyChartScene extends ChartSceneBase {
  migrationMode: 'legacy'
  legacyRendererPayload: Record<string, unknown>
}

export interface BarMarkScene {
  type: 'rect'
  id: ElementId
  datumId: DatumId
  seriesId: SeriesId
  legacyKey: string
  category: DataValue
  categoryIndex: number
  value: number | null
  displayCategory: string
  displayValue: string
  style: { color: string; opacity: number; borderColor: string; borderWidth: number; borderRadius: number; width?: number }
  label: { visible: boolean; text: string; style: ChartTextStyle; position: ChartConfig['valueLabelPosition']; autoContrast: boolean }
}

export interface BarSeriesScene {
  id: SeriesId
  name: string
  color: string
  visible: boolean
  marks: BarMarkScene[]
}

export interface CartesianBarPlotScene {
  kind: 'bar'
  orientation: 'vertical' | 'horizontal'
  stacking: 'none' | 'stacked' | 'normalized'
  categories: Array<{ id: DatumId; value: DataValue; label: string; coordinate: string }>
  categoryAxis: AxisSpec
  valueAxis: AxisSpec
  valueDomain: { min: number; max: number; step: number }
  barWidth: number
  seriesGap: number
  series: BarSeriesScene[]
}

export interface NativeChartScene extends ChartSceneBase {
  migrationMode: 'native'
  plot: CartesianBarPlotScene
  guides: GuideSpec[]
  frameElements: Array<{ id: ElementId; role: 'title' | 'subtitle' | 'note' | 'source'; text: string; style: ChartTextStyle }>
  /** Temporary presentation adapter until persisted ChartConfig is replaced by ChartDocument. */
  compatibilityConfig: ChartConfig
}

export type ChartScene = LegacyChartScene | NativeChartScene

export interface ResolvedSceneGeometry {
  canvas: Rect
  content: Rect
  plot: Rect
  reservations: Record<string, Rect>
  axes: Record<string, Rect>
  elements: Record<ElementId, Rect>
}

export type ResolvedScene =
  | (LegacyChartScene & { geometry: ResolvedSceneGeometry })
  | (NativeChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] })
