import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resolveNativeScene, renderScene } from '../../chart-renderer/echarts/renderScene'
import { compileNativeBumpScene, rankBumpData } from './compiler'

const table: DataTable = { name: 'ranking', columns: ['period', 'A', 'B', 'C'], rows: [
  { period: '2024', A: 20, B: 20, C: -5 },
  { period: '2025', A: null, B: 12, C: 30 },
] }
const config: ChartConfig = { ...createDefaultChartConfig(), kind: 'bump', xField: 'period', yField: 'A', yFields: ['A', 'B', 'C'], showDirectLabels: true, showLegend: false }

describe('bump chart', () => {
  it('ranks each period with ties, negatives, missing values and either direction without mutating data', () => {
    const data = { categories: ['a', 'b'], series: [{ name: 'A', data: [20, null] }, { name: 'B', data: [20, 12] }, { name: 'C', data: [-5, 30] }] }
    expect(rankBumpData(data, 'value', 'desc').series.map((item) => item.data)).toEqual([[1, null], [1, 2], [3, 1]])
    expect(rankBumpData(data, 'value', 'asc').series.map((item) => item.data)).toEqual([[2, null], [2, 1], [1, 2]])
    expect(data.series[0].data).toEqual([20, null])
    expect(rankBumpData({ categories: ['a'], series: [{ name: 'A', data: [NaN] }, { name: 'B', data: [Infinity] }] }, 'value', 'desc').series.map((item) => item.data)).toEqual([[null], [null]])
  })

  it('keeps ranks independent of stale percent, log, zero-fill and formatting settings', () => {
    const scene = compileNativeBumpScene(table, { ...config, valueMode: 'percent', missingMode: 'zero', yAxisScaleType: 'log', yAxisMin: 100, yAxisMax: 1000, numberOperation: 'multiply', numberFactor: 100, numberSuffix: '%' })
    expect(scene.plot.series.map((item) => item.points.map((point) => point.value))).toEqual([[1, null], [1, 2], [3, 1]])
    expect(scene.plot.valueDomain).toEqual({ min: 1, max: 3, step: 1 })
    expect(scene.plot.valueAxisInverse).toBe(true)
    expect(scene.plot.series[0].points[0].label.text).toBe('1')
    expect(scene.plot.series[0].points[0].marker.visible).toBe(true)
    expect(scene.document.chart).toMatchObject({ family: 'line', kind: 'bump', rankMode: 'value' })
  })

  it('preserves supplied ranks and rejects invalid places or insufficient comparisons', () => {
    const ranked: DataTable = { ...table, rows: [{ period: '2024', A: 2, B: 1, C: 4 }, { period: '2025', A: 1, B: 3, C: 2 }] }
    expect(compileNativeBumpScene(ranked, { ...config, bumpMode: 'rank' }).plot.series[0].points.map((point) => point.value)).toEqual([2, 1])
    expect(getChartPlugin('bump').validate(ranked, { ...config, bumpMode: 'rank' }).ok).toBe(true)
    expect(getChartPlugin('bump').validate(table, { ...config, bumpMode: 'rank' }).errors).toContainEqual(expect.objectContaining({ field: 'bumpMode' }))
    expect(getChartPlugin('bump').validate({ ...ranked, rows: ranked.rows.slice(0, 1) }, config).errors).toContainEqual(expect.objectContaining({ field: 'xField' }))
    expect(getChartPlugin('bump').validate(ranked, { ...config, yFields: ['A'] }).errors).toContainEqual(expect.objectContaining({ field: 'yField' }))
  })

  it('aggregates long tables before ranking, with stable source selections and informative tooltips', () => {
    const long: DataTable = { name: 'long', columns: ['period', 'brand', 'sales'], rows: [
      { period: 2024, brand: 'A', sales: 4 }, { period: 2024, brand: 'A', sales: 7 }, { period: 2024, brand: 'B', sales: 10 },
      { period: 2025, brand: 'A', sales: 2 }, { period: 2025, brand: 'B', sales: 3 },
    ] }
    const mapping: ChartConfig = { ...config, yField: 'sales', yFields: ['sales'], seriesField: 'brand', aggregation: 'sum' }
    const scene = compileNativeBumpScene(long, mapping)
    expect(scene.plot.series.map((item) => item.points.map((point) => point.value))).toEqual([[1, 2], [2, 1]])
    expect(scene.plot.series[0].points[0].displayValue).toBe('1 место · 11')
    const reversed = compileNativeBumpScene(long, { ...mapping, bumpRankDirection: 'asc', seriesOrder: ['B', 'A'] })
    expect(reversed.plot.series[1].points[0].id).toBe(scene.plot.series[0].points[0].id)
    expect(scene.elements.filter((item) => item.role === 'mark').every((item) => item.selectable)).toBe(true)
  })

  it('reserves both endpoint rails and renders first place at the top through the shared line renderer', () => {
    const resolved = resolveNativeScene(compileNativeBumpScene(table, config))
    expect(resolved.geometry.reservations['guide:bump-start']?.width).toBeGreaterThan(0)
    expect(resolved.geometry.reservations['guide:direct-series']?.width).toBeGreaterThan(0)
    const option = renderScene(resolved) as { yAxis: { inverse: boolean }; series: Array<{ name: string; endLabel?: { show: boolean }; data: Array<{ label: { position: string }; displayValue: string }> }> }
    expect(option.yAxis.inverse).toBe(true)
    expect(option.series[0].endLabel?.show).toBe(true)
    expect(option.series[0].data[0].label.position).toBe('left')
    const hidden = resolveNativeScene(compileNativeBumpScene(table, { ...config, bumpShowStartLabels: false }))
    expect(hidden.geometry.reservations['guide:bump-start']).toBeUndefined()
  })
})
