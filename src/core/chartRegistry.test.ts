import { describe, expect, it } from 'vitest'
import { getChartPlugin, prepareVisibleChartData } from './chartRegistry'
import type { ChartConfig, ChartTextStyle, DataTable } from './types'

const style = (size: number): ChartTextStyle => ({ fontFamily: 'Arial', size, color: '#000000', weight: 400, italic: false, lineHeight: 120, align: 'left' })
const table: DataTable = { name: 'test', columns: ['month', 'value'], rows: [{ month: 'Янв', value: 10 }, { month: 'Фев', value: 20 }] }
const base = (kind: ChartConfig['kind']): ChartConfig => ({
  kind, xField: 'month', yField: 'value', yFields: ['value'], seriesField: '', aggregation: 'none', valueMode: 'absolute', missingMode: 'gap',
  title: '', subtitle: '', note: '', source: '', titleText: style(20), subtitleText: style(14), axisTitleText: style(12), axisLabelText: style(11), legendText: style(11), valueText: style(11), noteText: style(10), sourceText: style(9),
  xAxisTitle: 'month', yAxisTitle: 'value', xAxisTitleGap: 10, yAxisTitleGap: 10, xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisTitle: true, showYAxisTitle: true, showXAxisLine: true, showYAxisLine: true, axisLineColor: '#555', axisLineWidth: 1, axisLineType: 'solid', showXTicks: true, showYTicks: true, tickLength: 5,
  showValues: false, elementStyles: {}, seriesStyles: {}, annotations: [], color: '#6956e8', showLegend: false, showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#dddddd', gridWidth: 1, gridType: 'solid',
})

