import { describe, expect, it } from 'vitest'
import { getChartPlugin, legacyComparisonStemBuilderGuard } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import { renderScene } from '../../chart-renderer/echarts/renderScene'
import { resolveNativeComparisonStemScene } from './layout'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { NativeComparisonStemChartScene } from '../../../entities/chart/model/ChartScene'
import { applySeriesVisualState } from '../../../components/ChartCanvas'

const table: DataTable = {
  name: 'comparison', columns: ['category', 'value', 'before', 'after'], rows: [
    { category: 'A', value: 4, before: 10, after: 14 },
    { category: 'B', value: 8, before: 20, after: 18 },
    { category: 'missing', value: 2, before: 8, after: null },
    { category: 'C', value: 12, before: 8, after: 17 },
  ],
}

const config = (kind: ChartConfig['kind']): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'category', yField: 'value', yFields: ['value'], aggregation: 'none' })

describe('native comparison/stem compiler', () => {
  it.each(['lollipop', 'horizontal-lollipop'] as const)('%s emits editable source points and derived stable stems', (kind) => {
    const plugin = getChartPlugin(kind), source = config(kind)
    const scene = plugin.compile(table, source)
    expect(plugin.compilerMode).toBe('native')
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    expect(scene.plot.variant).toBe('lollipop')
    expect(scene.plot.orientation).toBe(kind === 'lollipop' ? 'vertical' : 'horizontal')
    expect(scene.plot.series[0].points).toHaveLength(4)
    expect(scene.plot.connectors.every((connector) => connector.endpointIds.length === 1)).toBe(true)
    expect(scene.elements.filter((element) => element.role === 'mark')).toHaveLength(4)
  })

  it('keeps dumbbell field, orientation, complete-pair, sorting, change, and stable-ID semantics', () => {
    const source = { ...config('dumbbell'), dumbbellStartField: 'before', dumbbellEndField: 'after', dumbbellOrientation: 'vertical' as const, dumbbellSort: 'difference' as const, dumbbellSortDirection: 'desc' as const, dumbbellShowDifference: true, dumbbellDifferenceFormat: 'percent' as const, dumbbellColorByChange: true }
    const plugin = getChartPlugin('dumbbell'), scene = plugin.compile(table, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    expect(scene.document.chart).toMatchObject({ family: 'dumbbell', orientation: 'vertical', startField: 'before', endField: 'after' })
    expect(scene.plot.categories.map((category) => category.label)).toEqual(['C', 'A', 'B'])
    expect(scene.plot.series.map((series) => [series.name, series.role, series.points.length])).toEqual([['before', 'start', 3], ['after', 'end', 3]])
    expect(scene.plot.connectors[0]).toMatchObject({ endpointIds: expect.arrayContaining([scene.plot.series[0].points[0].id, scene.plot.series[1].points[0].id]), change: { visible: true, label: '+113%' } })
    const edited = plugin.compile(table, { ...source, dumbbellSort: 'start', dumbbellSortDirection: 'asc', seriesStyles: { ...source.seriesStyles, before: { color: '#6956e8' } } })
    if (edited.migrationMode !== 'native' || edited.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    expect(new Set(edited.plot.series.flatMap((series) => series.points.map((point) => point.id)))).toEqual(new Set(scene.plot.series.flatMap((series) => series.points.map((point) => point.id))))
  })

  it('keeps explicit dumbbell roles and source category order despite stale generic sorting', () => {
    const source = { ...config('dumbbell'), yFields: ['before', 'after'], dumbbellStartField: 'before', dumbbellEndField: 'after', seriesOrder: ['after', 'before'], barCategorySort: 'name-desc' as const }
    const scene = getChartPlugin('dumbbell').compile(table, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    expect(scene.plot.series.map((series) => [series.name, series.role])).toEqual([['before', 'start'], ['after', 'end']])
    expect(scene.plot.categories.map((category) => category.label)).toEqual(['A', 'B', 'C'])
  })

  it.each([['lollipop', 'vertical'], ['horizontal-lollipop', 'horizontal'], ['dumbbell', 'vertical'], ['dumbbell', 'horizontal']] as const)('%s resolves a strictly positive log domain and finite geometry in %s mode', (kind, orientation) => {
    const source = { ...config(kind), yFields: kind === 'dumbbell' ? ['before', 'after'] : ['value'], yAxisScaleType: 'log' as const, dumbbellStartField: 'before', dumbbellEndField: 'after', dumbbellOrientation: orientation }
    const scene = getChartPlugin(kind).compile(table, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    expect(scene.plot.valueDomain.min).toBeGreaterThan(0)
    expect(scene.plot.valueDomain.max).toBeGreaterThan(scene.plot.valueDomain.min)
    const resolved = resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene)
    expect(Object.values(resolved.comparisonGeometry.points).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
    const option = renderScene(resolved) as { xAxis: { type: string; min: number }; yAxis: { type: string; min: number } }
    const axis = orientation === 'horizontal' ? option.xAxis : option.yAxis
    expect(axis).toMatchObject({ type: 'log', min: scene.plot.valueDomain.min })
  })

  it.each([['lollipop', 'vertical'], ['horizontal-lollipop', 'horizontal'], ['dumbbell', 'vertical'], ['dumbbell', 'horizontal']] as const)('%s omits nonpositive log marks and unresolved connectors in %s mode', (kind, orientation) => {
    const logTable: DataTable = { name: 'log comparison', columns: ['category', 'value', 'before', 'after'], rows: [
      { category: 'positive', value: 4, before: 2, after: 4 },
      { category: 'zero', value: 0, before: 0, after: 4 },
      { category: 'negative', value: -2, before: 2, after: -1 },
    ] }
    const source = { ...config(kind), yFields: kind === 'dumbbell' ? ['before', 'after'] : ['value'], yAxisScaleType: 'log' as const, dumbbellStartField: 'before', dumbbellEndField: 'after', dumbbellOrientation: orientation }
    const scene = getChartPlugin(kind).compile(logTable, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    const resolved = resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene)
    expect(Object.keys(resolved.comparisonGeometry.connectors)).toHaveLength(1)
    expect(() => renderScene(resolved)).not.toThrow()
    const option = renderScene(resolved) as { graphic: Array<{ id?: string }> }
    expect(option.graphic.filter((item) => item.id?.startsWith('layer:comparison:'))).toHaveLength(1)
  })

  it.each(['lollipop', 'horizontal-lollipop'] as const)('%s direct-guide collision pass keeps labels in bounds and pairwise separated', (kind) => {
    const fields = ['Alpha extended', 'Beta extended', 'Gamma extended', 'Delta extended']
    const denseTable: DataTable = { name: 'dense guides', columns: ['category', ...fields], rows: [
      { category: 'A', ...Object.fromEntries(fields.map((field) => [field, 10])) },
      { category: 'B', ...Object.fromEntries(fields.map((field) => [field, 20])) },
    ] }
    const source = { ...config(kind), yFields: fields, showDirectLabels: true }
    const scene = getChartPlugin(kind).compile(denseTable, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    const resolved = resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene)
    const horizontal = kind === 'horizontal-lollipop'
    const minimum = horizontal ? resolved.geometry.plot.x : resolved.geometry.plot.y
    const maximum = horizontal ? resolved.geometry.plot.x + resolved.geometry.plot.width : resolved.geometry.plot.y + resolved.geometry.plot.height
    const bounds = Object.values(resolved.comparisonGeometry.directLabels).map((label) => {
      const center = horizontal ? label.x : label.y, half = (horizontal ? label.width : label.height) / 2
      return { start: center - half, end: center + half }
    }).sort((left, right) => left.start - right.start)
    expect(bounds).toHaveLength(fields.length)
    expect(bounds[0].start).toBeGreaterThanOrEqual(minimum)
    expect(bounds.at(-1)!.end).toBeLessThanOrEqual(maximum)
    bounds.slice(1).forEach((bound, index) => expect(bound.start).toBeGreaterThanOrEqual(bounds[index].end + 4 - 1e-6))
  })

  it('owns vertical category-grid geometry without ChartCanvas data conversion', () => {
    const source = { ...config('lollipop'), showVerticalGrid: true }
    const scene = getChartPlugin('lollipop').compile(table, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    const resolved = resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene)
    expect(resolved.comparisonGeometry.categoryGridLines).toHaveLength(scene.plot.categories.length)
    const option = renderScene(resolved) as { graphic: Array<{ id?: string }> }
    expect(option.graphic.filter((item) => item.id?.startsWith('comparison-category-grid:'))).toHaveLength(scene.plot.categories.length)
  })

  it('preserves custom mark/stem interaction styling and fully resolved direct guides', () => {
    const source = { ...config('lollipop'), yFields: ['before', 'after'], showDirectLabels: true, showDirectLabelLines: true, seriesStyles: { before: { legendNote: 'baseline' }, after: {} } }
    const scene = getChartPlugin('lollipop').compile(table, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    const resolved = resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene)
    const before = scene.plot.series.find((series) => series.name === 'before')!, after = scene.plot.series.find((series) => series.name === 'after')!
    expect(resolved.comparisonGeometry.directLabels[before.id]).toMatchObject({ collision: 'shift-y', leader: { points: expect.any(Array) }, noteY: expect.any(Number) })
    const option = renderScene(resolved) as { series: Array<{ name: string; data: Array<{ itemStyle: Record<string, unknown>; selectionTarget?: string }>; renderItem(params: { dataIndex: number }): { children: Array<{ info?: { selectionTarget?: string }; style?: Record<string, unknown> }> } }>; graphic: Array<{ comparisonConnectorSeriesNames?: string[]; children?: Array<{ style?: { opacity?: number } }> }> }
    applySeriesVisualState(option as unknown as Record<string, unknown>, table, source, 'before')
    expect(option.series.find((series) => series.name === 'after')?.data[0].itemStyle.opacity).toBe(.22)
    const afterMark = option.series.find((series) => series.name === 'after')!
    expect(afterMark.renderItem({ dataIndex: 0 }).children[0].style?.opacity).toBe(.22)
    expect(option.graphic.find((item) => item.comparisonConnectorSeriesNames?.includes('after'))?.children?.[0].style?.opacity).toBeCloseTo(.72 * .22)
    const beforeGuide = option.series.find((series) => series.name === '__comparison-direct-guide:before')!
    expect(beforeGuide.data[0].selectionTarget).toBe('guide')
    expect(beforeGuide.renderItem({ dataIndex: 0 }).children.some((child) => child.info?.selectionTarget === 'guide')).toBe(true)
    expect(resolved.comparisonGeometry.directLabels[after.id].collision).toBe('shift-y')
  })

  it('resolves all mark geometry before the renderer and renders without DataTable access', () => {
    const source = { ...config('dumbbell'), dumbbellStartField: 'before', dumbbellEndField: 'after', dumbbellShowDifference: true }
    const scene = getChartPlugin('dumbbell').compile(table, source)
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'comparison-stem') throw new Error('Expected native comparison/stem scene')
    const resolved = resolveNativeComparisonStemScene(scene as NativeComparisonStemChartScene)
    expect(Object.keys(resolved.comparisonGeometry.points)).toHaveLength(6)
    expect(Object.keys(resolved.comparisonGeometry.connectors)).toHaveLength(3)
    const option = renderScene(resolved) as { series: Array<{ type: string; coordinateSystem: string }>; graphic: Array<{ id?: string }> }
    expect(option.series.every((series) => series.type === 'custom' && series.coordinateSystem === 'none')).toBe(true)
    expect(option.graphic.some((item) => String(item.id).startsWith('layer:comparison:'))).toBe(true)
  })

  it('physically blocks the removed legacy runtime builder', () => {
    expect(legacyComparisonStemBuilderGuard).toThrow('Legacy Lollipop/Dumbbell builder was removed')
  })
})
