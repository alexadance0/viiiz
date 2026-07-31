import type { ChartTextStyle } from '../../../core/types'

export const DEFAULT_CANVAS = {
  width: 1000,
  height: 750,
  background: '#ffffff',
} as const

export const DEFAULT_COMPOSITION_SPACING = {
  canvasInsets: { top: 24, right: 24, bottom: 24, left: 32 },
  titleSubtitle: 12,
  headerPlot: 28,
  headerLegend: 20,
  legendPlot: 24,
  plotFooter: 24,
  noteSource: 10,
  axisTickLabel: 8,
  xAxisLabelTitle: 14,
  yAxisLabelTitle: 14,
  directLabelPlot: 16,
  tickLength: 6,
} as const

export const DEFAULT_CHART_PALETTE = ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#56b4e9', '#f0e442'] as const

export const defaultChartTextStyle = (size: number, weight = 400, color = '#2b2b2b'): ChartTextStyle => ({
  fontFamily: 'Onest, sans-serif', size, color, weight, italic: false, lineHeight: 120, align: 'left',
})
