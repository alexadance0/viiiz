import type { ChartConfig, ChartTextStyle } from './types'
import { clearInlineFontFamily, clearInlineTextColor } from './annotationHtml'

const textKeys = ['titleText', 'subtitleText', 'axisTitleText', 'axisLabelText', 'legendText', 'valueText', 'noteText', 'sourceText'] as const

/** Apply a text change without flattening each chart's type sizes and emphasis. */
export function applyChartTextStyle(config: ChartConfig, values: Partial<ChartTextStyle>): ChartConfig {
  const style = (current: ChartTextStyle) => ({ ...current, ...values })
  const html = (current: string | undefined) => {
    const next = values.fontFamily ? clearInlineFontFamily(current) : current
    return values.color ? clearInlineTextColor(next) : next
  }
  const next: ChartConfig = {
    ...config,
    ...Object.fromEntries(textKeys.map((key) => [key, style(config[key])])),
    xAxisTitleText: style(config.xAxisTitleText ?? config.axisTitleText), yAxisTitleText: style(config.yAxisTitleText ?? config.axisTitleText),
    xAxisLabelText: style(config.xAxisLabelText ?? config.axisLabelText), yAxisLabelText: style(config.yAxisLabelText ?? config.axisLabelText),
    directLabelText: style(config.directLabelText ?? config.legendText),
    treemapGroupText: style(config.treemapGroupText ?? config.valueText), treemapLeafText: style(config.treemapLeafText ?? config.valueText),
    titleHtml: html(config.titleHtml), subtitleHtml: html(config.subtitleHtml), noteHtml: html(config.noteHtml), sourceHtml: html(config.sourceHtml),
    elementStyles: Object.fromEntries(Object.entries(config.elementStyles).map(([key, current]) => [key, { ...current, ...(current.valueText ? { valueText: style(current.valueText) } : {}) }])),
    seriesStyles: Object.fromEntries(Object.entries(config.seriesStyles).map(([key, current]) => [key, { ...current, ...(current.directLabelText ? { directLabelText: style(current.directLabelText) } : {}) }])),
    annotations: config.annotations.map((annotation) => ({ ...annotation, ...(values.fontFamily ? { fontFamily: values.fontFamily } : {}), html: html(annotation.html) ?? '', fragments: annotation.fragments.map((fragment) => ({ ...fragment, ...(values.color ? { color: values.color } : {}) })) })),
  }
  if (config.multiples) next.multiples = { ...config.multiples, panels: config.multiples.panels.map((panel) => panel ? { ...panel, config: applyChartTextStyle(panel.config, values) } : null) }
  return next
}

export const canvasThemeColors = {
  light: { background: '#ffffff', text: '#2b2b2b', muted: '#666666', axis: '#555555', grid: '#dddddd' },
  dark: { background: '#151922', text: '#f4f4f5', muted: '#b7bbc5', axis: '#727985', grid: '#39414f' },
} as const

/** Apply theme surfaces after the shared text update, including every multiples panel. */
export function applyCanvasTheme(config: ChartConfig, theme: NonNullable<ChartConfig['canvasTheme']>): ChartConfig {
  const colors = canvasThemeColors[theme]
  const surfaces = (current: ChartConfig): ChartConfig => ({
    ...current,
    canvasTheme: theme,
    canvasBackground: colors.background,
    axisLineColor: colors.axis,
    gridColor: colors.grid,
    noteText: { ...current.noteText, color: colors.muted },
    sourceText: { ...current.sourceText, color: colors.muted },
    annotations: current.annotations.map((annotation) => ({ ...annotation, textStrokeColor: colors.background })),
    ...(current.multiples ? { multiples: { ...current.multiples, panels: current.multiples.panels.map((panel) => panel ? { ...panel, config: surfaces(panel.config) } : null) } } : {}),
  })
  return surfaces(applyChartTextStyle(config, { color: colors.text }))
}
