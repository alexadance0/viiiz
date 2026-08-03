import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin, chartValueLabelSelections } from '../../../core/chartRegistry'
import { nativeMarkSelections } from '../../../entities/chart/model/sceneVisitors'
import { resolveNativeCartesianScene } from '../bar/layout'
import { compileNativeSmoothingScene, smoothingLayerId } from './compiler'
import { movingAverage, normalizeMovingAverageWindow } from './movingAverage'
import { smoothingFixtures } from '../../../test-fixtures/charts/smoothing'

const table: DataTable = { name: 'smooth', columns: ['period', 'a', 'b'], rows: [
  { period: 'A', a: 1, b: 10 }, { period: 'B', a: 2, b: 20 }, { period: 'C', a: 3, b: null }, { period: 'D', a: 4, b: 40 }, { period: 'E', a: 5, b: 50 },
] }
const config = (kind: 'moving-average-line' | 'moving-average-scatter', overrides: Partial<ChartConfig> = {}): ChartConfig => ({
  ...createDefaultChartConfig(), kind, xField: 'period', yField: 'a', yFields: ['a', 'b'], movingAverageWindow: 3, showLegend: true, ...overrides,
})

describe('native smoothing compiler', () => {
  it.each(smoothingFixtures)('compiles deterministic characterization fixture: $name', ({ table: sourceTable, config: sourceConfig }) => {
    for (const kind of ['moving-average-line', 'moving-average-scatter'] as const) {
      const scene = compileNativeSmoothingScene(sourceTable, { ...sourceConfig, kind })
      expect(scene.plot.sourceGroups).toHaveLength(scene.plot.layers.length / 2)
      expect(new Set(scene.plot.layers.map((layer) => layer.id)).size).toBe(scene.plot.layers.length)
      expect(new Set(scene.plot.layers.flatMap((layer) => layer.points.map((point) => point.id))).size).toBe(scene.plot.layers.flatMap((layer) => layer.points).length)
    }
  })

  it('normalizes once and applies a trailing inclusive full finite window', () => {
    expect(normalizeMovingAverageWindow(2.6)).toBe(3)
    expect(normalizeMovingAverageWindow(-20)).toBe(2)
    expect(normalizeMovingAverageWindow(999)).toBe(999)
    expect(movingAverage([1, 2, 3, 4, null, 6], 3)).toEqual([null, null, 2, 3, null, null])
  })

  it.each(['moving-average-line', 'moving-average-scatter'] as const)('%s compiles source groups and explicit stable layers', (kind) => {
    const first = compileNativeSmoothingScene(table, config(kind))
    const changed = compileNativeSmoothingScene(table, config(kind, { movingAverageWindow: 4, movingAverageRawOpacity: .7, canvasWidth: 700 }))
    expect(getChartPlugin(kind).compilerMode).toBe('native')
    expect(first.plot).toMatchObject({ kind: 'smoothing', variant: kind, window: 3 })
    expect(first.plot.sourceGroups).toHaveLength(2)
    expect(first.plot.layers.map((layer) => [layer.role, layer.renderMode])).toEqual(kind === 'moving-average-line'
      ? [['raw', 'line'], ['average', 'line'], ['raw', 'line'], ['average', 'line']]
      : [['raw', 'points'], ['average', 'line'], ['raw', 'points'], ['average', 'line']])
    expect(changed.plot.layers.map((layer) => layer.id)).toEqual(first.plot.layers.map((layer) => layer.id))
    expect(first.plot.sourceGroups[0].rawLayerId).toBe(smoothingLayerId(first.plot.sourceGroups[0].sourceSeriesId, 'raw'))
  })

  it('derives stable point identities from layer and source datum identity, never values', () => {
    const first = compileNativeSmoothingScene(table, config('moving-average-line'))
    const changed = compileNativeSmoothingScene(table, config('moving-average-line', { movingAverageWindow: 4 }))
    const average = first.plot.layers.find((layer) => layer.role === 'average')!
    const changedAverage = changed.plot.layers.find((layer) => layer.role === 'average')!
    expect(changedAverage.points.map((point) => [point.id, point.datumId])).toEqual(average.points.map((point) => [point.id, point.datumId]))
    expect(average.points[2].provenance).toMatchObject({ transform: 'moving-average', sourceSeriesId: average.sourceSeriesId, sourceDatumId: expect.any(String), window: 3 })
  })

  it('keeps raw points editable and derived points out of source-data selection', () => {
    const scene = compileNativeSmoothingScene(table, config('moving-average-line', { showValues: true }))
    expect(scene.plot.layers.filter((layer) => layer.role === 'raw').flatMap((layer) => layer.points).every((point) => point.editable && !point.label.visible)).toBe(true)
    expect(scene.plot.layers.filter((layer) => layer.role === 'average').flatMap((layer) => layer.points).every((point) => !point.editable && point.role === 'derived' && point.label.visible)).toBe(true)
    expect(nativeMarkSelections(scene)).toHaveLength(table.rows.length * 2)
    expect(chartValueLabelSelections(table, config('moving-average-line'))).toHaveLength(table.rows.length * 2 - 1)
  })

  it('uses layer legend targets and average-only direct identification with source text styles', () => {
    const scene = compileNativeSmoothingScene(table, config('moving-average-scatter', { showLegend: false, showDirectLabels: true, seriesStyles: { a: { legendLabel: 'Alpha', legendNote: 'note', showDirectLabel: true } } }))
    const legend = scene.guides.find((guide) => guide.kind === 'categorical-legend')!
    const direct = scene.guides.find((guide) => guide.kind === 'direct-series')!
    expect(legend.items.every((item) => item.target.kind === 'layer')).toBe(true)
    expect(legend.items[0]).toMatchObject({ label: 'Alpha · исходные значения', marker: { kind: 'point' } })
    expect(direct.items[0]).toMatchObject({ seriesId: scene.plot.sourceGroups[0].averageLayerId, label: 'Alpha', note: 'note', visible: true })
    expect(direct.items).toHaveLength(scene.plot.sourceGroups.length)
  })

  it('shares Cartesian rails, domains, top/right axes, multiline and rotated labels with Line', () => {
    const overrides: Partial<ChartConfig> = { xAxisPosition: 'top', yAxisPosition: 'right', xAxisLabelRotate: 45, categoryLabelOverrides: { x: { '0:A': 'First\nlong label', '4:E': 'Last long label' } }, yAxisMin: -5, yAxisMax: 80, showZeroLine: true }
    const smooth = resolveNativeCartesianScene(compileNativeSmoothingScene(table, config('moving-average-line', overrides)))
    const line = getChartPlugin('line').compile(table, { ...config('moving-average-line', overrides), kind: 'line' })
    if (line.migrationMode !== 'native') throw new Error('Expected native Line')
    const resolvedLine = resolveNativeCartesianScene(line)
    expect(smooth.geometry.axes.value).toEqual(resolvedLine.geometry.axes.value)
    expect(smooth.geometry.plot.x).toBe(resolvedLine.geometry.plot.x)
    expect(smooth.plot.valueDomain).toMatchObject({ min: -5, max: 80 })
    expect(smooth.geometry.reservations['axis:category-edge']).toBeUndefined()
  })

  it('rejects every kind outside the smoothing boundary and contains no renderer vocabulary', () => {
    expect(() => compileNativeSmoothingScene(table, { ...config('moving-average-line'), kind: 'line' })).toThrow(/cannot compile line/)
    expect(JSON.stringify(compileNativeSmoothingScene(table, config('moving-average-line')))).not.toMatch(/boundaryGap|connectNulls|smoothMonotone|labelLayout|endLabel/)
  })
})
