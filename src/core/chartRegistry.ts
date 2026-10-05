import { compileStreamScene, validateStreamMapping } from '../features/chart-types/stream/compiler'
import { compileMarimekkoScene, validateMarimekkoMapping } from '../features/chart-types/marimekko/compiler'
import { compileNativeMapScene, validateMapMapping } from '../features/chart-types/map/compiler'
import { inferMapRegionField, isMapChart, isTileMapChart, mapChartPresets, mapPresetForKind } from '../features/chart-types/map/catalog'
import { compileNativeBumpScene, validateBumpMapping } from '../features/chart-types/bump/compiler'
import { compileNativeSankeyScene, validateNativeSankeyMapping } from '../features/chart-types/sankey/compiler'
import type { NativeChartScene } from '../entities/chart/model/ChartScene'
import { nativeMarkSelections } from '../entities/chart/model/sceneVisitors'
import { renderScene } from '../features/chart-renderer/echarts/renderScene'
import { areaChartDefinitions } from '../features/chart-types/area'
import { compileNativeAreaScene, isNativeAreaKind } from '../features/chart-types/area/compiler'
import { barChartDefinitions } from '../features/chart-types/bar'
import { compileNativeBarScene, isNativeBarKind } from '../features/chart-types/bar/compiler'
import { compileNativeButterflyScene, validateNativeButterflyMapping } from '../features/chart-types/butterfly/compiler'
import { compileNativeComparisonStemScene, isNativeComparisonStemKind } from '../features/chart-types/comparison-stem/compiler'
import { distributionChartDefinitions } from '../features/chart-types/distribution'
import { compileNativeDistributionScene, isNativeDistributionKind, validateNativeDistributionMapping } from '../features/chart-types/distribution/compiler'
import { heatmapChartDefinitions } from '../features/chart-types/heatmap'
import { compileNativeHeatmapScene } from '../features/chart-types/heatmap/compiler'
import { compileNativeIntervalScene, isNativeIntervalKind } from '../features/chart-types/interval/compiler'
import { intervalChartDefinitions, lineChartDefinitions } from '../features/chart-types/line'
import { compileNativeLineScene, isNativeLineKind } from '../features/chart-types/line/compiler'
import { relationshipChartDefinitions } from '../features/chart-types/relationship'
import { compileNativeSlopeScene } from '../features/chart-types/slope/compiler'
import { smoothingChartDefinitions } from '../features/chart-types/smoothing'
import { compileNativeSmoothingScene, isNativeSmoothingKind } from '../features/chart-types/smoothing/compiler'
import { compileNativePieScene, validateNativePieMapping } from '../features/chart-types/pie/compiler'
import { compileNativeWaffleScene, validateNativeWaffleMapping } from '../features/chart-types/waffle/compiler'
import { isCompositionChart, isPieChart } from './chartKinds'
import { treemapChartDefinitions } from '../features/chart-types/treemap'
import { compileNativeTreemapScene, validateNativeTreemapMapping } from '../features/chart-types/treemap/compiler'
import { compileNativeWaterfallScene } from '../features/chart-types/waterfall/compiler'
import { compileNativeXYScene, isNativeXYKind, validateNativeXYMapping } from '../features/chart-types/xy/compiler'
import { repeatedChartCategories } from './chartData'
import { isScatterChart, isPairedComparisonChart, isAreaChart, isBarChart, isNormalizedStackedChart } from './chartKinds'
import { slopePositionKey } from './chartScale'
import type { ChartConfig, ChartElementSelection, ChartKind, ChartPlugin, DataTable } from './types'

export { niceNumericScale, prepareVisibleChartData } from './chartScale'
export { getSeriesColor } from './seriesColor'
export { fitSwarmClouds, fitSwarmOffsets, packSwarmOffsets } from '../features/chart-types/distribution/swarm'
export { formatWaterfallChange, waterfallLabelPlacement, waterfallSteps, waterfallValueLabel } from '../features/chart-types/waterfall/transform'
export { hyphenateTreemapText, treemapAdaptiveFontSize } from '../features/chart-types/treemap/text'

