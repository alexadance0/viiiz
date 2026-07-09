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

export type ChartKind = 'bar' | 'stacked-bar' | 'normalized-stacked-bar'
  | 'horizontal-bar' | 'horizontal-stacked-bar' | 'horizontal-normalized-stacked-bar'
  | 'line' | 'spline' | 'step-line' | 'range-line' | 'step-range-line' | 'confidence-line'
  | 'area' | 'stacked-area' | 'normalized-stacked-area' | 'scatter' | 'bubble'
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
export interface ChartElementStyle extends MarkerStyle { color?: string; fillOpacity?: number; borderColor?: string; borderWidth?: number; barWidth?: number; showLabel?: boolean; label?: string; valueText?: ChartTextStyle; lineWidth?: number; lineType?: 'solid' | 'dashed' | 'dotted' }
export interface ChartSeriesStyle extends MarkerStyle {
  color?: string
  fillOpacity?: number
  borderColor?: string
  borderWidth?: number
  barWidth?: number
  lineWidth?: number
  lineType?: 'solid' | 'dashed' | 'dotted'
  legendLabel?: string
  legendNote?: string
  showLegendLine?: boolean
  scatterTrendline?: boolean
  scatterTrendBand?: boolean
  scatterTrendColor?: string
  scatterTrendWidth?: number
  scatterTrendType?: 'solid' | 'dashed' | 'dotted'
  scatterTrendBandOpacity?: number
}
export interface ChartElementSelection { key: string; seriesName: string; category: string; value: string; target?: 'element' | 'value-label' }
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
  canvasPreset?: 'square' | 'portrait' | 'story' | 'presentation-wide' | 'presentation-standard' | 'custom'
  canvasWidth?: number
  canvasHeight?: number
  canvasBackground?: string
  autoFitCanvas?: boolean
  canvasMarginTop?: number
  canvasMarginRight?: number
  canvasMarginBottom?: number
  canvasMarginLeft?: number
  kind: ChartKind
  xField: string
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
  numberGrouping?: boolean
  numberZeroLabel?: string
  xAxisStartLabel?: string
  xAxisEndLabel?: string
  valueLabelPosition?: 'auto' | 'top' | 'inside-top' | 'inside-center' | 'inside-bottom' | 'bottom'
  valueLabelAutoContrast?: boolean
  valueLabelHideOverlap?: boolean
  xAxisTitle: string
  yAxisTitle: string
  xAxisTitleGap: number
  yAxisTitleGap: number
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
  categoryAxisInverse?: boolean
  areaFillOpacity?: number
  stepPosition?: 'start' | 'end'
  intervalFillOpacity?: number
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
  scatterDiagonal?: boolean
  scatterDiagonalColor?: string
  scatterDiagonalWidth?: number
  scatterDiagonalType?: 'solid' | 'dashed' | 'dotted'
  axisTitleMode?: 'standard' | 'editorial'
  showLegend: boolean
  legendPosition?: 'top' | 'bottom' | 'left' | 'right'
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
  xAxisLabelRotate?: number
  xAxisLabelOverflow?: 'auto' | 'wrap' | 'truncate'
}

export type DateLabelFormat = 'auto' | 'year-full' | 'year-short' | 'year-first-full'
  | 'half-only' | 'half-year-en' | 'year-half-en'
  | 'quarter-only' | 'quarter-year' | 'year-quarter' | 'quarter-year-en' | 'year-quarter-en' | 'quarter-context-en' | 'quarter-context-ru'
  | 'month-year' | 'month-short-year' | 'year-month' | 'month-only-ru' | 'month-full-ru' | 'month-number' | 'month-number-year' | 'month-only-en' | 'month-en-year' | 'year-month-en' | 'month-context-ru' | 'month-context-en'
  | 'day-month' | 'day-month-year' | 'date-dmy-slash' | 'date-mdy-slash' | 'date-dmy-en' | 'date-mdy-en' | 'day-context-month-ru' | 'day-context-month-en' | 'iso'
  | 'week-only' | 'week-year' | 'week-year-en' | 'year-week-en' | 'week-context-en' | 'week-context-ru'

export interface ChartPlugin {
  id: ChartKind
  label: string
  category: 'comparison' | 'bar-horizontal' | 'trend' | 'area' | 'relationship'
  settings: ChartSettingsCapabilities
  buildOption(table: DataTable, config: ChartConfig): Record<string, unknown>
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
    lineVariant: boolean
  }
}
