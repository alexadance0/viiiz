import { describe, expect, it } from 'vitest'
import * as echarts from 'echarts'
import { applySeriesVisualState, barVerticalGridGraphics, butterflyCategoryLayout, directLegendGraphics, fitTreemapLabelBoxes, heatmapPlotBounds, heatmapScaleSideOffset, materializeTreemapHyphens, outlineSelectedTreemapGroup, positionHeatmapScaleGraphics, suppressBuiltInDirectLabels, wrapTreemapLabelText } from './ChartCanvas'
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

describe('heatmap title layout', () => {
  it('reserves the scale width on the same side as the Y title', () => {
    expect(heatmapScaleSideOffset({ ...config, kind: 'heatmap', yAxisPosition: 'left', heatmapScalePosition: 'left', heatmapShowScale: true })).toBe(80)
    expect(heatmapScaleSideOffset({ ...config, kind: 'heatmap', yAxisPosition: 'right', heatmapScalePosition: 'right', heatmapShowScale: true })).toBe(80)
    expect(heatmapScaleSideOffset({ ...config, kind: 'heatmap', yAxisPosition: 'left', heatmapScalePosition: 'right', heatmapShowScale: true })).toBe(0)
    expect(heatmapScaleSideOffset({ ...config, kind: 'heatmap', yAxisPosition: 'left', heatmapScalePosition: 'left', heatmapShowScale: false })).toBe(0)
  })

  it('aligns horizontal scales to the final plot and keeps vertical scales shorter', () => {
    const graphics = [{ id: 'heatmap-scale-bar', shape: {} }, { id: 'heatmap-scale-label-1', info: { ratio: .25 }, style: {} }]
    const grid = { left: 140, right: 80, top: 130, bottom: 100 }
    const top = positionHeatmapScaleGraphics(graphics, { ...config, kind: 'heatmap', heatmapScalePosition: 'top', xAxisPosition: 'top' }, grid, 800, 500, { x: 30, y: 20 }) as typeof graphics
    expect(top[0].shape).toMatchObject({ x: 140, y: 76, width: 148.5, height: 12 })
    expect(top[1].style).toMatchObject({ x: 177.125, align: 'center' })
    const left = positionHeatmapScaleGraphics(graphics, { ...config, kind: 'heatmap', heatmapScalePosition: 'left', yAxisPosition: 'left' }, grid, 800, 500, { x: 30, y: 20 }) as typeof graphics
    expect(Number((left[0]!.shape as { height?: number }).height)).toBe(Number((top[0]!.shape as { width?: number }).width))
    expect(left[0].shape).toMatchObject({ x: 32, width: 12 })
  })

  it('reads heatmap bounds from the rendered coordinate rectangle, excluding labels', () => {
    const instance = { getModel: () => ({ getComponent: () => ({ coordinateSystem: { getRect: () => ({ x: 173, y: 91, width: 427, height: 286 }) } }) }) }
    expect(heatmapPlotBounds(instance, { ...config, kind: 'heatmap' })).toEqual({ left: 173, right: 600, top: 91, bottom: 377 })
  })
})