const inferMapping = (table: DataTable): Pick<ChartConfig, 'xField' | 'yField' | 'yFields'> => {
  const numeric = table.columns.filter((column) => table.rows.some((row) => typeof row[column] === 'number' && Number.isFinite(row[column])))
  const xField = table.columns.find((column) => !numeric.includes(column)) ?? table.columns[0] ?? ''
  const yField = numeric[0] ?? table.columns.find((column) => column !== xField) ?? xField
  return { xField, yField, yFields: yField ? [yField] : [] }
}

const validateMapping = (table: DataTable, config: ChartConfig) => {
  const errors: Array<{ field: string; message: string }> = []
  const numeric = (field: string | undefined) => Boolean(field && table.columns.includes(field) && table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  if (!config.xField || !table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку для оси X.' })
  const yFields = config.yFields.length ? config.yFields : [config.yField]
  if (!yFields.some(numeric)) errors.push({ field: 'yField', message: 'Выберите числовую колонку для значения.' })
  if (isPairedComparisonChart(config.kind) && (!numeric(config.dumbbellStartField) || !numeric(config.dumbbellEndField) || config.dumbbellStartField === config.dumbbellEndField)) errors.push({ field: 'dumbbellFields', message: config.kind === 'arrow-plot' ? 'Выберите две разные числовые колонки для стрелочной диаграммы.' : 'Выберите две разные числовые колонки для гантельной диаграммы.' })
  if ((config.kind === 'range-line' || config.kind === 'step-range-line') && (!numeric(config.rangeLowerField) || !numeric(config.rangeUpperField) || config.rangeLowerField === config.rangeUpperField)) errors.push({ field: 'rangeFields', message: 'Выберите две разные числовые границы диапазона.' })
  if (config.kind === 'confidence-line' && !(config.intervalGroups?.some((group) => new Set([group.main, group.lower, group.upper]).size === 3 && numeric(group.main) && numeric(group.lower) && numeric(group.upper)) || config.yFields.length >= 3 && new Set(config.yFields.slice(0, 3)).size === 3 && config.yFields.slice(0, 3).every(numeric))) errors.push({ field: 'intervalGroups', message: 'Настройте три разных числовых поля: основное значение и две границы.' })
  if (config.aggregation === 'none' && repeatedChartCategories(table, config).length) errors.push({ field: 'aggregation', message: 'Для повторяющихся значений X выберите способ агрегации.' })
  return { ok: errors.length === 0, errors }
}

const genericSettings = (id: ChartKind, category: ChartPlugin['category']): ChartPlugin['settings'] => ({
  sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'],
  series: isBarChart(id) || isAreaChart(id) ? ['color'] : ['color', 'line', 'markers'],
  features: { directLabels: true, barLayout: isBarChart(id), dataPreparation: false, normalizedStack: isNormalizedStackedChart(id), areaLayout: isAreaChart(id), scatterLayout: false, distributionLayout: false, lineVariant: id === 'step-line' || category === 'smoothing' },
})

const capabilities = (id: ChartKind): ChartPlugin['capabilities'] => {
  if (id === 'stream-graph') return { coordinateSystem: 'cartesian', axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear'] } }, guides: ['legend', 'direct-series'], valueLabels: true, markers: false, stacking: ['stacked'] }
  if (id === 'marimekko') return { coordinateSystem: 'cartesian', axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear'] } }, guides: ['legend'], valueLabels: true, markers: false, orientation: ['vertical', 'horizontal'], stacking: ['stacked', 'normalized'] }
  if (id === 'waffle') return { coordinateSystem: 'matrix', axes: {}, guides: ['legend'], valueLabels: true, markers: false }
  if (isPieChart(id)) return { coordinateSystem: 'radial', axes: {}, guides: ['legend'], valueLabels: true, markers: false }
  if (isMapChart(id)) return { coordinateSystem: 'custom', axes: {}, guides: ['color-scale'], valueLabels: true, markers: false }
  if (id === 'sankey') return { coordinateSystem: 'custom', axes: {}, guides: [], valueLabels: true, markers: false }
  if (id === 'treemap') return { coordinateSystem: 'hierarchy', axes: {}, guides: [], valueLabels: true, markers: false }
  if (id === 'heatmap') return { coordinateSystem: 'matrix', axes: { category: { placements: ['side'] }, lane: { placements: ['side'] } }, guides: ['color-scale'], valueLabels: true, markers: false }
  if (isScatterChart(id)) return { coordinateSystem: 'cartesian', axes: { x: { scaleTypes: ['linear', 'date'] }, y: { scaleTypes: ['linear', 'log'] } }, guides: id === 'bubble' ? ['legend', 'size-scale'] : ['legend'], valueLabels: true, markers: true }
  if (isNativeDistributionKind(id)) return { coordinateSystem: 'cartesian', axes: { lane: { placements: ['side'] }, value: { scaleTypes: ['linear'] } }, guides: ['legend'], valueLabels: true, markers: true, orientation: ['horizontal', 'vertical'] }
  if (id === 'butterfly') return { coordinateSystem: 'cartesian', axes: { category: { placements: ['side', 'internal'] }, value: { scaleTypes: ['linear'] } }, guides: ['legend'], valueLabels: true, markers: false, orientation: ['horizontal'], stacking: ['stacked'] }
  if (id === 'waterfall') return { coordinateSystem: 'cartesian', axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } }, guides: [], valueLabels: true, markers: false, orientation: ['vertical'], stacking: ['none', 'stacked', 'normalized'] }
  if (id === 'slope') return { coordinateSystem: 'cartesian', axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } }, guides: [], valueLabels: true, markers: true, endpointLabels: true }
  const markers = !isNativeBarKind(id) || isNativeComparisonStemKind(id)
  return { coordinateSystem: 'cartesian', axes: { category: { placements: ['side'] }, value: { scaleTypes: ['linear', 'log'] } }, guides: ['legend', 'direct-series'], valueLabels: true, markers, orientation: isNativeBarKind(id) || isNativeComparisonStemKind(id) ? ['vertical', 'horizontal'] : undefined, stacking: isNativeBarKind(id) || isNativeAreaKind(id) ? ['none', 'stacked', 'normalized'] : undefined }
}

