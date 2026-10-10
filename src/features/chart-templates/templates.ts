import { z } from 'zod'
import type { ChartConfig, ChartKind, ChartSeriesStyle } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'

const commonKeys = [
  'canvasBackground', 'canvasTheme', 'canvasMarginTop', 'canvasMarginRight', 'canvasMarginBottom', 'canvasMarginLeft',
  'titleSubtitleGap', 'headerPlotGap', 'headerLegendGap', 'legendPlotGap', 'plotFooterGap', 'noteSourceGap',
  'titleText', 'subtitleText', 'noteText', 'sourceText', 'axisTitleText', 'axisLabelText', 'xAxisTitleText', 'yAxisTitleText', 'xAxisLabelText', 'yAxisLabelText', 'legendText', 'valueText', 'directLabelText',
  'showTitle', 'showSubtitle', 'showNote', 'showSource', 'showValues', 'showLegend', 'legendPosition', 'legendMarker', 'legendLabelColorByCategory',
  'showDirectLabels', 'directLabelWrap', 'directLabelMaxWidth', 'directLabelGap', 'showDirectLabelLines', 'directLabelLineWidth', 'directLabelLineType',
  'showXAxisTitle', 'showYAxisTitle', 'showXAxisLabels', 'showYAxisLabels', 'showXAxisLine', 'showYAxisLine',
  'xAxisTitleGap', 'yAxisTitleGap', 'xAxisLabelGap', 'yAxisLabelGap', 'xAxisPosition', 'yAxisPosition',
  'axisLineColor', 'axisLineWidth', 'axisLineType', 'showXTicks', 'showYTicks', 'tickLength',
  'showHorizontalGrid', 'showVerticalGrid', 'gridColor', 'gridWidth', 'gridType', 'showZeroLine', 'zeroLineColor', 'zeroLineWidth', 'zeroLineType',
  'xAxisLabelRotate', 'xAxisLabelOverflow', 'categoryAxisLabelAlignment', 'valueLabelPosition', 'valueLabelAutoContrast', 'valueLabelHideOverlap',
  'palette', 'paletteName', 'paletteBaseColor', 'paletteReversed', 'paletteGradientColors', 'paletteGradientSteps', 'color', 'customFonts',
] as const satisfies readonly (keyof ChartConfig)[]
const sizeKeys = ['canvasPreset', 'canvasWidth', 'canvasHeight'] as const
const specificGroups = {
  bar: ['barWidth', 'barFillColor', 'barFillOpacity', 'barBorderColor', 'barBorderWidth', 'barBorderRadius', 'barSeriesGap', 'barValueLabelAbsorption', 'barValueLabelInsidePosition', 'barValueLabelOutsidePosition', 'barValueLabelAbsorptionPadding'],
  waterfall: ['waterfallIncreaseColor', 'waterfallDecreaseColor', 'waterfallTotalColor', 'waterfallConnectorColor', 'waterfallLabelGap'],
  bump: ['bumpSmooth', 'bumpShowStartLabels'],
  slope: ['slopeShowValues', 'slopeShowSeriesNames', 'slopeShowYAxis', 'slopeIncreaseColor', 'slopeDecreaseColor', 'slopeNeutralColor'],
  dumbbell: ['dumbbellShowStartValue', 'dumbbellShowEndValue', 'dumbbellConnectorColor', 'dumbbellConnectorWidth', 'dumbbellConnectorOpacity', 'dumbbellConnectorType', 'dumbbellIncreaseColor', 'dumbbellDecreaseColor', 'dumbbellNeutralColor'],
  movingAverage: ['movingAverageRawOpacity'],
  seasonal: ['seasonalMutedColor', 'seasonalMutedOpacity'],
  area: ['areaFillOpacity', 'streamSmooth', 'intervalFillOpacity', 'intervalFillMode', 'intervalFillColor'],
  heatmap: ['heatmapLowColor', 'heatmapMidColor', 'heatmapHighColor', 'heatmapShowScale', 'heatmapScalePosition', 'heatmapCellGap', 'heatmapMissingColor'],
  treemap: ['treemapGap', 'treemapGroupGap', 'treemapShowGroupLabels', 'treemapShowLeafLabels', 'treemapShowGroupValues', 'treemapShowLeafValues', 'treemapGroupLabelPosition', 'treemapLabelPosition', 'treemapGroupText', 'treemapLeafText'],
  pie: ['pieInnerRadius', 'pieLabelPosition', 'pieShowNames'],
  waffle: ['waffleLabelPosition', 'waffleLabelColor', 'waffleLabelBackground', 'waffleShowValues', 'waffleShowUnitLegend', 'waffleUnitLegendPosition', 'waffleUnitLegendText', 'waffleDescriptionText', 'waffleColumns', 'waffleRows', 'waffleGap', 'waffleRadius'],
  map: ['mapShowNames', 'mapBorderColor', 'mapBorderWidth', 'mapTileGap'],
  sankey: ['sankeyNodeWidth', 'sankeyNodeGap', 'sankeyLinkOpacity', 'sankeyCurvature', 'sankeyLinkColor', 'sankeyLabelPosition', 'sankeyCompactLabels', 'sankeyShowNames', 'sankeyLabelColorByCategory'],
  scatter: ['scatterPointSize', 'scatterSizeMin', 'scatterSizeMax', 'scatterOpacity', 'scatterBorderWidth', 'scatterHollow', 'scatterShowLabels', 'scatterLabelPosition', 'scatterConnectionWidth', 'scatterConnectionType', 'scatterConnectionOpacity', 'scatterTrendColor', 'scatterTrendWidth', 'scatterTrendType', 'scatterTrendBandOpacity', 'scatterReferenceColor', 'scatterReferenceWidth', 'scatterReferenceType', 'scatterDiagonalColor', 'scatterDiagonalWidth', 'scatterDiagonalType'],
  distribution: ['distributionPointSize', 'distributionPointOpacity', 'distributionTickWidth', 'distributionWidth', 'distributionSummaryWidth', 'distributionSummaryLength', 'distributionDensityFillOpacity', 'distributionShowLabels', 'distributionLabelPosition'],
} as const satisfies Record<string, readonly (keyof ChartConfig)[]>
function specificKeys(kind: string): readonly (keyof ChartConfig)[] {
  if (kind === 'bar' || kind.endsWith('-bar') || ['butterfly', 'marimekko', 'lollipop', 'horizontal-lollipop', 'waterfall'].includes(kind)) return [...specificGroups.bar, ...(kind === 'waterfall' ? specificGroups.waterfall : [])]
  if (kind.includes('area') || ['stream-graph', 'range-line', 'step-range-line', 'confidence-line'].includes(kind)) return specificGroups.area
  if (kind.includes('map') && kind !== 'heatmap' && kind !== 'treemap') return specificGroups.map
  if (['scatter', 'bubble', 'connected-scatter'].includes(kind)) return specificGroups.scatter
  if (kind.startsWith('moving-average-')) return specificGroups.movingAverage
  if (kind === 'seasonal-line') return specificGroups.seasonal
  if (['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'].includes(kind)) return specificGroups.distribution
  if (kind === 'pie' || kind === 'donut') return specificGroups.pie
  return specificGroups[kind as keyof typeof specificGroups] ?? []
}
const appearanceKeys = ['fillOpacity', 'borderColor', 'borderWidth', 'barWidth', 'lineWidth', 'lineType', 'showMarker', 'markerShape', 'markerSize', 'markerFill', 'markerBorder', 'markerBorderWidth'] as const satisfies readonly (keyof ChartSeriesStyle)[]
const textSchema = z.object({ fontFamily: z.string().max(300), size: z.number().min(1).max(500), color: z.string().max(100), weight: z.number().min(1).max(1000), italic: z.boolean(), lineHeight: z.number().min(1).max(500), align: z.enum(['left', 'center', 'right']) })
const number = z.number().finite().min(0).max(10000)
const string = z.string().max(300)
const defaults = createDefaultChartConfig()
const enums: Record<string, string[]> = {
  canvasTheme: ['light', 'dark'], legendPosition: ['top', 'bottom', 'left', 'right'], legendMarker: ['auto', 'circle', 'square', 'line', 'diamond', 'triangle'],
  xAxisPosition: ['top', 'bottom'], yAxisPosition: ['left', 'right'], xAxisLabelOverflow: ['auto', 'wrap', 'truncate'], categoryAxisLabelAlignment: ['plot', 'outer'],
  valueLabelPosition: ['auto', 'top', 'inside-top', 'inside-center', 'inside-bottom', 'bottom'], barValueLabelInsidePosition: ['start', 'center', 'end'], barValueLabelOutsidePosition: ['start', 'end'],
  intervalFillMode: ['by-bound', 'custom'], pieLabelPosition: ['outside', 'inside'], sankeyLinkColor: ['source', 'target', 'single'], sankeyLabelPosition: ['outside', 'inside'],
  waffleLabelPosition: ['right', 'inside', 'legend'], waffleLabelColor: ['text', 'category', 'auto'], waffleUnitLegendPosition: ['top', 'bottom', 'left', 'right'], heatmapScalePosition: ['top', 'bottom', 'left', 'right'],
  scatterLabelPosition: ['top', 'right', 'bottom', 'left'], distributionLabelPosition: ['top', 'right', 'bottom', 'left'],
  treemapGroupLabelPosition: ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'],
  treemapLabelPosition: ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'],
}
const allKeys = [...new Set([...commonKeys, ...sizeKeys, ...Object.values(specificGroups).flat()])]
const validators = Object.fromEntries(allKeys.map((key) => {
  const defaultValue = defaults[key]
  const schema = enums[key] ? z.enum(enums[key]) : key.endsWith('Type') ? z.enum(['solid', 'dashed', 'dotted']) : key.endsWith('Text') ? textSchema
    : key.endsWith('Opacity') ? z.number().min(0).max(1)
    : key === 'waffleColumns' || key === 'waffleRows' ? z.number().min(1).max(100)
    : key === 'paletteGradientSteps' ? z.number().min(2).max(24)
    : key === 'customFonts' ? z.array(z.object({ name: string, dataUrl: z.string().max(12_000_000).regex(/^data:(font\/|application\/)[\w.+-]+;base64,[A-Za-z0-9+/=]+$/), fileName: string.optional(), weight: number.optional(), style: z.enum(['normal', 'italic']).optional() })).max(20)
    : key === 'paletteGradientColors' ? z.union([z.tuple([string, string]), z.tuple([string, string, string])])
    : key === 'palette' ? z.array(z.string().max(100)).min(1).max(100)
    : key === 'xAxisLabelRotate' ? z.union([z.literal('auto'), z.union([z.literal(0), z.literal(30), z.literal(45), z.literal(60), z.literal(90)])])
    : typeof defaultValue === 'boolean' || /^(show|mapShow|pieShow|sankeyShow|treemapShow|waffleShow|distributionShow|slopeShow|dumbbellShow|bumpShow)/.test(key) || ['directLabelWrap', 'paletteReversed', 'legendLabelColorByCategory', 'sankeyLabelColorByCategory', 'streamSmooth', 'bumpSmooth', 'scatterHollow', 'scatterShowLabels', 'sankeyCompactLabels', 'waffleLabelBackground', 'barValueLabelAbsorption', 'valueLabelAutoContrast', 'valueLabelHideOverlap'].includes(key) ? z.boolean()
    : typeof defaultValue === 'number' || /(?:Width|Height|Gap|Size|Opacity|Radius|Steps|Columns|Rows|Length|Padding)$/.test(key) ? number
    : string
  return [key, schema.optional()]
}))
const appearanceSchema = z.object({ fillOpacity: z.number().min(0).max(1).optional(), borderColor: string.optional(), borderWidth: number.optional(), barWidth: number.optional(), lineWidth: number.optional(), lineType: z.enum(['solid', 'dashed', 'dotted']).optional(), showMarker: z.boolean().optional(), markerShape: z.enum(['circle', 'rect', 'roundRect', 'triangle', 'diamond']).optional(), markerSize: number.optional(), markerFill: string.optional(), markerBorder: string.optional(), markerBorderWidth: number.optional() })
const variantSchema = z.object({ sourceKind: z.string().min(1).max(80), style: z.object(validators), seriesAppearance: z.array(appearanceSchema).max(1000) })
export const MAX_TEMPLATE_BYTES = 16_000_000
const templateSchema = z.object({ format: z.literal('viiiz-style-template'), version: z.literal(1), id: z.string().min(1).max(100), name: z.string().trim().min(1).max(80), sourceKind: z.string().min(1).max(80), includeSize: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), style: z.object(validators), seriesAppearance: z.array(appearanceSchema).max(1000), variants: z.array(variantSchema).max(100).optional() })
  .refine((value) => !value.variants || new Set(value.variants.map((variant) => variant.sourceKind)).size === value.variants.length)
  .refine((value) => !value.includeSize || Number(value.style.canvasWidth) > 0 && Number(value.style.canvasHeight) > 0)
  .refine((value) => new TextEncoder().encode(JSON.stringify(value, null, 2)).byteLength <= MAX_TEMPLATE_BYTES)

