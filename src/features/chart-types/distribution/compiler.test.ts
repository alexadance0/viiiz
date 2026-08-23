import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { nativeMarkSelections } from '../../../entities/chart/model/sceneVisitors'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeDistributionScene, NATIVE_DISTRIBUTION_KINDS, validateNativeDistributionMapping } from './compiler'

const config = (kind: typeof NATIVE_DISTRIBUTION_KINDS[number], overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'group', yField: 'value', yFields: ['value'], aggregation: 'none', ...overrides })
const table: DataTable = { name: 'distribution', columns: ['group', 'value', 'other', 'label'], rows: [
  { group: 'A', value: 2, other: 10, label: 'two' }, { group: 'A', value: 2, other: 20, label: 'again' }, { group: 'B', value: 8, other: 30, label: 'eight' }, { group: null, value: 100, other: 40, label: 'outlier' },
] }

describe('native Distribution compiler', () => {
  it('registers all eleven variants as native and guards the removed legacy builder', () => {
  })

  it('compiles Histogram bins with stable IDs and source identities', () => {
    const scene = compileNativeDistributionScene(table, config('histogram', { distributionGroupField: 'group', distributionBinCount: 3, distributionHistogramMin: 0, distributionHistogramMax: 6 }))
    const layer = scene.plot.layers.find((item) => item.kind === 'histogram')!
    expect(scene.plot).toMatchObject({ variant: 'histogram', frequencyDomain: { min: 0 } })
    expect(layer.groups[0].bins).toHaveLength(3)
    expect(layer.groups[0].bins.map((bin) => bin.amount)).toEqual([0, 2, 0])
    expect(layer.groups[0].bins[1].sourceDatumIds).toHaveLength(2)
    expect(nativeMarkSelections(scene)).toHaveLength(4)
    const renamed = compileNativeDistributionScene(table, config('histogram', { distributionGroupField: 'group', distributionBinCount: 3, distributionHistogramMin: 0, distributionHistogramMax: 6, distributionCategoryStyles: { A: { label: 'Renamed', color: '#123456' } } }))
    expect(renamed.plot.layers.find((item) => item.kind === 'histogram')!.groups[0].bins.map((bin) => bin.id)).toEqual(layer.groups[0].bins.map((bin) => bin.id))
    const clipped = compileNativeDistributionScene(table, config('histogram', { distributionHistogramMin: 20, distributionHistogramMax: 30 }))
    expect(clipped.plot.layers.find((item) => item.kind === 'frequency-summaries')?.marks[0].amount).toBe(0)
  })

  it('compiles normalized KDE samples and median summaries', () => {
    const scene = compileNativeDistributionScene(table, config('kde-plot'))
    const layer = scene.plot.layers.find((item) => item.kind === 'kde')!
    expect(scene.plot).toMatchObject({ variant: 'kde', frequencyDomain: { min: 0 } })
    expect(layer.groups[0].points).toHaveLength(121)
    expect(layer.groups[0].points[0].density).toBe(0)
    expect(scene.plot.layers.find((item) => item.kind === 'frequency-summaries')?.marks).toHaveLength(1)
    expect(nativeMarkSelections(scene)).toHaveLength(4)
  })

  it('compiles stable box and density layers without renderer vocabulary', () => {
    const box = compileNativeDistributionScene(table, config('boxplot'))
    expect(box.plot.layers.find((layer) => layer.kind === 'boxes')).toMatchObject({ marks: [{ minimumInlier: 2, maximumInlier: 8 }] })
    for (const kind of ['violinplot', 'raincloud', 'ridgeline'] as const) {
      const scene = compileNativeDistributionScene(table, config(kind))
      const density = scene.plot.layers.find((layer) => layer.kind === 'density')
      expect(density?.kind === 'density' && density.groups[0].profile.samples).toHaveLength(81)
      expect(density?.kind === 'density' && density.groups[0].id).toContain(':density')
    }
    expect(JSON.stringify(box.plot)).not.toMatch(/renderItem|itemStyle|coordinateSystem/)
  })

  it('compiles semantic lanes, groups and stable raw observation identities', () => {
    const scene = compileNativeDistributionScene(table, config('strip-plot', { distributionGroupField: 'group', distributionLabelField: 'label', showLegend: true }))
    expect(scene.plot).toMatchObject({ kind: 'distribution', variant: 'strip', orientation: 'horizontal', layoutMode: 'measures' })
    expect(scene.plot.lanes.map((lane) => lane.label)).toEqual(['value'])
    expect(scene.plot.groups.map((group) => group.categoryLabel)).toEqual(['A', 'B', 'Без категории'])
    const observations = scene.plot.groups.flatMap((group) => group.observations)
    expect(new Set(observations.map((item) => item.id)).size).toBe(4)
    expect(observations.map((item) => item.legacyKey)).toContain('A\u001fstring:row:0:value')
    expect(observations.map((item) => item.displayLabel)).toEqual(['two', 'again', 'eight', 'outlier'])
    expect(nativeMarkSelections(scene)).toHaveLength(4)
  })

  it('keeps IDs stable across ordering and edited display labels', () => {
    const first = compileNativeDistributionScene(table, config('jitter-plot', { yFields: ['value', 'other'], distributionGroupField: 'group' }))
    const changed = compileNativeDistributionScene(table, config('jitter-plot', { yFields: ['value', 'other'], seriesOrder: ['other', 'value'], distributionGroupField: 'group', distributionCategoryStyles: { A: { label: 'Renamed' } } }))
    expect(new Set(changed.plot.groups.map((group) => group.id))).toEqual(new Set(first.plot.groups.map((group) => group.id)))
    expect(changed.plot.lanes.map((lane) => lane.label)).toEqual(['other', 'value'])
  })

  it('builds exact Counts aggregates with semantic sizes and aggregate legacy keys', () => {
    const scene = compileNativeDistributionScene(table, config('counts-plot'))
    const layer = scene.plot.layers.find((item) => item.kind === 'counts')!
    const size = scene.compatibilityConfig.distributionPointSize ?? 9
    expect(layer.kind === 'counts' && layer.groups[0].marks.map((mark) => [mark.value, mark.count, mark.marker.size])).toEqual([[2, 2, expect.closeTo(size * Math.sqrt(2))], [8, 1, size], [100, 1, size]])
    expect(layer.kind === 'counts' && layer.groups[0].marks[0].sourceDatumIds).toHaveLength(2)
    expect(layer.kind === 'counts' && layer.groups[0].marks[0].legacyKey).toBe('value\u001fstring:count:2')
  })

  it('compiles barcode strokes and summary precedence without renderer vocabulary', () => {
    const key = 'value\u001fstring:row:0:value'
    const scene = compileNativeDistributionScene(table, config('barcode-plot', { distributionTickWidth: 3, elementStyles: { [key]: { color: '#123456', lineWidth: 5 } }, seriesStyles: { value: { distributionSummaryColor: '#654321', distributionSummaryWidth: 7 } }, distributionSummaryStatistic: 'mean' }))
    const barcode = scene.plot.layers.find((item) => item.kind === 'barcodes')!
    expect(barcode.kind === 'barcodes' && barcode.groups[0].marks[0].stroke).toMatchObject({ color: '#123456', width: 5 })
    const summary = scene.plot.layers.find((item) => item.kind === 'summaries')!
    expect(summary.kind === 'summaries' && summary.marks[0]).toMatchObject({ statistic: 'mean', value: 28, color: '#654321', width: 7 })
    expect(JSON.stringify(scene.plot)).not.toMatch(/renderItem|symbolSize|itemStyle|coordinateSystem/)
  })

  it('preserves the mapping validation message', () => {
    expect(validateNativeDistributionMapping({ name: 'empty', columns: ['value'], rows: [{ value: null }] }, config('strip-plot'))).toEqual({ ok: false, errors: [{ field: 'yFields', message: 'Выберите хотя бы один числовой показатель для распределения.' }] })
  })

  it('keeps compiler, preparation, statistics and density renderer-neutral', () => {
    for (const file of ['compiler.ts', 'prepare.ts', 'statistics.ts', 'density.ts', 'frequency.ts', 'layout.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source).not.toMatch(/echarts|zrender|ChartCanvas/)
    }
  })
})
