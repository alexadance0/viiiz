import { describe, expect, it } from 'vitest'
import { getChartPlugin, legacyComparisonStemBuilderGuard } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import { renderScene } from '../../chart-renderer/echarts/renderScene'
import { resolveNativeComparisonStemScene } from './layout'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { NativeComparisonStemChartScene } from '../../../entities/chart/model/ChartScene'

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