const compile = (table: DataTable, config: ChartConfig): NativeChartScene => {
  const id = config.kind
  if (id === 'marimekko') return compileMarimekkoScene(table, config)
  if (isMapChart(id)) return compileNativeMapScene(table, config)
  if (id === 'bump') return compileNativeBumpScene(table, config)
  if (id === 'waffle') return compileNativeWaffleScene(table, config)
  if (isPieChart(id)) return compileNativePieScene(table, config)
  if (id === 'sankey') return compileNativeSankeyScene(table, config)
  if (id === 'treemap') return compileNativeTreemapScene(table, config)
  if (id === 'heatmap') return compileNativeHeatmapScene(table, config)
  if (id === 'waterfall') return compileNativeWaterfallScene(table, config)
  if (id === 'butterfly') return compileNativeButterflyScene(table, config)
  if (isNativeComparisonStemKind(id)) return compileNativeComparisonStemScene(table, config)
  if (isNativeBarKind(id)) return compileNativeBarScene(table, config)
  if (isNativeLineKind(id)) return compileNativeLineScene(table, config)
  if (id === 'stream-graph') return compileStreamScene(table, config)
  if (isNativeAreaKind(id)) return compileNativeAreaScene(table, config)
  if (id === 'slope') return compileNativeSlopeScene(table, config)
  if (isNativeSmoothingKind(id)) return compileNativeSmoothingScene(table, config)
  if (isNativeIntervalKind(id)) return compileNativeIntervalScene(table, config)
  if (isNativeXYKind(id)) return compileNativeXYScene(table, config)
  if (isNativeDistributionKind(id)) return compileNativeDistributionScene(table, config)
  throw new Error(`No native compiler registered for ${id satisfies never}`)
}

const slopeValidation = (table: DataTable, config: ChartConfig) => {
  const result = validateMapping(table, config)
  const positions = new Set(table.rows.map((row) => slopePositionKey(row[config.xField])))
  const selected = config.slopeXValues ?? []
  if (!(selected.length === 2 && new Set(selected).size === 2 && selected.every((value) => positions.has(value))) && positions.size !== 2) result.errors.push({ field: 'slopeXValues', message: 'Выберите две позиции по оси X для наклонного графика.' })
  return { ok: result.errors.length === 0, errors: result.errors }
}