describe('Butterfly category layout', () => {
  it('uses the shared date-label planner for central categories', () => {
    const dated: DataTable = {
      name: 'dated',
      columns: ['date', 'a', 'b'],
      rows: [
        { date: new Date(2024, 0, 1), a: 10, b: 12 },
        { date: new Date(2024, 1, 1), a: 11, b: 13 },
        { date: new Date(2025, 0, 1), a: 12, b: 14 },
      ],
      timeProfiles: { date: { frequency: 'monthly', confidence: 1, label: 'Ежемесячно', source: 'intervals' } },
    }
    const butterfly = { ...config, kind: 'butterfly' as const, xField: 'date', yFields: ['a', 'b'], butterflyLeftFields: ['a'], butterflyRightFields: ['b'], dateLabelFormat: 'month-context-ru' as const }
    expect(butterflyCategoryLayout(dated, butterfly).labels.map(({ label }) => label)).toEqual(['янв.\n2024', 'февр.', 'янв.\n2025'])
  })
})

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

  it('hides selected series labels and applies an individual text style', () => {
    const styled: ChartConfig = { ...config, seriesStyles: { a: { showDirectLabel: false }, b: { directLabelText: { ...text(22), color: '#e56b45', weight: 700 } }, c: {} } }
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 800, height: 500 })
    chart.setOption(getChartPlugin('line').buildOption(table, styled), true)
    const graphics = directLegendGraphics(chart, table, styled) as Array<{ id?: string; style?: { fill?: string; fontSize?: number; fontWeight?: number } }>
    expect(graphics.some((item) => item.id === 'direct-legend-name-a')).toBe(false)
    expect(graphics.find((item) => item.id === 'direct-legend-name-b')?.style).toMatchObject({ fill: '#e56b45', fontSize: 22, fontWeight: 700 })
    expect(graphics.some((item) => item.id === 'direct-legend-name-c')).toBe(true)
    chart.dispose()
  })

  it('keeps remaining direct-label colors and anchors tied to their original series', () => {
    const palette = ['#6956e8', '#168a72', '#e56b45']
    const visibleConfig: ChartConfig = { ...config, palette, showDirectLabelLines: true, seriesStyles: { a: {}, b: {}, c: {} } }
    const hiddenConfig: ChartConfig = { ...visibleConfig, seriesStyles: { a: { showDirectLabel: false }, b: {}, c: {} } }
    const chart = {
      getWidth: () => 800,
      getOption: () => ({ yAxis: [{ min: 0, max: 12 }] }),
      convertToPixel: (finder: { xAxisIndex?: number }, value: number) => finder.xAxisIndex === 0 ? 100 + value * 200 : 440 - value * 30,
    } as unknown as echarts.ECharts
    const visible = directLegendGraphics(chart, table, visibleConfig) as Array<{ id?: string; left?: number; top?: number; shape?: { points?: number[][] }; style?: { fill?: string; stroke?: string } }>
    const hidden = directLegendGraphics(chart, table, hiddenConfig) as typeof visible

    for (const [name, color] of [['b', palette[1]], ['c', palette[2]]] as const) {
      const visibleLabel = visible.find((item) => item.id === `direct-legend-name-${name}`)
      expect(hidden.find((item) => item.id === `direct-legend-name-${name}`)).toMatchObject({ left: visibleLabel?.left, top: visibleLabel?.top, style: { fill: color } })
      expect(hidden.find((item) => item.id === `direct-legend-line-${name}`)?.style?.stroke).toBe(color)
      expect(hidden.find((item) => item.id === `direct-legend-line-${name}`)?.shape?.points?.[0]).toEqual(
        visible.find((item) => item.id === `direct-legend-line-${name}`)?.shape?.points?.[0],
      )
    }
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
    const barConfig: ChartConfig = { ...config, kind: 'bar', barOrientation: 'horizontal', categoryAxisInverse: true, xAxisPosition: 'top', yAxisPosition: 'right', yFields: ['a'], seriesStyles: { a: {} } }
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

  it('does not move or recolor grouped horizontal-bar labels when another label is hidden', () => {
    const palette = ['#6956e8', '#168a72', '#e56b45']
    const visibleConfig: ChartConfig = { ...config, kind: 'bar', barOrientation: 'horizontal', categoryAxisInverse: true, yFields: ['a', 'b', 'c'], palette, showDirectLabelLines: true, seriesStyles: { a: {}, b: {}, c: {} } }
    const hiddenConfig: ChartConfig = { ...visibleConfig, seriesStyles: { a: { showDirectLabel: false }, b: {}, c: {} } }
    const chart = {
      convertToPixel: (finder: { xAxisIndex?: number }, value: number) => finder.xAxisIndex === 0 ? 100 + value * 20 : 100 + value * 100,
      getWidth: () => 800,
    } as unknown as echarts.ECharts
    const visible = directLegendGraphics(chart, table, visibleConfig) as Array<{ id?: string; left?: number; top?: number; shape?: { points?: number[][] }; style?: { fill?: string; stroke?: string } }>
    const hidden = directLegendGraphics(chart, table, hiddenConfig) as typeof visible

    for (const [name, color] of [['b', palette[1]], ['c', palette[2]]] as const) {
      const visibleLabel = visible.find((item) => item.id === `direct-legend-name-${name}`)
      const hiddenLabel = hidden.find((item) => item.id === `direct-legend-name-${name}`)
      expect(hiddenLabel).toMatchObject({ left: visibleLabel?.left, top: visibleLabel?.top, style: { fill: color } })
      expect(hidden.find((item) => item.id === `direct-legend-line-${name}`)?.shape?.points?.[0]).toEqual(
        visible.find((item) => item.id === `direct-legend-line-${name}`)?.shape?.points?.[0],
      )
    }
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

  it('does not duplicate absorbed values on the last stacked column beside direct labels', () => {
    const barConfig: ChartConfig = { ...config, kind: 'normalized-stacked-bar', showValues: true, barValueLabelAbsorption: true }
    const option = getChartPlugin('normalized-stacked-bar').buildOption(table, barConfig) as Record<string, unknown> & { series: Array<{ data?: Array<{ directLegendLabel?: boolean; label?: { show?: boolean } }> }> }
    const directPoints = option.series.flatMap((series) => series.data?.filter((point) => point.directLegendLabel) ?? [])
    expect(directPoints.length).toBeGreaterThan(0)
    suppressBuiltInDirectLabels(option, barConfig)
    expect(directPoints.every((point) => point.label?.show === false)).toBe(true)
  })

  it('keeps the configured value-label position on the last column beside direct labels', () => {
    const barConfig: ChartConfig = { ...config, kind: 'bar', showValues: true, valueLabelPosition: 'inside-bottom' }
    const option = getChartPlugin('bar').buildOption(table, barConfig) as Record<string, unknown> & { series: Array<{ data?: Array<{ directLegendLabel?: boolean; label?: { show?: boolean; position?: string } }> }> }
    const directPoints = option.series.flatMap((series) => series.data?.filter((point) => point.directLegendLabel) ?? [])
    suppressBuiltInDirectLabels(option, barConfig)
    expect(directPoints).toHaveLength(3)
    expect(directPoints.every((point) => point.label?.show === true && point.label.position === 'insideBottom')).toBe(true)
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

  it('highlights a selected treemap leaf inside nested categories', () => {
    const hierarchy: DataTable = { name: 'hierarchy', columns: ['category', 'subcategory', 'value'], rows: [
      { category: 'A', subcategory: 'A1', value: 10 },
      { category: 'A', subcategory: 'A2', value: 8 },
      { category: 'B', subcategory: 'B1', value: 6 },
    ] }
    const treemapConfig: ChartConfig = { ...config, kind: 'treemap', xField: 'category', yField: 'value', yFields: ['value'], treemapSubcategoryField: 'subcategory', aggregation: 'sum' }
    type Node = { elementKey?: string; itemStyle?: { opacity?: number; borderColor?: string; borderWidth?: number }; children?: Node[] }
    const option = getChartPlugin('treemap').buildOption(hierarchy, treemapConfig) as Record<string, unknown> & { series: Array<{ data: Node[] }> }
    applySeriesVisualState(option, hierarchy, treemapConfig, null, 'A\u001fstring:A1')
    const leaves = option.series[0].data.flatMap((node) => node.children ?? [])
    expect(leaves.find((node) => node.elementKey === 'A\u001fstring:A1')?.itemStyle).toMatchObject({ borderColor: '#6956e8', borderWidth: 3 })
    expect(leaves.find((node) => node.elementKey === 'B\u001fstring:B1')?.itemStyle?.opacity).toBeUndefined()

    const groupOption = getChartPlugin('treemap').buildOption(hierarchy, treemapConfig) as Record<string, unknown> & { series: Array<{ data: Node[] }> }
    applySeriesVisualState(groupOption, hierarchy, treemapConfig, null, 'treemap-group:A')
    expect(groupOption.series[0].data.find((node) => node.elementKey === 'treemap-group:A')?.itemStyle?.borderWidth).toBe(0)
    expect(groupOption.series[1].data.find((node) => node.elementKey === 'treemap-group:A')?.itemStyle).toMatchObject({ color: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0 })
    expect(groupOption.series[1].data.find((node) => node.elementKey === 'treemap-group:B')?.itemStyle?.borderWidth).toBe(0)
  })

  it('outlines the laid-out treemap category without filling it', () => {
    let renderedStyle: Record<string, unknown> = {}
    const host = { type: 'rect', setStyle: (style: Record<string, unknown>) => { renderedStyle = style }, markRedraw: () => undefined }
    Object.assign(echarts.helper.getECData(host as never), { seriesIndex: 1, dataIndex: 7 })
    const instance = {
      getOption: () => ({ series: [{ name: 'Treemap' }, { name: '__treemap-groups' }] }),
      getModel: () => ({ getSeriesByIndex: () => ({ getData: () => ({ getName: (index: number) => index === 7 ? 'Проблемы с клиентами' : 'Другое' }) }) }),
      getZr: () => ({ storage: { getDisplayList: () => [host] } }),
    } as unknown as echarts.ECharts

    outlineSelectedTreemapGroup(instance, 'treemap-group:Проблемы с клиентами')

    expect(renderedStyle).toEqual({ fill: 'rgba(0,0,0,0)', stroke: '#6956e8', lineWidth: 3 })
  })

  it('wraps a treemap category across the complete width and keeps its value separate', () => {
    const lines = wrapTreemapLabelText('Экономическая и политическая нестабильность\n8', 150, 17, 'Arial', 700)
    expect(lines[0].replace('\u200b', '')).toBe('Экономическая и')
    expect(lines.at(-1)).toBe('8')
  })

  it('keeps fitted treemap labels wrapped instead of truncating them with an ellipsis', () => {
    let rendered: Record<string, unknown> = {}
    const label = {
      style: { text: 'Затрудняюсь ответить\n12', padding: 4, fontSize: 20, fontFamily: 'Arial', fontWeight: 700, lineHeight: 24 },
      setStyle: (style: Record<string, unknown>) => { rendered = style },
      markRedraw: () => undefined,
      getBoundingRect: () => ({}),
    }
    const host = {
      zlevel: 0,
      getTextContent: () => label,
      getBoundingRect: () => ({ x: 0, y: 0, width: 170, height: 100 }),
      getPaintRect: () => ({ x: 0, y: 0, width: 170, height: 100 }),
    }
    fitTreemapLabelBoxes({ getZr: () => ({ storage: { getDisplayList: () => [host] } }) } as unknown as echarts.ECharts)
    expect(String(rendered.text).replaceAll('\u200b', '')).toBe('Затрудняюсь\nответить\n12')
    expect(String(rendered.text)).not.toContain('…')
    expect(rendered).toMatchObject({ overflow: undefined, ellipsis: undefined })
  })

  it('shows a hyphen only where a treemap line actually wraps', () => {
    const wrapped = { textContent: 'кон\u00ad\ufeff' }
    const intact = { textContent: 'кон\u00ad\ufeffкурен\u00ad\ufeffция' }
    let selector = ''
    materializeTreemapHyphens({ querySelectorAll: (value: string) => { selector = value; return [wrapped, intact] } } as unknown as ParentNode)
    expect(selector).toBe('text[x]')
    expect(wrapped.textContent).toBe('кон‐')
    expect(intact.textContent).toBe('конкуренция')

    const first = { textContent: 'Финансовы', nextElementSibling: null as unknown }
    const second = { textContent: 'е трудности', nextElementSibling: null as unknown }
    first.nextElementSibling = second
    materializeTreemapHyphens({ querySelectorAll: () => [first, second] } as unknown as ParentNode)
    expect(first.textContent).toBe('Финансо‐')
    expect(second.textContent).toBe('вые трудности')
  })

  it('does not add glow, opacity or size changes to distribution dots', () => {
    const distributionTable: DataTable = { name: 'distribution', columns: ['value'], rows: [{ value: 10 }, { value: 10 }, { value: 20 }] }
    const distributionConfig: ChartConfig = { ...config, kind: 'jitter-plot', yField: 'value', yFields: ['value'], distributionPointSize: 9, distributionPointOpacity: .55 }
    const option = getChartPlugin('jitter-plot').buildOption(distributionTable, distributionConfig) as Record<string, unknown> & { series: Array<{ name?: string; silent?: boolean; symbolSize?: number; itemStyle?: { opacity?: number; shadowBlur?: number }; data?: Array<{ symbolSize?: number; itemStyle?: { opacity?: number; shadowBlur?: number } }> }> }
    const pointSeries = () => option.series.filter((series) => !series.silent)
    const before = structuredClone(pointSeries())
    applySeriesVisualState(option, distributionTable, distributionConfig, 'value', 'value\u001fnumber:10')
    expect(pointSeries()).toEqual(before)
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
