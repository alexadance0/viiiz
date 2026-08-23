import { describe, expect, it } from 'vitest'
import { indexSeriesToBase, prepareChartData, prepareSeasonalChartData, repeatedChartCategories } from './chartData'
import type { ChartConfig, DataTable } from './types'

const table: DataTable = { name: 'sales', columns: ['month', 'country', 'sales', 'cost'], rows: [
  { month: 'Янв', country: 'A', sales: 10, cost: 4 },
  { month: 'Янв', country: 'A', sales: 5, cost: 2 },
  { month: 'Янв', country: 'B', sales: 15, cost: 8 },
  { month: 'Фев', country: 'A', sales: 20, cost: 9 },
] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
  kind: 'bar', xField: 'month', yField: 'sales', yFields: ['sales'], seriesField: '', aggregation: 'sum',
  valueMode: 'absolute', missingMode: 'gap', title: '', subtitle: '', note: '', source: '',
  titleText: style(22), subtitleText: style(14), axisTitleText: style(12), axisLabelText: style(11), legendText: style(11), valueText: style(11), noteText: style(11), sourceText: style(9), showValues: false, elementStyles: {}, seriesStyles: {}, annotations: [],
  xAxisTitle: 'month', yAxisTitle: 'sales', xAxisTitleGap: 10, yAxisTitleGap: 10, xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisTitle: true, showYAxisTitle: true, showXAxisLine: true, showYAxisLine: true, axisLineColor: '#555', axisLineWidth: 1, axisLineType: 'solid', showXTicks: true, showYTicks: true, tickLength: 5,
  color: '#000', showLegend: true, showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#ddd', gridWidth: 1, gridType: 'solid', ...overrides,
})
function style(size: number) { return { fontFamily: 'Arial', size, color: '#000', weight: 400, italic: false, lineHeight: 120, align: 'left' as const } }