const indexedValidation = (table: DataTable, config: ChartConfig) => {
  const result = validateMapping(table, config)
  const positions = new Set(table.rows.map((row) => slopePositionKey(row[config.xField])))
  if (!config.indexBaseXValue || !positions.has(config.indexBaseXValue)) result.errors.push({ field: 'indexBaseXValue', message: 'Выберите базовую дату для индекса.' })
  else if (!table.rows.some((row) => slopePositionKey(row[config.xField]) === config.indexBaseXValue && config.yFields.some((field) => typeof row[field] === 'number' && row[field] !== 0))) result.errors.push({ field: 'indexBaseXValue', message: 'В базовую дату должно быть ненулевое значение.' })
  return { ok: result.errors.length === 0, errors: result.errors }
}

const seasonalValidation = (table: DataTable, config: ChartConfig) => {
  const result = validateMapping(table, config)
  const dates = table.rows.map((row) => row[config.xField]).filter((value): value is Date => value instanceof Date)
  if (!dates.length) result.errors.push({ field: 'xField', message: 'Для сравнения по годам выберите колонку с датами.' })
  else if (new Set(dates.map((date) => date.getFullYear())).size < 2) result.errors.push({ field: 'xField', message: 'Для сравнения нужны данные минимум за два года.' })
  return { ok: result.errors.length === 0, errors: result.errors }
}

type Descriptor = Pick<ChartPlugin, 'id' | 'label' | 'category' | 'settings'> & { defaultConfig?: Partial<ChartConfig> }

const lineSettings = (id: ChartKind) => {
  const base = genericSettings(id, 'trend')
  return { ...base, features: { ...base.features, lineVariant: ['indexed-line', 'seasonal-line', 'slope', 'bump'].includes(id) || base.features.lineVariant } }
}

const barSettings = (id: typeof barChartDefinitions[number][0], category: ChartPlugin['category']) => {
  const base = genericSettings(id, category)
  if (id === 'waterfall' || id === 'butterfly') return { ...base, series: id === 'waterfall' ? [] as ChartPlugin['settings']['series'] : base.series, features: { ...base.features, directLabels: false } }
  if (id === 'lollipop' || id === 'horizontal-lollipop') return { ...base, series: ['color', 'markers'] as ChartPlugin['settings']['series'], features: { ...base.features, barLayout: false } }
  return base
}

const relationshipSettings: ChartPlugin['settings'] = { sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'], series: ['color', 'markers'], features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: true, distributionLayout: false, lineVariant: false } }
const distributionSettings: ChartPlugin['settings'] = { sections: ['series', 'annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'], series: ['color', 'markers'], features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: true, lineVariant: false } }
const heatmapSettings: ChartPlugin['settings'] = { sections: ['annotations', 'grid', 'text', 'headings', 'axes', 'legend-values', 'credits'], series: ['color'], features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: false, lineVariant: false } }
const treemapSettings: ChartPlugin['settings'] = { sections: ['series', 'annotations', 'text', 'headings', 'legend-values', 'credits'], series: ['color'], features: { directLabels: false, barLayout: false, dataPreparation: false, normalizedStack: false, areaLayout: false, scatterLayout: false, distributionLayout: false, lineVariant: false } }

