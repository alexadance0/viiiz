import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeXYScene } from '../../chart-types/xy/compiler'
import { resolveNativeXYScene } from '../../chart-types/xy/layout'
import { renderXYScene } from './renderXYScene'

const table: DataTable = { name: 'xy', columns: ['x', 'y', 'size', 'group'], rows: [{ x: 1, y: 2, size: 10, group: 'A' }, { x: 2, y: 4, size: 100, group: 'A' }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'bubble', xField: 'x', yField: 'y', yFields: ['y'], scatterSizeField: 'size', aggregation: 'none', ...overrides })

describe('native XY ECharts adapter', () => {
  it('spaces logarithmic ticks by integer orders of magnitude for the available height', () => {
    const logTable = { ...table, rows: [{ x: 1, y: 4e-14 }, { x: 2, y: 5e11 }] }
    const scene = resolveNativeXYScene(compileNativeXYScene(logTable, config({ kind: 'scatter', scatterSizeField: '', yAxisScaleType: 'log' })))
    const option = renderXYScene(scene) as { yAxis: { interval: number; axisLabel: { formatter(value: number): string } } }
    expect(Number.isInteger(option.yAxis.interval)).toBe(true)
    expect(option.yAxis.interval).toBeGreaterThanOrEqual(1)
    expect(option.yAxis.interval).toBeLessThan(10)
    expect(option.yAxis.axisLabel.formatter(1e-14)).toBe('1E-14')
    const smaller = renderXYScene({ ...scene, geometry: { ...scene.geometry, plot: { ...scene.geometry.plot, height: scene.geometry.plot.height / 2 } } }) as typeof option
    expect(smaller.yAxis.interval).toBeGreaterThan(option.yAxis.interval)
  })
  it('shows and escapes the point name in tooltips even when labels are hidden', () => {
    const scene = resolveNativeXYScene(compileNativeXYScene({ ...table, columns: [...table.columns, 'name'], rows: [{ x: 1, y: 2, name: 'Model <A>' }] }, config({ kind: 'scatter', scatterSizeField: '', scatterLabelField: 'name', scatterShowLabels: false })))
    const option = renderXYScene(scene) as { series: Array<{ type: string; data: unknown[] }>; tooltip: { formatter(input: unknown): string } }
    const point = option.series.find((series) => series.type === 'scatter')!.data[0]
    expect(option.tooltip.formatter({ seriesName: 'y', data: point })).toContain('Model &lt;A&gt;')
  })
  it('renders semantic source and derived layers without markLine, markArea or fake source series', () => {
    const scene = resolveNativeXYScene(compileNativeXYScene(table, config({ scatterTrendline: true, scatterTrendBand: true, scatterXReference: 1.5, scatterYReference: 3, scatterQuadrants: true })))
    const option = renderXYScene(scene) as { xAxis: { type: string; axisLabel: { align: string } }; series: Array<{ type: string; name: string; markLine?: unknown; markArea?: unknown; data: Array<{ symbolSize?: unknown }> }>; graphic: Array<{ id?: string }>; tooltip: { formatter(input: unknown): string } }
    expect(option.xAxis.type).toBe('value')
    expect(option.xAxis.axisLabel.align).toBe('center')
    expect(option.series.some((series) => series.markLine || series.markArea)).toBe(false)
    expect(option.series.filter((series) => series.type === 'scatter')).toHaveLength(1)
    expect(option.series.find((series) => series.type === 'scatter')?.data.every((point) => typeof point.symbolSize === 'number')).toBe(true)
    expect(option.graphic.some((item) => item.id === 'guide:size-scale')).toBe(true)
    const point = option.series.find((series) => series.type === 'scatter')!.data[0]
    expect(option.tooltip.formatter({ seriesName: 'y', data: { ...point, displayCategory: '1', displayValue: '2', displaySizeValue: '10' } })).toContain('size: <b>10</b>')
  })
})
