import type { ChartKind } from '../../core/types'

const barKinds = new Set<ChartKind>(['bar', 'stacked-bar', 'normalized-stacked-bar', 'waterfall', 'horizontal-bar', 'butterfly', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar'])
const comparisonStemKinds = new Set<ChartKind>(['lollipop', 'horizontal-lollipop', 'dumbbell'])
const scatterKinds = new Set<ChartKind>(['scatter', 'bubble'])
const distributionKinds = new Set<ChartKind>(['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'])

export const loadEchartsForKind = (kind: ChartKind) => Promise.all([
  import('./loadCustom'),
  ...(barKinds.has(kind) ? [import('./loadBar')] : []),
  ...(kind === 'heatmap' ? [import('./loadHeatmap')] : []),
  ...(kind === 'treemap' ? [import('./loadTreemap')] : []),
  ...(scatterKinds.has(kind) ? [import('./loadScatter'), import('./loadLine')] : []),
  ...(distributionKinds.has(kind) ? [import('./loadScatter'), import('./loadLine')] : []),
  ...(!barKinds.has(kind) && !comparisonStemKinds.has(kind) && kind !== 'heatmap' && kind !== 'treemap' && !scatterKinds.has(kind) && !distributionKinds.has(kind) ? [import('./loadLine')] : []),
])

export const preloadAllEcharts = () => Promise.all([
  import('./loadBar'),
  import('./loadCustom'),
  import('./loadHeatmap'),
  import('./loadLine'),
  import('./loadScatter'),
  import('./loadTreemap'),
])