const descriptors: Descriptor[] = [
  { id: 'marimekko', label: 'Marimekko', category: 'composition', defaultConfig: { kind: 'marimekko', marimekkoMode: 'normalized', barOrientation: 'vertical', aggregation: 'sum', showValues: true, showLegend: true, showDirectLabels: false, showXAxisTitle: false, showYAxisTitle: false, yAxisScaleType: 'linear', xAxisLabelRotate: 0, xAxisLabelOverflow: 'wrap' }, settings: { ...genericSettings('bar', 'composition'), features: { ...genericSettings('bar', 'composition').features, directLabels: false, barLayout: false, normalizedStack: true } } },
  ...barChartDefinitions.map(([id, label, category]) => ({ id, label, category, settings: barSettings(id, category) })),
  ...([['dumbbell', 'Гантельная'], ['dot-plot', 'Dot Plot'], ['arrow-plot', 'Arrow Plot']] as const).map(([id, label]) => ({ id, label, category: 'point-comparison' as const, defaultConfig: { kind: id, dumbbellOrientation: 'horizontal' as const, showHorizontalGrid: false, showVerticalGrid: true, ...(id === 'arrow-plot' ? { dumbbellConnectorColor: '#1923e3', showLegend: false } : {}) }, settings: { ...genericSettings(id, 'point-comparison'), series: ['color', 'markers'] as ChartPlugin['settings']['series'], features: { ...genericSettings(id, 'point-comparison').features, directLabels: false, barLayout: false, lineVariant: true } } })),
  ...lineChartDefinitions.map(([id, label]) => ({ id, label, category: 'trend' as const, settings: lineSettings(id), ...(id === 'bump' ? { defaultConfig: { kind: id, bumpMode: 'value' as const, bumpShowStartLabels: false, showDirectLabels: true, showLegend: false } } : {}) })),
  ...smoothingChartDefinitions.map(([id, label]) => ({ id, label, category: 'smoothing' as const, settings: genericSettings(id, 'smoothing') })),
  ...intervalChartDefinitions.map(([id, label]) => ({ id, label, category: 'trend' as const, settings: { ...genericSettings('line', 'trend'), features: { ...genericSettings('line', 'trend').features, lineVariant: true } } })),
  { id: 'stream-graph', label: 'Stream Graph', category: 'area', defaultConfig: { kind: 'stream-graph', aggregation: 'sum', missingMode: 'zero', areaFillOpacity: .85, showLegend: true, showYAxisLabels: false, showYAxisLine: false, showYTicks: false, showYAxisTitle: false, showHorizontalGrid: false, showZeroLine: false, yAxisScaleType: 'linear' }, settings: { ...genericSettings('stream-graph', 'area'), features: { ...genericSettings('stream-graph', 'area').features, lineVariant: true } } },
  ...areaChartDefinitions.map(([id, label]) => ({ id, label, category: 'area' as const, settings: genericSettings(id, 'area') })),
  ...relationshipChartDefinitions.map(([id, label]) => ({ id, label, category: 'relationship' as const, settings: relationshipSettings, ...(id === 'connected-scatter' ? { defaultConfig: { kind: id, aggregation: 'none' as const, missingMode: 'gap' as const, scatterOrderDirection: 'asc' as const } } : {}) })),
  ...distributionChartDefinitions.map(([id, label]) => ({ id, label, category: 'distribution' as const, settings: distributionSettings })),
  { id: heatmapChartDefinitions[0][0], label: heatmapChartDefinitions[0][1], category: 'heatmap', defaultConfig: { kind: 'heatmap', showYAxisTitle: false, showLegend: false, showDirectLabels: false, showValues: false }, settings: heatmapSettings },
  ...([['pie', 'Круговая'], ['donut', 'Кольцевая'], ['waffle', 'Вафельная']] as const).map(([id, label]) => ({ id, label, category: 'composition' as const, settings: treemapSettings, defaultConfig: { kind: id, aggregation: 'sum' as const, showValues: true, showLegend: id === 'waffle', showDirectLabels: false } })),
  { id: treemapChartDefinitions[0][0], label: treemapChartDefinitions[0][1], category: 'hierarchy', defaultConfig: { kind: 'treemap', aggregation: 'sum', showValues: true, showLegend: false, showDirectLabels: false, showXAxisTitle: false, showYAxisTitle: false }, settings: treemapSettings },
  ...mapChartPresets.map(({ kind: id, label }) => ({ id, label, category: 'geography' as const, defaultConfig: { kind: id, aggregation: 'sum' as const, heatmapScaleMode: 'sequential' as const, heatmapLowColor: '#edf2f7', heatmapHighColor: '#1923e3', showValues: false, showLegend: false, showDirectLabels: false, mapShowNames: isTileMapChart(id), mapLabelFormat: 'code' as const, mapTileGap: 4 }, settings: { ...heatmapSettings, sections: ['series', 'annotations', 'text', 'headings', 'legend-values', 'credits'] as ChartPlugin['settings']['sections'] } })),
  { id: 'sankey', label: 'Санкей', category: 'relationship', defaultConfig: { kind: 'sankey', aggregation: 'sum', showValues: true, showLegend: false, showDirectLabels: false }, settings: { ...treemapSettings, sections: ['series', 'annotations', 'text', 'headings', 'credits'] } },
]

