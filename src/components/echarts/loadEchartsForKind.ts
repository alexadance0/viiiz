import type { ChartKind } from '../../core/types'

const barKinds = new Set<ChartKind>(['bar', 'stacked-bar', 'normalized-stacked-bar', 'waterfall', 'horizontal-bar', 'butterfly', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar'])
const lollipopKinds = new Set<ChartKind>(['lollipop', 'horizontal-lollipop'])
const scatterKinds = new Set<ChartKind>(['scatter', 'bubble'])
const distributionKinds = new Set<ChartKind>(['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'])

export const loadEchartsForKind = (kind: ChartKind) => Promise.all([
  import('./loadCustom'),
  ...(barKinds.has(kind) ? [import('./loadBar')] : []),
  ...(lollipopKinds.has(kind) ? [import('./loadScatter')] : []),
  ...(kind === 'dumbbell' ? [import('./loadScatter')] : []),
  ...(kind === 'heatmap' ? [import('./loadHeatmap')] : []),
  ...(kind === 'treemap' ? [import('./loadTreemap')] : []),
  ...(scatterKinds.has(kind) ? [import('./loadScatter'), import('./loadLine')] : []),
  ...(distributionKinds.has(kind) ? [import('./loadScatter'), import('./loadLine')] : []),
  ...(!barKinds.has(kind) && !lollipopKinds.has(kind) && kind !== 'dumbbell' && kind !== 'heatmap' && kind !== 'treemap' && !scatterKinds.has(kind) && !distributionKinds.has(kind) ? [import('./loadLine')] : []),
])

export const preloadAllEcharts = () => Promise.all([
  import('./loadBar'),
  import('./loadCustom'),
  import('./loadHeatmap'),
  import('./loadLine'),
  import('./loadScatter'),
  import('./loadTreemap'),
])
