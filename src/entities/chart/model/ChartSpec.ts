import type { ChartKind } from '../../../core/types'

interface SpecBase { kind: ChartKind }
export interface BarSpec extends SpecBase { family: 'bar'; orientation: 'vertical' | 'horizontal'; stacking: 'none' | 'stacked' | 'normalized'; width: number; seriesGap: number }
export interface LollipopSpec extends SpecBase { family: 'lollipop'; orientation: 'vertical' | 'horizontal' }
export interface WaterfallSpec extends SpecBase { family: 'waterfall'; showTotal: boolean; labelContent: 'change' | 'cumulative' | 'both' }
export interface ButterflySpec extends SpecBase { family: 'butterfly'; categoryPlacement: 'center' | 'left' | 'right' }
export interface DumbbellSpec extends SpecBase { family: 'dumbbell'; orientation: 'horizontal'; startField?: string; endField?: string }
export interface LineSpec extends SpecBase { family: 'line'; variant: ChartKind; missing: 'gap' | 'zero' | 'connect' }
export interface SlopeSpec extends SpecBase { family: 'slope'; showValues: boolean; showSeriesNames: boolean; showInternalValueLabels: boolean }
export interface IntervalSpec extends SpecBase { family: 'interval'; variant: 'range-line' | 'step-range-line' | 'confidence-line' }
export interface SmoothingSpec extends SpecBase { family: 'smoothing'; variant: ChartKind }
export interface ScatterSpec extends SpecBase { family: 'scatter'; bubble: boolean; sizeField?: string; colorField?: string }
export interface HeatmapSpec extends SpecBase { family: 'heatmap'; scale: 'sequential' | 'diverging'; scalePosition: 'top' | 'right' | 'bottom' | 'left' }
export interface TreemapSpec extends SpecBase { family: 'treemap'; subcategoryField?: string; groupGap: number; leafGap: number }
export interface DistributionSpec extends SpecBase { family: 'distribution'; orientation: 'vertical' | 'horizontal'; layout: 'measures' | 'categories' }
export interface AreaSpec extends SpecBase { family: 'area'; stacking: 'none' | 'stacked' | 'normalized'; fillOpacity: number }
export interface CustomSpec extends SpecBase { family: 'custom' }
export type ChartSpec = BarSpec | LollipopSpec | WaterfallSpec | ButterflySpec | DumbbellSpec | LineSpec | SlopeSpec | IntervalSpec | SmoothingSpec | ScatterSpec | HeatmapSpec | TreemapSpec | DistributionSpec | AreaSpec | CustomSpec