const validationFor = (id: ChartKind, base: ChartPlugin['validate']): ChartPlugin['validate'] => isMapChart(id) ? validateMapMapping : id === 'waffle' ? validateNativeWaffleMapping : id === 'sankey' ? validateNativeSankeyMapping : isCompositionChart(id) ? validateNativePieMapping : id === 'treemap' ? validateNativeTreemapMapping
  : id === 'butterfly' ? (table, config) => { const generic = base(table, config), native = validateNativeButterflyMapping(table, config); return { ok: generic.ok && native.ok, errors: [...generic.errors, ...native.errors] } }
  : isNativeXYKind(id) ? validateNativeXYMapping
  : isNativeDistributionKind(id) ? validateNativeDistributionMapping
  : id === 'stream-graph' ? (table, config) => { const generic = base(table, config), stream = validateStreamMapping(table, config); return { ok: generic.ok && stream.ok, errors: [...generic.errors, ...stream.errors] } }
  : id === 'slope' ? slopeValidation
  : id === 'bump' ? (table, config) => { const baseResult = base(table, config); const rankResult = validateBumpMapping(table, config); const errors = [...baseResult.errors, ...rankResult.errors]; return { ok: errors.length === 0, errors } }
  : id === 'indexed-line' ? indexedValidation
  : id === 'seasonal-line' ? seasonalValidation
  : id === 'marimekko' ? (table, config) => { const generic = base(table, config), native = validateMarimekkoMapping(table, config); return { ok: generic.ok && native.ok, errors: [...generic.errors, ...native.errors] } }
  : base

export const chartRegistry: ChartPlugin[] = descriptors.map((descriptor) => {
  const compilePlugin = (table: DataTable, config: ChartConfig) => compile(table, config)
  return { ...descriptor, defaultConfig: descriptor.defaultConfig ?? { kind: descriptor.id }, capabilities: capabilities(descriptor.id), inferMapping: isMapChart(descriptor.id) ? (table) => ({ ...inferMapping(table), xField: inferMapRegionField(table, mapPresetForKind(descriptor.id)) }) : descriptor.id === 'sankey' ? (table) => ({ ...inferMapping(table), sankeyTargetField: table.columns.find((column) => column !== inferMapping(table).xField && column !== inferMapping(table).yField) }) : inferMapping, validate: validationFor(descriptor.id, validateMapping), compile: compilePlugin, buildOption: (table, config) => renderScene(compilePlugin(table, config)) }
})

export function getChartPlugin(id: ChartKind) {
  return chartRegistry.find((plugin) => plugin.id === id) ?? chartRegistry[0]
}

export function chartValueLabelSelections(table: DataTable, config: ChartConfig): ChartElementSelection[] {
  const plugin = getChartPlugin(config.kind)
  if (!plugin.validate(table, config).ok) return []
  return nativeMarkSelections(plugin.compile(table, config)).filter((mark) => mark.value != null).map((mark) => ({ key: mark.legacyKey, seriesName: mark.seriesName, category: mark.displayCategory, value: mark.displayValue, label: config.elementStyles[mark.legacyKey]?.label ?? mark.displayLabel, color: config.elementStyles[mark.legacyKey]?.color ?? (config.kind === 'waterfall' || config.kind === 'butterfly' ? mark.color : undefined), target: 'value-label' }))
}

export function chartElementColor(table: DataTable, config: ChartConfig, key: string) {
  const plugin = getChartPlugin(config.kind)
  if (!plugin.validate(table, config).ok) return undefined
  return nativeMarkSelections(plugin.compile(table, config)).find((mark) => mark.legacyKey === key)?.color
}

export function waterfallElementColor(table: DataTable, config: ChartConfig, key: string) {
  return chartElementColor(table, config, key)
}