describe('chart data preparation', () => {
  it('aggregates repeated categories', () => {
    expect(prepareChartData(table, config()).series[0].data).toEqual([30, 20])
  })

  it('finds repeated X values only for charts that aggregate observations', () => {
    expect(repeatedChartCategories(table, config({ aggregation: 'none' }))).toEqual(['Янв'])
    expect(repeatedChartCategories(table, config({ kind: 'scatter', aggregation: 'none' }))).toEqual([])
  })

  it('creates multiple metric series', () => {
    const result = prepareChartData(table, config({ yFields: ['sales', 'cost'] }))
    expect(result.series.map((series) => series.name)).toEqual(['sales', 'cost'])
    expect(result.series[1].data).toEqual([14, 9])
  })

  it('deduplicates repeated metric fields', () => {
    const result = prepareChartData(table, config({ yFields: ['sales', 'sales'] }))
    expect(result.series.map((series) => series.name)).toEqual(['sales'])
    expect(result.series[0].data).toEqual([30, 20])
  })

  it('splits one metric by a category', () => {
    const result = prepareChartData(table, config({ seriesField: 'country' }))
    expect(result.series.map((series) => series.name)).toEqual(['A', 'B'])
    expect(result.series[0].data).toEqual([15, 20])
    expect(result.series[1].data).toEqual([15, null])
  })

  it('converts series to percentages and can replace gaps with zero', () => {
    const result = prepareChartData(table, config({ seriesField: 'country', valueMode: 'percent', missingMode: 'zero' }))
    expect(result.series[0].data[0]).toBe(50)
    expect(result.series[1].data).toEqual([50, 0])
  })

  it('sorts numeric categories for every chart kind', () => {
    const numeric: DataTable = { name: 'numeric', columns: ['x', 'sales'], rows: [{ x: 21, sales: 3 }, { x: 12, sales: 1 }, { x: 18, sales: 2 }] }
    for (const kind of ['range-line', 'dumbbell', 'horizontal-bar'] as const) {
      const result = prepareChartData(numeric, config({ kind, xField: 'x' }))
      expect(result.categories).toEqual([12, 18, 21])
      expect(result.series[0].data).toEqual([1, 2, 3])
    }
  })

  it('indexes every line to 100 at the selected position', () => {
    const result = prepareChartData(table, config({ kind: 'indexed-line', indexBaseXValue: 'string:Янв', yFields: ['sales', 'cost'] }))
    expect(result.series[0].data).toEqual([100, 20 / 30 * 100])
    expect(result.series[1].data).toEqual([100, 9 / 14 * 100])
  })

  it('indexes purely while preserving order, missing values, and negative-base semantics', () => {
    const source = { categories: ['before', 'base', 'after'], series: [
      { name: 'negative', data: [-5, -10, null] },
      { name: 'zero', data: [4, 0, 8] },
      { name: 'missing', data: [4, null, 8] },
    ] }
    const snapshot = structuredClone(source)
    const result = indexSeriesToBase(source, 'string:base')
    expect(result.categories).toEqual(source.categories)
    expect(result.series.map((item) => item.name)).toEqual(['negative', 'zero', 'missing'])
    expect(result.series.map((item) => item.data)).toEqual([[50, 100, null], [null, null, null], [null, null, null]])
    expect(source).toEqual(snapshot)
  })

  it('preserves the existing percent-then-index transform order', () => {
    const percentTable: DataTable = { name: 'percent indexed', columns: ['period', 'a', 'b'], rows: [{ period: 'base', a: 10, b: 30 }, { period: 'after', a: 20, b: 20 }] }
    const result = prepareChartData(percentTable, config({ kind: 'indexed-line', xField: 'period', yField: 'a', yFields: ['a', 'b'], valueMode: 'percent', indexBaseXValue: 'string:base' }))
    expect(result.series[0].data).toEqual([100, 200])
    expect(result.series[1].data).toEqual([100, 50 / 75 * 100])
  })

  it('splits one dated metric into January–December lines by year', () => {
    const dated: DataTable = { name: 'years', columns: ['date', 'value'], rows: [
      { date: new Date(2023, 0, 1), value: 10 }, { date: new Date(2023, 1, 1), value: 20 },
      { date: new Date(2024, 0, 1), value: 15 }, { date: new Date(2024, 1, 1), value: 30 },
    ] }
    const result = prepareChartData(dated, config({ kind: 'seasonal-line', xField: 'date', yField: 'value', yFields: ['value'], aggregation: 'none' }))
    expect(result.categories).toHaveLength(12)
    expect(result.series.map((series) => series.name)).toEqual(['2023', '2024'])
    expect(result.series.map((series) => series.data.slice(0, 2))).toEqual([[10, 20], [15, 30]])
  })

  it.each([
    ['none', 10], ['sum', 30], ['average', 15], ['min', 10], ['max', 20], ['count', 2],
  ] as const)('preserves seasonal %s aggregation', (aggregation, expected) => {
    const dated: DataTable = { name: 'seasonal aggregation', columns: ['date', 'value'], rows: [
      { date: new Date(2023, 0, 1), value: 10 }, { date: new Date(2023, 0, 2), value: 20 }, { date: new Date(2024, 0, 1), value: 40 },
    ] }
    const result = prepareSeasonalChartData(dated, config({ kind: 'seasonal-line', xField: 'date', yField: 'value', yFields: ['value'], aggregation }))
    expect(result.series[0].data[0]).toBe(expected)
    expect(result.series[0].data[1]).toBeNull()
  })

  it('keeps seasonal gaps distinct from zero and connect rendering policy', () => {
    const dated: DataTable = { name: 'seasonal gaps', columns: ['date', 'value'], rows: [{ date: new Date(2023, 1, 1), value: 2 }, { date: new Date(2024, 1, 1), value: 4 }] }
    const gap = prepareSeasonalChartData(dated, config({ kind: 'seasonal-line', xField: 'date', yField: 'value', yFields: ['value'], missingMode: 'gap' }))
    const connect = prepareSeasonalChartData(dated, config({ kind: 'seasonal-line', xField: 'date', yField: 'value', yFields: ['value'], missingMode: 'connect' }))
    const zero = prepareSeasonalChartData(dated, config({ kind: 'seasonal-line', xField: 'date', yField: 'value', yFields: ['value'], missingMode: 'zero' }))
    expect(gap.series[0].data[0]).toBeNull()
    expect(connect.series[0].data[0]).toBeNull()
    expect(zero.series[0].data[0]).toBe(0)
  })
})
