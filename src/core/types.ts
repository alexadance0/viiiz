export type DataValue = string | number | boolean | Date | null
export type DataRow = Record<string, DataValue>

export interface DataTable {
  name: string
  columns: string[]
  rows: DataRow[]
  importWarnings?: string[]
  rawRows?: DataRow[]
  normalizations?: Record<string, NormalizationSummary>
  observationFlags?: Record<string, Record<number, string[]>>
  timeProfiles?: Record<string, TimeProfile>
  dateRules?: Record<string, DateParseRule>
  imputedCells?: Record<string, Record<number, ImputationInfo>>
}

export interface ImputationInfo {
  method: 'linear' | 'forward' | 'seasonal' | 'empty'
  generatedPeriod: boolean
}

export interface DateParseRule {
  format: string
  twoDigitYearPivot: number
  invalid: 'keep' | 'null'
}

export type TimeFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'irregular'
export interface TimeProfile {
  frequency: TimeFrequency
  label: string
  confidence: number
  source: 'notation' | 'intervals'
}

export interface NormalizationSummary {
  kind: 'number' | 'date' | 'boolean' | 'missing'
  format: string
  confidence: number
  converted: number
  ambiguous: number
}

export type ColumnType = 'text' | 'number' | 'date' | 'boolean'
export type IssueSeverity = 'info' | 'warning' | 'critical'

export interface DataIssue {
  column: string
  severity: IssueSeverity
  message: string
  count: number
  kind?: 'import' | 'missing' | 'invalid' | 'ambiguous' | 'quality-flag' | 'duplicate' | 'time-gap'
  examples?: string[]
}

export type ChartKind = 'bar' | 'stacked-bar' | 'normalized-stacked-bar' | 'waterfall'
  | 'horizontal-bar' | 'butterfly' | 'horizontal-stacked-bar' | 'horizontal-normalized-stacked-bar'
  | 'lollipop' | 'horizontal-lollipop' | 'dumbbell'
  | 'line' | 'spline' | 'step-line' | 'indexed-line' | 'seasonal-line' | 'slope' | 'range-line' | 'step-range-line' | 'confidence-line'
  | 'moving-average-line' | 'moving-average-scatter' | 'heatmap' | 'treemap'
  | 'area' | 'stacked-area' | 'normalized-stacked-area' | 'scatter' | 'bubble'
  | 'boxplot' | 'violinplot' | 'raincloud' | 'histogram' | 'kde-plot' | 'ridgeline' | 'beeswarm' | 'strip-plot' | 'jitter-plot' | 'counts-plot' | 'barcode-plot'
export interface ChartTextStyle {
  fontFamily: string
  size: number
  color: string
  weight: number
  italic: boolean
  lineHeight: number
  align: 'left' | 'center' | 'right'
}
export type MarkerShape = 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond'
export interface MarkerStyle { showMarker?: boolean; markerShape?: MarkerShape; markerSize?: number; markerFill?: string; markerBorder?: string; markerBorderWidth?: number }
export type TreemapLabelPosition = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
export interface ChartElementStyle extends MarkerStyle { color?: string; fillOpacity?: number; borderColor?: string; borderWidth?: number; barWidth?: number; showLabel?: boolean; showName?: boolean; showValue?: boolean; labelAutoContrast?: boolean; label?: string; labelPosition?: 'top' | 'right' | 'bottom' | 'left'; waterfallLabelPosition?: ChartConfig['valueLabelPosition']; treemapLabelPosition?: TreemapLabelPosition; valueText?: ChartTextStyle; lineWidth?: number; lineType?: 'solid' | 'dashed' | 'dotted' }
export interface ChartSeriesStyle extends MarkerStyle {
  color?: string
  fillOpacity?: number
  borderColor?: string
  borderWidth?: number
  barWidth?: number
  lineWidth?: number
  lineType?: 'solid' | 'dashed' | 'dotted'
  legendLabel?: string
  showLegendItem?: boolean
  legendNote?: string
  showDirectLabel?: boolean
  directLabelText?: ChartTextStyle
  showLegendLine?: boolean
  scatterTrendline?: boolean
  scatterTrendBand?: boolean
  scatterTrendColor?: string
  scatterTrendWidth?: number
  scatterTrendType?: 'solid' | 'dashed' | 'dotted'
  scatterTrendBandOpacity?: number
  distributionSummaryColor?: string
  distributionSummaryWidth?: number
  distributionSummaryLength?: number
}
export interface LegendItemOverride { label?: string; visible?: boolean }
export interface ChartElementSelection { key: string; seriesName: string; category: string; value: string; label?: string; color?: string; target?: 'element' | 'value-label' | 'category-label'; axis?: 'x' | 'y' }
export interface ChartSeriesSelection { name: string; color: string }
export interface AnnotationFragment { id: string; text: string; color: string; bold: boolean; italic: boolean; underline?: boolean; backgroundColor?: string }
export interface ChartAnnotation {
  id: string
  x: number
  y: number
  width: number
  height?: number
  fontFamily: string
  fontSize: number
  backgroundColor: string
  borderColor: string
  textStrokeColor?: string
  textStrokeWidth?: number
  textAlign: 'left' | 'center' | 'right'
  fragments: AnnotationFragment[]
  html?: string
}
export interface ChartDecoration {
  id: string
  type: 'area' | 'line' | 'horizontal-line' | 'vertical-line' | 'arrow' | 'curved-line'
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  lineWidth: number
  lineType: 'solid' | 'dashed' | 'dotted'
  endArrow?: boolean
  arrowPlacement?: 'none' | 'start' | 'end' | 'both'
  arrowHead?: 'open' | 'filled' | 'circle' | 'bar'
  curvature?: number
  fitToPlot?: boolean
  fitToPlotWidth?: boolean
}

