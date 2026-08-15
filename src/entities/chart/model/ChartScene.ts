import type { ChartConfig, ChartTextStyle, DataValue, TimeProfile } from '../../../core/types'
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

declare const intervalGroupIdBrand: unique symbol
export type IntervalGroupId = string & { readonly [intervalGroupIdBrand]: 'IntervalGroupId' }

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

export interface IntervalBandCellScene {
  id: ElementId
  fromCategoryIndex: number
  toCategoryIndex: number
  fromT: number
  toT: number
  startBottom: number
  startTop: number
  endBottom: number
  endTop: number
  fillColor: string
  fillOpacity: number
  topBoundarySeriesId?: SeriesId
}

export interface IntervalBandScene {
  id: LayerId
  groupId: IntervalGroupId
  fill: { colorMode: 'resolved-per-cell'; opacity: number }
  interpolation: 'linear' | 'step-start' | 'step-end'
  cells: IntervalBandCellScene[]
}

export interface IntervalGroupScene {
  id: IntervalGroupId
  mainSeriesId?: SeriesId
  lowerSeriesId: SeriesId
  upperSeriesId: SeriesId
  bandLayerId: LayerId
  boundsVisible: boolean
  validPointCount: number
}

export interface CartesianIntervalPlotScene extends CartesianPointPlotScene {
  kind: 'interval'
  variant: 'range' | 'step-range' | 'confidence'
  series: LineSeriesScene[]
  groups: IntervalGroupScene[]
  bands: IntervalBandScene[]
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

export interface XYScaleSpec {
  type: 'linear' | 'log' | 'time'
  minimum?: number
  maximum?: number
  step?: number
  timeProfile?: TimeProfile
  dateLabelFormat?: ChartConfig['dateLabelFormat']
  automaticDomain: { minimum: number; maximum: number; step?: number }
}

export interface XYPointScene {
  type: 'xy-point'
  id: ElementId
  datumId: DatumId
  seriesId: SeriesId
  legacyKey: string
  x: number
  y: number
  sourceX: DataValue
  sourceY: number
  displayX: string
  displayY: string
  marker: { shape: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond'; size: number; fill: string; stroke: string; strokeWidth: number; opacity: number }
  label: { visible: boolean; text: string; position: 'top' | 'right' | 'bottom' | 'left'; style: ChartTextStyle; collision: 'shift-y-hide-overlap' }
  sizeValue?: number
  displaySizeValue?: string
  colorGroup?: string
}

export interface XYSeriesScene {
  id: SeriesId
  name: string
  yField: string
  colorGroup?: string
  color: string
  visible: boolean
  points: XYPointScene[]
}

export interface SizeEncodingSpec {
  field: string
  domain: { minimumMagnitude: number; maximumMagnitude: number }
  range: { minimumDiameter: number; maximumDiameter: number }
  scale: 'sqrt-absolute'
  missingDiameter: number
}

export interface XYConfidenceBandScene {
  id: LayerId
  sourceSeriesId: SeriesId
  fillColor: string
  fillOpacity: number
  samples: Array<{ x: number; lower: number; upper: number }>
}

export interface XYTrendLayerScene {
  id: LayerId
  kind: 'trend'
  sourceSeriesId: SeriesId
  regression: { slope: number; intercept: number }
  stroke: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted'; opacity: number }
  samples: Array<{ x: number; y: number }>
  confidenceBand?: XYConfidenceBandScene
}

export type XYReferenceLineScene = {
  id: LayerId
  kind: 'reference'
  axis: 'x' | 'y' | 'diagonal'
  value?: number
  segment?: [{ x: number; y: number }, { x: number; y: number }]
  stroke: { color: string; width: number; type: 'solid' | 'dashed' | 'dotted'; opacity: number }
}

export interface XYQuadrantLayerScene {
  id: LayerId
  kind: 'quadrants'
  xReference: number
  yReference: number
  regions: Array<{ position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'; xMinimum: number; xMaximum: number; yMinimum: number; yMaximum: number; fillColor: string; fillOpacity: number; label: string; labelStyle: ChartTextStyle }>
}

export interface CartesianXYPlotScene {
  kind: 'xy'
  variant: 'scatter' | 'bubble'
  xAxis: AxisSpec
  yAxis: AxisSpec
  xScale: XYScaleSpec
  yScale: XYScaleSpec
  series: XYSeriesScene[]
  sizeEncoding?: SizeEncodingSpec
  analyticalLayers: Array<XYTrendLayerScene | XYReferenceLineScene | XYQuadrantLayerScene>
}

declare const distributionGroupIdBrand: unique symbol
export type DistributionGroupId = string & { readonly [distributionGroupIdBrand]: 'DistributionGroupId' }
declare const distributionLaneIdBrand: unique symbol
export type DistributionLaneId = string & { readonly [distributionLaneIdBrand]: 'DistributionLaneId' }

export interface DistributionMarkerStyle {
  shape: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond'
  size: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
}

export interface DistributionObservationScene {
  id: ElementId
  datumId: DatumId
  groupId: DistributionGroupId
  legacyKey: string
  value: number
  sourceRowIndex: number
  sourceField: string
  displayValue: string
  displayLabel: string
  displayCategory: string
  marker: DistributionMarkerStyle
  label: { visible: boolean; text: string; position: 'top' | 'right' | 'bottom' | 'left'; style: ChartTextStyle }
}

export interface DistributionCountMarkScene {
  id: ElementId
  datumId: DatumId
  groupId: DistributionGroupId
  legacyKey: string
  value: number
  count: number
  sourceDatumIds: DatumId[]
  displayValue: string
  displayCategory: string
  displayLabel: string
  marker: DistributionMarkerStyle
  label: DistributionObservationScene['label']
}

export interface DistributionBarcodeMarkScene {
  id: ElementId
  datumId: DatumId
  groupId: DistributionGroupId
  legacyKey: string
  value: number
  displayValue: string
  displayCategory: string
  displayLabel: string
  stroke: { color: string; width: number; opacity: number }
  label: DistributionObservationScene['label']
}

export interface DistributionSummaryStats {
  count: number
  minimumInlier: number
  q1: number
  median: number
  mean: number
  q3: number
  maximumInlier: number
  outlierDatumIds: DatumId[]
}

export interface DistributionGroupScene {
  id: DistributionGroupId
  field: string
  categoryKey?: string
  categoryLabel?: string
  sourceSeriesName: string
  seriesKey: string
  displayName: string
  color: string
  laneId: DistributionLaneId
  subgroupIndex: number
  subgroupCount: number
  observations: DistributionObservationScene[]
  summary: DistributionSummaryStats
}

export interface DistributionLaneScene {
  id: DistributionLaneId
  index: number
  label: string
  groupIds: DistributionGroupId[]
}

export interface DistributionSummaryStyle { color: string; width: number; lengthRatio: number }
export interface DistributionDensityProfile { bandwidth: number; minimum: number; maximum: number; samples: Array<{ value: number; density: number; relativeDensity: number }>; peak: number; statisticDensity: { q1: number; median: number; q3: number } }
export interface DistributionBoxMarkScene {
  id: LayerId
  groupId: DistributionGroupId
  minimumInlier: number
  q1: number
  median: number
  q3: number
  maximumInlier: number
  boxStyle: { fillColor: string; fillOpacity: number; strokeColor: string; strokeWidth: number }
  whiskerStyle: { color: string; width: number }
  medianStyle: DistributionSummaryStyle & { visible: boolean }
  tooltip: { group: string; count: number; median: string; mean: string; quartiles: string }
}

export interface DistributionDensityLayerScene {
  kind: 'density'
  groups: Array<{
    id: LayerId
    groupId: DistributionGroupId
    mode: 'full' | 'half-first' | 'half-second' | 'ridge'
    profile: DistributionDensityProfile
    fill: { color: string; opacity: number }
    outline: { color: string; width: number }
    widthRatio: number
    summary: { mode: 'box' | 'lines' | 'ridge'; showWhiskers: boolean; showMedian: boolean; style: DistributionSummaryStyle; boxFill: string; boxThickness: number }
    tooltip: DistributionBoxMarkScene['tooltip']
  }>
}

export interface DistributionHistogramBinScene {
  id: ElementId
  datumId: DatumId
  groupId: DistributionGroupId
  index: number
  start: number
  end: number
  center: number
  amount: number
  sourceDatumIds: DatumId[]
  fill: { color: string; opacity: number; stroke: string; strokeWidth: number }
  label?: { text: string; style: ChartTextStyle }
  tooltip: { group: string; range: string; amount: number }
}

export interface DistributionFrequencySummaryScene {
  id: LayerId
  groupId: DistributionGroupId
  value: number
  amount: number
  color: string
  width: number
  lengthRatio: number
}

export interface DistributionHistogramLayerScene {
  kind: 'histogram'
  groups: Array<{ id: LayerId; groupId: DistributionGroupId; bins: DistributionHistogramBinScene[] }>
}

export interface DistributionKdeLayerScene {
  kind: 'kde'
  groups: Array<{ id: LayerId; groupId: DistributionGroupId; points: Array<{ value: number; density: number }>; stroke: { color: string; width: number }; fill: { color: string; opacity: number }; tooltip: { group: string } }>
}

export type DistributionLayerScene =
  | { kind: 'observations'; groups: Array<{ groupId: DistributionGroupId; marks: DistributionObservationScene[] }> }
  | { kind: 'counts'; groups: Array<{ groupId: DistributionGroupId; marks: DistributionCountMarkScene[] }> }
  | { kind: 'barcodes'; groups: Array<{ groupId: DistributionGroupId; marks: DistributionBarcodeMarkScene[] }> }
  | { kind: 'summaries'; marks: Array<{ id: ElementId; groupId: DistributionGroupId; value: number; visible: boolean; statistic: 'median' | 'mean'; color: string; width: number; lengthRatio: number }> }
  | { kind: 'boxes'; marks: DistributionBoxMarkScene[] }
  | DistributionHistogramLayerScene
  | DistributionKdeLayerScene
  | { kind: 'frequency-summaries'; marks: DistributionFrequencySummaryScene[] }
  | DistributionDensityLayerScene

export interface DistributionPlotScene {
  kind: 'distribution'
  variant: 'strip' | 'jitter' | 'beeswarm' | 'counts' | 'barcode' | 'box' | 'violin' | 'raincloud' | 'ridgeline' | 'histogram' | 'kde'
  orientation: 'horizontal' | 'vertical'
  layoutMode: 'measures' | 'categories'
  valueAxis: AxisSpec
  laneAxis: AxisSpec
  frequencyAxis?: AxisSpec
  valueDomain: { min: number; max: number; step: number }
  laneDomain: { min: number; max: number; interval: number }
  frequencyDomain?: { min: number; max: number; step: number }
  widthRatio: number
  jitterAmount: number
  lanes: DistributionLaneScene[]
  groups: DistributionGroupScene[]
  layers: DistributionLayerScene[]
  grid: { valueVisible: boolean; laneVisible: boolean; color: string; width: number; type: 'solid' | 'dashed' | 'dotted' }
}

export type NativePlotScene = CartesianBarPlotScene | CartesianLinePlotScene | CartesianAreaPlotScene | CartesianSlopePlotScene | CartesianSmoothingPlotScene | CartesianIntervalPlotScene | CartesianXYPlotScene | DistributionPlotScene

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
export type NativeIntervalChartScene = NativeChartScene & { plot: CartesianIntervalPlotScene }
export type NativeXYChartScene = NativeChartScene & { plot: CartesianXYPlotScene }
export type NativeDistributionChartScene = NativeChartScene & { plot: DistributionPlotScene }

export type ChartScene = LegacyChartScene | NativeChartScene

export interface ResolvedSceneGeometry {
  canvas: Rect
  content: Rect
  plot: Rect
  reservations: Record<string, Rect>
  axes: Record<string, Rect>
  elements: Record<ElementId, Rect>
  guides: Record<string, Rect>
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
