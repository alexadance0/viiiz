import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { chartElementColor, chartValueLabelSelections, getChartPlugin } from '../../../core/chartRegistry'
import { renderScene, resolveNativeScene } from '../../chart-renderer/echarts/renderScene'
import { compileNativePieScene, validateNativePieMapping } from './compiler'

const table: DataTable = { name: 'shares', columns: ['category', 'value', 'other'], rows: [{ category: 'А', value: 10, other: 90 }, { category: 'Б', value: 30, other: 80 }, { category: 'А', value: 20, other: 70 }, { category: 'Ноль', value: 0, other: 60 }, { category: 'Пусто', value: null, other: 50 }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'pie', xField: 'category', yField: 'value', yFields: ['value', 'other'], aggregation: 'sum', showValues: true, ...overrides })

describe('pie and donut charts', () => {
  it('aggregates one measure and calculates shares of the entire sum without zero or missing sectors', () => {
    const scene = compileNativePieScene(table, config({ valueMode: 'percent' }))
    expect(scene.plot.total).toBe(60)
    expect(scene.plot.slices.map((slice) => [slice.name, slice.value, slice.percent, slice.label.text])).toEqual([['А', 30, 50, 'А\n50%'], ['Б', 30, 50, 'Б\n50%']])
    expect(scene.document.chart).toMatchObject({ family: 'pie', innerRadius: 0 })
    expect(chartValueLabelSelections(table, config())).toHaveLength(2)
  })
  it('preserves colors and selection IDs when reordering or switching to a donut', () => {
    const pie = compileNativePieScene(table, config())
    const donut = compileNativePieScene(table, config({ kind: 'donut', seriesOrder: ['Б', 'А'] }))
    expect(donut.plot.innerRadius).toBe(.55)
    expect(donut.plot.slices[1]).toMatchObject({ id: pie.plot.slices[0].id, legacyKey: pie.plot.slices[0].legacyKey, color: pie.plot.slices[0].color })
    const key = pie.plot.slices[0].legacyKey
    expect(chartElementColor(table, config({ elementStyles: { [key]: { color: '#aa2244', label: 'Своя подпись', showLabel: true } } }), key)).toBe('#aa2244')
    expect(compileNativePieScene(table, config({ showValues: false, elementStyles: { [key]: { label: 'Своя подпись', showLabel: true } } })).plot.slices[0].label).toMatchObject({ visible: true, text: 'Своя подпись' })
  })
  it('validates negative values, all zero values, and repeated categories without aggregation', () => {
    expect(validateNativePieMapping(table, config({ aggregation: 'none' })).ok).toBe(false)
    for (const value of [-1, 0, null]) expect(validateNativePieMapping({ ...table, rows: [{ category: 'А', value, other: 10 }] }, config()).ok).toBe(false)
    expect(() => compileNativePieScene({ ...table, rows: [{ category: 'А', value: -1, other: 10 }] }, config())).toThrow('отрицательные')
  })
  it('respects formatting, inside label contrast and clamps the donut hole', () => {
    const scene = compileNativePieScene(table, config({ kind: 'donut', pieInnerRadius: 200, pieLabelPosition: 'inside', pieValueFormat: 'both', numberSuffix: ' ₽', numberDecimals: 1 }))
    expect(scene.plot.innerRadius).toBe(.85)
    expect(scene.plot.slices[0].displayValue).toBe('30,0 ₽ (50,0%)')
    expect(scene.plot.slices[0].label.color).not.toBe(scene.compatibilityConfig.valueText.color)
  })
  it.each(['pie', 'donut'] as const)('renders %s with the existing measured frame and category legend', (kind) => {
    const settings = config({ kind, title: 'Структура', showLegend: true })
    const scene = resolveNativeScene(getChartPlugin(kind).compile(table, settings))
    const option = renderScene(scene) as { series: Array<{ type: string; radius: number[]; data: Array<{ name: string }> }>; xAxis: unknown; legend: { data: Array<{ name: string }> } }
    expect(option.xAxis).toBeUndefined()
    expect(option.series[0].type).toBe('pie')
    expect(option.series[0]).toMatchObject({ minShowLabelAngle: 0, labelLayout: { hideOverlap: false } })
    expect(option.series[0].radius[0] > 0).toBe(kind === 'donut')
    expect(option.legend.data.map((item) => item.name)).toEqual(['А', 'Б'])
    expect(scene.geometry.plot.y).toBeGreaterThan(scene.geometry.content.y)
    expect(getChartPlugin(kind).capabilities.axes).toEqual({})
  })
})