export interface ChartConfig {
  customFonts?: Array<{ name: string; dataUrl: string; fileName?: string; weight?: number; style?: 'normal' | 'italic' }>
  paletteName?: string
  palette?: string[]
  paletteBaseColor?: string
  paletteGradientColors?: [string, string, string]
  canvasPreset?: 'square' | 'portrait' | 'presentation-wide' | 'presentation-standard' | 'custom'
  canvasWidth?: number
  canvasHeight?: number
  canvasBackground?: string
  autoFitCanvas?: boolean
  canvasMarginTop?: number
  canvasMarginRight?: number
  canvasMarginBottom?: number
  canvasMarginLeft?: number
  titleSubtitleGap?: number
  headerPlotGap?: number
  headerLegendGap?: number
  legendPlotGap?: number
  plotFooterGap?: number
  noteSourceGap?: number
  kind: ChartKind
  xField: string
  /** Two X positions shown by a slope chart. Values use `slopePositionKey`. */
  slopeXValues?: string[]
  yField: string
  yFields: string[]
  seriesField: string
  aggregation: 'none' | 'sum' | 'average' | 'min' | 'max' | 'count'
  valueMode: 'absolute' | 'percent'
  missingMode: 'gap' | 'zero' | 'connect'
  title: string
  subtitle: string
  note: string
  source: string
  titleHtml?: string
  subtitleHtml?: string
  noteHtml?: string
  sourceHtml?: string
  showTitle?: boolean
  showSubtitle?: boolean
  showNote?: boolean
  showSource?: boolean
  titleText: ChartTextStyle
  subtitleText: ChartTextStyle
  axisTitleText: ChartTextStyle
  axisLabelText: ChartTextStyle
  xAxisTitleText?: ChartTextStyle
  yAxisTitleText?: ChartTextStyle
  xAxisLabelText?: ChartTextStyle
  yAxisLabelText?: ChartTextStyle
  legendText: ChartTextStyle
  valueText: ChartTextStyle
  noteText: ChartTextStyle
  sourceText: ChartTextStyle
  showValues: boolean
  numberLocale?: 'ru-RU' | 'en-US'
  numberDecimals?: number | null
  numberOperation?: 'none' | 'divide' | 'multiply'
  numberFactor?: number
  numberPrefix?: string
  numberSuffix?: string
  yAxisAffixScope?: 'all' | 'first' | 'last' | 'edges'
  xAxisNumberPrefix?: string
  xAxisNumberSuffix?: string
  xAxisAffixScope?: 'all' | 'first' | 'last' | 'edges'
  valueLabelAffixesLinked?: boolean
  valueLabelPrefix?: string
  valueLabelSuffix?: string
  numberGrouping?: boolean
  numberZeroLabel?: string
  /** @deprecated Use xAxisNumberPrefix/xAxisNumberSuffix for every numeric X tick. */
  xAxisStartLabel?: string
  /** @deprecated Use xAxisNumberPrefix/xAxisNumberSuffix for every numeric X tick. */
  xAxisEndLabel?: string
  valueLabelPosition?: 'auto' | 'top' | 'inside-top' | 'inside-center' | 'inside-bottom' | 'bottom'
  valueLabelAutoContrast?: boolean
  valueLabelHideOverlap?: boolean
  barValueLabelAbsorption?: boolean
  barValueLabelInsidePosition?: 'start' | 'center' | 'end'
  barValueLabelOutsidePosition?: 'start' | 'end'
  barValueLabelAbsorptionPadding?: number
  barCategorySort?: 'none' | 'value-asc' | 'value-desc' | 'name-asc' | 'name-desc'
  barCategorySortSeries?: string
  waterfallShowTotal?: boolean
  waterfallTotalLabel?: string
  waterfallIncreaseColor?: string
  waterfallDecreaseColor?: string
  waterfallTotalColor?: string
  waterfallConnectorColor?: string
  waterfallLabelContent?: 'change' | 'cumulative' | 'both'
  waterfallSignMode?: 'negative-only' | 'plus-minus' | 'none' | 'custom'
  waterfallPositivePrefix?: string
  waterfallNegativePrefix?: string
  waterfallShowTotalValue?: boolean
  waterfallLabelGap?: number
  xAxisTitle: string
  yAxisTitle: string
  xAxisTitleGap: number
  yAxisTitleGap: number
  xAxisLabelGap?: number
  yAxisLabelGap?: number
  xAxisPosition: 'top' | 'bottom'
  yAxisPosition: 'left' | 'right'
  xAxisMin?: string
  xAxisMax?: string
  xAxisStep?: number | null
  dateAxisStepUnit?: 'auto' | 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'
  dateAxisAnchor?: string
  yAxisMin?: number | null
  yAxisMax?: number | null
  yAxisStep?: number | null
  dateLabelFormat?: DateLabelFormat
  showXAxisTitle: boolean
  showYAxisTitle: boolean
  showXAxisLabels?: boolean
  showYAxisLabels?: boolean
  showXAxisLine: boolean
  showYAxisLine: boolean
  axisLineColor: string
  axisLineWidth: number
  axisLineType: 'solid' | 'dashed' | 'dotted'
  showXTicks: boolean
  showYTicks: boolean
  tickLength: number
  elementStyles: Record<string, ChartElementStyle>
  seriesStyles: Record<string, ChartSeriesStyle>
  seriesOrder?: string[]
  annotations: ChartAnnotation[]
  decorations?: ChartDecoration[]
  color: string
  barFillColor?: string
  barWidth?: number
  barFillOpacity?: number
  barBorderColor?: string
  barBorderWidth?: number
  barBorderRadius?: number
  barSeriesGap?: number
  barOrientation?: 'vertical' | 'horizontal'
  butterflyLeftFields?: string[]
  butterflyRightFields?: string[]
  butterflyCategoryPosition?: 'center' | 'left' | 'right'
  categoryAxisInverse?: boolean
  areaFillOpacity?: number
  stepPosition?: 'start' | 'end'
  intervalFillOpacity?: number
  /** Use the colour of the boundary that is above, or one chosen colour for the whole interval. */
  intervalFillMode?: 'by-bound' | 'custom'
  intervalFillColor?: string
  rangeLowerField?: string
  rangeUpperField?: string
  dumbbellStartField?: string
  dumbbellEndField?: string
  dumbbellOrientation?: 'vertical' | 'horizontal'
  dumbbellShowDifference?: boolean
  dumbbellDifferenceFormat?: 'absolute' | 'percent'
  dumbbellDifferencePosition?: 'start' | 'middle' | 'end'
  dumbbellPercentDecimals?: number
  dumbbellShowStartValue?: boolean
  dumbbellShowEndValue?: boolean
  dumbbellConnectorColor?: string
  dumbbellConnectorWidth?: number
  dumbbellConnectorOpacity?: number
  dumbbellConnectorType?: 'solid' | 'dashed' | 'dotted'
  dumbbellColorByChange?: boolean
  dumbbellIncreaseColor?: string
  dumbbellDecreaseColor?: string
  dumbbellNeutralColor?: string
  dumbbellSort?: 'none' | 'difference' | 'start' | 'end'
  dumbbellSortDirection?: 'asc' | 'desc'
  slopeShowValues?: boolean
  slopeShowSeriesNames?: boolean
  slopeShowYAxis?: boolean
  indexBaseXValue?: string
  seasonalAccentYears?: string[]
  seasonalMutedColor?: string
  seasonalMutedOpacity?: number
  movingAverageWindow?: number
  movingAverageRawOpacity?: number
  heatmapYField?: string
  heatmapLowColor?: string
  heatmapMidColor?: string
  heatmapHighColor?: string
  heatmapScaleMode?: 'sequential' | 'diverging'
  heatmapMidpoint?: number
  heatmapShowScale?: boolean
  heatmapScalePosition?: 'right' | 'left' | 'top' | 'bottom'
  heatmapScaleMin?: number | null
  heatmapScaleMax?: number | null
  heatmapCellGap?: number
  heatmapRowSort?: 'none' | 'average' | 'min' | 'max' | 'last'
  heatmapRowSortDirection?: 'ascending' | 'descending'
  heatmapMissingColor?: string
  heatmapMissingLabel?: string
  treemapSubcategoryField?: string
  treemapGap?: number
  treemapGroupGap?: number
  treemapShowGroupLabels?: boolean
  treemapShowLeafLabels?: boolean
  treemapShowGroupValues?: boolean
  treemapShowLeafValues?: boolean
  treemapGroupLabelPosition?: TreemapLabelPosition
  treemapLabelPosition?: TreemapLabelPosition
  treemapGroupText?: ChartTextStyle
  treemapLeafText?: ChartTextStyle
  treemapGroupOrder?: string[]
  treemapLeafOrder?: Record<string, string[]>
  treemapHiddenCategories?: string[]
  treemapValueFormat?: 'absolute' | 'percent'
  intervalGroups?: Array<{ main: string; lower: string; upper: string; showBounds?: boolean }>
  scatterLabelField?: string
  scatterSizeField?: string
  scatterColorField?: string
  scatterPointSize?: number
  scatterSizeMin?: number
  scatterSizeMax?: number
  scatterSizeLegend?: boolean
  scatterSizeLegendTitle?: string
  scatterSizeLegendPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  scatterOpacity?: number
  scatterBorderWidth?: number
  scatterHollow?: boolean
  scatterShowLabels?: boolean
  scatterLabelPosition?: 'top' | 'right' | 'bottom' | 'left'
  distributionLabelField?: string
  distributionShowLabels?: boolean
  distributionLabelPosition?: 'top' | 'right' | 'bottom' | 'left'
  scatterTrendline?: boolean
  scatterTrendColor?: string
  scatterTrendWidth?: number
  scatterTrendType?: 'solid' | 'dashed' | 'dotted'
  scatterTrendBand?: boolean
  scatterTrendBandOpacity?: number
  scatterXReference?: number | null
  scatterYReference?: number | null
  scatterReferenceColor?: string
  scatterReferenceWidth?: number
  scatterReferenceType?: 'solid' | 'dashed' | 'dotted'
  scatterQuadrants?: boolean
  scatterQuadrantColors?: [string, string, string, string]
  scatterQuadrantLabels?: [string, string, string, string]
  distributionGroupField?: string
  distributionLayoutMode?: 'measures' | 'categories'
  distributionCategoryOrder?: string[]
  distributionCategoryStyles?: Record<string, { color?: string; label?: string; visible?: boolean }>
  distributionOrientation?: 'horizontal' | 'vertical'
  distributionPointSize?: number
  distributionPointOpacity?: number
  distributionTickWidth?: number
  distributionJitter?: number
  distributionWidth?: number
  distributionBandwidth?: number
  distributionViolinMode?: 'full' | 'half' | 'split'
  distributionViolinSummaryMode?: 'box' | 'lines'
  distributionViolinShowWhiskers?: boolean
  distributionViolinHalfSide?: 'first' | 'second'
  distributionViolinSplitFirst?: string
  distributionViolinSplitSecond?: string
  distributionRaincloudPointMode?: 'overlay' | 'separate'
  distributionShowPoints?: boolean
  distributionShowAllPoints?: boolean
  distributionShowMedian?: boolean
  distributionSummaryStatistic?: 'median' | 'mean'
  distributionSummaryWidth?: number
  distributionSummaryLength?: number
  distributionShowOutliers?: boolean
  distributionBinCount?: number
  distributionHistogramMin?: number | null
  distributionHistogramMax?: number | null
  distributionHistogramLabels?: 'none' | 'count' | 'range'
  distributionHistogramRangeDecimals?: number
  distributionDensityFillOpacity?: number
  distributionRidgelineOverlap?: number
  scatterDiagonal?: boolean
  scatterDiagonalColor?: string
  scatterDiagonalWidth?: number
  scatterDiagonalType?: 'solid' | 'dashed' | 'dotted'
  axisTitleMode?: 'standard' | 'editorial'
  showLegend: boolean
  legendPosition?: 'top' | 'bottom' | 'left' | 'right'
  legendItemOverrides?: Record<string, LegendItemOverride>
  showDirectLabels?: boolean
  directLabelText?: ChartTextStyle
  directLabelGap?: number
  showDirectLabelLines?: boolean
  directLabelLineWidth?: number
  directLabelLineType?: 'solid' | 'dashed' | 'dotted'
  showHorizontalGrid: boolean
  showVerticalGrid: boolean
  gridColor: string
  gridWidth: number
  gridType: 'solid' | 'dashed' | 'dotted'
  yAxisScaleType?: 'linear' | 'log'
  showZeroLine?: boolean
  zeroLineColor?: string
  zeroLineWidth?: number
  zeroLineType?: 'solid' | 'dashed' | 'dotted'
  xAxisLabelRotate?: 0 | 30 | 45 | 60 | 90 | 'auto'
  xAxisLabelOverflow?: 'auto' | 'wrap' | 'truncate'
  categoryLabelOverrides?: { x?: Record<string, string>; y?: Record<string, string> }
  legendMarker?: 'auto' | 'circle' | 'square' | 'line' | 'diamond' | 'triangle'
}