describe('individual chart element styles', () => {
  it('keeps explicitly configured text sizes and uses line samples in a line-chart legend', () => {
    const config = base('line')
    config.showLegend = true
    config.axisLabelText.size = 27
    config.legendText.size = 23
    const option = getChartPlugin('line').buildOption(table, config) as { legend: { itemWidth: number; itemHeight: number; textStyle: { fontSize: number }; data: Array<{ icon: string; itemStyle: { color: string } }> }; xAxis: { axisLabel: { fontSize: number } }; series: Array<{ lineStyle?: { width: number } }> }
    expect(option.xAxis.axisLabel.fontSize).toBe(27)
    expect(option.legend).toMatchObject({ itemWidth: 24, itemHeight: 10, textStyle: { fontSize: 23 } })
    expect(option.legend.data[0]).toMatchObject({ icon: 'path://M0 4H24V7H0Z', itemStyle: { color: '#6956e8' } })
    expect(option.series[0].lineStyle?.width).toBe(3)
  })

  it('styles X and Y titles and scale labels independently', () => {
    const config = base('line')
    config.xAxisTitleText = { ...style(19), color: '#112233' }
    config.yAxisTitleText = { ...style(21), color: '#223344' }
    config.xAxisLabelText = { ...style(17), color: '#334455' }
    config.yAxisLabelText = { ...style(23), color: '#445566' }
    const option = getChartPlugin('line').buildOption(table, config) as {
      xAxis: { nameTextStyle: { fontSize: number; color: string }; axisLabel: { fontSize: number; color: string } }
      yAxis: { axisLabel: { fontSize: number; color: string } }
      graphic: Array<{ id?: string; style?: { fontSize?: number; fill?: string } }>
    }
    expect(option.xAxis.nameTextStyle).toMatchObject({ fontSize: 19, color: '#112233' })
    expect(option.xAxis.axisLabel).toMatchObject({ fontSize: 17, color: '#334455' })
    expect(option.yAxis.axisLabel).toMatchObject({ fontSize: 23, color: '#445566' })
    expect(option.graphic.find((item) => item.id === 'chart-y-axis-title')?.style).toMatchObject({ fontSize: 21, fill: '#223344' })
  })

  it('uses a selected palette consistently for series and legend markers', () => {
    const paletteTable: DataTable = { name: 'palette', columns: ['month', 'first', 'second'], rows: [{ month: 'Янв', first: 1, second: 2 }] }
    const config = base('bar'); config.yFields = ['first', 'second']; config.palette = ['#112233', '#aabbcc']; config.showLegend = true
    const option = getChartPlugin('bar').buildOption(paletteTable, config) as { legend: { itemWidth: number; data: Array<{ icon: string; itemStyle: { color: string } }> }; series: Array<{ itemStyle: { color: string } }> }
    expect(option.series.slice(0, 2).map((series) => series.itemStyle.color)).toEqual(['#112233', '#aabbcc'])
    expect(option.legend.data.map((item) => item.itemStyle.color)).toEqual(['#112233', '#aabbcc'])
    expect(option.legend).toMatchObject({ itemWidth: 10 })
    expect(option.legend.data.every((item) => item.icon === 'rect')).toBe(true)
  })

  it('builds stacked columns and scales the value axis by their totals', () => {
    const stackedTable: DataTable = {
      name: 'stacked', columns: ['month', 'first', 'second'],
      rows: [{ month: 'Янв', first: 40, second: 35 }, { month: 'Фев', first: 20, second: 15 }],
    }
    const config = base('stacked-bar')
    config.yFields = ['first', 'second']
    config.palette = ['#112233', '#aabbcc']
    const option = getChartPlugin('stacked-bar').buildOption(stackedTable, config) as {
      yAxis: { min: number; max: number }
      series: Array<{ type: string; stack?: string; itemStyle?: { color?: string } }>
    }
    const columns = option.series.filter((series) => series.type === 'bar')
    expect(columns).toHaveLength(2)
    expect(columns.every((series) => series.stack === 'total')).toBe(true)
    expect(columns.map((series) => series.itemStyle?.color)).toEqual(['#112233', '#aabbcc'])
    expect(option.yAxis.min).toBe(0)
    expect(option.yAxis.max).toBeGreaterThanOrEqual(75)
  })

  it('normalizes each stacked column to 100% and formats its values as percentages', () => {
    const normalizedTable: DataTable = {
      name: 'normalized', columns: ['month', 'first', 'second'],
      rows: [{ month: 'Янв', first: 30, second: 70 }, { month: 'Фев', first: 1, second: 3 }],
    }
    const config = base('normalized-stacked-bar')
    config.yFields = ['first', 'second']
    config.showValues = true
    const prepared = prepareVisibleChartData(normalizedTable, config)
    expect(prepared.series.map((series) => series.data)).toEqual([[30, 25], [70, 75]])
    const option = getChartPlugin('normalized-stacked-bar').buildOption(normalizedTable, config) as {
      yAxis: { min: number; max: number; axisLabel: { formatter(value: number): string } }
      series: Array<{ type: string; stack?: string; label?: { formatter(params: { value: number }): string } }>
    }
    const columns = option.series.filter((series) => series.type === 'bar')
    expect(columns.every((series) => series.stack === 'total')).toBe(true)
    expect(option.yAxis).toMatchObject({ min: 0, max: 100 })
    expect(option.yAxis.axisLabel.formatter(50)).toBe('50%')
    expect(columns[0].label?.formatter({ value: 25 })).toBe('25%')
  })

  it('normalizes positive and negative stacks independently', () => {
    const mixedTable: DataTable = {
      name: 'mixed', columns: ['month', 'first', 'second', 'third'],
      rows: [{ month: 'Янв', first: 1, second: 3, third: -2 }],
    }
    const config = base('normalized-stacked-bar')
    config.yFields = ['first', 'second', 'third']
    const prepared = prepareVisibleChartData(mixedTable, config)
    expect(prepared.series.map((series) => series.data[0])).toEqual([25, 75, -100])
  })

  it('applies global column fill, frame, opacity and group width', () => {
    const config = base('bar'); config.barFillColor = '#123456'; config.barFillOpacity = .65; config.barBorderColor = '#abcdef'; config.barBorderWidth = 2; config.barWidth = 54; config.showLegend = true
    const option = getChartPlugin('bar').buildOption(table, config) as { legend: { data: Array<{ itemStyle: { color: string } }> }; series: Array<{ type: string; itemStyle: { color: string; opacity: number; borderWidth: number }; barCategoryGap: string; data: Array<{ itemStyle?: { borderColor: string; borderWidth: number } }> }> }
    expect(option.series[0]).toMatchObject({ itemStyle: { color: '#123456', opacity: .65, borderWidth: 0 }, barCategoryGap: '46%' })
    expect(option.series.filter((series) => series.type === 'custom')).toHaveLength(2)
    expect(option.series.find((series) => series.type === 'custom')?.data[0].itemStyle).toMatchObject({ borderColor: '#abcdef', borderWidth: 2 })
    expect(option.legend.data[0].itemStyle.color).toBe('#123456')
  })

  it('builds horizontal bars with a numeric X axis and category Y axis', () => {
    const config = base('bar'); config.barOrientation = 'horizontal'; config.barBorderRadius = 8; config.barSeriesGap = 20
    const option = getChartPlugin('bar').buildOption(table, config) as { xAxis: { type: string }; yAxis: { type: string }; series: Array<{ type: string; barGap?: string; itemStyle?: { borderRadius?: number } }> }
    expect(option.xAxis.type).toBe('value')
    expect(option.yAxis.type).toBe('category')
    expect(option.series[0]).toMatchObject({ type: 'bar', barGap: '20%', itemStyle: { borderRadius: 8 } })
  })

  it('builds all linear-bar variants horizontally without relying on the old orientation setting', () => {
    const horizontalTable: DataTable = { name: 'horizontal', columns: ['month', 'first', 'second'], rows: [{ month: 'Янв', first: 20, second: 30 }] }
    for (const kind of ['horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar'] as const) {
      const config = base(kind); config.yFields = ['first', 'second']; config.barOrientation = 'vertical'
      const option = getChartPlugin(kind).buildOption(horizontalTable, config) as { xAxis: { type: string; max?: number }; yAxis: { type: string }; series: Array<{ type: string; stack?: string }> }
      expect(option.xAxis.type).toBe('value')
      expect(option.yAxis.type).toBe('category')
      const bars = option.series.filter((series) => series.type === 'bar')
      if (kind === 'horizontal-bar') expect(bars.every((series) => series.stack == null)).toBe(true)
      else expect(bars.every((series) => series.stack === 'total')).toBe(true)
      if (kind === 'horizontal-normalized-stacked-bar') expect(option.xAxis.max).toBe(100)
    }
  })

  it('can reverse the category/date axis of linear bars', () => {
    const config = base('horizontal-bar'); config.categoryAxisInverse = true
    const option = getChartPlugin('horizontal-bar').buildOption(table, config) as { yAxis: { inverse: boolean } }
    expect(option.yAxis.inverse).toBe(true)
  })

  it('builds regular, stacked and normalized area charts with configurable fill', () => {
    const areaTable: DataTable = { name: 'areas', columns: ['month', 'first', 'second'], rows: [{ month: 'Янв', first: 20, second: 30 }, { month: 'Фев', first: 40, second: 10 }] }
    for (const kind of ['area', 'stacked-area', 'normalized-stacked-area'] as const) {
      const config = base(kind); config.yFields = ['first', 'second']; config.areaFillOpacity = .45
      const option = getChartPlugin(kind).buildOption(areaTable, config) as { yAxis: { max: number }; series: Array<{ type: string; stack?: string; areaStyle?: { opacity: number } }> }
      const areas = option.series.filter((series) => series.areaStyle)
      expect(areas).toHaveLength(2)
      expect(areas.every((series) => series.type === 'line' && series.areaStyle?.opacity === .45)).toBe(true)
      expect(areas.every((series) => kind === 'area' ? series.stack == null : series.stack === 'total')).toBe(true)
      if (kind === 'normalized-stacked-area') expect(option.yAxis.max).toBe(100)
    }
  })

  it('keeps areas in their own picker category and hides advanced preparation controls', () => {
    expect(getChartPlugin('area').category).toBe('area')
    expect(getChartPlugin('area').settings.features.dataPreparation).toBe(false)
    expect(getChartPlugin('bar').settings.features.dataPreparation).toBe(false)
  })

  it('calculates a clean logarithmic range from positive values', () => {
    const config = base('line'); config.yAxisScaleType = 'log'
    const option = getChartPlugin('line').buildOption(table, config) as { yAxis: { type: string; min: number; max: number; interval?: number } }
    expect(option.yAxis).toMatchObject({ type: 'log', min: 10, max: 100 })
    expect(option.yAxis.interval).toBeUndefined()
  })

  it('keeps the zero line solid by default and supports a custom type', () => {
    const config = base('line'); config.showZeroLine = true; config.zeroLineType = 'dotted'
    const option = getChartPlugin('line').buildOption(table, config) as { series: Array<{ markLine?: { lineStyle: { type: string }; data: Array<{ yAxis: number }> } }> }
    expect(option.series[0].markLine).toMatchObject({ lineStyle: { type: 'dotted' }, data: [{ yAxis: 0 }] })
  })

  it('reserves extreme ticks for independently aligned axis affixes', () => {
    const config = base('line'); config.numberSuffix = ' % осуждённых'; config.xAxisEndLabel = ' лет'
    const numericTable: DataTable = { name: 'numeric', columns: ['month', 'value'], rows: [{ month: 10, value: 10 }, { month: 20, value: 20 }] }
    const option = getChartPlugin('line').buildOption(numericTable, config) as { xAxis: { axisLabel: { formatter(value: string, index: number): string } }; yAxis: { max: number; axisLabel: { formatter(value: number): string } } }
    expect(option.yAxis.axisLabel.formatter(option.yAxis.max)).toBe('')
    expect(option.yAxis.axisLabel.formatter(10)).toBe('10')
    expect(option.xAxis.axisLabel.formatter('', 0)).toBe('10')
    expect(option.xAxis.axisLabel.formatter('', 1)).toBe('')
  })

  it('does not hide string categories when numeric X edge units remain in config', () => {
    const config = base('line'); config.xAxisStartLabel = ' лет'; config.xAxisEndLabel = ' лет'
    const option = getChartPlugin('line').buildOption(table, config) as { xAxis: { axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.xAxis.axisLabel.formatter('', 0)).toBe('Янв')
    expect(option.xAxis.axisLabel.formatter('', 1)).toBe('Фев')
  })

  it('reserves canvas space for a suffix after the last numeric X value', () => {
    const numericTable: DataTable = { name: 'numeric', columns: ['month', 'value'], rows: [{ month: 10, value: 10 }, { month: 20, value: 20 }] }
    const plain = base('line')
    const withUnit = { ...plain, xAxisEndLabel: ' лет' }
    const plainOption = getChartPlugin('line').buildOption(numericTable, plain) as { grid: { right: number } }
    const unitOption = getChartPlugin('line').buildOption(numericTable, withUnit) as { grid: { right: number } }
    expect(unitOption.grid.right).toBeGreaterThan(plainOption.grid.right)
  })

  it('reserves the physical numeric X endpoints on horizontal bars', () => {
    const config = base('bar'); config.barOrientation = 'horizontal'; config.xAxisStartLabel = ' ед.'; config.xAxisEndLabel = ' ед.'
    const option = getChartPlugin('bar').buildOption(table, config) as { xAxis: { min: number; max: number; axisLabel: { formatter(value: number): string } } }
    expect(option.xAxis.axisLabel.formatter(option.xAxis.min)).toBe('')
    expect(option.xAxis.axisLabel.formatter(option.xAxis.max)).toBe('')
    expect(option.xAxis.axisLabel.formatter(10)).toBe('10')
  })

  it('applies column styles to a selected series and an individual bar', () => {
    const config = base('bar')
    config.seriesStyles.value = { color: '#334455', fillOpacity: .8, borderColor: '#112233', borderWidth: 3, barWidth: 80 }
    config.elementStyles['value\u001fstring:Фев'] = { color: '#ffee00', fillOpacity: .5, borderColor: '#cc0000', borderWidth: 4, barWidth: 45 }
    const option = getChartPlugin('bar').buildOption(table, config) as { series: Array<{ type: string; customBarOf?: string; itemStyle?: { color: string; opacity: number; borderColor: string; borderWidth: number }; data: Array<{ itemStyle?: { color?: string; opacity: number; borderWidth: number }; elementKey?: string }> }> }
    expect(option.series[0].itemStyle).toMatchObject({ color: '#334455', opacity: .8, borderWidth: 0 })
    expect(option.series[0].data.every((point) => point.itemStyle?.color === 'rgba(0,0,0,0)' && point.itemStyle?.opacity === 1 && point.itemStyle?.borderWidth == null)).toBe(true)
    const overlays = option.series.filter((series) => series.type === 'custom' && series.customBarOf === 'value')
    expect(overlays).toHaveLength(2)
    expect(overlays[1].data[0].elementKey).toBe('value\u001fstring:Фев')
  })

  it('treats direct labels and the standard legend as alternatives', () => {
    const config = base('line')
    config.showLegend = true
    config.showDirectLabels = true
    config.seriesStyles.value = { legendLabel: 'Продажи', legendNote: 'млн ₽', showLegendLine: false }
    const option = getChartPlugin('line').buildOption(table, config) as { grid: { right: number }; legend: { show: boolean; data: Array<{ name: string }> }; series: Array<{ name: string; endLabel?: { show: boolean; formatter: string; width: number; align: string }; labelLine?: { show: boolean } }> }
    expect(option.legend.show).toBe(false)
    expect(option.legend.data.map((item) => item.name)).toEqual(['value'])
    expect(option.series[0].endLabel).toMatchObject({ show: true, formatter: '{name|Продажи}\n{note|млн ₽}', align: 'left' })
    expect(option.series[0].endLabel!.width).toBeLessThanOrEqual(260)
    expect(option.grid.right).toBeLessThan(340)
    expect(option.series[0].labelLine?.show).toBe(false)
  })

  it('uses the configured series order as the visual layer order', () => {
    const layeredTable: DataTable = { name: 'layers', columns: ['month', 'first', 'second'], rows: [{ month: 'Янв', first: 10, second: 12 }, { month: 'Фев', first: 20, second: 18 }] }
    const config = base('line')
    config.yFields = ['first', 'second']
    config.seriesOrder = ['second', 'first']
    const option = getChartPlugin('line').buildOption(layeredTable, config) as { legend: { data: Array<{ name: string }> }; series: Array<{ name: string; segmentOf?: string; z: number }> }
    expect(option.legend.data.map((item) => item.name)).toEqual(['second', 'first'])
    const visible = option.series.filter((series) => !series.name.startsWith('__hit__:'))
    expect(visible.filter((series) => !series.segmentOf).map((series) => series.name)).toEqual(['second', 'first'])
    expect(visible.find((series) => series.name === 'second')!.z).toBeGreaterThan(visible.find((series) => series.name === 'first')!.z)
  })

  it('applies color and a custom label to one bar', () => {
    const config = base('bar')
    config.showValues = false
    config.valueText.color = '#7b1fa2'
    config.elementStyles['value\u001fstring:Фев'] = { color: '#ff0000', showLabel: true, label: 'Пик', valueText: { ...config.valueText, fontFamily: 'Georgia, serif', size: 24 } }
    const option = getChartPlugin('bar').buildOption(table, config) as { series: Array<{ data: Array<{ itemStyle?: { color: string }; label?: { formatter: string; color: string; fontFamily: string; fontSize: number }; emphasis?: { label: { color: string } } }> }> }
    expect(option.series[0].data[0].itemStyle).toBeUndefined()
    expect(option.series[0].data[1].itemStyle?.color).toBe('#ff0000')
    expect(option.series[0].data[1].label?.formatter).toBe('Пик')
    expect(option.series[0].data[1].label?.color).toBe('#7b1fa2')
    expect(option.series[0].data[1].label).toMatchObject({ fontFamily: 'Georgia, serif', fontSize: 24 })
    expect(option.series[0].data[1].emphasis?.label.color).toBe('#7b1fa2')
  })

  it('styles the selected line segment as well as its endpoint', () => {
    const config = base('line')
    config.elementStyles['value\u001fstring:Фев'] = { color: '#00aa00', lineWidth: 4, lineType: 'dashed' }
    const option = getChartPlugin('line').buildOption(table, config) as { series: Array<{ data: Array<{ itemStyle?: { color: string; borderColor?: string } }>; lineStyle?: { color: string; width: number; type: string; opacity?: number } }> }
    expect(option.series).toHaveLength(3)
    expect(option.series[0].lineStyle?.opacity).toBe(0)
    expect(option.series[0].data[1].itemStyle).toMatchObject({ color: '#ffffff', borderColor: '#00aa00' })
    expect(option.series[1].lineStyle).toMatchObject({ color: '#00aa00', width: 4, type: 'dashed' })
  })

  it('adds a wide invisible hit area when line markers are hidden', () => {
    const config = base('line')
    const option = getChartPlugin('line').buildOption(table, config) as { series: Array<{ name?: string; triggerEvent?: boolean; symbol?: string; symbolSize?: number; itemStyle?: { opacity?: number }; lineStyle?: { color: string; width: number; opacity?: number }; data: Array<{ elementKey?: string; sourceSeriesName?: string }> }> }
    expect(option.series[0].data[0]).toMatchObject({ symbolSize: 0 })
    const hit = option.series.find((series) => series.name === '__hit__:value')!
    expect(hit).toMatchObject({ name: '__hit__:value', triggerEvent: true, symbol: 'circle', symbolSize: 8, itemStyle: { opacity: 0 }, lineStyle: { color: 'rgba(0,0,0,0)', width: 14, opacity: 0 } })
    expect(hit.data[1]).toMatchObject({ elementKey: 'value\u001fstring:Фев', sourceSeriesName: 'value' })
  })

  it('keeps a regular line straight and exposes smoothing as a separate chart type', () => {
    const line = getChartPlugin('line').buildOption(table, base('line')) as { series: Array<{ smooth: boolean }> }
    const spline = getChartPlugin('spline').buildOption(table, base('spline')) as { series: Array<{ smooth: boolean; type: string }> }
    expect(line.series[0].smooth).toBe(false)
    expect(spline.series[0]).toMatchObject({ smooth: 0.45, type: 'line' })
  })

  it('applies a custom color to an entire series', () => {
    const config = base('line'); config.seriesStyles.value = { color: '#123456', lineWidth: 5, lineType: 'dotted', showMarker: false }
    const option = getChartPlugin('line').buildOption(table, config) as { series: Array<{ itemStyle: { color: string; borderColor: string }; lineStyle: { color: string }; showSymbol: boolean; data: Array<{ symbolSize: number }> }> }
    expect(option.series[0].itemStyle).toMatchObject({ color: '#ffffff', borderColor: '#123456' })
    expect(option.series[0].lineStyle).toMatchObject({ color: '#123456', width: 5, type: 'dotted' })
    expect(option.series[0].showSymbol).toBe(true)
    expect(option.series[0].data.every((point) => point.symbolSize === 0)).toBe(true)
  })

  it('keeps line markers hidden by default and styles them for a whole series', () => {
    const config = base('spline')
    let option = getChartPlugin('spline').buildOption(table, config) as { series: Array<{ data: Array<{ symbolSize: number; symbol?: string; itemStyle?: object }> }> }
    expect(option.series[0].data.every((point) => point.symbolSize === 0)).toBe(true)
    config.seriesStyles.value = { showMarker: true, markerShape: 'diamond', markerSize: 11, markerFill: '#ffffff', markerBorder: '#ff0000', markerBorderWidth: 3 }
    option = getChartPlugin('spline').buildOption(table, config) as typeof option
    expect(option.series[0].data[0]).toMatchObject({ symbol: 'diamond', symbolSize: 11, itemStyle: { color: '#ffffff', borderColor: '#ff0000', borderWidth: 3 } })
  })

  it('can show and style a marker for one line value only', () => {
    const config = base('line')
    config.elementStyles['value\u001fstring:Фев'] = { showMarker: true, markerShape: 'rect', markerSize: 14, markerFill: '#ffee00', markerBorder: '#111111', markerBorderWidth: 1 }
    const option = getChartPlugin('line').buildOption(table, config) as { series: Array<{ data: Array<{ symbolSize: number; symbol?: string; itemStyle?: object }> }> }
    expect(option.series[0].data[0].symbolSize).toBe(0)
    expect(option.series[0].data[1]).toMatchObject({ symbol: 'rect', symbolSize: 14, itemStyle: { color: '#ffee00', borderColor: '#111111', borderWidth: 1 } })
  })

  it('renders styled line sections once instead of overlaying the original line', () => {
    const threePoints: DataTable = { name: 'three', columns: ['month', 'value'], rows: [{ month: 'Янв', value: 10 }, { month: 'Фев', value: 20 }, { month: 'Мар', value: 15 }] }
    const config = base('line')
    config.elementStyles['value\u001fstring:Фев'] = { color: '#ff0000', lineType: 'dashed', lineWidth: 4 }
    config.elementStyles['value\u001fstring:Мар'] = { color: '#00aa00', lineType: 'dotted', lineWidth: 3 }
    const option = getChartPlugin('line').buildOption(threePoints, config) as { series: Array<{ name: string; segmentOf?: string; lineStyle: { opacity?: number; color: string; type?: string; width: number }; data: Array<number | null | [string, number | null]> }> }
    expect(option.series[0].lineStyle.opacity).toBe(0)
    const segments = option.series.filter((series) => series.segmentOf === 'value')
    expect(segments).toHaveLength(2)
    expect(segments[0].lineStyle).toMatchObject({ color: '#ff0000', type: 'dashed', width: 4 })
    expect(segments[1].lineStyle).toMatchObject({ color: '#00aa00', type: 'dotted', width: 3 })
    expect(segments[0].data).toEqual([['0:Янв', 10], ['1:Фев', 20], null])
    expect(segments[1].data).toEqual([['1:Фев', 20], ['2:Мар', 15], null])
  })

  it('does not create a separate ECharts series for every line segment', () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ month: index, value: index % 100 }))
    const longTable: DataTable = { name: 'long', columns: ['month', 'value'], rows }
    const option = getChartPlugin('line').buildOption(longTable, base('line')) as { series: Array<{ segmentOf?: string }> }
    expect(option.series).toHaveLength(2)
    expect(option.series.some((series) => series.segmentOf)).toBe(false)
  })
})

