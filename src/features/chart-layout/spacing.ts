import type { ChartConfig } from '../../core/types'
import { DEFAULT_COMPOSITION_SPACING } from '../../entities/chart/model/defaults'
import type { Insets } from './geometry'

export interface CompositionSpacing {
  canvasInsets: Insets
  titleSubtitle: number
  headerLegend: number
  headerPlot: number
  legendPlot: number
  plotFooter: number
  noteSource: number
  axisTickLabel: number
  xAxisLabelTitle: number
  yAxisLabelTitle: number
  directLabelPlot: number
}

export function compositionSpacing(config: Partial<ChartConfig>): CompositionSpacing {
  const defaults = DEFAULT_COMPOSITION_SPACING
  return {
    canvasInsets: {
      top: config.canvasMarginTop ?? defaults.canvasInsets.top,
      right: config.canvasMarginRight ?? defaults.canvasInsets.right,
      bottom: config.canvasMarginBottom ?? defaults.canvasInsets.bottom,
      left: config.canvasMarginLeft ?? defaults.canvasInsets.left,
    },
    titleSubtitle: config.titleSubtitleGap ?? defaults.titleSubtitle,
    headerLegend: config.headerLegendGap ?? defaults.headerLegend,
    headerPlot: config.headerPlotGap ?? defaults.headerPlot,
    legendPlot: config.legendPlotGap ?? defaults.legendPlot,
    plotFooter: config.plotFooterGap ?? defaults.plotFooter,
    noteSource: config.noteSourceGap ?? defaults.noteSource,
    axisTickLabel: config.xAxisLabelGap ?? defaults.axisTickLabel,
    xAxisLabelTitle: config.xAxisTitleGap ?? defaults.xAxisLabelTitle,
    yAxisLabelTitle: config.yAxisTitleGap ?? defaults.yAxisLabelTitle,
    directLabelPlot: config.directLabelGap ?? defaults.directLabelPlot,
  }
}
