import { describe, expect, it } from 'vitest'
import * as echarts from 'echarts'
import { applySeriesVisualState, positionYAxisTitleGraphic } from './ChartCanvas'
import { customFontCss } from '../features/chart-export/chartExport'
import { decorationGraphics } from './chartDecorations'
import { getChartPlugin } from '../core/chartRegistry'
import type { ChartConfig, ChartTextStyle, DataTable } from '../core/types'

const text = (size: number): ChartTextStyle => ({ fontFamily: 'Arial', size, color: '#222222', weight: 400, italic: false, lineHeight: 120, align: 'left' })
const config: ChartConfig = {
  kind: 'line', xField: 'year', yField: 'a', yFields: ['a', 'b', 'c'], seriesField: '', aggregation: 'none', valueMode: 'absolute', missingMode: 'gap',
  title: '', subtitle: '', note: '', source: '', titleText: text(30), subtitleText: text(20), axisTitleText: text(16), axisLabelText: text(14), legendText: text(16), directLabelText: text(16), valueText: text(14), noteText: text(14), sourceText: text(14), showValues: false,
  xAxisTitle: '', yAxisTitle: '', xAxisTitleGap: 10, yAxisTitleGap: 10, xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisTitle: false, showYAxisTitle: false, showXAxisLine: true, showYAxisLine: false, axisLineColor: '#555555', axisLineWidth: 1, axisLineType: 'solid', showXTicks: true, showYTicks: false, tickLength: 5,
  elementStyles: {}, seriesStyles: { a: { legendNote: '10%' }, b: { legendNote: '9%' }, c: { legendNote: '8%' } }, annotations: [], color: '#6956e8', showLegend: false, showDirectLabels: true, showDirectLabelLines: false, showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#dddddd', gridWidth: 1, gridType: 'solid', canvasWidth: 800, canvasHeight: 500,
}
const table: DataTable = { name: 'line', columns: ['year', 'a', 'b', 'c'], rows: [{ year: 2022, a: 10, b: 9.8, c: 9.6 }, { year: 2023, a: 10, b: 9.9, c: 9.8 }] }

describe('native title layout', () => {
  it.each([
    [{ left: 24 }, 'left'],
    [{ right: 24 }, 'right'],
  ] as const)('keeps a native category-axis title on its resolved %s side', (side, key) => {
    const positioned = positionYAxisTitleGraphic({ id: 'chart-y-axis-title', ...side, top: 'middle' }, 700, 250, true)
    expect(positioned).toMatchObject({ [key]: 24, y: 250 })
    expect(positioned.x).toBeUndefined()
  })
})