export type DateLabelFormat = 'auto' | 'year-full' | 'year-short' | 'year-first-full'
  | 'half-only' | 'half-only-ru' | 'half-year-en' | 'year-half-en' | 'half-year-ru' | 'year-half-ru'
  | 'quarter-only' | 'quarter-only-ru' | 'quarter-year' | 'year-quarter' | 'quarter-year-en' | 'year-quarter-en' | 'quarter-context-en' | 'quarter-context-ru'
  | 'month-year' | 'month-short-year' | 'year-month' | 'month-only-ru' | 'month-full-ru' | 'month-number' | 'month-number-year' | 'month-only-en' | 'month-en-year' | 'year-month-en' | 'year-month-ru' | 'month-context-ru' | 'month-context-en'
  | 'day-month' | 'day-month-year' | 'date-dmy-slash' | 'date-mdy-slash' | 'date-dmy-en' | 'date-dmy-ru' | 'date-mdy-en' | 'day-context-month-ru' | 'day-context-month-en' | 'iso'
  | 'week-only' | 'week-only-ru' | 'week-year' | 'week-year-en' | 'year-week-en' | 'year-week-ru' | 'week-context-en' | 'week-context-ru'

export interface ChartPlugin {
  id: ChartKind
  label: string
  category: 'comparison' | 'bar-horizontal' | 'trend' | 'smoothing' | 'area' | 'relationship' | 'distribution' | 'heatmap' | 'hierarchy'
  capabilities: ChartCapabilities
  settings: ChartSettingsCapabilities
  defaultConfig: Partial<ChartConfig>
  inferMapping(table: DataTable): Pick<ChartConfig, 'xField' | 'yField' | 'yFields'>
  validate(table: DataTable, config: ChartConfig): ChartValidationResult
  compilerMode: 'legacy' | 'native'
  compile(table: DataTable, config: ChartConfig): import('../entities/chart/model/ChartScene').ChartScene
  /** @deprecated Compatibility boundary for consumers not migrated to ChartScene yet. */
  buildOption(table: DataTable, config: ChartConfig): Record<string, unknown>
}

export interface ChartCapabilities {
  coordinateSystem: 'cartesian' | 'hierarchy' | 'matrix' | 'custom'
  axes: false | { category?: { placements: Array<'side' | 'internal'> }; value?: { scaleTypes: Array<'linear' | 'log' | 'date'> } }
  guides: Array<'legend' | 'direct-series' | 'color-scale' | 'size-scale'>
  endpointLabels?: boolean
  valueLabels?: boolean
  markers?: boolean
  orientation?: Array<'vertical' | 'horizontal'>
  stacking?: Array<'none' | 'stacked' | 'normalized'>
}

export interface ChartValidationResult {
  ok: boolean
  errors: Array<{ field: string; message: string }>
}

export interface ChartSettingsCapabilities {
  sections: Array<'series' | 'annotations' | 'grid' | 'text' | 'headings' | 'axes' | 'legend-values' | 'credits'>
  series: Array<'color' | 'line' | 'markers'>
  features: {
    directLabels: boolean
    barLayout: boolean
    dataPreparation: boolean
    normalizedStack: boolean
    areaLayout: boolean
    scatterLayout: boolean
    distributionLayout: boolean
    lineVariant: boolean
  }
}