describe('chart composition alignment', () => {
  it('keeps visible data and interaction indices aligned for reversed date bounds', () => {
    const dated: DataTable = { name: 'dated', columns: ['date', 'value'], rows: [1, 2, 3, 4].map((day) => ({ date: new Date(2025, 0, day), value: day })) }
    const config = base('line'); config.xField = 'date'; config.xAxisMin = '2025-01-03'; config.xAxisMax = '2025-01-02'
    const visible = prepareVisibleChartData(dated, config)
    expect(visible.categories).toEqual([new Date(2025, 0, 2), new Date(2025, 0, 3)])
    expect(visible.series[0].data).toEqual([2, 3])
  })

  it('applies numeric X bounds and a nice scale to scatter charts', () => {
    const numeric: DataTable = { name: 'numeric', columns: ['x', 'value'], rows: [{ x: 2, value: 10 }, { x: 8, value: 20 }] }
    const config = base('scatter'); config.xField = 'x'; config.xAxisMin = '10'; config.xAxisMax = '1'; config.xAxisStep = 2
    const option = getChartPlugin('scatter').buildOption(numeric, config) as { xAxis: { type: string; min: number; max: number; interval: number } }
    expect(option.xAxis).toMatchObject({ type: 'value', min: 1, max: 10, interval: 2 })
  })

  it('uses a real time axis for dated scatter charts', () => {
    const dated: DataTable = { name: 'dated', columns: ['date', 'value'], rows: [{ date: new Date(2025, 0, 1), value: 10 }, { date: new Date(2025, 1, 1), value: 20 }] }
    const config = base('scatter'); config.xField = 'date'; config.xAxisMin = '2025-01-15'
    const option = getChartPlugin('scatter').buildOption(dated, config) as { xAxis: { type: string; min: number } }
    expect(option.xAxis.type).toBe('time')
    expect(option.xAxis.min).toBe(new Date(2025, 0, 15).getTime())
  })

  it('encodes scatter points by label, bubble size and color group', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'value', 'name', 'population', 'group'], rows: [
      { x: 1, value: 3, name: 'Альфа', population: 10, group: 'А' },
      { x: 2, value: 5, name: 'Бета', population: 1000, group: 'Б' },
    ] }
    const config = base('bubble'); config.xField = 'x'; config.scatterLabelField = 'name'; config.scatterSizeField = 'population'; config.scatterColorField = 'group'; config.scatterShowLabels = true; config.scatterSizeMin = 6; config.scatterSizeMax = 36; config.showLegend = true
    const option = getChartPlugin('bubble').buildOption(scatterTable, config) as { legend: { data: Array<{ name: string; icon: string }> }; series: Array<{ type: string; name: string; data: Array<{ displayLabel: string; bubbleSize: number }> }> }
    const points = option.series.filter((series) => series.type === 'scatter')
    expect(points.map((series) => series.name)).toEqual(['А', 'Б'])
    expect(points.flatMap((series) => series.data).map((point) => point.displayLabel)).toEqual(['Альфа', 'Бета'])
    expect(points[1].data[0].bubbleSize).toBeGreaterThan(points[0].data[0].bubbleSize)
    expect(option.legend.data).toEqual([{ name: 'А', icon: 'circle', itemStyle: { color: '#6956e8' } }, { name: 'Б', icon: 'circle', itemStyle: { color: '#168a72' } }])
  })

  it('uses the first descriptive text column for scatter value labels by default', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'value', 'country'], rows: [{ x: 1, value: 3, country: 'Франция' }] }
    const config = base('scatter'); config.xField = 'x'; config.showValues = true
    const option = getChartPlugin('scatter').buildOption(scatterTable, config) as { series: Array<{ type: string; data: Array<{ displayLabel: string }> }> }
    expect(option.series.find((series) => series.type === 'scatter')?.data[0].displayLabel).toBe('Франция')
  })

  it('adds scatter reference quadrants, a regression line and confidence band', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'value'], rows: [{ x: 1, value: 2 }, { x: 2, value: 4 }, { x: 3, value: 5 }, { x: 4, value: 8 }] }
    const config = base('scatter'); config.xField = 'x'; config.scatterXReference = 2.5; config.scatterYReference = 4; config.scatterQuadrants = true; config.scatterTrendline = true; config.scatterTrendBand = true
    const option = getChartPlugin('scatter').buildOption(scatterTable, config) as { series: Array<{ name: string; type: string; data: unknown[]; markLine?: { data: unknown[] }; markArea?: { data: unknown[] } }> }
    const points = option.series.find((series) => series.type === 'scatter')!
    expect(points.markLine?.data).toHaveLength(2)
    expect(points.markArea?.data).toHaveLength(4)
    expect(option.series.some((series) => series.name === 'Тренд: value' && series.data.length === 31)).toBe(true)
    expect(option.series.filter((series) => series.name.startsWith('__trend-band:value'))).toHaveLength(2)
  })

  it('draws scatter trend lines per color group', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'value', 'group'], rows: [
      { x: 1, value: 2, group: 'А' }, { x: 2, value: 4, group: 'А' }, { x: 1, value: 5, group: 'Б' }, { x: 2, value: 7, group: 'Б' },
    ] }
    const config = base('scatter'); config.xField = 'x'; config.scatterColorField = 'group'; config.seriesStyles = { А: { scatterTrendline: true, scatterTrendBand: true } }
    const option = getChartPlugin('scatter').buildOption(scatterTable, config) as { series: Array<{ name: string; lineStyle?: { color?: string } }> }
    expect(option.series.find((series) => series.name === 'Тренд: А')?.lineStyle?.color).toBe('#6956e8')
    expect(option.series.some((series) => series.name === 'Тренд: Б')).toBe(false)
    expect(option.series.filter((series) => series.name.startsWith('__trend-band:А'))).toHaveLength(2)
  })

  it('keeps ordinary scatter markers uniform and gives bubble charts a size legend', () => {
    const bubbleTable: DataTable = { name: 'bubble', columns: ['x', 'value', 'population'], rows: [{ x: 1, value: 2, population: 10 }, { x: 2, value: 3, population: 1000 }] }
    const scatterConfig = base('scatter'); scatterConfig.xField = 'x'; scatterConfig.scatterSizeField = 'population'; scatterConfig.scatterPointSize = 12
    const scatterOption = getChartPlugin('scatter').buildOption(bubbleTable, scatterConfig) as { series: Array<{ type: string; data: Array<{ bubbleSize: number }> }> }
    expect(scatterOption.series.find((series) => series.type === 'scatter')?.data.map((point) => point.bubbleSize)).toEqual([12, 12])

    const bubbleConfig = { ...scatterConfig, kind: 'bubble' as const, scatterSizeLegend: true, scatterSizeLegendTitle: 'Население' }
    const bubbleOption = getChartPlugin('bubble').buildOption(bubbleTable, bubbleConfig) as { graphic: Array<{ id?: string; x?: number; y?: number }>; grid: { left: number; right: number; top: number; bottom: number }; series: Array<{ type: string; data: Array<{ bubbleSize: number }> }> }
    const sizes = bubbleOption.series.find((series) => series.type === 'scatter')!.data.map((point) => point.bubbleSize)
    expect(sizes[1]).toBeGreaterThan(sizes[0])
    const sizeLegend = bubbleOption.graphic.find((graphic) => graphic.id === 'bubble-size-legend')!
    expect(sizeLegend).toBeTruthy()
    expect(sizeLegend.x).toBeGreaterThanOrEqual(bubbleOption.grid.left)
    expect(sizeLegend.y).toBeGreaterThanOrEqual(bubbleOption.grid.top)
  })

  it('supports equality diagonals and editable quadrant labels', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'value'], rows: [{ x: 1, value: 2 }, { x: 8, value: 7 }] }
    const config = base('scatter'); config.xField = 'x'; config.scatterXReference = 4; config.scatterYReference = 4; config.scatterQuadrants = true; config.scatterDiagonal = true; config.scatterQuadrantLabels = ['A', 'B', 'C', 'D']
    const option = getChartPlugin('scatter').buildOption(scatterTable, config) as { series: Array<{ type: string; markLine?: { data: unknown[] }; markArea?: { data: Array<Array<{ label?: { formatter: string } }>> } }> }
    const points = option.series.find((series) => series.type === 'scatter')!
    expect(points.markLine?.data.some(Array.isArray)).toBe(true)
    expect(points.markArea?.data.map((area) => area[0].label?.formatter)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('builds step, range and confidence-interval line variants', () => {
    const intervalTable: DataTable = { name: 'interval', columns: ['month', 'main', 'low', 'high', 'main2', 'low2', 'high2'], rows: [{ month: 'Янв', main: 10, low: 8, high: 12, main2: 5, low2: -1, high2: 9 }, { month: 'Фев', main: 14, low: 11, high: 18, main2: 7, low2: 0, high2: 20 }, { month: 'Мар', main: 13, low: 18, high: 11, main2: 8, low2: 2, high2: 30 }] }
    const stepConfig = base('step-line'); stepConfig.stepPosition = 'start'
    const stepOption = getChartPlugin('step-line').buildOption(table, stepConfig) as { series: Array<{ step?: string }> }
    expect(stepOption.series[0].step).toBe('start')

    const rangeConfig = base('range-line'); rangeConfig.yFields = ['low', 'high']
    const rangeOption = getChartPlugin('range-line').buildOption(intervalTable, rangeConfig) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } }; series: Array<{ name: string; type?: string; data?: Array<{ value: unknown; itemStyle: { color?: string; opacity: number } }> }> }
    const rangeBand = rangeOption.series.find((series) => series.name === '__range-line-band')
    expect(rangeBand?.type).toBe('custom')
    expect(rangeBand?.data?.[0]).toEqual({ value: ['0:Янв', 8, 12, '1:Фев', 11, 18, 0, 1], itemStyle: { color: '#168a72', opacity: .18 } })
    expect(rangeBand?.data?.[1]).toEqual({ value: ['1:Фев', 11, 18, '2:Мар', 14.5, 14.5, 0, .5], itemStyle: { color: '#168a72', opacity: .18 } })
    expect(rangeBand?.data?.[2]).toEqual({ value: ['1:Фев', 14.5, 14.5, '2:Мар', 11, 18, .5, 1], itemStyle: { color: '#6956e8', opacity: .18 } })
    expect(rangeOption.series.find((series) => series.name === 'low')?.data).toHaveLength(3)
    expect(rangeOption.series.find((series) => series.name === '__hit__:low')?.data).toHaveLength(3)
    expect(rangeOption.xAxis.data).toEqual(['0:Янв', '1:Фев', '2:Мар'])
    expect(rangeOption.xAxis.axisLabel.formatter('2:Мар', 2)).toBe('Мар')

    const stepRangeConfig = base('step-range-line'); stepRangeConfig.yFields = ['low', 'high']; stepRangeConfig.stepPosition = 'end'
    const stepRangeOption = getChartPlugin('step-range-line').buildOption(intervalTable, stepRangeConfig) as { xAxis: { data: string[] }; series: Array<{ name: string; step?: string; data?: Array<{ value: unknown[]; itemStyle: { color?: string } }> }> }
    expect(stepRangeOption.xAxis.data).toEqual(['0:Янв', '1:Фев', '2:Мар'])
    expect(stepRangeOption.series.find((series) => series.name === 'low')?.step).toBe('end')
    expect(stepRangeOption.series.find((series) => series.name === '__step-range-line-band')?.data?.[0]).toEqual({ value: ['0:Янв', 8, 12, '1:Фев', 8, 12, 0, 1], itemStyle: { color: '#168a72', opacity: .18 } })

    const confidenceConfig = base('confidence-line'); confidenceConfig.yFields = ['main', 'low', 'high', 'main2', 'low2', 'high2']; confidenceConfig.intervalFillOpacity = .3; confidenceConfig.showDirectLabels = true
    const confidenceOption = getChartPlugin('confidence-line').buildOption(intervalTable, confidenceConfig) as { yAxis: { min: number; max: number }; series: Array<{ name: string; silent?: boolean; endLabel?: { show: boolean }; areaStyle?: { opacity: number } }> }
    expect(confidenceOption.yAxis.min).toBeLessThanOrEqual(-1)
    expect(confidenceOption.yAxis.max).toBeGreaterThanOrEqual(30)
    expect(confidenceOption.series.find((series) => series.name === '__confidence-line-band-0-fill')?.areaStyle?.opacity).toBe(.3)
    expect(confidenceOption.series.find((series) => series.name === '__confidence-line-band-1-fill')?.areaStyle?.opacity).toBe(.3)
    expect(confidenceOption.series.some((series) => series.name === 'low')).toBe(false)
    expect(confidenceOption.series.find((series) => series.name === 'main')?.endLabel?.show).toBe(true)
    expect(confidenceOption.series.some((series) => series.name === '__confidence-line-bound:low')).toBe(false)

    const labelledConfig = { ...confidenceConfig, intervalGroups: [{ main: 'main', lower: 'low', upper: 'high', showBounds: true }] }
    const labelledOption = getChartPlugin('confidence-line').buildOption(intervalTable, labelledConfig) as { series: Array<{ name: string; endLabel?: { show: boolean }; lineStyle?: { color?: string } }> }
    expect(labelledOption.series.find((series) => series.name === 'low')?.endLabel?.show).toBe(true)
    expect(labelledOption.series.find((series) => series.name === 'high')?.endLabel?.show).toBe(true)
    expect(labelledOption.series.find((series) => series.name === 'low')?.lineStyle?.color).toBe('#6956e8')
  })

  it('shows human labels rather than internal category identifiers in tooltips', () => {
    const option = getChartPlugin('bar').buildOption(table, base('bar')) as { tooltip: { formatter(input: unknown): string } }
    const tooltip = option.tooltip.formatter([{ dataIndex: 0, seriesName: 'value', value: 10, marker: '•' }])
    expect(tooltip).toContain('Янв')
    expect(tooltip).not.toContain('0:Янв')
  })

  it('builds a padded nice numeric scale automatically', () => {
    const config = base('line')
    const option = getChartPlugin('line').buildOption(table, config) as { yAxis: { min: number; max: number; interval: number } }
    expect(option.yAxis).toMatchObject({ min: 8, max: 22, interval: 2 })
  })

  it('keeps zero as the baseline for bar charts and respects manual scale values', () => {
    const automatic = getChartPlugin('bar').buildOption(table, base('bar')) as { yAxis: { min: number } }
    expect(automatic.yAxis.min).toBe(0)
    const config = base('bar'); config.yAxisMin = 5; config.yAxisMax = 50; config.yAxisStep = 5
    const manual = getChartPlugin('bar').buildOption(table, config) as { yAxis: { min: number; max: number; interval: number } }
    expect(manual.yAxis).toMatchObject({ min: 5, max: 50, interval: 5 })
  })

  it('lets the category axis choose a collision-free label interval by default', () => {
    const config = base('line'); config.xAxisStep = null
    const option = getChartPlugin('line').buildOption(table, config) as { xAxis: { axisLabel: { interval: string; hideOverlap: boolean }; axisTick: { interval: string }; splitLine: { interval: string } } }
    expect(option.xAxis.axisLabel).toMatchObject({ interval: 0, hideOverlap: false, showMinLabel: true, showMaxLabel: true })
    expect(option.xAxis.axisTick.interval).toBe(0)
    expect(option.xAxis.splitLine.interval).toBe(0)
  })

  it('shows every categorical label and wraps long names instead of dropping categories', () => {
    const categorical: DataTable = { name: 'countries', columns: ['country', 'value'], rows: ['Соединённые Штаты Америки', 'Великобритания', 'Новая Зеландия', 'Южная Африка'].map((country, index) => ({ country, value: index + 1 })) }
    const config = base('bar'); config.xField = 'country'; config.canvasWidth = 420
    const option = getChartPlugin('bar').buildOption(categorical, config) as { xAxis: { data: string[]; axisLabel: { interval: number; hideOverlap: boolean; formatter(value: string, index: number): string } } }
    const labels = option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))
    expect(option.xAxis.axisLabel).toMatchObject({ interval: 0, hideOverlap: false })
    expect(labels).toHaveLength(categorical.rows.length)
    expect(labels.every(Boolean)).toBe(true)
    expect(labels[0]).toContain('\n')
  })

  it('applies configurable canvas margins to plot and text guides', () => {
    const config = base('bar'); config.canvasWidth = 800; config.canvasMarginLeft = 70; config.canvasMarginRight = 55; config.canvasMarginTop = 40; config.canvasMarginBottom = 45; config.note = 'Комментарий'; config.source = 'Источник'
    const option = getChartPlugin('bar').buildOption(table, config) as { title: { left: number; top: number }; grid: { left: number; right: number }; legend: { left: number }; graphic: Array<{ id: string; left?: number; right?: number; bottom?: number }> }
    expect(option.title).toMatchObject({ left: 70, top: 32 })
    expect(option.grid.left).toBeGreaterThanOrEqual(70)
    expect(option.grid.right).toBeGreaterThanOrEqual(55)
    expect(option.legend.left).toBe(70)
    expect(option.graphic.find((item) => item.id === 'chart-source')).toMatchObject({ left: 70, bottom: 45 })
  })

  it('uses the same manual interval for labels, ticks and vertical grid lines', () => {
    const config = base('line'); config.xAxisStep = 3; config.showVerticalGrid = true
    const option = getChartPlugin('line').buildOption(table, config) as { xAxis: { axisLabel: { interval: number }; axisTick: { interval: number }; splitLine: { interval: number } } }
    expect(option.xAxis.axisLabel.interval).toBe(2)
    expect(option.xAxis.axisTick.interval).toBe(2)
    expect(option.xAxis.splitLine.interval).toBe(2)
  })

  it('shrinks dense date labels instead of hiding labels requested by a manual step', () => {
    const dated: DataTable = { name: 'daily', columns: ['date', 'value'], rows: Array.from({ length: 20 }, (_, index) => ({ date: new Date(2025, 0, index + 1), value: index })) }
    const denseConfig = base('line'); denseConfig.xField = 'date'; denseConfig.dateLabelFormat = 'day-month-year'; denseConfig.xAxisStep = 1; denseConfig.canvasWidth = 500
    const sparseConfig = { ...denseConfig, xAxisStep: 5 }
    const dense = getChartPlugin('line').buildOption(dated, denseConfig) as { xAxis: { axisLabel: { fontSize: number; interval: number; hideOverlap: boolean; rotate: number } } }
    const sparse = getChartPlugin('line').buildOption(dated, sparseConfig) as typeof dense
    expect(dense.xAxis.axisLabel.fontSize).toBeLessThan(sparse.xAxis.axisLabel.fontSize)
    expect(dense.xAxis.axisLabel).toMatchObject({ interval: 0, hideOverlap: false })
    expect(dense.xAxis.axisLabel.rotate).toBeGreaterThan(0)
  })

  it('keeps readable typography and chooses a wider step in automatic date mode', () => {
    const dated: DataTable = { name: 'daily', columns: ['date', 'value'], rows: Array.from({ length: 30 }, (_, index) => ({ date: new Date(2025, 0, index + 1), value: index })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'day-month-year'; config.xAxisStep = null; config.canvasWidth = 500; config.xAxisLabelText = style(16)
    const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { axisLabel: { fontSize: number; interval: number; hideOverlap: boolean; rotate: number }; axisTick: { interval: number } } }
    expect(option.xAxis.axisLabel.fontSize).toBe(16)
    expect(option.xAxis.axisLabel.interval).toBeGreaterThan(0)
    expect(option.xAxis.axisLabel).toMatchObject({ hideOverlap: false, rotate: 0 })
    expect(option.xAxis.axisTick.interval).toBe(option.xAxis.axisLabel.interval)
  })

  it('aligns line-chart grid lines with category ticks without clipping bars', () => {
    const line = getChartPlugin('line').buildOption(table, base('line')) as { xAxis: { boundaryGap: boolean } }
    const bar = getChartPlugin('bar').buildOption(table, { ...base('bar'), showVerticalGrid: true }) as { xAxis: { boundaryGap: boolean; splitLine: { show: boolean }; axisTick: { interval: number } } }
    expect(line.xAxis.boundaryGap).toBe(false)
    expect(bar.xAxis.boundaryGap).toBe(true)
    expect(bar.xAxis.splitLine.show).toBe(false)
    expect(typeof bar.xAxis.axisTick.interval).toBe('number')
  })

  it('uses calendar years rather than row counts for date label steps', () => {
    const daily: DataTable = {
      name: 'daily', columns: ['date', 'value'],
      rows: [new Date(2022, 11, 31), new Date(2023, 0, 1), new Date(2023, 0, 2), new Date(2024, 0, 1), new Date(2025, 0, 1)].map((date, index) => ({ date, value: index + 1 })),
      timeProfiles: { date: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' } },
    }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'year-first-full'; config.dateAxisStepUnit = 'year'; config.xAxisStep = 2
    const option = getChartPlugin('line').buildOption(daily, config) as { xAxis: { data: string[]; axisLabel: { interval(index: number): boolean; formatter(value: string, index: number): string }; axisTick: { interval(index: number): boolean }; splitLine: { interval(index: number): boolean } } }
    expect(option.xAxis.data).toHaveLength(5)
    expect(new Set(option.xAxis.data).size).toBe(5)
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['', '2023', '', '', "'25"])
    expect(option.xAxis.data.map((_, index) => option.xAxis.axisLabel.interval(index))).toEqual([false, true, false, false, true])
    expect(option.xAxis.axisTick.interval).toBe(option.xAxis.axisLabel.interval)
    expect(option.xAxis.splitLine.interval).toBe(option.xAxis.axisLabel.interval)
  })

  it('labels annual observations recorded at the end of each year', () => {
    const annual: DataTable = { name: 'annual', columns: ['date', 'value'], rows: [2022, 2023, 2024].map((year, value) => ({ date: new Date(year, 11, 31), value })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'year-full'
    const option = getChartPlugin('line').buildOption(annual, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['2022', '2023', '2024'])
    expect(option.xAxis.axisLabel.interval(0)).toBe(true)
  })

  it('anchors calendar steps at the first date chosen by the user', () => {
    const dated: DataTable = { name: 'years', columns: ['date', 'value'], rows: [2022, 2023, 2024, 2025, 2026].map((year, value) => ({ date: new Date(year, 0, 1), value })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'year-full'; config.dateAxisStepUnit = 'year'; config.dateAxisAnchor = '2023-01-01'; config.xAxisStep = 2
    const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { data: string[]; axisLabel: { hideOverlap: boolean; interval(index: number): boolean; formatter(value: string, index: number): string } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['', '2023', '', '2025', ''])
    expect(option.xAxis.data.map((_, index) => option.xAxis.axisLabel.interval(index))).toEqual([false, true, false, true, false])
    expect(option.xAxis.axisLabel.hideOverlap).toBe(false)
  })

  it('does not turn a March anchor into a year boundary', () => {
    const dates = [new Date(2024, 2, 1), new Date(2024, 5, 1), new Date(2025, 0, 1), new Date(2025, 2, 1)]
    const dated: DataTable = { name: 'daily', columns: ['date', 'value'], rows: dates.map((date, value) => ({ date, value })), timeProfiles: { date: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' } } }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'year-full'; config.dateAxisStepUnit = 'year'; config.dateAxisAnchor = '2024-03-01'
    const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['', '', '2025', ''])
    expect(option.xAxis.axisLabel.interval(0)).toBe(false)
  })

  it('reduces daily labels to calendar month and week transitions', () => {
    const dates = Array.from({ length: 12 }, (_, index) => new Date(2024, 0, 29 + index))
    const dated: DataTable = { name: 'daily', columns: ['date', 'value'], rows: dates.map((date, value) => ({ date, value })) }
    const monthConfig = base('line'); monthConfig.xField = 'date'; monthConfig.dateLabelFormat = 'month-only-ru'
    const month = getChartPlugin('line').buildOption(dated, monthConfig) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    expect(month.xAxis.data.map((value, index) => month.xAxis.axisLabel.formatter(value, index)).filter(Boolean)).toEqual(['февр.'])
    const weekConfig = { ...monthConfig, dateLabelFormat: 'week-only' as const }
    const week = getChartPlugin('line').buildOption(dated, weekConfig) as typeof month
    expect(week.xAxis.data.map((value, index) => week.xAxis.axisLabel.formatter(value, index)).filter(Boolean)).toEqual(['W05', 'W06'])
  })

  it('shows half-year labels only at real half-year boundaries', () => {
    const dated: DataTable = { name: 'monthly', columns: ['date', 'value'], rows: Array.from({ length: 12 }, (_, month) => ({ date: new Date(2025, month, 1), value: month })), timeProfiles: { date: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' } } }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'half-only'
    const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index)).filter(Boolean)).toEqual(['H1', 'H2'])
  })

  it('reserves room to the right of the final label for every cartesian chart', () => {
    const dated: DataTable = { name: 'dated', columns: ['date', 'value'], rows: [{ date: new Date(2025, 0, 1), value: 1 }, { date: new Date(2025, 11, 31), value: 2 }] }
    for (const kind of ['line', 'spline', 'step-line', 'range-line', 'step-range-line', 'confidence-line', 'area', 'stacked-area', 'normalized-stacked-area', 'bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'scatter', 'bubble'] as const) {
      const config = base(kind); config.xField = 'date'; config.dateLabelFormat = 'date-dmy-en'
      const option = getChartPlugin(kind).buildOption(dated, config) as { grid: { right: number } }
      expect(option.grid.right, kind).toBeGreaterThan(30)
    }
  })

  it('formats contextual quarter and day labels without changing category identities', () => {
    const quarterly: DataTable = {
      name: 'quarterly', columns: ['date', 'value'],
      rows: [0, 3, 6, 9].map((month, index) => ({ date: new Date(2025, month, 1), value: index + 1 })),
      timeProfiles: { date: { frequency: 'quarterly', label: 'Квартальные', confidence: 100, source: 'intervals' } },
    }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'quarter-context-en'
    const option = getChartPlugin('line').buildOption(quarterly, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; hideOverlap: boolean; showMinLabel: boolean; showMaxLabel?: boolean } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['Q1\n2025', 'Q2', 'Q3', 'Q4'])
    expect(option.xAxis.axisLabel).toMatchObject({ hideOverlap: false, showMinLabel: true })
    expect(option.xAxis.axisLabel.showMaxLabel).toBeUndefined()
    expect(new Set(option.xAxis.data).size).toBe(4)
  })

  it('keeps the first contextual period label when a series starts mid-year', () => {
    const quarterly: DataTable = { name: 'partial year', columns: ['date', 'value'], rows: [3, 6, 9].map((month, value) => ({ date: new Date(2025, month, 1), value })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'quarter-context-ru'
    const option = getChartPlugin('line').buildOption(quarterly, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
    expect(option.xAxis.axisLabel.formatter(option.xAxis.data[0], 0)).toBe('К2')
    expect(option.xAxis.axisLabel.interval(0)).toBe(true)
  })

  it('places an ISO year only below the first contextual week', () => {
    const weekly: DataTable = { name: 'weeks', columns: ['date', 'value'], rows: [new Date(2024, 11, 30), new Date(2025, 0, 6), new Date(2025, 0, 13)].map((date, value) => ({ date, value })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'week-context-en'
    const option = getChartPlugin('line').buildOption(weekly, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['W01\n2025', 'W02', 'W03'])
  })

  it('uses one left guide for title, plot, legend and footer texts', () => {
    const config = base('bar'); config.showLegend = true; config.note = 'Комментарий'; config.source = 'Источник'; config.axisTitleText.color = '#c2185b'; config.noteText.color = '#1565c0'; config.sourceText.color = '#7b1fa2'
    const option = getChartPlugin('bar').buildOption(table, config) as { title: { left: number }; grid: { left: number }; legend: { left: number }; graphic: Array<{ id: string; left: number; bottom?: number; rotation?: number; style: { text: string; align?: string; fill?: string } }>; xAxis: { nameGap: number }; yAxis: { name: string } }
    expect(option.title.left).toBe(32)
    expect(option.grid.left).toBe(56)
    expect(option.legend.left).toBe(32)
    expect(option.graphic.map((item) => item.left)).toEqual([32, 32, 32])
    expect(option.graphic[0]).toMatchObject({ id: 'chart-y-axis-title', left: 32, rotation: Math.PI / 2, style: { text: 'value', fill: '#c2185b' } })
    expect(option.graphic[1]).toMatchObject({ id: 'chart-note', left: 32, bottom: 40, style: { text: 'Комментарий', align: 'left', fill: '#1565c0' } })
    expect(option.graphic[2]).toMatchObject({ id: 'chart-source', left: 32, bottom: 24, style: { text: 'Источник', align: 'left', fill: '#7b1fa2' } })
    expect(option.xAxis.nameGap).toBe(36)
    expect(option.yAxis.name).toBe('')
  })

  it('keeps Y scale labels to the right of the Y title even with zero gap', () => {
    const config = base('bar'); config.yAxisTitleGap = 0
    const option = getChartPlugin('bar').buildOption(table, config) as { grid: { left: number }; graphic: Array<{ id: string; left: number }> }
    expect(option.graphic[0]).toMatchObject({ id: 'chart-y-axis-title', left: 32 })
    expect(option.grid.left).toBe(46)
  })

  it('applies X title gap after category labels and ticks', () => {
    const config = base('bar'); config.xAxisTitleGap = 0
    const option = getChartPlugin('bar').buildOption(table, config) as { grid: { bottom: number }; xAxis: { nameGap: number } }
    expect(option.xAxis.nameGap).toBe(26)
    expect(option.grid.bottom).toBe(58)
  })

  it('reserves the full height of multiline axis titles', () => {
    const single = base('line')
    const multiline = base('line'); multiline.xAxisTitle = 'Первая строка\nВторая строка'; multiline.yAxisTitle = 'Значение\nна человека'
    const singleOption = getChartPlugin('line').buildOption(table, single) as { grid: { left: number; bottom: number } }
    const multilineOption = getChartPlugin('line').buildOption(table, multiline) as { grid: { left: number; bottom: number }; graphic: Array<{ id: string; style: { lineHeight?: number } }> }
    expect(multilineOption.grid.bottom).toBeGreaterThan(singleOption.grid.bottom)
    expect(multilineOption.grid.left).toBeGreaterThan(singleOption.grid.left)
    expect(multilineOption.graphic.find((item) => item.id === 'chart-y-axis-title')?.style.lineHeight).toBe(14)
  })

  it('uses the matching title gaps after axes are transposed for linear bars', () => {
    const config = base('horizontal-bar'); config.xAxisTitleGap = 7; config.yAxisTitleGap = 23; config.barOrientation = 'vertical'
    const option = getChartPlugin('horizontal-bar').buildOption(table, config) as { xAxis: { name: string; nameGap: number; nameTextStyle: { fontSize: number } }; yAxis: { name: string; nameGap: number; nameRotate: number; nameTextStyle: { fontSize: number } }; graphic: Array<{ id?: string }> }
    expect(option.xAxis.name).toBe('value')
    expect(option.xAxis.nameGap).toBeGreaterThan(23)
    expect(option.xAxis.nameTextStyle.fontSize).toBe(12)
    expect(option.yAxis.name).toBe('month')
    expect(option.yAxis.nameGap).toBe(33)
    expect(option.yAxis.nameRotate).toBe(90)
    expect(option.yAxis.nameTextStyle.fontSize).toBe(12)
    expect(option.graphic.some((item) => item.id === 'chart-y-axis-title')).toBe(false)
  })

  it('reclaims and reserves the correct sides when horizontal-axis titles are toggled', () => {
    const both = base('horizontal-bar')
    const valueOnly = base('horizontal-bar'); valueOnly.showXAxisTitle = false; valueOnly.showYAxisTitle = true; valueOnly.yAxisTitleText = style(24)
    const categoryOnly = base('horizontal-bar'); categoryOnly.showXAxisTitle = true; categoryOnly.showYAxisTitle = false; categoryOnly.xAxisTitleText = style(24)
    const bothGrid = (getChartPlugin('horizontal-bar').buildOption(table, both) as { grid: { left: number; bottom: number } }).grid
    const valueGrid = (getChartPlugin('horizontal-bar').buildOption(table, valueOnly) as { grid: { left: number; bottom: number } }).grid
    const categoryGrid = (getChartPlugin('horizontal-bar').buildOption(table, categoryOnly) as { grid: { left: number; bottom: number } }).grid
    expect(valueGrid.bottom).toBeGreaterThan(categoryGrid.bottom)
    expect(categoryGrid.left).toBeGreaterThan(valueGrid.left)
    expect(bothGrid.left).toBeGreaterThan(0)
  })

  it('reclaims left space automatically when the Y title is hidden', () => {
    const config = base('bar'); config.showYAxisTitle = false
    const option = getChartPlugin('bar').buildOption(table, config) as { grid: { left: number }; yAxis: { name: string } }
    expect(option.grid.left).toBe(32)
    expect(option.yAxis.name).toBe('')
  })

  it('aligns the plot itself to the left guide when the Y axis is on the right', () => {
    const config = base('bar'); config.yAxisPosition = 'right'
    const option = getChartPlugin('bar').buildOption(table, config) as { grid: { left: number; right: number }; yAxis: { position: string }; graphic: Array<{ id: string; left?: number; right?: number; rotation?: number }> }
    expect(option.grid).toMatchObject({ left: 32, containLabel: true })
    expect(option.grid.right).toBeGreaterThanOrEqual(56)
    expect(option.yAxis.position).toBe('right')
    expect(option.graphic[0]).toMatchObject({ id: 'chart-y-axis-title', right: 24, rotation: -Math.PI / 2 })
    expect(option.graphic[0].left).toBeUndefined()
  })

  it('reserves header space when the X axis is moved to the top', () => {
    const config = base('bar'); config.xAxisPosition = 'top'
    const option = getChartPlugin('bar').buildOption(table, config) as { grid: { top: number; bottom: number }; xAxis: { position: string; axisLine: { onZero: boolean }; axisTick: { inside: boolean; alignWithLabel: boolean }; axisLabel: { inside: boolean } } }
    expect(option.grid).toMatchObject({ top: 128, bottom: 38 })
    expect(option.xAxis.position).toBe('top')
    expect(option.xAxis.axisLine.onZero).toBe(false)
    expect(option.xAxis.axisTick.inside).toBe(false)
    expect(option.xAxis.axisTick.alignWithLabel).toBe(true)
    expect(option.xAxis.axisLabel.inside).toBe(false)
  })

  it('configures horizontal and vertical grid lines independently', () => {
    const config = base('line'); config.showHorizontalGrid = false; config.showVerticalGrid = true; config.gridColor = '#123456'; config.gridWidth = 2; config.gridType = 'dashed'
    const option = getChartPlugin('line').buildOption(table, config) as { xAxis: { splitLine: { show: boolean; lineStyle: object } }; yAxis: { splitLine: { show: boolean } } }
    expect(option.xAxis.splitLine).toMatchObject({ show: true, lineStyle: { color: '#123456', width: 2, type: 'dashed' } })
    expect(option.yAxis.splitLine.show).toBe(false)
  })
})
