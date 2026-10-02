import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { chartDataValueKey } from '../../../core/chartData'
import { niceNumericScale, orderedBounds, prepareVisibleChartData } from '../../../core/chartScale'
import { isNormalizedStackedChart, usesHorizontalAxes } from '../../../core/chartKinds'
import { resolveNativeScene } from '../../chart-renderer/echarts/renderScene'

export type Multiples = NonNullable<ChartConfig['multiples']>

export function sharedCategoryRows(table: DataTable, grid: Multiples) {
  if (!grid.sharedCategoryLabels) return []
  return Array.from({ length: grid.rows }, (_, row) => {
    const indices = grid.panels.flatMap((panel, index) => panel && Math.floor(index / grid.columns) === row ? [index] : [])
    const reference = grid.panels[indices[0]]?.config
    if (!reference || !indices.every((index) => {
      const config = grid.panels[index]!.config
      return ['bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'horizontal-lollipop', 'dumbbell'].includes(config.kind) && usesHorizontalAxes(config) && config.xField === reference.xField && compilePanel(table, config) !== null
    })) return null
    const categories = prepareVisibleChartData(table, reference).categories
    if (!categories.length || categories.some((value) => value instanceof Date || typeof value === 'number')) return null
    return { row, indices, reference, order: categories.map(chartDataValueKey) }
  }).filter((row) => row !== null)
}

const compilePanel = (table: DataTable, config: ChartConfig) => {
  const plugin = getChartPlugin(config.kind)
  if (!plugin.validate(table, config).ok) return null
  try { return plugin.compile(table, config) } catch { return null }
}
const valueScaleKey = (config: ChartConfig) => JSON.stringify([config.yAxisScaleType ?? 'linear', isNormalizedStackedChart(config.kind) || config.valueMode === 'percent' ? 'percent' : config.kind === 'indexed-line' ? 'index' : 'absolute', config.numberSuffix, config.numberPrefix, config.numberOperation, config.numberFactor])
const dateInput = (time: number) => { const date = new Date(time); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const bounds = (values: number[]) => values.reduce((range, value) => ({ min: Math.min(range.min, value), max: Math.max(range.max, value) }), { min: Infinity, max: -Infinity })

const horizontalCategoryCount = (table: DataTable, config: ChartConfig) => {
  if (!usesHorizontalAxes(config) || !['bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'horizontal-lollipop', 'dumbbell'].includes(config.kind)) return null
  const scene = compilePanel(table, config)
  return scene && 'categories' in scene.plot && scene.plot.categories.length ? scene.plot.categories.length : null
}

/** Allocate the plot space by category count; headings and axes reserve fixed space. */
export function resolveMultiplesRowHeights(table: DataTable, grid: Multiples, width: number, availableHeight: number, categoryRows = sharedCategoryRows(table, grid)) {
  const equalHeight = Math.max(1, availableHeight / grid.rows)
  const heights = Array.from({ length: grid.rows }, () => equalHeight)
  if (!grid.equalCategorySpacing) return heights
  const counts = heights.map((_, row) => {
    const panels = grid.panels.filter((panel, index) => panel && Math.floor(index / grid.columns) === row)
    const categories = panels.map((panel) => horizontalCategoryCount(table, panel!.config))
    return categories.length && categories.every((count) => count !== null) ? Math.max(...categories as number[]) : null
  })
  const indices = grid.panels.flatMap((panel, index) => panel && counts[Math.floor(index / grid.columns)] !== null ? [index] : [])
  if (!indices.length) return heights
  const referenceHeight = Math.max(500, equalHeight)
  const configs = resolveMultiplesPanels(table, grid, width, referenceHeight, categoryRows)
  const overhead = Math.max(...indices.map((index) => {
    const config = configs[index]!
    return referenceHeight - resolveNativeScene(getChartPlugin(config.kind).compile(table, config)).geometry.plot.height
  }))
  const rows = counts.filter((count) => count !== null)
  const remaining = availableHeight - (grid.rows - rows.length) * equalHeight - rows.length * overhead
  if (remaining <= 0) return heights
  const categoryHeight = remaining / rows.reduce((sum, count) => sum + count, 0)
  return counts.map((count) => count === null ? equalHeight : overhead + count * categoryHeight)
}

/** Resolve shared ranges from the existing compilers, including stacks and cumulative values. */
export function resolveMultiplesPanels(table: DataTable, grid: Multiples, width: number, height: number | number[], categoryRows = sharedCategoryRows(table, grid)) {
  const panelHeight = (index: number) => Math.round(typeof height === 'number' ? height : height[Math.floor(index / grid.columns)])
  const configs = grid.panels.map((panel, index) => panel ? { ...panel.config, canvasWidth: Math.round(width), canvasHeight: panelHeight(index), autoFitCanvas: true } : null)
  if (!grid.sharedValueScale && !grid.sharedXScale && !categoryRows.length && !grid.equalCategorySpacing) return configs
  const alignmentGroups: number[][] = categoryRows.map((row) => row.indices)
  if (grid.equalCategorySpacing) alignmentGroups.push(configs.flatMap((config, index) => config && horizontalCategoryCount(table, config) !== null ? [index] : []))
  for (const row of categoryRows) for (const index of row.indices) configs[index] = { ...configs[index]!, categoryOrder: row.order, categoryAxisInverse: row.reference.categoryAxisInverse ?? true, showXAxisLabels: false, showXAxisTitle: false, showXTicks: false, showXAxisLine: false }
  const valueGroups = new Map<string, Array<{ index: number; min: number; max: number }>>()
  const xGroups = new Map<string, Array<{ index: number; min: number; max: number; type: 'date' | 'number'; continuous: boolean }>>()
  configs.forEach((config, index) => {
    if (!config) return
    const scene = compilePanel(table, { ...config, ...(grid.sharedValueScale ? { yAxisMin: null, yAxisMax: null, yAxisStep: null } : {}), ...(grid.sharedXScale ? { xAxisMin: '', xAxisMax: '' } : {}) })
    if (!scene) return
    const plot = scene.plot
    if (grid.sharedValueScale && ('valueDomain' in plot || plot.kind === 'xy')) {
      const domain = plot.kind === 'xy' ? { min: plot.yScale.minimum ?? plot.yScale.automaticDomain.minimum, max: plot.yScale.maximum ?? plot.yScale.automaticDomain.maximum } : plot.valueDomain
      let min = domain.min
      if (config.yAxisScaleType === 'log' && min <= 0) {
        const positive = table.rows.flatMap((row) => config.yFields.flatMap((field) => typeof row[field] === 'number' && row[field] > 0 ? [row[field] as number] : []))
        min = positive.length ? 10 ** Math.floor(Math.log10(bounds(positive).min)) : 1
      }
      const key = valueScaleKey(config)
      const group = valueGroups.get(key) ?? []
      group.push({ index, min, max: Math.max(domain.max, config.yAxisScaleType === 'log' ? min * 10 : min) }); valueGroups.set(key, group)
    }
    if (grid.sharedXScale) {
      const values = plot.kind === 'xy' ? [plot.xScale.minimum ?? plot.xScale.automaticDomain.minimum, plot.xScale.maximum ?? plot.xScale.automaticDomain.maximum] : 'categories' in plot ? plot.categories.flatMap(({ value }) => value instanceof Date ? [value.getTime()] : typeof value === 'number' ? [value] : []) : []
      if (!values.length) return
      const type = plot.kind === 'xy' ? plot.xScale.type === 'time' ? 'date' : 'number' : 'categories' in plot && plot.categories.some(({ value }) => value instanceof Date) ? 'date' : 'number'
      const key = `${type}:${plot.kind === 'xy' ? 'continuous' : config.xField}`
      const group = xGroups.get(key) ?? []
      group.push({ index, ...bounds(values), type, continuous: plot.kind === 'xy' }); xGroups.set(key, group)
    }
  })
  for (const group of valueGroups.values()) {
    const automatic = niceNumericScale(group.flatMap(({ min, max }) => [min, max]))
    const logarithmic = configs[group[0].index]!.yAxisScaleType === 'log'
    const [manualMin, manualMax] = orderedBounds(grid.valueMin, grid.valueMax)
    const min = logarithmic ? manualMin != null && manualMin > 0 ? manualMin : Math.min(...group.map((item) => item.min)) : manualMin ?? Math.min(...group.map((item) => item.min))
    const max = Math.max(manualMax ?? Math.max(...group.map((item) => item.max)), logarithmic ? min * (manualMax != null && manualMax > min ? 1 : 10) : min + automatic.step)
    for (const { index } of group) configs[index] = { ...configs[index]!, yAxisMin: min, yAxisMax: max, yAxisStep: logarithmic ? null : grid.valueStep != null && grid.valueStep > 0 ? grid.valueStep : automatic.step }
    alignmentGroups.push(group.map((item) => item.index))
  }
  for (const group of xGroups.values()) {
    const min = Math.min(...group.map((item) => item.min)), max = Math.max(...group.map((item) => item.max))
    for (const { index, type, continuous } of group) configs[index] = { ...configs[index]!, xAxisMin: type === 'date' ? dateInput(min) : String(min), xAxisMax: type === 'date' ? dateInput(max) : String(max), ...(continuous && type === 'number' ? { xAxisStep: niceNumericScale([min, max]).step } : {}) }
    alignmentGroups.push(group.map((item) => item.index))
  }
  // Equal domains need equal plot sizes as well: label rails and wrapped headings vary.
  const layouts = configs.map((config) => { const scene = config && compilePanel(table, config); return scene ? resolveNativeScene(scene).geometry.plot : null })
  const aligned = [...new Set(alignmentGroups.flat())]
  for (const indices of [aligned.filter((index) => usesHorizontalAxes(configs[index]!)), aligned.filter((index) => !usesHorizontalAxes(configs[index]!))]) {
    const insets = { top: 0, right: 0, bottom: 0, left: 0 }
    for (const index of indices) {
      const plot = layouts[index]
      if (!plot) continue
      insets.top = Math.max(insets.top, plot.y); insets.left = Math.max(insets.left, plot.x)
      insets.bottom = Math.max(insets.bottom, panelHeight(index) - plot.y - plot.height); insets.right = Math.max(insets.right, Math.round(width) - plot.x - plot.width)
    }
    for (const index of indices) if (layouts[index]) {
      const previous = configs[index]!.minimumPlotInsets
      configs[index] = { ...configs[index]!, minimumPlotInsets: previous ? { top: Math.max(previous.top, insets.top), right: Math.max(previous.right, insets.right), bottom: Math.max(previous.bottom, insets.bottom), left: Math.max(previous.left, insets.left) } : insets }
    }
  }
  // Hide repeated labels after alignment so the shared plots retain equal dimensions.
  // Compare only compatible scales, and use occupied cells when a grid has gaps.
  const hideRepeatedLabels = (indices: number[], axis: 'x' | 'y', edge: 'left' | 'bottom') => {
    for (const index of indices) {
      const repeated = indices.some((other) => edge === 'left'
        ? Math.floor(other / grid.columns) === Math.floor(index / grid.columns) && other < index
        : other % grid.columns === index % grid.columns && other > index)
      if (repeated) configs[index] = { ...configs[index]!, ...(axis === 'y' ? { showYAxisLabels: false } : { showXAxisLabels: false }) }
    }
  }
  if (grid.sharedScaleLabels === 'left') {
    for (const group of valueGroups.values()) hideRepeatedLabels(group.map(({ index }) => index).filter((index) => !usesHorizontalAxes(configs[index]!)), 'y', 'left')
  } else if (grid.sharedScaleLabels === 'bottom') {
    for (const group of valueGroups.values()) hideRepeatedLabels(group.map(({ index }) => index).filter((index) => usesHorizontalAxes(configs[index]!)), 'y', 'bottom')
    for (const group of xGroups.values()) hideRepeatedLabels(group.map(({ index }) => index).filter((index) => !usesHorizontalAxes(configs[index]!)), 'x', 'bottom')
  }
  return configs
}

export function resizeMultiples(grid: Multiples, columns: number, rows: number): Multiples {
  columns = Math.max(1, Math.min(4, Math.round(columns)))
  rows = Math.max(1, Math.min(6, Math.round(rows)))
  const occupied = grid.panels.findLastIndex(Boolean) + 1
  // Preserve every chart when a smaller preset is selected.
  rows = Math.max(rows, Math.ceil(occupied / columns))
  return { ...grid, columns, rows, panels: Array.from({ length: columns * rows }, (_, index) => grid.panels[index] ?? null) }
}

export function createPanelConfig(config: ChartConfig, title: string): ChartConfig {
  const panel = structuredClone(config)
  delete panel.multiples
  return {
    ...panel, title, titleHtml: undefined, subtitle: '', note: '', source: '',
    showTitle: true, showSubtitle: false, showNote: false, showSource: false,
    titleText: { ...panel.titleText, size: 20 },
    subtitleText: { ...panel.subtitleText, size: 14 },
    noteText: { ...panel.noteText, size: 12 },
    sourceText: { ...panel.sourceText, size: 12 },
    subtitleHtml: undefined, noteHtml: undefined, sourceHtml: undefined,
    axisTitleText: { ...panel.axisTitleText, size: 13 },
    axisLabelText: { ...panel.axisLabelText, size: 12 },
    xAxisTitleText: { ...(panel.xAxisTitleText ?? panel.axisTitleText), size: 13 },
    yAxisTitleText: { ...(panel.yAxisTitleText ?? panel.axisTitleText), size: 13 },
    xAxisLabelText: { ...(panel.xAxisLabelText ?? panel.axisLabelText), size: 12 },
    yAxisLabelText: { ...(panel.yAxisLabelText ?? panel.axisLabelText), size: 12 },
    legendText: { ...panel.legendText, size: 12 }, valueText: { ...panel.valueText, size: 12 },
    directLabelText: { ...(panel.directLabelText ?? panel.legendText), size: 12 },
    canvasMarginTop: 8, canvasMarginRight: 8, canvasMarginBottom: 8, canvasMarginLeft: 8,
    headerPlotGap: 14, titleSubtitleGap: 6, annotations: [], decorations: [],
  }
}
