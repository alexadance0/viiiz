import { describe, expect, it } from 'vitest'
import { nearestPixelIndex, prepareChartData, segmentEndpointIndex } from './chartData'
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

  it('sorts numeric x values for line-like charts', () => {
    const numeric: DataTable = { name: 'numeric', columns: ['x', 'sales'], rows: [{ x: 21, sales: 3 }, { x: 12, sales: 1 }, { x: 18, sales: 2 }] }
    const result = prepareChartData(numeric, config({ kind: 'range-line', xField: 'x' }))
    expect(result.categories).toEqual([12, 18, 21])
    expect(result.series[0].data).toEqual([1, 2, 3])
  })
})

describe('line segment selection', () => {
  it('selects the right endpoint from either half of a segment', () => {
    const pixels = [100, 200, 300]
    expect(segmentEndpointIndex(pixels, 125)).toBe(1)
    expect(segmentEndpointIndex(pixels, 175)).toBe(1)
    expect(segmentEndpointIndex(pixels, 225)).toBe(2)
    expect(segmentEndpointIndex(pixels, 275)).toBe(2)
  })

  it('also works for a reversed axis and outside the plot', () => {
    expect(segmentEndpointIndex([300, 200, 100], 250)).toBe(1)
    expect(segmentEndpointIndex([100, 200, 300], 50)).toBe(0)
    expect(segmentEndpointIndex([100, 200, 300], 350)).toBe(2)
  })

  it('finds the nearest point on normal and reversed axes', () => {
    expect(nearestPixelIndex([100, 200, 300], 170)).toBe(1)
    expect(nearestPixelIndex([100, 200, 300], 240)).toBe(1)
    expect(nearestPixelIndex([300, 200, 100], 170)).toBe(1)
    expect(nearestPixelIndex([300, 200, 100], 140)).toBe(2)
  })
})
