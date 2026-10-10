import { describe, expect, it } from 'vitest'
import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { getChartPlugin } from '../../../core/chartRegistry'
import { renderScene } from '../../chart-renderer/echarts/renderScene'
import { compileStreamScene } from './compiler'
import { resolveNativeScene } from '../../chart-renderer/echarts/renderScene'

const table: DataTable = { name: 'streams', columns: ['period', 'A', 'B'], rows: [
  { period: 'Jan', A: 10, B: 20 }, { period: 'Feb', A: 30, B: 10 }, { period: 'Mar', A: 20, B: 30 },
] }
const config: ChartConfig = { ...createDefaultChartConfig(), ...getChartPlugin('stream-graph').defaultConfig, kind: 'stream-graph', xField: 'period', yField: 'A', yFields: ['A', 'B'], streamOrder: 'data' }

describe('Stream Graph', () => {
  it('uses internal labels without reserving an outside legend rail', () => {
    const scene = compileStreamScene(table, config)
    expect(scene.guides.find((guide) => guide.kind === 'categorical-legend')?.visible).toBe(false)
    expect(scene.guides.find((guide) => guide.kind === 'direct-series')).toMatchObject({ visible: true, placement: 'inside' })
    const resolved = resolveNativeScene(scene)
    expect(resolved.geometry.reservations['guide:direct-series']).toBeUndefined()
    expect(resolved.geometry.reservations['guide:legend']).toBeUndefined()
  })
  it.each([
    ['default', config],
    ['unset', { ...config, streamBaseline: undefined }],
    ['explicit', { ...config, streamBaseline: 'centered' as const }],
  ])('preserves original values and thickness with a centered baseline (%s)', (_, centeredConfig) => {
    const snapshot = structuredClone(table)
    expect(getChartPlugin('stream-graph').defaultConfig.streamBaseline).toBe('centered')
    const scene = compileStreamScene(table, centeredConfig)
    expect(scene.document.chart).toMatchObject({ family: 'area', kind: 'stream-graph', stacking: 'stacked' })
    expect(scene.plot.series[0].points.map((point) => point.value)).toEqual([10, 30, 20])
    expect(scene.plot.series[0].streamBands).toEqual([{ lower: -15, upper: -5 }, { lower: -20, upper: 10 }, { lower: -25, upper: -5 }])
    for (const [column, band] of scene.plot.series[0].streamBands!.entries()) {
      expect(band.lower + scene.plot.series.at(-1)!.streamBands![column].upper).toBe(0)
    }
    for (const [index, layer] of scene.plot.series.entries()) for (const [column, band] of layer.streamBands!.entries()) {
      expect(band.upper - band.lower).toBe(layer.points[column].value)
      if (index) expect(band.lower).toBe(scene.plot.series[index - 1].streamBands![column].upper)
    }
    expect(table).toEqual(snapshot)
  })
  it('uses the weighted wiggle offset and renders smooth bands with truthful selection data', () => {
    const scene = compileStreamScene(table, { ...config, streamBaseline: 'wiggle' })
    expect(scene.plot.series[0].streamBands!.map((band) => band.lower)).toEqual([-14.75, -26, -24])
    const option = renderScene(scene) as { series: Array<{ type: string; data: Array<{ displayValue: string }>; renderItem?: (params: { dataIndex: number }, api: { coord(value: unknown[]): [number, number] }) => { shape: { pathData: string } } }> }
    const band = option.series.find((item) => item.type === 'custom')!
    expect(band.data[0].displayValue).toBe('10')
    expect(band.renderItem!({ dataIndex: 0 }, { coord: (value) => [String(value[0]).startsWith('0:') ? 0 : 100, Number(value[1])] }).shape.pathData).toContain('C')
    expect(scene.plot.valueDomain.min).toBeLessThanOrEqual(-26)
    expect(scene.plot.valueDomain.max).toBeGreaterThanOrEqual(26)
  })
  it('supports long data, aggregation, explicit layer order and missing values', () => {
    expect(compileStreamScene(table, { ...config, streamOrder: 'inside-out' }).plot.series.map((item) => item.name)).toEqual(['B', 'A'])
    const long: DataTable = { name: 'long', columns: ['period', 'series', 'value'], rows: [
      { period: 'Jan', series: 'A', value: 2 }, { period: 'Jan', series: 'A', value: 3 }, { period: 'Jan', series: 'B', value: 8 },
      { period: 'Feb', series: 'B', value: 4 }, { period: 'Mar', series: 'A', value: 6 }, { period: 'Mar', series: 'B', value: 2 },
    ] }
    const scene = compileStreamScene(long, { ...config, yField: 'value', yFields: ['value'], seriesField: 'series', streamOrder: 'inside-out', seriesOrder: ['B', 'A'] })
    expect(scene.plot.series.map((item) => item.name)).toEqual(['B', 'A'])
    expect(scene.plot.series[1].points.map((point) => point.value)).toEqual([5, 0, 6])
    const gap = compileStreamScene(long, { ...config, yField: 'value', yFields: ['value'], seriesField: 'series', missingMode: 'gap' })
    expect(gap.plot.series[0].points[1].value).toBeNull()
  })
  it('rejects negative, nonfinite, overflowing and single-position inputs, and handles all zero values', () => {
    for (const value of [-1, Infinity, NaN, Number.MAX_VALUE]) {
      const invalid = { ...table, rows: table.rows.map((row) => ({ ...row, A: value, B: value })) }
      expect(getChartPlugin('stream-graph').validate(invalid, config).ok).toBe(false)
      expect(() => compileStreamScene(invalid, config)).toThrow()
    }
    expect(getChartPlugin('stream-graph').validate({ ...table, rows: table.rows.slice(0, 1) }, config).ok).toBe(false)
    const zero = compileStreamScene({ ...table, rows: table.rows.map((row) => ({ ...row, A: 0, B: 0 })) }, config)
    expect(zero.plot.series.every((item) => item.streamBands!.every((band) => band.lower === 0 && band.upper === 0))).toBe(true)
    expect(zero.plot.valueDomain.max).toBeGreaterThan(zero.plot.valueDomain.min)
  })
})