export interface TemplateVariant { sourceKind: ChartKind; style: Partial<ChartConfig>; seriesAppearance: Partial<ChartSeriesStyle>[] }
export interface ChartTemplate extends TemplateVariant { format: 'viiiz-style-template'; version: 1; id: string; name: string; includeSize: boolean; createdAt: string; updatedAt: string; variants?: TemplateVariant[] }
export function parseTemplate(value: unknown): ChartTemplate { return templateSchema.parse(value) as ChartTemplate }
function appearance(config: ChartConfig, includeSize: boolean, seriesNames: string[]): TemplateVariant {
  const keys = [...commonKeys, ...specificKeys(config.kind), ...(includeSize ? sizeKeys : [])]
  return { sourceKind: config.kind, style: Object.fromEntries(keys.filter((key) => config[key] !== undefined || sizeKeys.includes(key as typeof sizeKeys[number])).map((key) => [key, config[key] ?? defaults[key]])), seriesAppearance: seriesNames.map((name) => Object.fromEntries(appearanceKeys.filter((key) => config.seriesStyles[name]?.[key] !== undefined).map((key) => [key, config.seriesStyles[name][key]]))) }
}
export function createTemplate(config: ChartConfig, name: string, includeSize: boolean, seriesNames: string[] = config.yFields): ChartTemplate {
  const now = new Date().toISOString()
  return parseTemplate({ format: 'viiiz-style-template', version: 1, id: crypto.randomUUID(), name, includeSize, createdAt: now, updatedAt: now, ...appearance(config, includeSize, seriesNames) })
}
export type SeriesNamesFor = (config: ChartConfig) => string[]
function compositionAppearance(config: ChartConfig, includeSize: boolean, namesFor: SeriesNamesFor) {
  const seen = new Set<ChartKind>()
  const variants = config.multiples?.panels.flatMap((panel) => {
    if (!panel || seen.has(panel.config.kind)) return []
    seen.add(panel.config.kind)
    return [appearance(panel.config, false, namesFor(panel.config))]
  })
  return { ...appearance(config, includeSize, config.multiples ? [] : namesFor(config)), ...(variants ? { variants } : {}) }
}
export function createCompositionTemplate(config: ChartConfig, name: string, includeSize: boolean, namesFor: SeriesNamesFor): ChartTemplate {
  const base = createTemplate(config, name, includeSize, [])
  return parseTemplate({ ...base, ...compositionAppearance(config, includeSize, namesFor) })
}
export function templateAppearanceSignature(config: ChartConfig, includeSize: boolean, namesFor: SeriesNamesFor): string {
  return JSON.stringify({ ...compositionAppearance(config, includeSize, namesFor), ...(config.multiples ? { panels: config.multiples.panels.map((panel) => panel ? appearance(panel.config, false, namesFor(panel.config)) : null) } : {}) })
}
export function applyTemplate(config: ChartConfig, template: ChartTemplate, seriesNames: string[] = config.yFields, includeSize = template.includeSize): ChartConfig {
  const variant = template.variants?.find((item) => item.sourceKind === config.kind)
  if (variant) template = { ...template, ...variant, style: { ...template.style, ...variant.style } }
  const next = { ...config }
  const keys = [...commonKeys, ...(template.sourceKind === config.kind ? specificKeys(config.kind) : []), ...(includeSize && template.includeSize ? sizeKeys : [])]
  for (const key of keys) (next as unknown as Record<string, unknown>)[key] = structuredClone(template.style[key] ?? defaults[key])
  if (config.customFonts?.length || template.style.customFonts?.length) {
    const fonts = [...(config.customFonts ?? []), ...(template.style.customFonts ?? [])]
    next.customFonts = [...new Map(fonts.map((font) => [`${font.name}:${font.weight ?? 400}:${font.style ?? 'normal'}`, structuredClone(font)])).values()]
  }
  if (template.sourceKind === config.kind) {
    next.seriesStyles = { ...config.seriesStyles }
    seriesNames.forEach((name, index) => {
      const style = { ...config.seriesStyles[name] }
      for (const key of appearanceKeys) delete style[key]
      next.seriesStyles[name] = { ...style, ...structuredClone(template.seriesAppearance[index] ?? template.seriesAppearance[0] ?? {}) }
    })
  }
  return next
}
export function applyTemplateToComposition(config: ChartConfig, template: ChartTemplate, namesFor: SeriesNamesFor, includeSize = template.includeSize): ChartConfig {
  if (!config.multiples) return applyTemplate(config, template, namesFor(config), includeSize)
  // Common headings and outer canvas use the document style, not a panel variant.
  const next = applyTemplate(config, { ...template, variants: undefined }, [], includeSize)
  next.multiples = { ...config.multiples, panels: config.multiples.panels.map((panel) => {
    if (!panel) return null
    const styled = applyTemplate(panel.config, template, namesFor(panel.config), false)
    if (!template.variants?.some((variant) => variant.sourceKind === panel.config.kind)) {
      // A standalone chart's document margins and visibility must not expand every cell.
      for (const key of ['canvasMarginTop', 'canvasMarginRight', 'canvasMarginBottom', 'canvasMarginLeft', 'showTitle', 'showSubtitle', 'showNote', 'showSource'] as const) styled[key] = panel.config[key] as never
    }
    return { ...panel, config: styled }
  }) }
  return next
}
export const builtInTemplates: ChartTemplate[] = [
  ['report', 'Для отчёта', { titleText: { ...defaults.titleText, size: 32 }, subtitleText: { ...defaults.subtitleText, size: 20 }, gridWidth: .5, showLegend: true }],
  ['presentation', 'Для презентации', { titleText: { ...defaults.titleText, size: 48 }, axisLabelText: { ...defaults.axisLabelText, size: 24 }, xAxisLabelText: { ...defaults.xAxisLabelText!, size: 24 }, yAxisLabelText: { ...defaults.yAxisLabelText!, size: 24 }, legendText: { ...defaults.legendText, size: 24 }, valueText: { ...defaults.valueText, size: 24 }, showValues: true }],
  ['minimal', 'Минималистичный', { showHorizontalGrid: false, showVerticalGrid: false, showXAxisLine: false, showYAxisLine: false, showXTicks: false, showYTicks: false }],
].map(([id, name, patch]) => ({ ...createTemplate({ ...defaults, ...(patch as Partial<ChartConfig>) }, String(name), false), id: `builtin:${id}` }))
