import { isMapChart } from '../../features/chart-types/map/catalog'
import type { ChartKind } from '../../core/types'

const barKinds = new Set<ChartKind>(['marimekko', 'bar', 'stacked-bar', 'normalized-stacked-bar', 'waterfall', 'horizontal-bar', 'butterfly', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar'])
const comparisonStemKinds = new Set<ChartKind>(['lollipop', 'horizontal-lollipop', 'dumbbell', 'dot-plot', 'arrow-plot'])
const scatterKinds = new Set<ChartKind>(['scatter', 'bubble', 'connected-scatter', 'moving-average-scatter'])
const distributionKinds = new Set<ChartKind>(['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'])

export const loadEchartsForKind = (kind: ChartKind) => Promise.all([
  import('./loadCustom'),
  ...((kind === 'pie' || kind === 'donut') ? [import('./loadPie')] : []),
  ...(barKinds.has(kind) ? [import('./loadBar')] : []),
  ...(scatterKinds.has(kind) ? [import('./loadScatter'), import('./loadLine')] : []),
  ...(distributionKinds.has(kind) ? [import('./loadScatter'), import('./loadLine')] : []),
  ...(!isMapChart(kind) && !barKinds.has(kind) && !comparisonStemKinds.has(kind) && kind !== 'sankey' && kind !== 'treemap' && kind !== 'pie' && kind !== 'donut' && kind !== 'waffle' && !scatterKinds.has(kind) && !distributionKinds.has(kind) ? [import('./loadLine')] : []),
])

export const preloadAllEcharts = () => Promise.all([
  import('./loadPie'),
  import('./loadBar'),
  import('./loadCustom'),
  import('./loadLine'),
  import('./loadScatter'),
])
