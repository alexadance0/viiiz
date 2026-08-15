import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeDistributionScene, type NativeDistributionKind } from '../../chart-types/distribution/compiler'
import { resolveNativeDistributionScene } from '../../chart-types/distribution/layout'
import { renderScene } from './renderScene'

const table: DataTable = { name: 'renderer', columns: ['value'], rows: [{ value: 1 }, { value: 1 }, { value: 2 }] }
const config = (kind: NativeDistributionKind, overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'value', yField: 'value', yFields: ['value'], aggregation: 'none', ...overrides })
const render = (kind: NativeDistributionKind, overrides: Partial<ChartConfig> = {}) => renderScene(resolveNativeDistributionScene(compileNativeDistributionScene(table, config(kind, overrides)))) as { series: Array<{ type: string; data: Array<{ elementId: string; datumId: string; seriesId: string; elementKey: string; symbolSize?: number }> }>; graphic: Array<{ id?: string }>; xAxis: { type: string }; yAxis: { type: string } }

describe('native Distribution renderer', () => {
  it('maps resolved points/counts and barcode primitives with native metadata', () => {
    expect(render('strip-plot').series.every((series) => series.type === 'scatter')).toBe(true)
    const counts = render('counts-plot').series[0]
    expect(counts.data.map((mark) => mark.symbolSize)).toEqual([8 * Math.sqrt(2), 8])
    expect(typeof (counts as unknown as { symbolSize?: unknown }).symbolSize).not.toBe('function')
    expect(render('barcode-plot').series.every((series) => series.type === 'custom')).toBe(true)
    expect(counts.data[0]).toMatchObject({ elementId: expect.any(String), datumId: expect.any(String), seriesId: expect.any(String), elementKey: expect.any(String) })
  })

  it('draws semantic lane grids and summaries without fake series', () => {
    const option = render('jitter-plot', { showHorizontalGrid: true, showVerticalGrid: false })
    expect(option.series.some((series) => (series as unknown as { name?: string }).name === '__distribution-grid')).toBe(false)
    expect(option.graphic.some((item) => item.id?.startsWith('distribution-grid:'))).toBe(true)
    expect(option.graphic.some((item) => item.id?.startsWith('summary:'))).toBe(true)
    expect(option.xAxis.type).toBe('value')
    expect(option.yAxis.type).toBe('value')
  })

  it('draws pre-resolved box and density shapes in the shared native renderer', () => {
    expect(render('boxplot').series.some((series) => series.type === 'custom')).toBe(true)
    for (const kind of ['violinplot', 'raincloud', 'ridgeline'] as const) expect(render(kind).series[0].type).toBe('custom')
  })

  it('adapts resolved Histogram and KDE geometry without renderer-side math', () => {
    const histogram = render('histogram', { distributionBinCount: 4 })
    expect(histogram.series).toHaveLength(1)
    expect(histogram.series[0]).toMatchObject({ type: 'custom', data: expect.arrayContaining([expect.objectContaining({ elementId: expect.any(String), datumId: expect.any(String) })]) })
    expect(histogram.graphic.some((item) => item.id?.includes('frequency-summary'))).toBe(true)
    expect(render('kde-plot').series[0]).toMatchObject({ type: 'custom' })
  })

  it('does not import or inspect a DataTable and leaves placement work outside renderer', () => {
    const source = readFileSync(new URL('./renderDistributionScene.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/DataTable|Math\.random|fitSwarm|deterministicDistributionOffset|distributionStatistics|distributionDensity|distributionQuantile|bandwidth/)
  })
})
