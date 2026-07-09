import { describe, expect, it } from 'vitest'
import * as echarts from 'echarts'
import { applySeriesVisualState, axisAffixGraphics, barVerticalGridGraphics, customFontCss, directLegendGraphics, suppressBuiltInDirectLabels, xAxisEdgeGraphics } from './ChartCanvas'
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

describe('direct legend rendering', () => {
  it('embeds uploaded fonts for SVG and PNG export', () => {
    expect(customFontCss([{ name: 'DM Sans', dataUrl: 'data:font/woff2;base64,abc', weight: 700, style: 'italic' }])).toBe('@font-face{font-family:"DM Sans";src:url("data:font/woff2;base64,abc");font-weight:700;font-style:italic;}')
  })

  it('renders and reapplies a line option without throwing', () => {
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
    const richConfig: ChartConfig = { ...config, seriesStyles: {
      a: { legendNote: 'Длинное примечание к первому ряду, которое переносится на несколько строк' },
      b: { legendNote: 'Длинное примечание ко второму ряду, которое тоже переносится' },
      c: { legendNote: 'Первая строка\nВторая строка' },
    } }
    const option = getChartPlugin('line').buildOption(table, richConfig)
    expect(() => chart.setOption(option, true)).not.toThrow()
    const graphics = directLegendGraphics(chart, table, richConfig) as Array<{ id?: string; type?: string; left?: number; top?: number; style?: { text?: string; lineHeight?: number; width?: number } }>
    expect(graphics.filter((item) => item.id?.startsWith('direct-legend-name-'))).toHaveLength(3)
    expect(graphics.filter((item) => item.id?.startsWith('direct-legend-note-'))).toHaveLength(3)
    for (const name of ['a', 'b', 'c']) {
      const title = graphics.find((item) => item.id === `direct-legend-name-${name}`)!
      const note = graphics.find((item) => item.id === `direct-legend-note-${name}`)!
      expect(note.top).toBeGreaterThan(title.top!)
    }
    const blocks = ['a', 'b', 'c'].map((name) => {
      const title = graphics.find((item) => item.id === `direct-legend-name-${name}`)!
      const note = graphics.find((item) => item.id === `direct-legend-note-${name}`)!
      const noteBottom = note.top! + (note.style?.text?.split('\n').length ?? 1) * (note.style?.lineHeight ?? 0)
      return { top: title.top!, bottom: noteBottom }
    }).sort((left, right) => left.top - right.top)
    blocks.slice(1).forEach((block, index) => expect(block.top).toBeGreaterThanOrEqual(blocks[index].bottom))
    const firstNote = graphics.find((item) => item.id === 'direct-legend-note-a')!
    expect(firstNote.style?.text).toBe(richConfig.seriesStyles.a.legendNote)
    expect(firstNote.style?.text).not.toContain('\n')
    expect(firstNote.left! + Number(firstNote.style?.width)).toBeLessThanOrEqual(800 - 24)
    expect(graphics.find((item) => item.id === 'direct-legend-note-c')?.style?.text).toBe('Первая строка\nВторая строка')
    expect(() => chart.setOption({ graphic: graphics }, { replaceMerge: ['graphic'] })).not.toThrow()
    chart.dispose()
  })

  it('does not overflow the call stack on long line series', () => {
    const points = 10_000
    const longTable: DataTable = {
      name: 'long line',
      columns: ['year', 'a'],
      rows: Array.from({ length: points }, (_, index) => ({ year: index, a: index % 100 })),
    }
    const longConfig: ChartConfig = { ...config, yFields: ['a'], seriesStyles: { a: {} } }
    const chart = {
      getOption: () => ({ yAxis: [{ min: 0, max: 100 }] }),
      convertToPixel: (finder: { xAxisIndex?: number }, value: number) => finder.xAxisIndex == null ? 450 - value * 4 : 100 + value / 200,
      getWidth: () => 800,
    } as unknown as echarts.ECharts
    expect(() => directLegendGraphics(chart, longTable, longConfig)).not.toThrow()
  })

  it('anchors direct area labels at the vertical middle of the filled area', () => {
    const areaConfig: ChartConfig = { ...config, kind: 'area', yFields: ['a'], showDirectLabelLines: true, seriesStyles: { a: {} } }
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
    chart.setOption(getChartPlugin('area').buildOption(table, areaConfig), true)
    const option = chart.getOption() as unknown as { yAxis: Array<{ min: number }> }
    const minimum = Number(option.yAxis[0].min)
    const value = Number(table.rows.at(-1)?.a)
    const expected = (Number(chart.convertToPixel({ yAxisIndex: 0 }, minimum)) + Number(chart.convertToPixel({ yAxisIndex: 0 }, value))) / 2
    const graphics = directLegendGraphics(chart, table, areaConfig) as Array<{ id?: string; shape?: { points?: number[][] } }>
    const leader = graphics.find((item) => item.id === 'direct-legend-line-a')
    expect(leader?.shape?.points?.[0][1]).toBeCloseTo(expected)
    chart.dispose()
  })

  it('places horizontal bar direct labels over the top row and centered on the bar', () => {
    const barConfig: ChartConfig = { ...config, kind: 'bar', barOrientation: 'horizontal', categoryAxisInverse: true, yFields: ['a'], seriesStyles: { a: {} } }
    const chart = {
      convertToPixel: (finder: { xAxisIndex?: number; yAxisIndex?: number }, value: number) => finder.xAxisIndex === 0 ? 100 + value * 20 : 100 + value * 100,
      getWidth: () => 800,
    } as unknown as echarts.ECharts
    const graphics = directLegendGraphics(chart, table, barConfig) as Array<{ id?: string; left?: number; top?: number; style?: { width?: number; align?: string; textAlign?: string } }>
    const label = graphics.find((item) => item.id === 'direct-legend-name-a')!
    expect(label.top).toBeLessThan(100)
    expect(label.left! + Number(label.style?.width) / 2).toBeCloseTo(200)
    expect(label.style).toMatchObject({ align: 'center', textAlign: 'center' })
  })

  it('handles null separators in styled line segments with direct labels', () => {
    const styledConfig: ChartConfig = {
      ...config,
      elementStyles: { 'a\u001fnumber:2023': { color: '#ff0000', lineType: 'dashed' } },
    }
    const option = getChartPlugin('line').buildOption(table, styledConfig) as Record<string, unknown> & { series: Array<{ data?: unknown[] }> }
    expect(option.series.some((series) => series.data?.includes(null))).toBe(true)
    expect(() => suppressBuiltInDirectLabels(option, styledConfig)).not.toThrow()
  })

  it('does not turn a regular line chart into an area chart while highlighting', () => {
    const option = getChartPlugin('line').buildOption(table, config) as Record<string, unknown> & { series: Array<{ name?: string; areaStyle?: object }> }
    applySeriesVisualState(option, table, config, 'a')
    expect(option.series.find((series) => series.name === 'a')?.areaStyle).toBeUndefined()
  })

  it('highlights a selected line point with the series color', () => {
    const lineConfig: ChartConfig = { ...config, palette: ['#168a72'] }
    const option = getChartPlugin('line').buildOption(table, lineConfig) as Record<string, unknown> & { series: Array<{ name?: string; data?: Array<{ elementKey?: string; symbolSize?: number; itemStyle?: { color?: string; borderColor?: string } }> }> }
    applySeriesVisualState(option, table, lineConfig, null, 'a\u001fnumber:2023')
    const point = option.series.find((series) => series.name === 'a')?.data?.[1]
    expect(point?.symbolSize).toBeGreaterThanOrEqual(11)
    expect(point?.itemStyle).toMatchObject({ color: '#168a72', borderColor: '#168a72' })
  })

  it('draws confidence direct labels only for visible interval series', () => {
    const intervalTable: DataTable = { name: 'interval', columns: ['year', 'main', 'low', 'high'], rows: [{ year: 2022, main: 10, low: 8, high: 12 }, { year: 2023, main: 12, low: 7, high: 15 }] }
    const intervalConfig: ChartConfig = { ...config, kind: 'confidence-line', yFields: ['main', 'low', 'high'], showDirectLabels: true, seriesStyles: { main: {}, low: {}, high: {} } }
    const chart = {
      getWidth: () => 800,
      getOption: () => ({ yAxis: [{ min: 0, max: 20 }] }),
      convertToPixel: (finder: { xAxisIndex?: number; yAxisIndex?: number }, value: number) => finder.xAxisIndex === 0 ? 100 + value * 100 : 420 - value * 15,
    } as unknown as echarts.ECharts
    const hiddenBounds = directLegendGraphics(chart, intervalTable, intervalConfig) as Array<{ id?: string }>
    expect(hiddenBounds.some((item) => item.id === 'direct-legend-name-main')).toBe(true)
    expect(hiddenBounds.some((item) => item.id === 'direct-legend-name-low')).toBe(false)

    const visibleBounds = directLegendGraphics(chart, intervalTable, { ...intervalConfig, intervalGroups: [{ main: 'main', lower: 'low', upper: 'high', showBounds: true }] }) as Array<{ id?: string }>
    expect(visibleBounds.some((item) => item.id === 'direct-legend-name-low')).toBe(true)
    expect(visibleBounds.some((item) => item.id === 'direct-legend-name-high')).toBe(true)
  })

  it('dims bar peers while keeping the selected bar fully visible', () => {
    const barConfig: ChartConfig = { ...config, kind: 'bar', palette: ['#168a72', '#e56b45'], yFields: ['a', 'b'], seriesStyles: { a: {}, b: {} } }
    const option = getChartPlugin('bar').buildOption(table, barConfig) as Record<string, unknown> & { series: Array<{ name?: string; type?: string; itemStyle?: { opacity?: number }; data?: Array<{ itemStyle?: { color?: string; opacity?: number } }> }> }
    applySeriesVisualState(option, table, barConfig, null, 'a\u001fnumber:2023')
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

  it('draws bar-chart vertical grid lines exactly at category tick coordinates', () => {
    const barConfig: ChartConfig = { ...config, kind: 'bar', showVerticalGrid: true, yFields: ['a'], seriesStyles: { a: {} } }
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
    chart.setOption(getChartPlugin('bar').buildOption(table, barConfig), true)
    const graphics = barVerticalGridGraphics(chart, table, barConfig, { top: 80, bottom: 440, left: 60, right: 760 }) as Array<{ shape: { x1: number; x2: number } }>
    expect(graphics).toHaveLength(2)
    graphics.forEach((graphic, index) => expect(graphic.shape).toMatchObject({ x1: chart.convertToPixel({ xAxisIndex: 0 }, index), x2: chart.convertToPixel({ xAxisIndex: 0 }, index) }))
    chart.dispose()
  })

  it('keeps Y affixes on the exact top-tick line and renders numeric X edge units', () => {
    const numericTable: DataTable = { name: 'numeric', columns: ['year', 'a'], rows: [{ year: 10, a: 5 }, { year: 20, a: 12 }] }
    const affixConfig: ChartConfig = { ...config, yFields: ['a'], seriesStyles: { a: {} }, numberPrefix: '+', numberSuffix: ' тыс.', xAxisStartLabel: ' лет', xAxisEndLabel: ' лет' }
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
    chart.setOption(getChartPlugin('line').buildOption(numericTable, affixConfig), true)
    const option = chart.getOption() as unknown as { yAxis: Array<{ max: number }> }
    const top = Number(chart.convertToPixel({ yAxisIndex: 0 }, Number(option.yAxis[0].max)))
    const bounds = { top, bottom: Number(chart.convertToPixel({ yAxisIndex: 0 }, 0)), left: 80, right: 740 }
    const yGraphics = axisAffixGraphics(chart, affixConfig, bounds) as Array<{ id: string; top?: number; shape?: { width?: number } }>
    expect(yGraphics).toHaveLength(4)
    expect(yGraphics[0].id).toBe('axis-y-top-background')
    expect(yGraphics[0].shape?.width).toBeGreaterThan(20)
    expect(new Set(yGraphics.filter((item) => item.id !== 'axis-y-top-background').map((item) => item.top))).toEqual(new Set([top - Math.round(14 * 1.2) / 2]))
    const xGraphics = xAxisEdgeGraphics(chart, numericTable, affixConfig, bounds) as Array<{ y?: number }>
    expect(xGraphics).toHaveLength(4)
    expect(new Set(xGraphics.map((item) => item.y))).toHaveLength(1)
    expect(() => chart.setOption({ graphic: [...yGraphics, ...xGraphics] }, { replaceMerge: ['graphic'] })).not.toThrow()
    expect(chart.renderToSVGString()).not.toContain('NaN')
    chart.dispose()
  })

  it('renders every chart kind with dense styling without invalid SVG geometry', () => {
    const numericTable: DataTable = { name: 'matrix', columns: ['x', 'a', 'b'], rows: [{ x: 1, a: 2, b: 4 }, { x: 2, a: 3, b: 1 }, { x: 3, a: 5, b: 6 }] }
    for (const kind of ['bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'line', 'spline', 'step-line', 'range-line', 'step-range-line', 'confidence-line', 'area', 'stacked-area', 'normalized-stacked-area', 'scatter', 'bubble'] as const) {
      const matrixConfig: ChartConfig = { ...config, kind, xField: 'x', yField: 'a', yFields: ['a', 'b'], showLegend: true, showValues: true, showVerticalGrid: true, showHorizontalGrid: true, xAxisStartLabel: ' ед.', xAxisEndLabel: ' ед.', scatterSizeField: 'b', seriesStyles: {}, elementStyles: {} }
      const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
      expect(() => chart.setOption(getChartPlugin(kind).buildOption(numericTable, matrixConfig), true)).not.toThrow()
      const svg = chart.renderToSVGString()
      expect(svg).toContain('<svg')
      expect(svg).not.toContain('NaN')
      chart.dispose()
    }
  })
})