describe('native canvas adapters', () => {
  it('embeds uploaded fonts for SVG and PNG export', () => {
    expect(customFontCss([{ name: 'DM Sans', dataUrl: 'data:font/woff2;base64,abc', weight: 700, style: 'italic' }])).toBe('@font-face{font-family:"DM Sans";src:url("data:font/woff2;base64,abc");font-weight:700;font-style:italic;}')
  })

  it('does not turn a regular line chart into an area chart while highlighting', () => {
    const option = getChartPlugin('line').buildOption(table, config) as Record<string, unknown> & { series: Array<{ name?: string; areaStyle?: object }> }
    applySeriesVisualState(option, config, 'a')
    expect(option.series.find((series) => series.name === 'a')?.areaStyle).toBeUndefined()
  })

  it('highlights a selected line point with the series color', () => {
    const lineConfig: ChartConfig = { ...config, palette: ['#168a72'] }
    const option = getChartPlugin('line').buildOption(table, lineConfig) as Record<string, unknown> & { series: Array<{ name?: string; data?: Array<{ elementKey?: string; symbolSize?: number; itemStyle?: { color?: string; borderColor?: string } }> }> }
    applySeriesVisualState(option, lineConfig, null, 'a\u001fnumber:2023')
    const point = option.series.find((series) => series.name === 'a')?.data?.[1]
    expect(point?.symbolSize).toBeGreaterThanOrEqual(11)
    expect(point?.itemStyle).toMatchObject({ color: '#168a72', borderColor: '#168a72' })
  })

  it('does not add glow, opacity or size changes to distribution dots', () => {
    const distributionTable: DataTable = { name: 'distribution', columns: ['value'], rows: [{ value: 10 }, { value: 10 }, { value: 20 }] }
    const distributionConfig: ChartConfig = { ...config, kind: 'jitter-plot', yField: 'value', yFields: ['value'], distributionPointSize: 9, distributionPointOpacity: .55 }
    const option = getChartPlugin('jitter-plot').buildOption(distributionTable, distributionConfig) as Record<string, unknown> & { series: Array<{ name?: string; silent?: boolean; symbolSize?: number; itemStyle?: { opacity?: number; shadowBlur?: number }; data?: Array<{ symbolSize?: number; itemStyle?: { opacity?: number; shadowBlur?: number } }> }> }
    const pointSeries = () => option.series.filter((series) => !series.silent)
    const before = structuredClone(pointSeries())
    applySeriesVisualState(option, distributionConfig, 'value', 'value\u001fnumber:10')
    expect(pointSeries()).toEqual(before)
  })

  it('dims bar peers while keeping the selected bar fully visible', () => {
    const barConfig: ChartConfig = { ...config, kind: 'bar', palette: ['#168a72', '#e56b45'], yFields: ['a', 'b'], seriesStyles: { a: {}, b: {} } }
    const option = getChartPlugin('bar').buildOption(table, barConfig) as Record<string, unknown> & { series: Array<{ name?: string; type?: string; itemStyle?: { opacity?: number }; data?: Array<{ itemStyle?: { color?: string; opacity?: number } }> }> }
    applySeriesVisualState(option, barConfig, null, 'a\u001fnumber:2023')
    const selectedSeries = option.series.find((series) => series.name === 'a' && series.type === 'bar')!
    const otherSeries = option.series.find((series) => series.name === 'b' && series.type === 'bar')!
    expect(selectedSeries.data?.[1].itemStyle).toMatchObject({ color: '#168a72', opacity: 1 })
    expect(selectedSeries.data?.[0].itemStyle).toMatchObject({ color: '#168a72', opacity: .62 })
    expect(otherSeries.itemStyle?.opacity).toBe(.22)
  })

  it('renders background areas, guide lines and arrowheads as ECharts graphics', () => {
    const graphics = decorationGraphics([
      { id: 'area', type: 'area', x: 10, y: 20, width: 100, height: 80, color: '#ff0000', opacity: .2, lineWidth: 1, lineType: 'solid' },
      { id: 'line', type: 'vertical-line', x: 50, y: 30, width: 0, height: 120, color: '#333333', opacity: 1, lineWidth: 2, lineType: 'dashed' },
      { id: 'arrow', type: 'arrow', x: 70, y: 90, width: 60, height: -40, color: '#0000ff', opacity: 1, lineWidth: 2, lineType: 'solid' },
      { id: 'curve', type: 'curved-line', x: 20, y: 80, width: 90, height: 40, color: '#008800', opacity: 1, lineWidth: 2, lineType: 'solid', curvature: .3, endArrow: true },
    ]) as Array<{ type: string; shape?: { width?: number }; children?: Array<{ type: string }> }>
    expect(graphics[0]).toMatchObject({ type: 'rect', shape: { width: 100 } })
    expect(graphics[1]).toMatchObject({ type: 'group', children: [{ type: 'line' }] })
    expect(graphics[2].children?.map((child) => child.type)).toEqual(['line', 'polygon'])
    expect(graphics[3].children?.map((child) => child.type)).toEqual(['bezierCurve', 'polygon'])
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
    expect(() => chart.setOption({ graphic: graphics })).not.toThrow()
    chart.dispose()
  })

  it('fits a background area to the exact plot height', () => {
    const [area] = decorationGraphics([{ id: 'fit', type: 'area', x: 30, y: 0, width: 100, height: 10, color: '#ff0000', opacity: .2, lineWidth: 1, lineType: 'solid', fitToPlot: true }], { top: 82, bottom: 430, left: 90, right: 720 }) as Array<{ shape: { y: number; height: number } }>
    expect(area.shape).toMatchObject({ y: 82, height: 348 })
  })

  it('fits horizontal ranges to the plot width and supports multiple line endings', () => {
    const bounds = { top: 80, bottom: 430, left: 92, right: 718 }
    const graphics = decorationGraphics([
      { id: 'range', type: 'area', x: 0, y: 170, width: 10, height: 80, color: '#eeee00', opacity: .2, lineWidth: 1, lineType: 'solid', fitToPlotWidth: true },
      { id: 'open', type: 'horizontal-line', x: 100, y: 100, width: 200, height: 0, color: '#111111', opacity: 1, lineWidth: 2, lineType: 'solid', arrowPlacement: 'both', arrowHead: 'open' },
      { id: 'circle', type: 'vertical-line', x: 100, y: 100, width: 0, height: 200, color: '#111111', opacity: 1, lineWidth: 2, lineType: 'solid', arrowPlacement: 'start', arrowHead: 'circle' },
      { id: 'plain', type: 'line', x: 100, y: 100, width: 120, height: 40, color: '#111111', opacity: 1, lineWidth: 2, lineType: 'solid', arrowPlacement: 'none' },
    ], bounds) as Array<{ shape?: { x: number; width: number }; children?: Array<{ type: string }> }>
    expect(graphics[0].shape).toMatchObject({ x: 92, width: 626 })
    expect(graphics[1].children?.map((child) => child.type)).toEqual(['line', 'polyline', 'polyline'])
    expect(graphics[2].children?.map((child) => child.type)).toEqual(['line', 'circle'])
    expect(graphics[3].children?.map((child) => child.type)).toEqual(['line'])
  })

  it('renders every chart kind with dense styling without invalid SVG geometry', () => {
    const numericTable: DataTable = { name: 'matrix', columns: ['x', 'a', 'b'], rows: [{ x: 1, a: 2, b: 4 }, { x: 2, a: 3, b: 1 }, { x: 3, a: 5, b: 6 }] }
    for (const kind of ['bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'dumbbell', 'line', 'spline', 'step-line', 'range-line', 'step-range-line', 'confidence-line', 'area', 'stacked-area', 'normalized-stacked-area', 'scatter', 'bubble'] as const) {
      const matrixConfig: ChartConfig = { ...config, kind, xField: 'x', yField: 'a', yFields: ['a', 'b'], showLegend: true, showValues: true, showVerticalGrid: true, showHorizontalGrid: true, xAxisNumberSuffix: ' ед.', scatterSizeField: 'b', seriesStyles: {}, elementStyles: {} }
      const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
      expect(() => chart.setOption(getChartPlugin(kind).buildOption(numericTable, matrixConfig), true)).not.toThrow()
      const svg = chart.renderToSVGString()
      expect(svg).toContain('<svg')
      expect(svg).not.toContain('NaN')
      chart.dispose()
    }
  })
})
