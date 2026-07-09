import type { ChartKind } from './types'

export const isHorizontalBarChart = (kind: ChartKind) => kind === 'horizontal-bar' || kind === 'horizontal-stacked-bar' || kind === 'horizontal-normalized-stacked-bar'
export const isBarChart = (kind: ChartKind) => kind === 'bar' || kind === 'stacked-bar' || kind === 'normalized-stacked-bar' || isHorizontalBarChart(kind)
export const isAreaChart = (kind: ChartKind) => kind === 'area' || kind === 'stacked-area' || kind === 'normalized-stacked-area'
export const isLineLikeChart = (kind: ChartKind) => kind === 'line' || kind === 'spline' || kind === 'step-line' || kind === 'range-line' || kind === 'step-range-line' || kind === 'confidence-line' || isAreaChart(kind)
export const isStackedBarChart = (kind: ChartKind) => kind === 'stacked-bar' || kind === 'normalized-stacked-bar' || kind === 'horizontal-stacked-bar' || kind === 'horizontal-normalized-stacked-bar'
export const isStackedAreaChart = (kind: ChartKind) => kind === 'stacked-area' || kind === 'normalized-stacked-area'
export const isStackedChart = (kind: ChartKind) => isStackedBarChart(kind) || isStackedAreaChart(kind)
export const isNormalizedStackedChart = (kind: ChartKind) => kind === 'normalized-stacked-bar' || kind === 'horizontal-normalized-stacked-bar' || kind === 'normalized-stacked-area'
