import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeXYScene } from '../../chart-types/xy/compiler'
import { resolveNativeXYScene } from '../../chart-types/xy/layout'
import { renderXYScene } from './renderXYScene'

const table: DataTable = { name: 'xy', columns: ['x', 'y', 'size', 'group'], rows: [{ x: 1, y: 2, size: 10, group: 'A' }, { x: 2, y: 4, size: 100, group: 'A' }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'bubble', xField: 'x', yField: 'y', yFields: ['y'], scatterSizeField: 'size', aggregation: 'none', ...overrides })

describe('native XY ECharts adapter', () => {
  it('renders semantic source and derived layers without markLine, markArea or fake source series', () => {
    const scene = resolveNativeXYScene(compileNativeXYScene(table, config({ scatterTrendline: true, scatterTrendBand: true, scatterXReference: 1.5, scatterYReference: 3, scatterQuadrants: true })))
    const option = renderXYScene(scene) as { xAxis: { type: string }; series: Array<{ type: string; name: string; markLine?: unknown; markArea?: unknown; data: Array<{ symbolSize?: unknown }> }>; graphic: Array<{ id?: string }>; tooltip: { formatter(input: unknown): string } }
    expect(option.xAxis.type).toBe('value')
    expect(option.series.some((series) => series.markLine || series.markArea)).toBe(false)
    expect(option.series.filter((series) => series.type === 'scatter')).toHaveLength(1)
    expect(option.series.find((series) => series.type === 'scatter')?.data.every((point) => typeof point.symbolSize === 'number')).toBe(true)
    expect(option.graphic.some((item) => item.id === 'guide:size-scale')).toBe(true)
    const point = option.series.find((series) => series.type === 'scatter')!.data[0]
    expect(option.tooltip.formatter({ seriesName: 'y', data: { ...point, displayCategory: '1', displayValue: '2', displaySizeValue: '10' } })).toContain('size: <b>10</b>')
  })
})
