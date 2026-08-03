import type { ChartConfig, ChartTextStyle, DataValue } from '../../../core/types'
import type { ChangeDescriptor } from '../../../core/changeSemantics'
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
  categoryPlacement: 'band'
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

export interface CartesianPointScene {
  type: 'point'
  id: ElementId
  datumId: DatumId
  seriesId: SeriesId
  legacyKey: string
  category: DataValue
  categoryIndex: number
  value: number | null
  displayCategory: string
  displayValue: string
  marker: { visible: boolean; shape: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond'; size: number; fill: string; stroke: string; strokeWidth: number }
  label: { visible: boolean; text: string; style: ChartTextStyle; position: NonNullable<ChartConfig['valueLabelPosition']> }
}

export interface LineSegmentScene {
  id: ElementId
  from: DatumId
  to: DatumId
  fromIndex: number
  toIndex: number
  stroke: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted'; opacity: number }
}

interface CartesianPointSeriesScene {
  id: SeriesId
  name: string
  color: string
  visible: boolean
  interpolation: 'linear' | 'spline' | 'step-start' | 'step-end'
  missing: 'gap' | 'zero' | 'connect'
  stroke: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted'; opacity: number }
  marker: { visible: boolean; shape: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond'; size: number; fill: string; stroke: string; strokeWidth: number }
  points: CartesianPointScene[]
  presentation?: { opacity?: number; emphasis?: 'normal' | 'accent' | 'muted'; layerPriority?: number }
}

export interface LineSeriesScene extends CartesianPointSeriesScene {
  segments: LineSegmentScene[]
}

export interface AreaSeriesScene extends CartesianPointSeriesScene {
  fill: { color: string; opacity: number }
}

interface CartesianPointPlotScene {
  categoryPlacement: 'point'
  categories: Array<{ id: DatumId; value: DataValue; label: string; coordinate: string }>
  categoryLabelPlan: { interval: 'auto' | number | ((index: number) => boolean); fontSize: number; rotation: number; hideOverlap: boolean; showMaxLabel?: boolean }
  categoryAxis: AxisSpec
  valueAxis: AxisSpec
  valueDomain: { min: number; max: number; step: number }
}

declare const layerIdBrand: unique symbol
export type LayerId = string & { readonly [layerIdBrand]: 'LayerId' }

export interface SmoothingPointScene extends CartesianPointScene {
  layerId: LayerId
  role: 'observed' | 'derived'
  editable: boolean
  provenance: {
    transform: 'moving-average'
    sourceSeriesId: SeriesId
    sourceDatumId: DatumId
    window: number
  }
}

export interface SmoothingLayerScene extends Omit<LineSeriesScene, 'id' | 'points'> {
  id: LayerId
  sourceSeriesId: SeriesId
  role: 'raw' | 'average'
  renderMode: 'line' | 'points'
  points: SmoothingPointScene[]
}

export interface SmoothingSourceGroupScene {
  sourceSeriesId: SeriesId
  sourceName: string
  color: string
  rawLayerId: LayerId
  averageLayerId: LayerId
}

export interface CartesianSmoothingPlotScene extends CartesianPointPlotScene {
  kind: 'smoothing'
  variant: 'moving-average-line' | 'moving-average-scatter'
  window: number
  sourceGroups: SmoothingSourceGroupScene[]
  layers: SmoothingLayerScene[]
}

export interface CartesianLinePlotScene extends CartesianPointPlotScene {
  kind: 'line'
  series: LineSeriesScene[]
}

export interface CartesianAreaPlotScene extends CartesianPointPlotScene {
  kind: 'area'
  stacking: 'none' | 'stacked' | 'normalized'
  series: AreaSeriesScene[]
}

export interface SlopePositionScene {
  id: DatumId
  value: DataValue
  label: string
  coordinate: string
  ordinal: 'start' | 'end'
}

export interface SlopeChangeScene {
  descriptor: ChangeDescriptor
  showLabel: boolean
  label: string
  labelPosition: 'start' | 'middle' | 'end'
  colorByDirection: boolean
  resolvedColor: string
}

export interface SlopeSeriesScene {
  id: SeriesId
  name: string
  color: string
  visible: boolean
  stroke: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted'; opacity: number }
  marker: { visible: true; shape: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond'; size: number; fill: string; stroke: string; strokeWidth: number }
  points: [CartesianPointScene, CartesianPointScene]
  change?: SlopeChangeScene
}

export interface SlopeEndpointLabelScene {
  id: ElementId
  pointId: ElementId
  seriesId: SeriesId
  side: 'left' | 'right'
  valueText?: string
  seriesText?: string
  color: string
  style: ChartTextStyle
}

export interface CartesianSlopePlotScene {
  kind: 'slope'
  positions: [SlopePositionScene, SlopePositionScene]
  series: SlopeSeriesScene[]
  valueDomain: { min: number; max: number; step: number }
  categoryAxis: AxisSpec
  valueAxis: AxisSpec
  guides: {
    horizontal: boolean
    vertical: boolean
    xAxisLine: boolean
    internalValueLabels: boolean
    grid: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted' }
    axisLine: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted' }
  }
  endpointLabels: { distance: number; collision: 'shift-y'; hideOverlap: false; items: SlopeEndpointLabelScene[] }
}

export type NativePlotScene = CartesianBarPlotScene | CartesianLinePlotScene | CartesianAreaPlotScene | CartesianSlopePlotScene | CartesianSmoothingPlotScene

export interface NativeChartScene extends ChartSceneBase {
  migrationMode: 'native'
  plot: NativePlotScene
  guides: GuideSpec[]
  frameElements: Array<{ id: ElementId; role: 'title' | 'subtitle' | 'note' | 'source'; text: string; style: ChartTextStyle }>
  /** Temporary presentation adapter until persisted ChartConfig is replaced by ChartDocument. */
  compatibilityConfig: ChartConfig
}

export type NativeBarChartScene = NativeChartScene & { plot: CartesianBarPlotScene }
export type NativeLineChartScene = NativeChartScene & { plot: CartesianLinePlotScene }
export type NativeAreaChartScene = NativeChartScene & { plot: CartesianAreaPlotScene }
export type NativeSlopeChartScene = NativeChartScene & { plot: CartesianSlopePlotScene }
export type NativeSmoothingChartScene = NativeChartScene & { plot: CartesianSmoothingPlotScene }

export type ChartScene = LegacyChartScene | NativeChartScene

export interface ResolvedSceneGeometry {
  canvas: Rect
  content: Rect
  plot: Rect
  reservations: Record<string, Rect>
  axes: Record<string, Rect>
  elements: Record<ElementId, Rect>
}

export interface ResolvedSlopeGeometry {
  firstX: number
  lastX: number
  guideLeft: number
  guideRight: number
  axisY: number
  leftEndpointLabelRail?: Rect
  rightEndpointLabelRail?: Rect
  valueScaleLabelRail?: Rect
  endpointLabels: Record<ElementId, ResolvedSlopeEndpointLabelPlacement>
  changeLabels: Record<SeriesId, ResolvedSlopeChangeLabelPlacement>
}

export interface ResolvedSlopeEndpointLabelPlacement {
  id: ElementId
  pointId: ElementId
  seriesId: SeriesId
  side: 'left' | 'right'
  anchorX: number
  anchorY: number
  x: number
  y: number
  width: number
  height: number
  displacementY: number
  leaderRequired: boolean
}

export interface ResolvedSlopeChangeLabelPlacement {
  seriesId: SeriesId
  anchorX: number
  anchorY: number
  x: number
  y: number
  width: number
  height: number
  color: string
  text: string
}

export type ResolvedScene =
  | (LegacyChartScene & { geometry: ResolvedSceneGeometry })
  | (NativeChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] })
export type ResolvedNativeChartScene = NativeChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
