import type { ChartConfig, DataTable } from '../../../core/types'
import { isAreaChart, isDistributionChart, isHorizontalChart, isNormalizedStackedChart, isStackedChart } from '../../../core/chartKinds'
import { DEFAULT_CANVAS } from './defaults'
import { compositionSpacing } from '../../../features/chart-layout/spacing'
import type { ChartSpec } from './ChartSpec'
import type { ChartDocument } from './ChartDocument'

export function chartSpecFromLegacy(config: ChartConfig): ChartSpec {
  if (config.kind === 'waterfall') return { family: 'waterfall', kind: config.kind, showTotal: config.waterfallShowTotal ?? true, labelContent: config.waterfallLabelContent ?? 'change' }
  if (config.kind === 'butterfly') return { family: 'butterfly', kind: config.kind, categoryPlacement: config.butterflyCategoryPosition ?? 'center' }
  if (config.kind === 'heatmap') return { family: 'heatmap', kind: config.kind, scale: config.heatmapScaleMode ?? 'diverging', scalePosition: config.heatmapScalePosition ?? 'right' }
  if (config.kind === 'treemap') return { family: 'treemap', kind: config.kind, subcategoryField: config.treemapSubcategoryField, groupGap: config.treemapGroupGap ?? 5, leafGap: config.treemapGap ?? 2 }
  if (isDistributionChart(config.kind)) return { family: 'distribution', kind: config.kind, orientation: config.distributionOrientation ?? 'horizontal', layout: config.distributionLayoutMode ?? 'measures' }
  if (config.kind === 'scatter' || config.kind === 'bubble') return { family: 'scatter', kind: config.kind, bubble: config.kind === 'bubble', sizeField: config.scatterSizeField, colorField: config.scatterColorField }
  if (isAreaChart(config.kind)) return { family: 'area', kind: config.kind, stacking: isNormalizedStackedChart(config.kind) ? 'normalized' : isStackedChart(config.kind) ? 'stacked' : 'none', fillOpacity: config.areaFillOpacity ?? .32 }
  if (config.kind.includes('line') || config.kind === 'slope') return { family: 'line', kind: config.kind, variant: config.kind, missing: config.missingMode }
  if (config.kind.includes('bar') || config.kind.includes('lollipop')) return { family: 'bar', kind: config.kind, orientation: isHorizontalChart(config.kind) || config.barOrientation === 'horizontal' ? 'horizontal' : 'vertical', stacking: isNormalizedStackedChart(config.kind) ? 'normalized' : isStackedChart(config.kind) ? 'stacked' : 'none', width: config.barWidth ?? 68, seriesGap: config.barSeriesGap ?? 30 }
  return { family: 'custom', kind: config.kind }
}

export function chartDocumentFromLegacy(table: DataTable, config: ChartConfig): ChartDocument {
  return {
    version: 1,
    canvas: { width: config.canvasWidth ?? DEFAULT_CANVAS.width, height: config.canvasHeight ?? DEFAULT_CANVAS.height, background: config.canvasBackground ?? DEFAULT_CANVAS.background },
    composition: compositionSpacing(config),
    theme: { palette: config.palette ?? [config.color], fontFamily: config.titleText.fontFamily },
    data: { table, xField: config.xField, yFields: config.yFields, seriesField: config.seriesField },
    chart: chartSpecFromLegacy(config),
    annotations: config.annotations,
    decorations: config.decorations ?? [],
    overrides: { elementStyles: config.elementStyles, seriesStyles: config.seriesStyles, categoryLabelOverrides: config.categoryLabelOverrides },
  }
}
