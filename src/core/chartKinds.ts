import type { ChartConfig, ChartKind } from './types'

const distributionKinds: ChartKind[] = ['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot']
export const isDistributionChart = (kind: ChartKind) => distributionKinds.includes(kind)
const distributionWidths: Partial<Record<ChartKind, number>> = {
  boxplot: 48, violinplot: 72, raincloud: 82, ridgeline: 76,
  beeswarm: 72, 'strip-plot': 32, 'jitter-plot': 58, 'counts-plot': 44, 'barcode-plot': 56,
}
const distributionPointSizes: Partial<Record<ChartKind, number>> = {
  boxplot: 8, violinplot: 8, raincloud: 7, beeswarm: 8, 'strip-plot': 7, 'jitter-plot': 7, 'counts-plot': 8,
}
export const distributionVisualDefaults = (kind: ChartKind): Partial<ChartConfig> => ({
  distributionWidth: distributionWidths[kind] ?? 72,
  distributionPointSize: distributionPointSizes[kind] ?? 8,
  distributionSummaryWidth: kind === 'violinplot' || kind === 'ridgeline' ? 2.5 : 3,
  distributionSummaryLength: 100,
  ...(kind === 'raincloud' ? { distributionRaincloudPointMode: 'overlay' as const } : {}),
})
export const isLollipopChart = (kind: ChartKind) => kind === 'lollipop' || kind === 'horizontal-lollipop'
export const isHorizontalBarChart = (kind: ChartKind) => kind === 'horizontal-bar' || kind === 'butterfly' || kind === 'horizontal-stacked-bar' || kind === 'horizontal-normalized-stacked-bar' || kind === 'horizontal-lollipop'
export const isHorizontalChart = (kind: ChartKind) => kind === 'dumbbell' || isHorizontalBarChart(kind)
export const usesHorizontalAxes = (config: Pick<ChartConfig, 'kind' | 'barOrientation' | 'dumbbellOrientation' | 'distributionOrientation'>) => config.kind === 'dumbbell'
  ? (config.dumbbellOrientation ?? 'horizontal') === 'horizontal'
  : isDistributionChart(config.kind)
    ? (config.distributionOrientation ?? 'horizontal') === 'horizontal'
  : isHorizontalChart(config.kind) || isBarChart(config.kind) && config.barOrientation === 'horizontal'
export const isBarChart = (kind: ChartKind) => kind === 'bar' || kind === 'stacked-bar' || kind === 'normalized-stacked-bar' || kind === 'waterfall' || kind === 'lollipop' || isHorizontalBarChart(kind)
export const isAreaChart = (kind: ChartKind) => kind === 'area' || kind === 'stacked-area' || kind === 'normalized-stacked-area'
export const isLineLikeChart = (kind: ChartKind) => kind === 'line' || kind === 'spline' || kind === 'step-line' || kind === 'moving-average-line' || kind === 'moving-average-scatter' || kind === 'slope' || kind === 'range-line' || kind === 'step-range-line' || kind === 'confidence-line' || isAreaChart(kind)
export const isStackedBarChart = (kind: ChartKind) => kind === 'stacked-bar' || kind === 'normalized-stacked-bar' || kind === 'butterfly' || kind === 'horizontal-stacked-bar' || kind === 'horizontal-normalized-stacked-bar'
export const isStackedAreaChart = (kind: ChartKind) => kind === 'stacked-area' || kind === 'normalized-stacked-area'
export const isStackedChart = (kind: ChartKind) => isStackedBarChart(kind) || isStackedAreaChart(kind)
export const isNormalizedStackedChart = (kind: ChartKind) => kind === 'normalized-stacked-bar' || kind === 'horizontal-normalized-stacked-bar' || kind === 'normalized-stacked-area'
export const chartUsesAggregation = (kind: ChartKind) => kind !== 'scatter' && kind !== 'bubble' && !isDistributionChart(kind)
