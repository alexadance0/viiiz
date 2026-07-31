import { describe, expect, it } from 'vitest'
import * as echarts from 'echarts'
import { chartElementColor, chartRegistry, chartValueLabelSelections, fitSwarmClouds, fitSwarmOffsets, formatWaterfallChange, getChartPlugin, hyphenateTreemapText, movingAverage, packSwarmOffsets, prepareVisibleChartData, treemapAdaptiveFontSize, waterfallElementColor, waterfallLabelPlacement, waterfallSteps, waterfallValueLabel } from './chartRegistry'
import { absorbedBarLabelPlacement } from './chartLabels'
import { isoWeekParts } from './timeFrequency'
import { entrepreneurshipDifficultiesDemoTable } from './demoData'
import type { ChartConfig, ChartTextStyle, DataTable } from './types'

const style = (size: number): ChartTextStyle => ({ fontFamily: 'Arial', size, color: '#000000', weight: 400, italic: false, lineHeight: 120, align: 'left' })
const table: DataTable = { name: 'test', columns: ['month', 'value'], rows: [{ month: 'Янв', value: 10 }, { month: 'Фев', value: 20 }] }
const base = (kind: ChartConfig['kind']): ChartConfig => ({
  kind, xField: 'month', yField: 'value', yFields: ['value'], seriesField: '', aggregation: 'none', valueMode: 'absolute', missingMode: 'gap',
  title: '', subtitle: '', note: '', source: '', titleText: style(20), subtitleText: style(14), axisTitleText: style(12), axisLabelText: style(11), legendText: style(11), valueText: style(11), noteText: style(10), sourceText: style(9),
  xAxisTitle: 'month', yAxisTitle: 'value', xAxisTitleGap: 10, yAxisTitleGap: 10, xAxisPosition: 'bottom', yAxisPosition: 'left', showXAxisTitle: true, showYAxisTitle: true, showXAxisLine: true, showYAxisLine: true, axisLineColor: '#555', axisLineWidth: 1, axisLineType: 'solid', showXTicks: true, showYTicks: true, tickLength: 5,
  showValues: false, elementStyles: {}, seriesStyles: {}, annotations: [], color: '#6956e8', showLegend: false, showHorizontalGrid: true, showVerticalGrid: false, gridColor: '#dddddd', gridWidth: 1, gridType: 'solid',
})
const plainLabel = (value: string) => value.replaceAll(/[\u00ad\ufeff]/g, '')

describe('waterfall chart', () => {
  it('builds cumulative floating bars and a final total', () => {
    expect(waterfallSteps([100, -30, 20, null])).toEqual({
      steps: [
        { delta: 100, start: 0, end: 100 },
        { delta: -30, start: 100, end: 70 },
        { delta: 20, start: 70, end: 90 },
        { delta: null, start: 90, end: 90 },
      ],
      total: 90,
    })
    const data: DataTable = { name: 'waterfall', columns: ['factor', 'change'], rows: [
      { factor: 'Выручка', change: 100 },
      { factor: 'Расходы', change: -30 },
      { factor: 'Прочее', change: 20 },
    ] }
    const option = getChartPlugin('waterfall').buildOption(data, { ...base('waterfall'), xField: 'factor', yField: 'change', yFields: ['change'], showValues: true }) as {
      grid: { left: number; right: number }
      xAxis: { data: string[] }
      yAxis: { min: number; max: number }
      series: Array<{ name: string; data: Array<{ value: number[]; displayValue: string }> }>
    }
    const barOption = getChartPlugin('bar').buildOption(data, { ...base('bar'), xField: 'factor', yField: 'change', yFields: ['change'], showValues: true }) as { grid: { left: number } }
    expect(option.grid.left).toBe(barOption.grid.left)
    expect(option.xAxis.data).toHaveLength(4)
    expect(option.series[1].name).toBe('change')
    expect(option.series[1].data.map((item) => item.value)).toEqual([[0, 0, 100], [1, 100, 70], [2, 70, 90], [3, 0, 90]])
    expect(option.series[1].data.map((item) => item.displayValue)).toEqual(['100', '-30', '20', '90'])
    expect(waterfallElementColor(data, { ...base('waterfall'), xField: 'factor', yField: 'change', yFields: ['change'] }, 'change\u001fstring:Выручка')).toBe('#36a476')
    expect(waterfallElementColor(data, { ...base('waterfall'), xField: 'factor', yField: 'change', yFields: ['change'] }, 'change\u001fstring:Расходы')).toBe('#db5a5a')
    expect(waterfallElementColor(data, { ...base('waterfall'), xField: 'factor', yField: 'change', yFields: ['change'] }, 'change\u001fstring:Итого')).toBe('#6956e8')
    expect(chartElementColor(data, { ...base('waterfall'), xField: 'factor', yField: 'change', yFields: ['change'] }, 'change\u001fstring:Итого')).toBe('#6956e8')
    expect(chartValueLabelSelections(data, { ...base('waterfall'), xField: 'factor', yField: 'change', yFields: ['change'] }).find((item) => item.category === 'Итого')?.color).toBe('#6956e8')
    expect(option.yAxis.min).toBeLessThanOrEqual(0)
    expect(option.yAxis.max).toBeGreaterThanOrEqual(100)
  })

  it('uses the rendered series color for ordinary chart elements', () => {
    const config = { ...base('bar'), palette: ['#123456'] }
    expect(chartElementColor(table, config, 'value\u001fstring:Янв')).toBe('#123456')
    expect(chartValueLabelSelections(table, config).find((item) => item.category === 'Янв')?.color).toBeUndefined()
  })

  it('formats signs, cumulative values and label positions', () => {
    const config = { ...base('waterfall'), waterfallSignMode: 'plus-minus' as const }
    expect(formatWaterfallChange(20, config)).toBe('+20')
    expect(formatWaterfallChange(-20, config)).toBe('-20')
    expect(waterfallValueLabel(20, 90, false, { ...config, waterfallLabelContent: 'both' })).toBe('+20 → 90')
    expect(waterfallValueLabel(90, 90, true, config)).toBe('90')
    expect(formatWaterfallChange(-20, { ...config, waterfallSignMode: 'custom', waterfallNegativePrefix: 'снижение ' })).toBe('снижение 20')
    expect(waterfallLabelPlacement(100, 20, 60, 30, 14, 'auto', 6)).toEqual({ y: 60, verticalAlign: 'middle', inside: true })
    expect(waterfallLabelPlacement(100, 92, 60, 30, 14, 'auto', 6)).toEqual({ y: 86, verticalAlign: 'bottom', inside: false })
    expect(waterfallLabelPlacement(20, 100, 60, 30, 14, 'inside-top', 6)).toEqual({ y: 94, verticalAlign: 'bottom', inside: true })
  })
})

describe('individual chart element styles', () => {
  it('builds a hierarchical treemap and aggregates repeated leaves', () => {
    const hierarchy: DataTable = { name: 'hierarchy', columns: ['category', 'subcategory', 'value'], rows: [
      { category: 'Транспорт', subcategory: 'Автобусы', value: 10 },
      { category: 'Транспорт', subcategory: 'Автобусы', value: 5 },
      { category: 'Транспорт', subcategory: 'Поезда', value: 20 },
      { category: 'Связь', subcategory: 'Интернет', value: 30 },
    ] }
    const config = { ...base('treemap'), xField: 'category', yField: 'value', yFields: ['value'], treemapSubcategoryField: 'subcategory', aggregation: 'sum' as const, showValues: true, treemapGap: 3, treemapGroupGap: 17, palette: ['#123456', '#abcdef'] }
    const option = getChartPlugin('treemap').buildOption(hierarchy, config) as { xAxis?: unknown; series: Array<{ type: string; levels?: Array<{ itemStyle?: { borderWidth?: number; gapWidth?: number } }>; data: Array<{ name: string; value: number; itemStyle?: { borderWidth?: number }; children: Array<{ name: string; value: number; displayValue: string; elementKey: string; itemStyle?: { borderWidth?: number }; label?: { color?: string } }> }> }> }
    expect(getChartPlugin('treemap').validate(hierarchy, config).ok).toBe(true)
    expect(option.xAxis).toBeUndefined()
    expect(option.series[0].type).toBe('treemap')
    const transport = option.series[0].data.find((node) => node.name === 'Транспорт')!
    expect(transport.value).toBe(35)
    expect(transport.children.find((node) => node.name === 'Автобусы')).toMatchObject({ value: 15, displayValue: '15' })
    expect(new Set(transport.children.map((node) => node.label?.color)).size).toBe(1)
    expect(option.series[0].data.find((node) => node.name === 'Связь')?.children).toHaveLength(1)
    expect(option.series[0].data.every((node) => node.itemStyle?.borderWidth === 0)).toBe(true)
    expect(option.series[0].levels?.[0].itemStyle).toMatchObject({ borderWidth: 0, gapWidth: 17 })
    expect(option.series[0].levels?.[1].itemStyle).toMatchObject({ borderWidth: 0, gapWidth: 3 })
    expect(transport.children.every((node) => node.itemStyle?.borderWidth === 0)).toBe(true)
    expect(chartValueLabelSelections(hierarchy, config)).toHaveLength(5)
  })

  it('rejects treemaps without positive sizes', () => {
    const invalid: DataTable = { name: 'invalid', columns: ['category', 'value'], rows: [{ category: 'A', value: 0 }, { category: 'B', value: -2 }] }
    expect(getChartPlugin('treemap').validate(invalid, { ...base('treemap'), xField: 'category', yField: 'value', yFields: ['value'] }).ok).toBe(false)
  })

  it('controls treemap names, values and positions per group and leaf', () => {
    const hierarchy: DataTable = { name: 'hierarchy', columns: ['category', 'subcategory', 'value'], rows: [
      { category: 'Транспорт', subcategory: 'Автобусы', value: 15 },
      { category: 'Транспорт', subcategory: 'Поезда', value: 20 },
    ] }
    const option = getChartPlugin('treemap').buildOption(hierarchy, {
      ...base('treemap'),
      xField: 'category',
      yField: 'value',
      yFields: ['value'],
      treemapSubcategoryField: 'subcategory',
      aggregation: 'sum',
      showValues: true,
      valueLabelAutoContrast: false,
      treemapGroupText: { ...style(20), fontFamily: 'Group Font' },
      treemapLeafText: { ...style(12), fontFamily: 'Leaf Font' },
      elementStyles: {
        'Транспорт\u001fstring:Автобусы': { color: '#000000', labelAutoContrast: true, showName: false, showValue: true, treemapLabelPosition: 'bottom-right' },
        'treemap-group:Транспорт': { color: '#ff00aa', showName: true, showValue: false, treemapLabelPosition: 'top-right' },
      },
    }) as { series: Array<{ data: Array<{ name: string; children?: Array<{ name: string; label: { formatter: string; position: string; fontFamily: string; fontWeight: number; color?: string }; itemStyle?: { color?: string } }>; label?: { formatter: string; position: string; fontFamily: string }; itemStyle?: { color?: string; borderColor?: string } }> }> }
    const buses = option.series[0].data[0].children?.find((item) => item.name === 'Автобусы')
    expect(buses?.label).toMatchObject({ formatter: '15', position: 'insideBottomRight', fontFamily: 'Leaf Font', fontWeight: 400 })
    expect(buses?.label.color).toBe('#ffffff')
    expect(plainLabel(option.series[1].data[0].label!.formatter)).toBe('Транспорт')
    expect(option.series[1].data[0].label).toMatchObject({ position: 'insideTopRight', fontFamily: 'Group Font' })
    expect(option.series[0].data[0].itemStyle?.color).toBe('#ff00aa')
    expect(buses?.itemStyle?.color).toBe('#000000')
    expect(option.series[1].data).toHaveLength(option.series[0].data.length)
    expect(option.series[1].data.every((item) => item.itemStyle?.color === 'rgba(0,0,0,0)' && item.itemStyle.borderColor === 'rgba(0,0,0,0)')).toBe(true)
  })

  it('keeps values attached to visible labels and does not duplicate a single-child total', () => {
    const hierarchy: DataTable = { name: 'hierarchy', columns: ['category', 'subcategory', 'value'], rows: [
      { category: 'Транспорт', subcategory: 'Автобусы', value: 15 },
      { category: 'Транспорт', subcategory: 'Поезда', value: 20 },
      { category: 'Связь', subcategory: 'Интернет', value: 30 },
    ] }
    type Node = { name: string; label: { show: boolean; formatter: string }; children?: Node[] }
    const build = (values: Partial<ChartConfig>) => getChartPlugin('treemap').buildOption(hierarchy, {
      ...base('treemap'),
      xField: 'category',
      yField: 'value',
      yFields: ['value'],
      treemapSubcategoryField: 'subcategory',
      aggregation: 'sum',
      showValues: true,
      ...values,
    }) as { series: Array<{ data: Node[] }> }

    const visible = build({})
    const singleGroup = visible.series[1].data.find((node) => node.name === 'Связь')!
    const singleLeaf = visible.series[0].data.find((node) => node.name === 'Связь')!.children![0]
    expect(plainLabel(singleGroup.label.formatter)).toBe('Связь\n30')
    expect(plainLabel(singleLeaf.label.formatter)).toBe('Интернет')

    const hidden = build({ treemapShowGroupLabels: false, treemapShowLeafLabels: false })
    expect(hidden.series.flatMap((series) => series.data).every((node) => node.label.show === false)).toBe(true)
    expect(hidden.series[0].data.flatMap((node) => node.children ?? []).every((node) => node.label.show === false)).toBe(true)

    const leavesOnly = build({ treemapShowGroupLabels: false, treemapShowLeafLabels: true })
    expect(plainLabel(leavesOnly.series[0].data.find((node) => node.name === 'Связь')!.children![0].label.formatter)).toBe('Интернет\n30')

    const valuesOnly = build({ treemapShowGroupLabels: false, treemapShowLeafLabels: false, treemapShowGroupValues: true, treemapShowLeafValues: true })
    expect(valuesOnly.series[1].data.find((node) => node.name === 'Связь')!.label.formatter).toBe('30')
    expect(valuesOnly.series[0].data.find((node) => node.name === 'Транспорт')!.children!.every((node) => /^\d+$/.test(node.label.formatter))).toBe(true)
  })

  it('filters treemap categories and formats visible values as shares without changing their size', () => {
    const hierarchy: DataTable = { name: 'hierarchy', columns: ['category', 'subcategory', 'value'], rows: [
      { category: 'A', subcategory: 'A1', value: 30 },
      { category: 'A', subcategory: 'A2', value: 20 },
      { category: 'B', subcategory: 'B1', value: 50 },
    ] }
    type Node = { name: string; value: number; displayValue: string; label: { formatter: string }; children?: Node[] }
    const option = getChartPlugin('treemap').buildOption(hierarchy, {
      ...base('treemap'),
      xField: 'category',
      yField: 'value',
      yFields: ['value'],
      treemapSubcategoryField: 'subcategory',
      aggregation: 'sum',
      showValues: true,
      treemapShowLeafValues: true,
      treemapHiddenCategories: ['B'],
      treemapValueFormat: 'percent',
      numberDecimals: 0,
    }) as { series: Array<{ data: Node[] }> }

    expect(option.series[0].data.map((node) => node.name)).toEqual(['A'])
    expect(option.series[1].data.map((node) => node.name)).toEqual(['A'])
    expect(option.series[0].data[0]).toMatchObject({ value: 50, displayValue: '100%' })
    expect(option.series[0].data[0].children).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'A1', value: 30, displayValue: '60%' }),
      expect.objectContaining({ name: 'A2', value: 20, displayValue: '40%' }),
    ]))
    expect(plainLabel(option.series[1].data[0].label.formatter)).toBe('A\n100%')
  })

  it('keeps raw treemap text while exposing Russian hyphenation points for rendered lines', () => {
    const long: DataTable = { name: 'long', columns: ['category', 'value'], rows: [{ category: 'Сверхдлинноесловобезединогопробела', value: 10 }] }
    const option = getChartPlugin('treemap').buildOption(long, { ...base('treemap'), xField: 'category', yField: 'value', yFields: ['value'], aggregation: 'sum', showValues: false }) as { series: Array<{ data: Array<{ label: { formatter: string; overflow: string } }> }> }
    const label = option.series[0].data[0].label
    expect(label.formatter).toBe('Сверхдлинноесловобезединогопробела')
    expect(label.overflow).toBe('break')
    expect(plainLabel(hyphenateTreemapText('Конкуренция'))).toBe('Конкуренция')
    expect(hyphenateTreemapText('Конкуренция')).toContain('\u00ad\ufeff')
  })

  it('uses a larger type scale for larger treemap areas', () => {
    expect(treemapAdaptiveFontSize(18, .3, 7)).toBeGreaterThan(treemapAdaptiveFontSize(18, .03, 7))
  })

  it('honors manual category and leaf order', () => {
    const hierarchy: DataTable = { name: 'order', columns: ['category', 'subcategory', 'value'], rows: [
      { category: 'A', subcategory: 'A1', value: 10 },
      { category: 'A', subcategory: 'A2', value: 20 },
      { category: 'Другое', subcategory: 'Прочее', value: 30 },
    ] }
    const option = getChartPlugin('treemap').buildOption(hierarchy, {
      ...base('treemap'), xField: 'category', yField: 'value', yFields: ['value'], treemapSubcategoryField: 'subcategory', aggregation: 'sum',
      treemapGroupOrder: ['A', 'Другое'], treemapLeafOrder: { A: ['A1', 'A2'] },
    }) as { series: Array<{ sort: boolean; data: Array<{ name: string; children?: Array<{ name: string }> }> }> }
    expect(option.series[0].sort).toBe(false)
    expect(option.series[0].data.map((item) => item.name)).toEqual(['A', 'Другое'])
    expect(option.series[0].data[0].children?.map((item) => item.name)).toEqual(['A1', 'A2'])
  })

  it('keeps the WCIOM demo hierarchy and percentages without duplicating group totals', () => {
    const option = getChartPlugin('treemap').buildOption(entrepreneurshipDifficultiesDemoTable, {
      ...base('treemap'), xField: 'Категория', yField: 'Процент', yFields: ['Процент'], treemapSubcategoryField: 'Трудность', aggregation: 'sum',
    }) as { series: Array<{ data: Array<{ name: string; value: number }> }> }
    expect(Object.fromEntries(option.series[0].data.map(({ name, value }) => [name, value]))).toMatchObject({
      'Проблемы с клиентами и спросом': 17,
      'Финансовые трудности': 16,
      'Налоги, законодательство и бюрократия': 8,
      'Сейчас у меня нет никаких трудностей': 52,
      'Затрудняюсь ответить': 12,
    })
    expect(option.series[0].data.reduce((sum, item) => sum + item.value, 0)).toBe(139)
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 1000, height: 750 })
    chart.setOption(option)
    expect(chart.renderToSVGString()).toContain('<svg')
    chart.dispose()
  })

  it('starts area charts at zero while keeping line charts focused on their data', () => {
    const closeValues: DataTable = { name: 'close', columns: ['month', 'value'], rows: [{ month: 'Янв', value: 98 }, { month: 'Фев', value: 100 }] }
    const area = getChartPlugin('area').buildOption(closeValues, base('area')) as { yAxis: { min: number } }
    const line = getChartPlugin('line').buildOption(closeValues, base('line')) as { yAxis: { min: number } }
    expect(area.yAxis.min).toBe(0)
    expect(line.yAxis.min).toBeGreaterThan(0)
  })

  it('rejects repeated X values until aggregation is explicit', () => {
    const repeated: DataTable = { name: 'repeated', columns: ['month', 'value'], rows: [{ month: 'Янв', value: 10 }, { month: 'Янв', value: 20 }] }
    expect(getChartPlugin('bar').validate(repeated, base('bar')).ok).toBe(false)
    expect(getChartPlugin('bar').validate(repeated, { ...base('bar'), aggregation: 'sum' }).ok).toBe(true)
  })

  it('builds every distribution chart from raw observations', () => {
    const distributionTable: DataTable = {
      name: 'distribution', columns: ['group', 'value'],
      rows: [{ group: 'A', value: 1 }, { group: 'A', value: 2 }, { group: 'A', value: 8 }, { group: 'B', value: 3 }, { group: 'B', value: 4 }, { group: 'B', value: 5 }],
    }
    for (const kind of ['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'] as const) {
      const config = { ...base(kind), xField: 'group', distributionGroupField: 'group', showLegend: true }
      const option = getChartPlugin(kind).buildOption(distributionTable, config) as { legend: { show: boolean; data: Array<{ name: string }> }; series: Array<{ type: string; data: unknown[] }>; yAxis: { data: string[] } }
      if (kind === 'histogram' || kind === 'kde-plot') expect(option.yAxis).toMatchObject({ type: 'value', min: 0 })
      else expect(option.yAxis.data).toEqual(['value'])
      expect(option.legend.show).toBe(true)
      expect(option.legend.data.map((item) => item.name)).toEqual(['A', 'B'])
      expect(option.series.some((series) => series.data.length > 0)).toBe(true)
    }
  })

  it('omits categories that have no finite observations', () => {
    const observations: DataTable = { name: 'missing group', columns: ['group', 'value'], rows: [
      { group: 'A', value: 1 }, { group: 'A', value: 2 }, { group: 'B', value: null },
    ] }
    const option = getChartPlugin('boxplot').buildOption(observations, { ...base('boxplot'), yField: 'value', yFields: ['value'], distributionGroupField: 'group', distributionLayoutMode: 'categories' }) as { yAxis: { data: string[] }; series: Array<{ name?: string }> }
    expect(option.yAxis.data).toEqual(['A'])
    expect(option.series.some((series) => series.name === 'B')).toBe(false)
  })

  it('applies the selected legend marker to distribution legends', () => {
    const observations: DataTable = { name: 'legend', columns: ['group', 'value'], rows: [{ group: 'A', value: 1 }, { group: 'B', value: 2 }] }
    const option = getChartPlugin('boxplot').buildOption(observations, { ...base('boxplot'), yField: 'value', yFields: ['value'], distributionGroupField: 'group', showLegend: true, legendMarker: 'triangle' }) as { legend: { data: Array<{ icon: string }> } }
    expect(option.legend.data.map((item) => item.icon)).toEqual(['triangle', 'triangle'])
  })

  it('labels distribution observations from another table column', () => {
    const countries: DataTable = { name: 'countries', columns: ['country', 'gdp'], rows: [
      { country: 'Франция', gdp: 44 }, { country: 'Япония', gdp: 51 }, { country: 'Бразилия', gdp: 39 },
    ] }
    type PointSeries = { type: string; name: string; data: Array<{ displayLabel?: string }>; label?: { show: boolean; formatter: string }; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Array<{ type: string; style?: { text?: string } }> } }
    for (const kind of ['strip-plot', 'jitter-plot', 'boxplot', 'violinplot', 'raincloud'] as const) {
      const config = { ...base(kind), yField: 'gdp', yFields: ['gdp'], distributionLabelField: 'country', distributionShowLabels: true, distributionShowAllPoints: true }
      const option = getChartPlugin(kind).buildOption(countries, config) as { series: PointSeries[] }
      const points = option.series.find((series) => series.type === 'scatter' && series.data.some((point) => point.displayLabel))!
      expect(points.data.map((point) => point.displayLabel), kind).toEqual(['Бразилия', 'Франция', 'Япония'])
      expect(points.label?.show, kind).toBe(true)
      expect(points.label?.formatter, kind).toBe('{b}')
    }

    const swarm = getChartPlugin('beeswarm').buildOption(countries, { ...base('beeswarm'), yField: 'gdp', yFields: ['gdp'], distributionLabelField: 'country', distributionShowLabels: true }) as { series: PointSeries[] }
    const cloud = swarm.series.find((series) => series.type === 'custom' && series.name === 'gdp')!
    const rendered = cloud.renderItem!(null, { coord: ([value, lane]) => [value * 10, lane * 100], size: () => [10, 100] })
    expect(rendered.children.filter((child) => child.type === 'text').map((child) => child.style?.text)).toEqual(['Бразилия', 'Франция', 'Япония'])
  })

  it('lists every editable value label for the settings panel', () => {
    const countries: DataTable = { name: 'countries', columns: ['country', 'gdp'], rows: [
      { country: 'Франция', gdp: 44 }, { country: 'Япония', gdp: 51 }, { country: 'Бразилия', gdp: 39 },
    ] }
    for (const kind of ['boxplot', 'violinplot', 'raincloud', 'beeswarm', 'strip-plot', 'jitter-plot'] as const) {
      const labels = chartValueLabelSelections(countries, { ...base(kind), yField: 'gdp', yFields: ['gdp'], distributionLabelField: 'country', distributionShowAllPoints: false })
      expect(labels.map((label) => label.label), kind).toEqual(['Бразилия', 'Франция', 'Япония'])
      expect(labels.every((label) => label.target === 'value-label'), kind).toBe(true)
    }
    expect(chartValueLabelSelections(table, base('bar')).map((label) => label.category)).toEqual(['Янв', 'Фев'])
  })

  it('applies every label setting to one selected distribution observation', () => {
    const countries: DataTable = { name: 'countries', columns: ['country', 'gdp'], rows: [
      { country: 'Франция', gdp: 44 }, { country: 'Япония', gdp: 51 },
    ] }
    const key = 'gdp\u001fstring:row:0:gdp'
    const labelStyle = { ...style(17), color: '#c2185b', weight: 700, italic: true, align: 'right' as const }
    const config = { ...base('strip-plot'), yField: 'gdp', yFields: ['gdp'], distributionLabelField: 'country', distributionShowLabels: false, elementStyles: { [key]: { showLabel: true, label: 'FR', labelPosition: 'left' as const, valueText: labelStyle } } }
    const option = getChartPlugin('strip-plot').buildOption(countries, config) as { series: Array<{ type: string; data: Array<{ elementKey?: string; label?: Record<string, unknown> }> }> }
    const point = option.series.flatMap((series) => series.data).find((item) => item.elementKey === key)!
    expect(point.label).toMatchObject({ show: true, formatter: 'FR', position: 'left', fontFamily: 'Arial', fontSize: 17, color: '#c2185b', fontWeight: 700, fontStyle: 'italic', align: 'right', verticalAlign: 'middle', opacity: 1 })

    type SwarmSeries = { name: string; type: string; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Array<{ type: string; info?: { elementKey?: string }; style?: { text?: string; fill?: string; align?: string } }> } }
    const swarm = getChartPlugin('beeswarm').buildOption(countries, { ...config, kind: 'beeswarm' }) as { series: SwarmSeries[] }
    const cloud = swarm.series.find((series) => series.type === 'custom' && series.name === 'gdp')!.renderItem!(null, { coord: ([value, lane]) => [value * 10, lane * 100], size: () => [10, 100] })
    const label = cloud.children.find((child) => child.type === 'text' && child.info?.elementKey === key)!
    expect(label.style).toMatchObject({ text: 'FR', fill: '#c2185b', align: 'right', verticalAlign: 'middle', opacity: 1 })
  })

  it('compares multiple numeric columns without requiring a category', () => {
    const observations: DataTable = { name: 'metrics', columns: ['profit', 'orders'], rows: [
      { profit: 10, orders: 2 }, { profit: 14, orders: 4 }, { profit: 18, orders: 8 }, { profit: 40, orders: 9 },
    ] }
    for (const kind of ['boxplot', 'violinplot', 'raincloud', 'histogram', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'] as const) {
      const config = { ...base(kind), xField: 'profit', yField: 'profit', yFields: ['profit', 'orders'] }
      const option = getChartPlugin(kind).buildOption(observations, config) as { series: Array<{ type: string; data: unknown[] }>; yAxis: { data: string[] } }
      if (kind === 'histogram' || kind === 'kde-plot') expect(option.series.filter((series) => !('silent' in series)).length, kind).toBeGreaterThanOrEqual(2)
      else expect(option.yAxis.data, kind).toEqual(['profit', 'orders'])
      expect(option.series.some((series) => series.data.length > 0), kind).toBe(true)
    }
  })

  it('uses series order for distribution lane positions', () => {
    const observations: DataTable = { name: 'ordered-metrics', columns: ['profit', 'orders', 'returns'], rows: [
      { profit: 10, orders: 2, returns: 1 }, { profit: 20, orders: 4, returns: 3 },
    ] }
    const option = getChartPlugin('jitter-plot').buildOption(observations, { ...base('jitter-plot'), yField: 'profit', yFields: ['profit', 'orders', 'returns'], seriesOrder: ['returns', 'profit', 'orders'] }) as { yAxis: { data: string[] } }
    expect(option.yAxis.data).toEqual(['returns', 'profit', 'orders'])
  })

  it('uses distinct geometries for distribution chart families', () => {
    const observations: DataTable = { name: 'metrics', columns: ['profit'], rows: [2, 3, 3, 5, 8, 13].map((profit) => ({ profit })) }
    const option = (kind: ChartConfig['kind']) => getChartPlugin(kind).buildOption(observations, { ...base(kind), yField: 'profit', yFields: ['profit'] }) as { series: Array<{ type: string; silent?: boolean }> }
    expect(option('boxplot').series.map((series) => series.type)).toContain('custom')
    expect(option('violinplot').series.map((series) => series.type)).toEqual(expect.arrayContaining(['custom', 'scatter']))
    expect(option('raincloud').series.map((series) => series.type)).toEqual(expect.arrayContaining(['custom', 'scatter']))
    expect(option('histogram').series.filter((series) => !series.silent).every((series) => series.type === 'custom')).toBe(true)
    expect(option('kde-plot').series.filter((series) => !series.silent).map((series) => series.type)).toContain('line')
    expect(option('ridgeline').series.filter((series) => !series.silent).every((series) => series.type === 'custom')).toBe(true)
    expect(option('strip-plot').series.filter((series) => !series.silent).every((series) => series.type === 'scatter')).toBe(true)
    expect(option('counts-plot').series.filter((series) => !series.silent).every((series) => series.type === 'scatter')).toBe(true)
    expect(option('barcode-plot').series.filter((series) => !series.silent).every((series) => series.type === 'custom')).toBe(true)
  })

  it('renders histogram bins and distinct density layers', () => {
    const observations: DataTable = { name: 'density', columns: ['profit'], rows: [1, 2, 2, 3, 5, 8, 13].map((profit) => ({ profit })) }
    const api = { coord: ([value, amount]: number[]) => [value * 10, 600 - amount * 10], size: () => [10, 100] }
    type RenderApi = { coord(value: number[]): number[]; size(value: number[]): number[] }
    type ShapeSeries = { name?: string; type: string; silent?: boolean; data: unknown[]; renderItem?: (params: { dataIndex: number }, api: RenderApi) => { type: string; children?: Array<{ type: string; style?: { text?: string } }> } }

    const histogram = getChartPlugin('histogram').buildOption(observations, { ...base('histogram'), yField: 'profit', yFields: ['profit'], distributionBinCount: 5 }) as { series: ShapeSeries[] }
    const bars = histogram.series.find((series) => series.name === 'profit' && !series.silent)!
    expect(bars.data).toHaveLength(5)
    const bar = bars.renderItem!({ dataIndex: 0 }, api)
    expect(bar.type).toBe('rect')
    expect((bar as unknown as { shape: { y: number; height: number } }).shape.y + (bar as unknown as { shape: { y: number; height: number } }).shape.height).toBe(600)
    const labelled = getChartPlugin('histogram').buildOption(observations, { ...base('histogram'), yField: 'profit', yFields: ['profit'], distributionBinCount: 5, distributionHistogramMin: 0, distributionHistogramMax: 10, distributionHistogramLabels: 'range', distributionHistogramRangeDecimals: 2 }) as { series: ShapeSeries[] }
    const labelledBar = labelled.series.find((series) => series.name === 'profit' && !series.silent)!.renderItem!({ dataIndex: 0 }, api)
    expect(labelledBar.children?.find((child) => child.type === 'text')?.style?.text).toBe('0,00–2,00')
    const oneSided = getChartPlugin('histogram').buildOption(observations, { ...base('histogram'), yField: 'profit', yFields: ['profit'], distributionHistogramMin: 20, distributionBinCount: 500 }) as { xAxis: { min: number; max: number }; series: Array<Omit<ShapeSeries, 'data'> & { data: Array<{ range?: [number, number] }> }> }
    const oneSidedBins = oneSided.series.find((series) => series.name === 'profit' && !series.silent)!.data
    expect(oneSided.xAxis.max).toBeGreaterThan(oneSided.xAxis.min)
    expect(oneSidedBins).toHaveLength(80)
    expect(oneSidedBins.every((bin, index) => index === 0 || bin.range![0] >= oneSidedBins[index - 1].range![1])).toBe(true)

    const kde = getChartPlugin('kde-plot').buildOption(observations, { ...base('kde-plot'), yField: 'profit', yFields: ['profit'] }) as { yAxis: { min: number; max: number; interval: number }; series: Array<{ name?: string; type: string; data: number[][] }> }
    const density = kde.series.find((series) => series.name === 'profit' && series.type === 'line')!
    expect(kde.yAxis.min).toBe(0)
    expect(kde.yAxis.max / kde.yAxis.interval).toBeLessThanOrEqual(7)
    expect(kde.yAxis.max).toBeLessThan(.5)
    expect(density.data[0][1]).toBe(0)
    expect(density.data.at(-1)![1]).toBe(0)

    const ridgeline = getChartPlugin('ridgeline').buildOption(observations, { ...base('ridgeline'), yField: 'profit', yFields: ['profit'] }) as { series: ShapeSeries[] }
    const rendered = ridgeline.series.find((series) => series.name === 'profit' && !series.silent)!.renderItem!({ dataIndex: 0 }, { coord: ([value, lane]) => [value * 10, lane * 100], size: () => [10, 100] })
    expect(rendered.children?.map((shape) => shape.type)).toEqual(['polygon', 'polyline', 'line', 'line'])
  })

  it('supports raincloud points over the boxplot or on a separate row', () => {
    const observations: DataTable = { name: 'raincloud', columns: ['value'], rows: [1, 2, 3, 4, 8].map((value) => ({ value })) }
    type Shape = { type: string; shape: { y?: number; height?: number; points?: number[][] } }
    type Series = { name?: string; type: string; data: Array<{ value?: number[] }>; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Shape[] } }
    const api = { coord: ([value, lane]: number[]) => [value * 10, lane * 100], size: () => [10, 100] }
    const option = (distributionRaincloudPointMode: ChartConfig['distributionRaincloudPointMode']) => getChartPlugin('raincloud').buildOption(observations, { ...base('raincloud'), yField: 'value', yFields: ['value'], distributionRaincloudPointMode }) as { series: Series[] }
    const overlay = option('overlay')
    const shapes = overlay.series.find((series) => series.type === 'custom' && series.name === 'value')!.renderItem!(null, api).children
    const cloud = shapes.find((shape) => shape.type === 'polygon')!.shape.points!
    const box = shapes.find((shape) => shape.type === 'rect')!.shape
    const boxCenter = Number(box.y) + Number(box.height) / 2
    const overlayPoints = overlay.series.find((series) => series.type === 'scatter')!.data.map((item) => item.value![1] * 100)
    const separatePoints = option('separate').series.find((series) => series.type === 'scatter')!.data.map((item) => item.value![1] * 100)
    expect(Math.max(...cloud.map((point) => point[1]))).toBe(0)
    expect(overlayPoints.some((lane) => Math.abs(lane - boxCenter) < Number(box.height) / 2)).toBe(true)
    expect(Math.min(...separatePoints)).toBeGreaterThan(Number(box.y) + Number(box.height))
  })

  it('draws barcode observations as configurable ticks', () => {
    const observations: DataTable = { name: 'metrics', columns: ['profit'], rows: [2, 3, 5].map((profit) => ({ profit })) }
    type BarcodeShape = { x1: number; y1: number; x2: number; y2: number }
    type BarcodeSeries = { name: string; type: string; silent?: boolean; data: unknown[]; renderItem?: (params: { dataIndex: number }, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { shape?: BarcodeShape; children?: Array<{ type: string; shape: BarcodeShape; style: { lineWidth: number } }> } }
    const option = getChartPlugin('barcode-plot').buildOption(observations, { ...base('barcode-plot'), yField: 'profit', yFields: ['profit'], distributionTickWidth: 3 }) as { series: BarcodeSeries[] }
    const barcode = option.series.find((series) => series.name === 'profit' && series.type === 'custom')!
    expect(barcode.data).toHaveLength(3)
    const tick = barcode.renderItem!({ dataIndex: 0 }, { coord: ([value, lane]) => [value * 10, lane * 100], size: () => [10, 100] }).children![0]
    expect(tick).toMatchObject({ type: 'line', shape: { x1: 20, y1: -28, x2: 20, y2: 28 }, style: { lineWidth: 3 } })
    const median = option.series.find((series) => series.name === 'profit' && series.silent)!.renderItem!({ dataIndex: 0 }, { coord: ([value, lane]) => [value * 10, lane * 100], size: () => [10, 100] }).shape!
    expect(median.y2 - median.y1).toBe(tick.shape.y2 - tick.shape.y1)
  })

  it('keeps category breakdowns inside each metric lane and supports half and split violins', () => {
    const observations: DataTable = { name: 'grouped', columns: ['group', 'value'], rows: [
      { group: 'A', value: 1 }, { group: 'A', value: 2 }, { group: 'A', value: 4 },
      { group: 'B', value: 3 }, { group: 'B', value: 5 }, { group: 'B', value: 7 },
    ] }
    type Shape = { type: string; shape: { x?: number; y?: number; width?: number; height?: number; r?: number; points?: number[][] }; style?: { fill?: string; stroke?: string } }
    type CustomSeries = { name: string; type: string; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Shape[] } }
    const api = { coord: ([value, lane]: number[]) => [value * 10, lane * 100], size: () => [10, 100] }
    const grouped = (kind: 'boxplot' | 'violinplot', distributionViolinMode: ChartConfig['distributionViolinMode'] = 'full') => getChartPlugin(kind).buildOption(observations, { ...base(kind), yField: 'value', yFields: ['value'], distributionGroupField: 'group', distributionViolinMode, palette: ['#123456', '#abcdef'], barBorderRadius: 16 }) as { yAxis: { data: string[] }; series: CustomSeries[] }

    const box = grouped('boxplot')
    expect(box.yAxis.data).toEqual(['value'])
    const boxRects = box.series.filter((series) => series.type === 'custom' && series.name !== '__distribution-grid').map((series) => series.renderItem!(null, api).children.find((child) => child.type === 'rect')!)
    const boxCenters = boxRects.map((rect) => Number(rect.shape.y) + Number(rect.shape.height) / 2)
    expect(boxCenters[0]).toBeCloseTo(-18)
    expect(boxCenters[1]).toBeCloseTo(18)
    expect(boxRects.map((rect) => rect.shape.r)).toEqual([0, 0])
    expect(boxRects.map((rect) => rect.style?.fill)).toEqual(['#123456', '#abcdef'])

    const full = grouped('violinplot')
    const fullPolygons = full.series.filter((series) => series.type === 'custom' && series.name !== '__distribution-grid').map((series) => series.renderItem!(null, api).children[0].shape.points!)
    expect(Math.max(...fullPolygons[0].map((point) => point[1]))).toBeLessThan(0)
    expect(Math.min(...fullPolygons[1].map((point) => point[1]))).toBeGreaterThan(0)

    const split = grouped('violinplot', 'split')
    const splitPolygons = split.series.filter((series) => series.type === 'custom' && series.name !== '__distribution-grid').map((series) => series.renderItem!(null, api).children[0].shape.points!)
    expect(Math.max(...splitPolygons[0].map((point) => point[1]))).toBeLessThanOrEqual(0)
    expect(Math.min(...splitPolygons[1].map((point) => point[1]))).toBeGreaterThanOrEqual(0)

    const half = getChartPlugin('violinplot').buildOption(observations, { ...base('violinplot'), yField: 'value', yFields: ['value'], distributionViolinMode: 'half' }) as { series: CustomSeries[] }
    const halfPolygon = half.series.find((series) => series.type === 'custom' && series.name !== '__distribution-grid')!.renderItem!(null, api).children[0].shape.points!
    expect(Math.min(...halfPolygon.map((point) => point[1]))).toBeGreaterThanOrEqual(0)
  })

  it('shows the 1.5 IQR range on violins and can render quartiles as lines', () => {
    const observations: DataTable = { name: 'violin-summary', columns: ['value'], rows: [1, 2, 3, 4, 100].map((value) => ({ value })) }
    type Child = { type: string; shape: { x1?: number; y1?: number; x2?: number; y2?: number }; style?: { lineDash?: number[] } }
    type ViolinSeries = { name?: string; type: string; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Child[] } }
    const api = { coord: ([value, lane]: number[]) => [value * 10, lane * 100], size: () => [10, 100] }
    const render = (distributionViolinSummaryMode: ChartConfig['distributionViolinSummaryMode'], distributionViolinShowWhiskers = true) => {
      const option = getChartPlugin('violinplot').buildOption(observations, { ...base('violinplot'), yField: 'value', yFields: ['value'], distributionViolinSummaryMode, distributionViolinShowWhiskers, distributionShowPoints: false }) as { series: ViolinSeries[] }
      return option.series.find((series) => series.type === 'custom' && series.name !== '__distribution-grid')!.renderItem!(null, api).children
    }
    const lines = render('lines').filter((child) => child.type === 'line')
    expect(lines[0].shape).toMatchObject({ x1: 10, y1: 0, x2: 40, y2: 0 })
    expect(lines.slice(1).map((line) => line.shape.x1)).toEqual([20, 30, 40])
    expect(lines[1].style?.lineDash).toEqual([4, 3])
    expect(render('lines', false).filter((child) => child.type === 'line')).toHaveLength(3)
    expect(render('box').some((child) => child.type === 'rect')).toBe(true)
  })

  it('can put categories on the axis and keeps category order, labels, visibility and colors in sync', () => {
    const observations: DataTable = { name: 'grouped', columns: ['region', 'profit', 'orders'], rows: [
      { region: 'North', profit: 10, orders: 2 }, { region: 'North', profit: 14, orders: 5 },
      { region: 'South', profit: 20, orders: 7 }, { region: 'South', profit: 24, orders: 9 },
    ] }
    const option = getChartPlugin('boxplot').buildOption(observations, {
      ...base('boxplot'), yField: 'profit', yFields: ['profit', 'orders'], distributionGroupField: 'region', distributionLayoutMode: 'categories',
      distributionCategoryOrder: ['South', 'North'], distributionCategoryStyles: { South: { label: 'Юг' }, North: { label: 'Север' } }, palette: ['#123456', '#abcdef'], showLegend: true,
    }) as { yAxis: { data: string[] }; legend: { data: Array<{ name: string; itemStyle: { color: string } }> }; series: Array<{ name: string; type: string; data: unknown[] }> }
    expect(option.yAxis.data).toEqual(['Юг', 'Север'])
    expect(option.legend.data).toMatchObject([{ name: 'profit', itemStyle: { color: '#123456' } }, { name: 'orders', itemStyle: { color: '#abcdef' } }])
    expect(option.series.filter((series) => series.type === 'custom' && series.name !== '__distribution-grid').map((series) => series.name)).toEqual(['profit', 'profit', 'orders', 'orders'])

    const styledCategories = getChartPlugin('boxplot').buildOption(observations, {
      ...base('boxplot'), yField: 'profit', yFields: ['profit'], distributionGroupField: 'region', distributionCategoryOrder: ['South', 'North'], distributionCategoryStyles: { South: { label: 'Юг', color: '#123456' }, North: { label: 'Север', color: '#abcdef' } }, showLegend: true,
    }) as { legend: { data: Array<{ name: string; itemStyle: { color: string } }> } }
    expect(styledCategories.legend.data).toMatchObject([{ name: 'Юг', itemStyle: { color: '#123456' } }, { name: 'Север', itemStyle: { color: '#abcdef' } }])

    const hidden = getChartPlugin('boxplot').buildOption(observations, {
      ...base('boxplot'), yField: 'profit', yFields: ['profit', 'orders'], distributionGroupField: 'region', distributionLayoutMode: 'categories', distributionCategoryStyles: { North: { visible: false }, South: { label: 'Юг', color: '#ff0000' } },
    }) as { yAxis: { data: string[] } }
    expect(hidden.yAxis.data).toEqual(['Юг'])
  })

  it('uses the explicitly selected groups and side for split and half violins', () => {
    const observations: DataTable = { name: 'grouped', columns: ['group', 'value'], rows: [
      { group: 'A', value: 1 }, { group: 'A', value: 2 }, { group: 'B', value: 3 }, { group: 'B', value: 4 }, { group: 'C', value: 5 },
    ] }
    type CustomSeries = { name: string; type: string; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Array<{ shape: { points?: number[][] } }> } }
    const api = { coord: ([value, lane]: number[]) => [value * 10, lane * 100], size: () => [10, 100] }
    const split = getChartPlugin('violinplot').buildOption(observations, { ...base('violinplot'), yField: 'value', yFields: ['value'], distributionGroupField: 'group', distributionViolinMode: 'split', distributionViolinSplitFirst: 'B', distributionViolinSplitSecond: 'A' }) as { legend: { data: Array<{ name: string }> }; series: CustomSeries[] }
    expect(split.series.filter((series) => series.type === 'custom' && series.name !== '__distribution-grid').map((series) => series.name)).toEqual(['A', 'B'])
    expect(split.legend.data.map((item) => item.name)).toEqual(['A', 'B'])
    const polygons = Object.fromEntries(split.series.filter((series) => series.type === 'custom' && series.name !== '__distribution-grid').map((series) => [series.name, series.renderItem!(null, api).children[0].shape.points!]))
    expect(Math.min(...polygons.A.map((point) => point[1]))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...polygons.B.map((point) => point[1]))).toBeLessThanOrEqual(0)

    const half = getChartPlugin('violinplot').buildOption(observations, { ...base('violinplot'), yField: 'value', yFields: ['value'], distributionViolinMode: 'half', distributionViolinHalfSide: 'first' }) as { series: CustomSeries[] }
    const halfPoints = half.series.find((series) => series.type === 'custom' && series.name !== '__distribution-grid')!.renderItem!(null, api).children[0].shape.points!
    expect(Math.max(...halfPoints.map((point) => point[1]))).toBeLessThanOrEqual(0)
  })

  it('packs beeswarm points without collisions and keeps the cloud compact', () => {
    const positions = [10, 10, 10, 14, 15, 16]
    const diameter = 8
    const offsets = packSwarmOffsets(positions, diameter)
    positions.forEach((position, index) => positions.slice(0, index).forEach((other, previous) => {
      expect((position - other) ** 2 + (offsets[index] - offsets[previous]) ** 2).toBeGreaterThanOrEqual((diameter - .01) ** 2)
    }))
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(24)
  })

  it('shrinks dense beeswarm dots together with their packing instead of overlapping them', () => {
    const positions = Array.from({ length: 80 }, () => 100)
    const fitted = fitSwarmOffsets(positions, 10, 32)
    expect(fitted.diameter).toBeLessThan(10)
    expect(Math.max(...fitted.offsets.map(Math.abs))).toBeLessThanOrEqual(32)
    fitted.offsets.forEach((offset, index) => fitted.offsets.slice(0, index).forEach((other) => {
      expect(Math.abs(offset - other)).toBeGreaterThanOrEqual(fitted.diameter - .01)
    }))
  })

  it('uses one dot size for every beeswarm lane', () => {
    const fitted = fitSwarmClouds([
      Array.from({ length: 80 }, () => 100),
      [80, 90, 100],
    ], 10, 32)
    expect(fitted.diameter).toBeLessThan(10)
    expect(fitted.offsets).toHaveLength(2)
    expect(Math.max(...fitted.offsets.flat().map(Math.abs))).toBeLessThanOrEqual(32)
  })

  it('keeps distribution axes on plot edges and renders the Y title only once', () => {
    const observations: DataTable = { name: 'axis', columns: ['region', 'value'], rows: [{ region: 'A', value: 10 }, { region: 'B', value: 20 }] }
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const option = getChartPlugin('boxplot').buildOption(observations, { ...base('boxplot'), yField: 'value', yFields: ['value'], distributionGroupField: 'region', distributionLayoutMode: 'categories', distributionOrientation: orientation, yAxisTitle: 'Значение', showYAxisTitle: true }) as { xAxis: { name?: string; axisLine: { onZero?: boolean }; axisTick: { alignWithLabel?: boolean } }; yAxis: { name?: string; axisLine: { onZero?: boolean }; axisTick: { alignWithLabel?: boolean } }; graphic: Array<{ id?: string }> }
      expect(option.xAxis.axisLine.onZero).toBe(false)
      expect(option.yAxis.axisLine.onZero).toBe(false)
      expect(option.xAxis.name).toBe('')
      expect(option.yAxis.name).toBe('')
      expect(option.graphic.filter((item) => item.id === 'chart-y-axis-title')).toHaveLength(1)
      const categoryAxis = orientation === 'horizontal' ? option.yAxis : option.xAxis
      expect(categoryAxis.axisTick.alignWithLabel).toBe(true)
    }
  })

  it('does not repeat a distribution lane label as the Y axis title', () => {
    const observations: DataTable = { name: 'duplicate-title', columns: ['profit', 'orders'], rows: [{ profit: 10, orders: 2 }, { profit: 20, orders: 4 }] }
    const option = getChartPlugin('jitter-plot').buildOption(observations, { ...base('jitter-plot'), yField: 'profit', yFields: ['profit', 'orders'], yAxisTitle: 'profit', showYAxisTitle: true }) as { graphic: Array<{ id?: string }> }
    expect(option.graphic.filter((item) => item.id === 'chart-y-axis-title')).toHaveLength(0)
  })

  it('mirrors distribution axis, tick and grid visibility with orientation', () => {
    const observations: DataTable = { name: 'axis-visibility', columns: ['value'], rows: [{ value: 10 }, { value: 20 }] }
    const visibility = (distributionOrientation: ChartConfig['distributionOrientation']) => getChartPlugin('jitter-plot').buildOption(observations, {
      ...base('jitter-plot'), yField: 'value', yFields: ['value'], distributionOrientation,
      ...(distributionOrientation === 'horizontal'
        ? { showXAxisLine: true, showYAxisLine: false, showXTicks: true, showYTicks: false, showHorizontalGrid: true, showVerticalGrid: false }
        : { showXAxisLine: false, showYAxisLine: true, showXTicks: false, showYTicks: true, showHorizontalGrid: false, showVerticalGrid: true }),
    }) as { xAxis: { axisLine: { show: boolean }; axisTick: { show: boolean }; splitLine: { show: boolean } }; yAxis: { axisLine: { show: boolean }; axisTick: { show: boolean }; splitLine: { show: boolean } } }
    const horizontal = visibility('horizontal'), vertical = visibility('vertical')
    expect(horizontal.xAxis).toMatchObject({ axisLine: { show: true }, axisTick: { show: true }, splitLine: { show: false } })
    expect(horizontal.yAxis).toMatchObject({ axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } })
    expect(vertical.xAxis).toMatchObject({ axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } })
    expect(vertical.yAxis).toMatchObject({ axisLine: { show: true }, axisTick: { show: true }, splitLine: { show: false } })
    for (const option of [horizontal, vertical] as Array<typeof horizontal & { series?: Array<{ name?: string }> }>) expect(option.series?.filter((series) => series.name === '__distribution-grid')).toHaveLength(1)
  })

  it('removes empty outer distribution lanes unless the full grid is enabled', () => {
    const observations: DataTable = { name: 'lanes', columns: ['profit', 'orders'], rows: [{ profit: 10, orders: 2 }, { profit: 20, orders: 4 }] }
    for (const kind of ['boxplot', 'violinplot', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot'] as const) {
      for (const distributionOrientation of ['horizontal', 'vertical'] as const) {
        const build = (showVerticalGrid: boolean) => getChartPlugin(kind).buildOption(observations, { ...base(kind), yField: 'profit', yFields: ['profit', 'orders'], distributionOrientation, showHorizontalGrid: true, showVerticalGrid }) as { xAxis: { min: number; max: number; interval: number; axisLabel: { formatter(value: number): string } }; yAxis: { min: number; max: number; interval: number; axisLabel: { formatter(value: number): string } } }
        const compact = build(false), full = build(true)
        const compactAxis = distributionOrientation === 'horizontal' ? compact.yAxis : compact.xAxis
        const fullAxis = distributionOrientation === 'horizontal' ? full.yAxis : full.xAxis
        expect(compactAxis, `${kind} ${distributionOrientation}`).toMatchObject({ min: -.5, max: 1.5, interval: .5 })
        expect(compactAxis.axisLabel.formatter(0), `${kind} ${distributionOrientation}`).toBe('profit')
        expect(compactAxis.axisLabel.formatter(1), `${kind} ${distributionOrientation}`).toBe('orders')
        expect(compactAxis.axisLabel.formatter(.5), `${kind} ${distributionOrientation}`).toBe('')
        expect(fullAxis, `${kind} ${distributionOrientation}`).toMatchObject({ min: -1, max: 2, interval: 1 })
      }
    }
  })

  it('draws a longer centered mean or median line for point distributions', () => {
    const observations: DataTable = { name: 'summary', columns: ['region', 'value'], rows: [
      { region: 'A', value: 1 }, { region: 'A', value: 2 }, { region: 'A', value: 9 },
      { region: 'B', value: 10 }, { region: 'B', value: 11 }, { region: 'B', value: 30 },
    ] }
    type SummarySeries = { silent?: boolean; z?: number; data: number[][]; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { shape: { x1: number; y1: number; x2: number; y2: number } } }
    const summaries = (kind: 'strip-plot' | 'jitter-plot' | 'counts-plot' | 'beeswarm', distributionSummaryStatistic: ChartConfig['distributionSummaryStatistic'] = 'median', extra: Partial<ChartConfig> = {}) => (getChartPlugin(kind).buildOption(observations, { ...base(kind), yField: 'value', yFields: ['value'], distributionGroupField: 'region', distributionSummaryStatistic, ...extra }) as { series: Array<SummarySeries & { name?: string }> }).series.filter((series) => series.silent && series.name !== '__distribution-grid')
    const median = summaries('strip-plot'), mean = summaries('strip-plot', 'mean')
    expect(median[0].data[0]).toEqual([2, 0])
    expect(mean[0].data[0][0]).toBe(4)
    expect(mean.map((series) => series.data[0][1])).toEqual([0, 0])
    const api = { coord: ([value, lane]: number[]) => [value * 10, lane * 100], size: () => [10, 100] }
    const lineLength = (kind: 'strip-plot' | 'jitter-plot' | 'counts-plot' | 'beeswarm') => { const shape = summaries(kind)[0].renderItem!(null, api).shape; return shape.y2 - shape.y1 }
    expect(lineLength('strip-plot')).toBeLessThan(lineLength('counts-plot'))
    expect(lineLength('counts-plot')).toBeLessThan(lineLength('jitter-plot'))
    expect(lineLength('jitter-plot')).toBeLessThan(lineLength('beeswarm'))
    expect(lineLength('jitter-plot')).toBeLessThan(72)
    const defaultShape = summaries('jitter-plot')[0].renderItem!(null, api).shape
    const shortShape = summaries('jitter-plot', 'median', { distributionSummaryLength: 50 })[0].renderItem!(null, api).shape
    expect(shortShape.y2 - shortShape.y1).toBeCloseTo((defaultShape.y2 - defaultShape.y1) / 2)
    expect(mean[0].z).toBeGreaterThan(5)
  })

  it('uses each series color for summary lines and allows color and width overrides', () => {
    const observations: DataTable = { name: 'summary-colors', columns: ['profit', 'orders'], rows: [
      { profit: 1, orders: 10 }, { profit: 2, orders: 20 }, { profit: 4, orders: 30 },
    ] }
    type Rendered = { style?: { stroke?: string; lineWidth?: number }; children?: Array<{ style?: { stroke?: string; lineWidth?: number } }> }
    type CustomSeries = { name?: string; type: string; silent?: boolean; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => Rendered }
    const api = { coord: ([value, lane]: number[]) => [value * 10, lane * 100], size: () => [10, 100] }
    const pointKinds = new Set<ChartConfig['kind']>(['beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot'])
    const summaries = (kind: ChartConfig['kind'], seriesStyles: ChartConfig['seriesStyles'] = {}) => {
      const option = getChartPlugin(kind).buildOption(observations, { ...base(kind), yField: 'profit', yFields: ['profit', 'orders'], palette: ['#123456', '#abcdef'], seriesStyles }) as { series: CustomSeries[] }
      return ['profit', 'orders'].map((name) => {
        const series = option.series.find((candidate) => candidate.name === name && candidate.type === 'custom' && (pointKinds.has(kind) ? candidate.silent : !candidate.silent))!
        const rendered = series.renderItem!(null, api)
        return rendered.style ?? rendered.children?.at(-1)?.style
      })
    }
    for (const kind of ['boxplot', 'violinplot', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot'] as const) {
      expect(summaries(kind).map((style) => style?.stroke)).toEqual(['#123456', '#abcdef'])
      expect(summaries(kind, { profit: { distributionSummaryColor: '#ff0000', distributionSummaryWidth: 5, distributionSummaryLength: 140 }, orders: { distributionSummaryColor: '#00aa44', distributionSummaryWidth: 7 } })).toMatchObject([{ stroke: '#ff0000', lineWidth: 5 }, { stroke: '#00aa44', lineWidth: 7 }])
    }
  })

  it('uses the same beeswarm dot style across distributions and scales only repeated counts', () => {
    const observations: DataTable = { name: 'metrics', columns: ['profit', 'orders'], rows: Array.from({ length: 40 }, (_, index) => ({ profit: index < 35 ? 10 : index, orders: index + 4 })) }
    const config = { ...base('jitter-plot'), yField: 'profit', yFields: ['profit', 'orders'], palette: ['#123456', '#abcdef'], distributionPointSize: 10, distributionPointOpacity: .5 }
    const jitter = getChartPlugin('jitter-plot').buildOption(observations, config) as { series: Array<{ name: string; symbol?: string; symbolSize?: number; itemStyle?: { color?: string; opacity?: number; borderWidth?: number }; emphasis?: { disabled?: boolean; scale?: boolean } }> }
    expect(jitter.series.find((series) => series.name === 'profit')?.itemStyle).toMatchObject({ color: '#123456', opacity: .5 })
    expect(jitter.series.find((series) => series.name === 'orders')?.itemStyle).toMatchObject({ color: '#abcdef', opacity: .5 })
    expect(jitter.series.find((series) => series.name === 'profit')).toMatchObject({ symbol: 'circle', symbolSize: 10, itemStyle: { borderWidth: 0 }, emphasis: { disabled: true, scale: false } })

    const strip = getChartPlugin('strip-plot').buildOption(observations, { ...config, kind: 'strip-plot' }) as { series: Array<{ name: string; symbol?: string; symbolSize?: number }> }
    expect(strip.series.find((series) => series.name === 'profit')).toMatchObject({ symbol: 'circle', symbolSize: 10 })

    const violin = getChartPlugin('violinplot').buildOption(observations, { ...config, kind: 'violinplot' }) as { series: Array<{ name: string; symbol?: string; symbolSize?: number }> }
    expect(violin.series.find((series) => series.name === 'profit' && series.symbol === 'circle')).toMatchObject({ symbol: 'circle', symbolSize: 10 })

    const box = getChartPlugin('boxplot').buildOption(observations, { ...config, kind: 'boxplot' }) as { series: Array<{ name: string; symbol?: string; symbolSize?: number }> }
    expect(box.series.find((series) => series.name === 'profit' && series.symbol === 'circle')).toMatchObject({ symbol: 'circle', symbolSize: 10 })

    const beeswarm = getChartPlugin('beeswarm').buildOption(observations, { ...config, kind: 'beeswarm' }) as { series: Array<{ name: string; renderItem?: (_params: unknown, api: { coord(value: number[]): number[]; size(value: number[]): number[] }) => { children: Array<{ shape: { r: number }; style: { fill: string; opacity: number; lineWidth: number } }> } }> }
    const renderedSwarm = beeswarm.series.find((series) => series.name === 'profit')!.renderItem!(null, { coord: (value) => value, size: () => [100, 100] })
    expect(renderedSwarm.children[0].shape.r).toBeCloseTo(5)
    expect(renderedSwarm.children[0].style).toMatchObject({ fill: '#123456', opacity: .5, lineWidth: 0 })

    const counts = getChartPlugin('counts-plot').buildOption(observations, { ...config, kind: 'counts-plot' }) as { series: Array<{ name: string; data: Array<{ count: number }>; symbolSize?: (_value: unknown, params: { data: { count: number } }) => number }> }
    const profit = counts.series.find((series) => series.name === 'profit')!
    const sizes = profit.data.map((point) => profit.symbolSize!(null, { data: point }))
    expect(Math.min(...sizes)).toBe(10)
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes))
  })

  it('can show every observation or only outliers on a box plot', () => {
    const observations: DataTable = { name: 'box-points', columns: ['value'], rows: [1, 2, 3, 100].map((value) => ({ value })) }
    const points = (config: Partial<ChartConfig>) => (getChartPlugin('boxplot').buildOption(observations, { ...base('boxplot'), yField: 'value', yFields: ['value'], ...config }) as { series: Array<{ type: string; data: unknown[] }> }).series.find((series) => series.type === 'scatter')?.data ?? []
    expect(points({})).toHaveLength(1)
    expect(points({ distributionShowAllPoints: true })).toHaveLength(4)
    expect(points({ distributionShowOutliers: false })).toHaveLength(0)
  })

  it('gives violin density enough domain to taper beyond the extreme observations', () => {
    const observations: DataTable = { name: 'violin', columns: ['value'], rows: [10, 12, 14, 20].map((value) => ({ value })) }
    const option = getChartPlugin('violinplot').buildOption(observations, { ...base('violinplot'), yField: 'value', yFields: ['value'] }) as { xAxis: { min: number; max: number } }
    expect(option.xAxis.min).toBeLessThan(10)
    expect(option.xAxis.max).toBeGreaterThan(20)
  })

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

  it('does not silently shrink categorical label text', () => {
    const categories: DataTable = { name: 'categories', columns: ['label', 'value'], rows: [{ label: 'Очень длинная категория', value: 1 }, { label: 'Ещё одна категория', value: 2 }, { label: 'Третья категория', value: 3 }] }
    const config = base('bar'); config.xField = 'label'; config.canvasWidth = 180; config.xAxisLabelText = style(24)
    const option = getChartPlugin('bar').buildOption(categories, config) as { xAxis: { axisLabel: { fontSize: number; margin: number } } }
    expect(option.xAxis.axisLabel).toMatchObject({ fontSize: 24, margin: 8 })
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

  it('hides value labels on both axes and reclaims their spacing', () => {
    const visible = base('bar')
    const hidden = { ...visible, showXAxisLabels: false, showYAxisLabels: false }
    const visibleOption = getChartPlugin('bar').buildOption(table, visible) as { xAxis: { nameGap: number; axisLabel: { show: boolean } }; yAxis: { axisLabel: { show: boolean } } }
    const hiddenOption = getChartPlugin('bar').buildOption(table, hidden) as typeof visibleOption
    expect(hiddenOption.xAxis.axisLabel.show).toBe(false)
    expect(hiddenOption.yAxis.axisLabel.show).toBe(false)
    expect(hiddenOption.xAxis.nameGap).toBeLessThan(visibleOption.xAxis.nameGap)

    const horizontalVisible = getChartPlugin('horizontal-bar').buildOption(table, base('horizontal-bar')) as { grid: { left: number }; xAxis: { axisLabel: { show: boolean } }; yAxis: { axisLabel: { show: boolean } } }
    const horizontalHidden = getChartPlugin('horizontal-bar').buildOption(table, { ...base('horizontal-bar'), showXAxisLabels: false, showYAxisLabels: false }) as typeof horizontalVisible
    expect(horizontalHidden.xAxis.axisLabel.show).toBe(false)
    expect(horizontalHidden.yAxis.axisLabel.show).toBe(false)
    expect(horizontalHidden.grid.left).toBeLessThan(horizontalVisible.grid.left)

    for (const kind of ['scatter', 'heatmap'] as const) {
      const config = { ...base(kind), showXAxisLabels: false, showYAxisLabels: false }
      const option = getChartPlugin(kind).buildOption(table, config) as { xAxis: { axisLabel: { show: boolean } }; yAxis: { axisLabel: { show: boolean } } }
      expect(option.xAxis.axisLabel.show).toBe(false)
      expect(option.yAxis.axisLabel.show).toBe(false)
    }
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

  it('uses white labels on saturated fills and dark labels only on light fills', () => {
    const labelColor = (color: string) => {
      const config = base('bar')
      config.palette = [color]
      config.showValues = true
      config.valueLabelPosition = 'inside-center'
      const option = getChartPlugin('bar').buildOption(table, config) as { series: Array<{ type: string; label?: { color?: string } }> }
      return option.series.find((series) => series.type === 'bar')?.label?.color
    }
    expect(labelColor('#de5b00')).toBe('#ffffff')
    expect(labelColor('#00a67a')).toBe('#ffffff')
    expect(labelColor('#087db5')).toBe('#ffffff')
    expect(labelColor('#f4df3f')).toBe('#202027')
    expect(labelColor('#b7e49a')).toBe('#202027')
    expect(labelColor('#f2d4c4')).toBe('#202027')
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

  it('sorts categorical bars by names, totals or a selected series before normalization', () => {
    const categorical: DataTable = {
      name: 'categories', columns: ['category', 'first', 'second'],
      rows: [
        { category: 'В', first: 7, second: 2 },
        { category: 'А', first: 4, second: 1 },
        { category: 'Б', first: 1, second: 10 },
      ],
    }
    const config: ChartConfig = { ...base('normalized-stacked-bar'), xField: 'category', yFields: ['first', 'second'], barCategorySort: 'name-asc' }
    expect(prepareVisibleChartData(categorical, config).categories).toEqual(['А', 'Б', 'В'])

    config.barCategorySort = 'value-desc'
    const byTotal = prepareVisibleChartData(categorical, config)
    expect(byTotal.categories).toEqual(['Б', 'В', 'А'])
    expect(byTotal.series.map((series) => series.data.map((value) => Math.round(value ?? 0)))).toEqual([[9, 78, 80], [91, 22, 20]])

    config.barCategorySort = 'value-asc'
    config.barCategorySortSeries = 'first'
    expect(prepareVisibleChartData(categorical, config).categories).toEqual(['Б', 'А', 'В'])
  })

  it('applies global column fill, frame, opacity and group width', () => {
    const config = base('bar'); config.barFillColor = '#123456'; config.barFillOpacity = .65; config.barBorderColor = '#abcdef'; config.barBorderWidth = 2; config.barWidth = 54; config.showLegend = true
    const option = getChartPlugin('bar').buildOption(table, config) as { legend: { data: Array<{ itemStyle: { color: string } }> }; series: Array<{ type: string; itemStyle: { color: string; opacity: number; borderWidth: number }; barCategoryGap: string; data: Array<{ itemStyle?: { borderColor: string; borderWidth: number } }> }> }
    expect(option.series[0]).toMatchObject({ itemStyle: { color: '#123456', opacity: .65, borderWidth: 0 }, barCategoryGap: '46%' })
    expect(option.series.filter((series) => series.type === 'custom')).toHaveLength(2)
    expect(option.series.find((series) => series.type === 'custom')?.data[0].itemStyle).toMatchObject({ borderColor: '#abcdef', borderWidth: 2 })
    expect(option.legend.data[0].itemStyle.color).toBe('#123456')

    config.barWidth = 100
    const fullWidth = getChartPlugin('bar').buildOption(table, config) as { series: Array<{ type: string; barCategoryGap: string }> }
    expect(fullWidth.series.find((series) => series.type === 'bar')?.barCategoryGap).toBe('0%')
  })

  it('builds horizontal bars with a numeric X axis and category Y axis', () => {
    const config = base('bar'); config.barOrientation = 'horizontal'; config.barBorderRadius = 8; config.barSeriesGap = 20
    const option = getChartPlugin('bar').buildOption(table, config) as { xAxis: { type: string }; yAxis: { type: string; axisLabel: { align: string } }; series: Array<{ type: string; barGap?: string; itemStyle?: { borderRadius?: number } }> }
    expect(option.xAxis.type).toBe('value')
    expect(option.yAxis.type).toBe('category')
    expect(option.yAxis.axisLabel.align).toBe('right')
    expect(option.series[0]).toMatchObject({ type: 'bar', barGap: '20%', itemStyle: { borderRadius: 8 } })
  })

  it('absorbs value labels only when the bar has enough room', () => {
    expect(absorbedBarLabelPlacement(true, 100, 220, 40, 50, 20, 8, 'end', 'end')).toMatchObject({ inside: true, x: 212, y: 40, align: 'right', verticalAlign: 'middle' })
    expect(absorbedBarLabelPlacement(true, 100, 140, 40, 50, 20, 8, 'end', 'end')).toMatchObject({ inside: false, x: 148, y: 40, align: 'left', verticalAlign: 'middle' })
    expect(absorbedBarLabelPlacement(true, 100, 20, 40, 30, 20, 8, 'end', 'end')).toMatchObject({ inside: true, x: 28, align: 'left' })
    expect(absorbedBarLabelPlacement(false, 200, 80, 40, 30, 20, 8, 'end', 'end')).toMatchObject({ inside: true, x: 40, y: 88, verticalAlign: 'top' })
    expect(absorbedBarLabelPlacement(false, 200, 80, 40, 30, 20, 8, 'end', 'end', 20)).toMatchObject({ inside: false })
  })

  it('keeps the configured size for an inside bar label', () => {
    const config = base('bar')
    config.showValues = true
    config.valueLabelPosition = 'inside-top'
    const option = getChartPlugin('bar').buildOption(table, config) as {
      series: Array<{ name: string; labelLayout?: (params: { dataIndex: number; rect: { width: number; height: number }; labelRect: { width: number; height: number } }) => { fontSize?: number; hideOverlap?: boolean } }>
    }
    const layout = option.series.find((series) => series.name === 'value')!.labelLayout!
    expect(layout({ dataIndex: 0, rect: { width: 16, height: 40 }, labelRect: { width: 40, height: 20 } })).toEqual({ hideOverlap: false, moveOverlap: 'shiftX' })
  })

  it('renders absorbed bar labels with inside contrast and outside text colour', () => {
    const config = base('horizontal-bar')
    config.showValues = true
    config.barValueLabelAbsorption = true
    config.barValueLabelInsidePosition = 'end'
    config.barValueLabelOutsidePosition = 'end'
    config.barValueLabelAbsorptionPadding = 8
    config.palette = ['#0072b2']
    config.valueText = { ...config.valueText, color: '#202027' }
    const option = getChartPlugin('horizontal-bar').buildOption(table, config) as {
      series: Array<{ name: string; renderItem?: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number] }) => { style: { fill: string; align: string } } | null }>
    }
    const labels = option.series.find((series) => series.name === '__bar-value-labels:value')!
    const api = (scale: number) => ({ value: (index: number) => [0, 10][index], coord: ([value, category]: [number, number]) => [100 + value * scale, 40 + category * 30] as [number, number], size: () => [0, 30] as [number, number] })
    expect(labels.renderItem?.({}, api(10))?.style).toMatchObject({ fill: '#ffffff', align: 'right' })
    expect(labels.renderItem?.({}, api(1))?.style).toMatchObject({ fill: '#202027', align: 'left' })
    expect(option.series.find((series) => series.name === 'value')).toMatchObject({ label: { show: false } })
  })

  it('aligns absorbed labels with their own bar in a grouped category', () => {
    const grouped: DataTable = { name: 'grouped', columns: ['category', 'first', 'second'], rows: [{ category: 'А', first: 10, second: 20 }] }
    const config = { ...base('bar'), xField: 'category', yFields: ['first', 'second'], showValues: true, barValueLabelAbsorption: true }
    const option = getChartPlugin('bar').buildOption(grouped, config) as {
      series: Array<{ name: string; renderItem?: (_params: unknown, api: { value(index: number): number; coord(value: [number, number]): [number, number]; size(value: [number, number]): [number, number] }) => { style: { x: number } } | null }>
    }
    const api = {
      value: (index: number) => [0, 20][index],
      coord: ([category, value]: [number, number]) => [100 + category * 80, 200 - value * 5] as [number, number],
      size: () => [80, 0] as [number, number],
    }
    const firstX = option.series.find((series) => series.name === '__bar-value-labels:first')?.renderItem?.({}, api)?.style.x
    const secondX = option.series.find((series) => series.name === '__bar-value-labels:second')?.renderItem?.({}, api)?.style.x
    expect(firstX).toBeLessThan(100)
    expect(secondX).toBeGreaterThan(100)
  })

  it('reserves space for a manually edited horizontal category label', () => {
    const config = base('horizontal-bar')
    config.categoryLabelOverrides = { y: { '0:Янв': 'Центр мира — это я и моя подруга' } }
    const option = getChartPlugin('horizontal-bar').buildOption(table, config) as { grid: { left: number }; yAxis: { axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.yAxis.axisLabel.formatter('', 0)).toBe('Центр мира — это я и моя подруга')
    expect(option.grid.left).toBeGreaterThan(180)
  })

  it('keeps the horizontal category title in its own rail beside row labels', () => {
    const withoutTitle = base('horizontal-bar'); withoutTitle.showXAxisTitle = false
    const withTitle = base('horizontal-bar'); withTitle.xAxisTitleText = style(24); withTitle.xAxisTitleGap = 12
    const withoutTitleOption = getChartPlugin('horizontal-bar').buildOption(table, withoutTitle) as { grid: { left: number } }
    const withTitleOption = getChartPlugin('horizontal-bar').buildOption(table, withTitle) as { grid: { left: number }; graphic: Array<{ id?: string }> }
    expect(withTitleOption.grid.left).toBeGreaterThan(withoutTitleOption.grid.left)
    expect(withTitleOption.graphic.some((item) => item.id === 'chart-y-axis-title')).toBe(true)
  })

  it('builds all linear-bar variants horizontally without relying on the old orientation setting', () => {
    const horizontalTable: DataTable = { name: 'horizontal', columns: ['month', 'first', 'second'], rows: [{ month: 'Янв', first: 20, second: 30 }] }
    for (const kind of ['horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar'] as const) {
      const config = base(kind); config.yFields = ['first', 'second']; config.barOrientation = 'vertical'
      const option = getChartPlugin(kind).buildOption(horizontalTable, config) as { xAxis: { type: string; max?: number; axisLabel: { formatter(value: number): string } }; yAxis: { type: string }; series: Array<{ type: string; stack?: string }> }
      expect(option.xAxis.type).toBe('value')
      expect(option.yAxis.type).toBe('category')
      const bars = option.series.filter((series) => series.type === 'bar')
      if (kind === 'horizontal-bar') expect(bars.every((series) => series.stack == null)).toBe(true)
      else expect(bars.every((series) => series.stack === 'total')).toBe(true)
      if (kind === 'horizontal-normalized-stacked-bar') {
        expect(option.xAxis.max).toBe(100)
        expect(option.xAxis.axisLabel.formatter(40)).toBe('40%')
      }
    }
  })

  it('builds Butterfly as two mirrored, equally scaled bar series', () => {
    const butterflyTable: DataTable = { name: 'butterfly', columns: ['group', 'left', 'right'], rows: [
      { group: '18–24', left: 20, right: 30 },
      { group: '25–34', left: -45, right: 36 },
    ] }
    const config = { ...base('butterfly'), xField: 'group', yField: 'left', yFields: ['left', 'right'], showValues: true }
    const plugin = getChartPlugin('butterfly')
    const option = plugin.buildOption(butterflyTable, config) as {
      xAxis: { min: number; max: number; axisLabel: { formatter(value: number): string } }
      yAxis: { axisLine: { onZero: boolean }; axisLabel: { show: boolean } }
      series: Array<{ name: string; type: string; stack?: string; label: { position: string; formatter(params: { value: number }): string }; data: Array<{ value: number; displayValue: string }> }>
    }
    const bars = option.series.filter((series) => series.type === 'bar')
    expect(plugin.validate(butterflyTable, config).ok).toBe(true)
    expect(plugin.validate(butterflyTable, { ...config, yFields: ['left'] }).ok).toBe(false)
    expect(bars.map((series) => series.stack)).toEqual(['total', 'total'])
    expect(bars[0].data.map((point) => point.value)).toEqual([20, 45])
    expect(bars[1].data.map((point) => point.value)).toEqual([30, 36])
    expect(bars[0].data.map((point) => point.displayValue)).toEqual(['20', '45'])
    expect(bars[0].label.position).toBe('left')
    expect(bars[1].label.position).toBe('right')
    expect(bars[0].label.formatter({ value: -20 })).toBe('20')
    expect(option.xAxis.min).toBe(-option.xAxis.max)
    expect(option.xAxis.axisLabel.formatter(-20)).toBe('20')
    expect(option.yAxis.axisLine.onZero).toBe(true)
    expect(option.yAxis.axisLabel.show).toBe(false)
  })

  it('stacks multiple Butterfly measures independently and can move categories outside the centre', () => {
    const butterflyTable: DataTable = { name: 'butterfly-stacked', columns: ['group', 'leftA', 'leftB', 'rightA', 'rightB'], rows: [
      { group: 'A', leftA: 20, leftB: 35, rightA: 30, rightB: 50 },
      { group: 'B', leftA: 15, leftB: 10, rightA: 25, rightB: 5 },
    ] }
    const config = {
      ...base('butterfly'),
      xField: 'group',
      yField: 'leftA',
      yFields: ['leftA', 'leftB', 'rightA', 'rightB'],
      butterflyLeftFields: ['leftA', 'leftB'],
      butterflyRightFields: ['rightA', 'rightB'],
      butterflyCategoryPosition: 'right' as const,
    }
    const plugin = getChartPlugin('butterfly')
    const option = plugin.buildOption(butterflyTable, config) as {
      xAxis: { min: number; max: number }
      yAxis: { position: string; axisLine: { onZero: boolean }; axisLabel: { show: boolean } }
      series: Array<{ name: string; type: string; stack?: string; data: Array<{ value: number }> }>
    }
    const bars = option.series.filter((series) => series.type === 'bar')
    expect(plugin.validate(butterflyTable, config).ok).toBe(true)
    expect(bars.map((series) => series.name)).toEqual(['leftA', 'leftB', 'rightA', 'rightB'])
    expect(bars.map((series) => series.data[0].value)).toEqual([20, 35, 30, 50])
    expect(bars.every((series) => series.stack === 'total')).toBe(true)
    expect(option.xAxis.max).toBeGreaterThanOrEqual(80)
    expect(option.xAxis.min).toBe(-option.xAxis.max)
    expect(option.yAxis.position).toBe('right')
    expect(option.yAxis.axisLine.onZero).toBe(false)
    expect(option.yAxis.axisLabel.show).toBe(true)
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

  it('formats every numeric tick with independent X and Y affixes', () => {
    const config = base('line'); config.numberPrefix = 'Y:'; config.numberSuffix = ' ед.'; config.xAxisNumberPrefix = 'X:'; config.xAxisNumberSuffix = ' лет'
    const numericTable: DataTable = { name: 'numeric', columns: ['month', 'value'], rows: [{ month: 10, value: 10 }, { month: 20, value: 20 }] }
    const option = getChartPlugin('line').buildOption(numericTable, config) as { xAxis: { axisLabel: { formatter(value: string, index: number): string } }; yAxis: { max: number; axisLabel: { formatter(value: number): string } } }
    expect(option.yAxis.axisLabel.formatter(option.yAxis.max)).toBe(`Y:${option.yAxis.max} ед.`)
    expect(option.yAxis.axisLabel.formatter(10)).toBe('Y:10 ед.')
    expect(option.xAxis.axisLabel.formatter('', 0)).toBe('X:10 лет')
    expect(option.xAxis.axisLabel.formatter('', 1)).toBe('X:20 лет')
  })

  it('limits numeric axis affixes to the selected edge labels', () => {
    const config = base('line'); config.numberSuffix = '% учеников'; config.yAxisAffixScope = 'last'; config.xAxisNumberSuffix = ' класс'; config.xAxisAffixScope = 'first'
    const numericTable: DataTable = { name: 'numeric', columns: ['month', 'value'], rows: [{ month: 1, value: 0.4 }, { month: 4, value: 0.8 }, { month: 11, value: 1.4 }] }
    type EdgeOption = { xAxis: { axisLabel: { formatter(value: string, index: number): string } }; yAxis: { min: number; max: number; axisLabel: { formatter(value: number): string } }; series: Array<{ name?: string; renderItem?: (params: { coordSys: { x: number; y: number; width: number; height: number } }, api: { value(index: number): unknown; coord(value: unknown[]): [number, number] }) => { type: string; style: { x: number; y: number; text: string; align: string; verticalAlign: string; backgroundColor: string } } }> }
    const option = getChartPlugin('line').buildOption(numericTable, config) as EdgeOption
    expect(option.yAxis.axisLabel.formatter(option.yAxis.min)).toBe(String(option.yAxis.min).replace('.', ','))
    expect(option.yAxis.axisLabel.formatter(option.yAxis.max)).toBe('')
    const overlay = option.series.find((series) => series.name === '__y-axis-edge-affixes')!
    const rendered = overlay.renderItem!({ coordSys: { x: 100, y: 20, width: 300, height: 200 } }, { value: (index) => [0, option.yAxis.max, 1][index], coord: () => [100, 24] })
    expect(rendered).toMatchObject({ type: 'text', style: { y: 24, text: `${String(option.yAxis.max).replace('.', ',')}% учеников`, align: 'left', backgroundColor: '#ffffff' } })
    expect(rendered.style.x).toBeLessThan(100)
    expect(option.xAxis.axisLabel.formatter('', 0)).toBe('')
    expect(option.xAxis.axisLabel.formatter('', 1)).toBe('4')
    expect(option.xAxis.axisLabel.formatter('', 2)).toBe('11')
    const xOverlay = option.series.find((series) => series.name === '__x-axis-edge-affixes')!
    const renderedX = xOverlay.renderItem!({ coordSys: { x: 100, y: 20, width: 300, height: 200 } }, { value: (index) => ['0:1', option.yAxis.min, 1, 0][index], coord: () => [100, 220] })
    expect(renderedX).toMatchObject({ style: { x: 100, y: 228, text: '1 класс', align: 'left', verticalAlign: 'top' } })

    const mirrored = getChartPlugin('line').buildOption(numericTable, { ...config, yAxisPosition: 'right', xAxisPosition: 'top', xAxisAffixScope: 'last' }) as EdgeOption
    const mirroredY = mirrored.series.find((series) => series.name === '__y-axis-edge-affixes')!.renderItem!({ coordSys: { x: 100, y: 20, width: 300, height: 200 } }, { value: (index) => [0, mirrored.yAxis.max, 1][index], coord: () => [400, 20] })
    expect(mirroredY.style.x).toBeGreaterThan(400)
    expect(mirroredY.style.align).toBe('right')
    const mirroredX = mirrored.series.find((series) => series.name === '__x-axis-edge-affixes')!.renderItem!({ coordSys: { x: 100, y: 20, width: 300, height: 200 } }, { value: (index) => ['2:11', mirrored.yAxis.min, 11, 1][index], coord: () => [400, 20] })
    expect(mirroredX).toMatchObject({ style: { x: 400, y: 12, text: '11 класс', align: 'right', verticalAlign: 'bottom' } })
  })

  it('does not add numeric X affixes to string categories', () => {
    const config = base('line'); config.xAxisNumberPrefix = 'X:'; config.xAxisNumberSuffix = ' лет'
    const option = getChartPlugin('line').buildOption(table, config) as { xAxis: { axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.xAxis.axisLabel.formatter('', 0)).toBe('Янв')
    expect(option.xAxis.axisLabel.formatter('', 1)).toBe('Фев')
  })

  it('reserves canvas space for a suffix after the last numeric X value', () => {
    const numericTable: DataTable = { name: 'numeric', columns: ['month', 'value'], rows: [{ month: 10, value: 10 }, { month: 20, value: 20 }] }
    const plain = base('line')
    const withUnit = { ...plain, xAxisNumberSuffix: ' лет' }
    const plainOption = getChartPlugin('line').buildOption(numericTable, plain) as { grid: { right: number } }
    const unitOption = getChartPlugin('line').buildOption(numericTable, withUnit) as { grid: { right: number } }
    expect(unitOption.grid.right).toBeGreaterThan(plainOption.grid.right)
  })

  it('formats every physical numeric X tick on horizontal bars', () => {
    const config = base('bar'); config.barOrientation = 'horizontal'; config.xAxisNumberPrefix = '≈'; config.xAxisNumberSuffix = ' ед.'
    const option = getChartPlugin('bar').buildOption(table, config) as { xAxis: { min: number; max: number; axisLabel: { formatter(value: number): string } } }
    expect(option.xAxis.axisLabel.formatter(option.xAxis.min)).toBe(`≈${option.xAxis.min} ед.`)
    expect(option.xAxis.axisLabel.formatter(option.xAxis.max)).toBe(`≈${option.xAxis.max} ед.`)
    expect(option.xAxis.axisLabel.formatter(10)).toBe('≈10 ед.')
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

    config.yAxisPosition = 'right'
    const rightAxisOption = getChartPlugin('line').buildOption(table, config) as { grid: { left: number; right: number }; series: Array<{ name: string; endLabel?: { show: boolean }; data: Array<{ directLegendLabel?: boolean; label?: { position?: string; formatter?: string; align?: string } }> }> }
    const line = rightAxisOption.series.find((series) => series.name === 'value')!
    expect(line.endLabel).toBeUndefined()
    expect(line.data[0]).toMatchObject({ directLegendLabel: true, label: { position: 'left', formatter: '{name|Продажи}\n{note|млн ₽}', align: 'right' } })
    expect(rightAxisOption.grid.left).toBeGreaterThan(rightAxisOption.grid.right)
  })

  it('supports per-series direct-label visibility and typography', () => {
    const layeredTable: DataTable = { name: 'layers', columns: ['month', 'first', 'second'], rows: [{ month: 'Янв', first: 10, second: 12 }, { month: 'Фев', first: 20, second: 18 }] }
    const config = base('bar'); config.yFields = ['first', 'second']; config.showDirectLabels = true; config.yAxisPosition = 'right'
    config.seriesStyles = { first: { showDirectLabel: false }, second: { directLabelText: { ...style(23), color: '#6956e8', weight: 700 } } }
    const option = getChartPlugin('bar').buildOption(layeredTable, config) as { grid: { left: number; right: number }; series: Array<{ name: string; endLabel?: unknown; data: Array<{ directLegendLabel?: boolean; label?: { rich?: { name?: { color?: string; fontSize?: number; fontWeight?: number } } } }> }> }
    const first = option.series.find((series) => series.name === 'first')!, second = option.series.find((series) => series.name === 'second')!
    expect(first.endLabel).toBeUndefined()
    expect(first.data.some((point) => point.directLegendLabel)).toBe(false)
    expect(second.data[1]).toMatchObject({ directLegendLabel: true, label: { rich: { name: { color: '#6956e8', fontSize: 23, fontWeight: 700 } } } })
    expect(option.grid.left).toBeGreaterThan(option.grid.right)
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

  it('keeps spline smoothing intact when one point has a line override', () => {
    const config = base('spline')
    config.elementStyles['value\u001fstring:Фев'] = { color: '#ff0000', lineWidth: 6 }
    const option = getChartPlugin('spline').buildOption(table, config) as { series: Array<{ name?: string; segmentOf?: string; smooth?: number; lineStyle?: { opacity?: number } }> }
    expect(option.series[0]).toMatchObject({ smooth: .45, lineStyle: { opacity: 1 } })
    expect(option.series.some((series) => series.segmentOf === 'value')).toBe(false)
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

  it('uses contextual date labels on continuous scatter and bubble time axes', () => {
    const dated: DataTable = { name: 'dated', columns: ['date', 'value'], rows: [{ date: new Date(2025, 0, 15), value: 10 }, { date: new Date(2025, 1, 15), value: 20 }] }
    for (const kind of ['scatter', 'bubble'] as const) {
      const config = base(kind); config.xField = 'date'; config.dateLabelFormat = 'day-context-month-ru'
      const option = getChartPlugin(kind).buildOption(dated, config) as { xAxis: { axisLabel: { formatter(value: number, index: number): string } } }
      expect(option.xAxis.axisLabel.formatter(new Date(2025, 0, 15).getTime(), 0), kind).toBe('15\nянв.')
      expect(option.xAxis.axisLabel.formatter(new Date(2025, 1, 15).getTime(), 1), kind).toBe('15')
      expect(option.xAxis.axisLabel.formatter(new Date(2025, 2, 1).getTime(), 2), kind).toBe('1\nмар.')
    }
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

  it('applies a complete label override to one scatter point', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'value', 'country'], rows: [{ x: 1, value: 3, country: 'Франция' }, { x: 2, value: 5, country: 'Япония' }] }
    const key = 'value\u001fnumber:1'
    const valueText = { ...style(16), color: '#c2185b', weight: 700, italic: true, align: 'center' as const }
    const config = { ...base('scatter'), xField: 'x', scatterLabelField: 'country', elementStyles: { [key]: { showLabel: true, label: 'FR', labelPosition: 'bottom' as const, fillOpacity: .15, valueText } } }
    const option = getChartPlugin('scatter').buildOption(scatterTable, config) as { series: Array<{ type: string; data: Array<{ elementKey?: string; itemStyle?: Record<string, unknown>; label?: Record<string, unknown> }> }> }
    const point = option.series.flatMap((series) => series.data).find((item) => item.elementKey === key)!
    expect(point.itemStyle).toMatchObject({ opacity: .15 })
    expect(point.label).toMatchObject({ show: true, formatter: 'FR', position: 'bottom', fontSize: 16, color: '#c2185b', fontWeight: 700, fontStyle: 'italic', align: 'center', verticalAlign: 'top', opacity: 1 })
  })

  it('keeps category colors consistent across measures in scatter and bubble charts', () => {
    const scatterTable: DataTable = { name: 'scatter', columns: ['x', 'profit', 'orders', 'group'], rows: [
      { x: 1, profit: 3, orders: 8, group: 'А' }, { x: 2, profit: 5, orders: 6, group: 'Б' },
    ] }
    for (const kind of ['scatter', 'bubble'] as const) {
      const config = base(kind); config.xField = 'x'; config.yField = 'profit'; config.yFields = ['profit', 'orders']; config.scatterColorField = 'group'; config.seriesStyles = { А: { color: '#c43d70' } }
      const option = getChartPlugin(kind).buildOption(scatterTable, config) as { series: Array<{ type: string; name: string; itemStyle: { borderColor: string } }> }
      const points = option.series.filter((series) => series.type === 'scatter')
      expect(points.filter((series) => series.name.endsWith('· А')).map((series) => series.itemStyle.borderColor), kind).toEqual(['#c43d70', '#c43d70'])
      expect(new Set(points.filter((series) => series.name.endsWith('· Б')).map((series) => series.itemStyle.borderColor)).size, kind).toBe(1)
    }
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

  it('keeps ordinary scatter markers uniform and scales bubble areas proportionally', () => {
    const bubbleTable: DataTable = { name: 'bubble', columns: ['x', 'value', 'population'], rows: [{ x: 1, value: 2, population: 100 }, { x: 2, value: 3, population: 200 }] }
    const scatterConfig = base('scatter'); scatterConfig.xField = 'x'; scatterConfig.scatterSizeField = 'population'; scatterConfig.scatterPointSize = 12
    const scatterOption = getChartPlugin('scatter').buildOption(bubbleTable, scatterConfig) as { series: Array<{ type: string; data: Array<{ bubbleSize: number }> }> }
    expect(scatterOption.series.find((series) => series.type === 'scatter')?.data.map((point) => point.bubbleSize)).toEqual([12, 12])

    const bubbleConfig = { ...scatterConfig, kind: 'bubble' as const, scatterSizeLegend: true, scatterSizeLegendTitle: 'Население', scatterSizeLegendPosition: 'top-right' as const }
    const bubbleOption = getChartPlugin('bubble').buildOption(bubbleTable, bubbleConfig) as {
      series: Array<{
        name?: string
        type: string
        z?: number
        data: Array<{ bubbleSize?: number }>
        renderItem?: (params: unknown, api: { value(index: number): number; coord(value: number[]): number[] }) => { x: number; children: Array<{ type: string; y?: number; shape?: { cx?: number; cy?: number; r?: number; x1?: number; y1?: number; width?: number; height?: number }; style?: { text?: string } }> }
      }>
    }
    const sizes = bubbleOption.series.find((series) => series.type === 'scatter')!.data.map((point) => point.bubbleSize)
    expect(sizes[1]).toBe(42)
    expect(((sizes[0]! - 6) / (sizes[1]! - 6)) ** 2).toBeCloseTo(.5)
    const sizeLegend = bubbleOption.series.find((series) => series.name === '__bubble-size-legend')!
    expect(sizeLegend).toMatchObject({ type: 'custom', z: 100 })
    const renderedLegend = sizeLegend.renderItem?.({}, { value: (index) => [1, 4][index], coord: () => [250, 250] })
    const legendChildren = renderedLegend?.children ?? []
    expect(renderedLegend!.x).toBeGreaterThan(100)
    expect(legendChildren.find((child) => child.type === 'rect')?.shape).toMatchObject({ width: expect.any(Number), height: expect.any(Number) })
    const circles = legendChildren.filter((child) => child.type === 'circle')
    expect(circles[0].shape!.r).toBe(sizes[1]! / 2)
    const guides = legendChildren.filter((child) => child.type === 'line')
    expect(new Set(circles.map((circle) => circle.shape!.cy! + circle.shape!.r!)).size).toBe(1)
    guides.forEach((guide, index) => expect(guide.shape).toMatchObject({ x1: circles[index].shape!.cx, y1: circles[index].shape!.cy! - circles[index].shape!.r! }))
  })

  it('omits empty scatter groups and includes the size measure in bubble tooltips', () => {
    const bubbleTable: DataTable = { name: 'bubble gaps', columns: ['x', 'value', 'population', 'group'], rows: [
      { x: 1, value: 2, population: 100, group: 'А' },
      { x: 2, value: null, population: 200, group: 'Пустая' },
    ] }
    const config = { ...base('bubble'), xField: 'x', scatterSizeField: 'population', scatterColorField: 'group', legendMarker: 'triangle' as const }
    const option = getChartPlugin('bubble').buildOption(bubbleTable, config) as {
      legend: { data: Array<{ name: string; icon: string }> }
      tooltip: { formatter(params: unknown): string }
      series: Array<{ type: string; data: Array<{ value: number[]; bubbleValue?: number }> }>
    }
    expect(option.legend.data).toEqual([{ name: 'А', icon: 'triangle', itemStyle: { color: '#6956e8' } }])
    const point = option.series.find((series) => series.type === 'scatter')!.data[0]
    expect(option.tooltip.formatter({ seriesName: 'А', value: point.value, data: point })).toContain('population: <b>100</b>')
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

    const rangeConfig = base('range-line'); rangeConfig.yFields = ['main']; rangeConfig.rangeLowerField = 'low'; rangeConfig.rangeUpperField = 'high'
    const rangeOption = getChartPlugin('range-line').buildOption(intervalTable, rangeConfig) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } }; series: Array<{ name: string; type?: string; data?: Array<{ value: unknown; itemStyle: { color?: string; opacity: number } }> }> }
    const rangeBand = rangeOption.series.find((series) => series.name === '__range-line-band')
    expect(rangeBand?.type).toBe('custom')
    expect(rangeBand?.data?.[0]).toEqual({ value: [0, 8, 12, 1, 11, 18, 0, 1], itemStyle: { color: '#168a72', opacity: .18 } })
    expect(rangeBand?.data?.[1]).toEqual({ value: [1, 11, 18, 2, 14.5, 14.5, 0, .5], itemStyle: { color: '#168a72', opacity: .18 } })
    expect(rangeBand?.data?.[2]).toEqual({ value: [1, 14.5, 14.5, 2, 11, 18, .5, 1], itemStyle: { color: '#6956e8', opacity: .18 } })
    const firstRangeValues = rangeBand?.data?.[0]?.value as number[] | undefined
    const renderedBand = (rangeBand as unknown as { renderItem?: (params: { dataIndex: number }, api: { value(index: number): number; coord(value: number[]): number[] }) => { style?: unknown } })?.renderItem?.({ dataIndex: 0 }, { value: (index: number) => firstRangeValues?.[index] ?? 0, coord: ([x, y]: number[]) => [x, y] })
    expect(renderedBand?.style).toMatchObject({ fill: '#168a72', opacity: .18 })
    expect(rangeOption.series.find((series) => series.name === 'low')?.data).toHaveLength(3)
    expect(rangeOption.series.find((series) => series.name === '__hit__:low')?.data).toHaveLength(3)
    expect(rangeOption.xAxis.data).toEqual(['0:Янв', '1:Фев', '2:Мар'])
    expect(rangeOption.xAxis.axisLabel.formatter('2:Мар', 2)).toBe('Мар')
    const customRangeOption = getChartPlugin('range-line').buildOption(intervalTable, { ...rangeConfig, intervalFillMode: 'custom', intervalFillColor: '#db5a5a' }) as { series: Array<{ name: string; data?: Array<{ itemStyle: { color?: string } }> }> }
    expect(customRangeOption.series.find((series) => series.name === '__range-line-band')?.data?.every((segment) => segment.itemStyle.color === '#db5a5a')).toBe(true)

    const stepRangeConfig = base('step-range-line'); stepRangeConfig.rangeLowerField = 'low'; stepRangeConfig.rangeUpperField = 'high'; stepRangeConfig.stepPosition = 'end'
    const stepRangeOption = getChartPlugin('step-range-line').buildOption(intervalTable, stepRangeConfig) as { xAxis: { data: string[] }; series: Array<{ name: string; step?: string; data?: Array<{ value: unknown[]; itemStyle: { color?: string } }> }> }
    expect(stepRangeOption.xAxis.data).toEqual(['0:Янв', '1:Фев', '2:Мар'])
    expect(stepRangeOption.series.find((series) => series.name === 'low')?.step).toBe('end')
    expect(stepRangeOption.series.find((series) => series.name === '__step-range-line-band')?.data?.[0]).toEqual({ value: [0, 8, 12, 1, 8, 12, 0, 1], itemStyle: { color: '#168a72', opacity: .18 } })

    const confidenceConfig = base('confidence-line'); confidenceConfig.yFields = ['main', 'low', 'high', 'main2', 'low2', 'high2']; confidenceConfig.intervalFillOpacity = .3; confidenceConfig.showDirectLabels = true
    const confidenceOption = getChartPlugin('confidence-line').buildOption(intervalTable, confidenceConfig) as { yAxis: { min: number; max: number }; series: Array<{ name: string; silent?: boolean; endLabel?: { show: boolean }; areaStyle?: { opacity: number }; data?: unknown[] }> }
    expect(confidenceOption.yAxis.min).toBeLessThanOrEqual(-1)
    expect(confidenceOption.yAxis.max).toBeGreaterThanOrEqual(30)
    expect(confidenceOption.series.find((series) => series.name === '__confidence-line-band-0-fill')?.areaStyle?.opacity).toBe(.3)
    expect(confidenceOption.series.find((series) => series.name === '__confidence-line-band-1-fill')?.areaStyle?.opacity).toBe(.3)
    expect(confidenceOption.series.find((series) => series.name === '__confidence-line-band-0-fill')?.data?.[2]).toBeNull()
    expect(confidenceOption.series.some((series) => series.name === 'low')).toBe(false)
    expect(confidenceOption.series.find((series) => series.name === 'main')?.endLabel?.show).toBe(true)
    expect(confidenceOption.series.some((series) => series.name === '__confidence-line-bound:low')).toBe(false)
    const customConfidenceOption = getChartPlugin('confidence-line').buildOption(intervalTable, { ...confidenceConfig, intervalFillMode: 'custom', intervalFillColor: '#db5a5a' }) as { series: Array<{ name: string; areaStyle?: { color?: string }; lineStyle?: { color?: string } }> }
    expect(customConfidenceOption.series.find((series) => series.name === '__confidence-line-band-0-fill')?.areaStyle?.color).toBe('#db5a5a')

    const labelledConfig = { ...confidenceConfig, intervalGroups: [{ main: 'main', lower: 'low', upper: 'high', showBounds: true }] }
    const labelledOption = getChartPlugin('confidence-line').buildOption(intervalTable, labelledConfig) as { series: Array<{ name: string; endLabel?: { show: boolean }; lineStyle?: { color?: string } }> }
    expect(labelledOption.series.find((series) => series.name === 'low')?.endLabel?.show).toBe(true)
    expect(labelledOption.series.find((series) => series.name === 'high')?.endLabel?.show).toBe(true)
    expect(labelledOption.series.find((series) => series.name === 'low')?.lineStyle?.color).toBe('#6956e8')

    const incomplete = base('confidence-line')
    incomplete.yFields = ['main']
    expect((getChartPlugin('confidence-line').buildOption(intervalTable, incomplete) as { series: unknown[] }).series).toEqual([])

    const unconfiguredRange = base('range-line')
    expect((getChartPlugin('range-line').buildOption(intervalTable, unconfiguredRange) as { series: unknown[] }).series).toEqual([])
    expect(getChartPlugin('range-line').validate(intervalTable, { ...rangeConfig, rangeUpperField: 'low' }).ok).toBe(false)
    expect(getChartPlugin('confidence-line').validate(intervalTable, { ...confidenceConfig, yFields: ['main'], intervalGroups: [{ main: 'main', lower: 'low', upper: 'low' }] }).ok).toBe(false)
  })

  it('builds a sorted dumbbell chart from two explicitly selected measures', () => {
    const dumbbellTable: DataTable = {
      name: 'dumbbell',
      columns: ['country', 'before', 'after'],
      rows: [
        { country: 'A', before: 10, after: 14 },
        { country: 'B', before: 20, after: 18 },
        { country: 'C', before: 8, after: 17 },
      ],
    }
    const config = base('dumbbell')
    config.xField = 'country'
    config.dumbbellStartField = 'before'
    config.dumbbellEndField = 'after'
    config.dumbbellSort = 'difference'
    config.dumbbellSortDirection = 'desc'
    config.showValues = true
    config.xAxisLabelRotate = 60
    const option = getChartPlugin('dumbbell').buildOption(dumbbellTable, config) as {
      yAxis: { data: string[]; axisLabel: { formatter(value: string): string; rotate: number } }
      series: Array<{ name: string; type: string; z?: number; zlevel?: number; data: Array<{ value: unknown[]; label?: { show: boolean; position: string; formatter: string } }>; label?: { show: boolean } }>
    }
    expect(option.yAxis.data.map(option.yAxis.axisLabel.formatter)).toEqual(['C', 'A', 'B'])
    expect(option.yAxis.axisLabel.rotate).toBe(0)
    expect(option.series.map((series) => [series.name, series.type])).toEqual([
      ['__dumbbell-connectors', 'custom'],
      ['before', 'scatter'],
      ['after', 'scatter'],
    ])
    expect(option.series.slice(1).every((series) => Number(series.z) > Number(option.series[0].z) && Number(series.zlevel) > Number(option.series[0].zlevel))).toBe(true)
    expect(option.series[1].data[0].value).toEqual([8, '0:C'])
    expect(option.series[1].data[0].label?.position).toBe('left')
    expect(option.series[2].data[0].label?.position).toBe('right')

    const vertical = getChartPlugin('dumbbell').buildOption(dumbbellTable, { ...config, dumbbellOrientation: 'vertical', dumbbellShowDifference: true, dumbbellDifferenceFormat: 'percent', dumbbellDifferencePosition: 'start', dumbbellShowStartValue: false, dumbbellShowEndValue: true, dumbbellConnectorWidth: 5, dumbbellConnectorOpacity: .6, dumbbellConnectorType: 'dotted', dumbbellColorByChange: true, dumbbellIncreaseColor: '#118855' }) as {
      xAxis: { data: string[]; boundaryGap: boolean }
      series: Array<{ name: string; data: Array<{ value: unknown[]; label?: { show: boolean; position: string; formatter: string } }>; renderItem?: (params: { dataIndex: number }, api: { value(index: number): number | string; coord(value: unknown[]): number[] }) => { children: Array<{ type: string; style?: Record<string, unknown> }> } }>
    }
    expect(vertical.xAxis.data).toHaveLength(3)
    expect(vertical.xAxis.boundaryGap).toBe(true)
    expect(vertical.series[1].data[0].value).toEqual(['0:C', 8])
    expect(vertical.series[1].data[0].label?.position).toBe('bottom')
    expect(vertical.series[1].data[0].label?.show).toBe(false)
    expect(vertical.series[2].data[0].label?.show).toBe(true)
    const connector = vertical.series.find((series) => series.name === '__dumbbell-connectors')
    const connectorChildren = connector?.renderItem?.({ dataIndex: 0 }, { value: (index) => ['0:C', 8, 17][index], coord: ([x, y]) => [Number(x) || 0, Number(y)] }).children ?? []
    expect(connectorChildren[0]?.style).toMatchObject({ stroke: '#118855', opacity: .6, lineWidth: 5, lineDash: [2, 4] })
    const change = connectorChildren[1]
    expect(change).toMatchObject({ type: 'text', style: { text: '+113%', textAlign: 'center', textVerticalAlign: 'bottom', y: 0 } })
    expect(change?.style?.fill).toBe('#118855')
    expect(change?.style).not.toHaveProperty('backgroundColor')
    expect(change?.style).not.toHaveProperty('padding')

    const horizontal = getChartPlugin('dumbbell').buildOption(dumbbellTable, { ...config, dumbbellShowDifference: true, dumbbellDifferencePosition: 'end' }) as unknown as {
      series: Array<{ name: string; renderItem?: (params: { dataIndex: number }, api: { value(index: number): number | string; coord(value: unknown[]): number[] }) => { children: Array<{ style?: { x?: number; y?: number; text?: string } }> } }>
    }
    const horizontalConnector = horizontal.series.find((series) => series.name === '__dumbbell-connectors')
    expect(horizontalConnector?.renderItem?.({ dataIndex: 0 }, { value: (index) => [8, 17, '0:C'][index], coord: ([x]) => [Number(x), 0] }).children[1]?.style).toMatchObject({ x: 28.5, text: '+9', textAlign: 'left' })

    const incomplete = base('dumbbell')
    expect((getChartPlugin('dumbbell').buildOption(dumbbellTable, incomplete) as { series: unknown[] }).series).toEqual([])
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

  it('keeps long categorical labels on one line and avoids collisions', () => {
    const categorical: DataTable = { name: 'countries', columns: ['country', 'value'], rows: ['Соединённые Штаты Америки', 'Великобритания', 'Новая Зеландия', 'Южная Африка'].map((country, index) => ({ country, value: index + 1 })) }
    const config = base('bar'); config.xField = 'country'; config.canvasWidth = 420
    const option = getChartPlugin('bar').buildOption(categorical, config) as { xAxis: { data: string[]; axisLabel: { interval: number; hideOverlap: boolean; formatter(value: string, index: number): string } } }
    const labels = option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))
    expect(option.xAxis.axisLabel).toMatchObject({ interval: 0, hideOverlap: false })
    expect(labels).toHaveLength(categorical.rows.length)
    expect(labels.every(Boolean)).toBe(true)
    expect(labels[0]).not.toContain('\n')
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
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['2022', '', '', "'24", ''])
    expect(option.xAxis.data.map((_, index) => option.xAxis.axisLabel.interval(index))).toEqual([true, false, false, true, false])
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

  it('uses the first observed date after an anchor as the period label', () => {
    const dates = [new Date(2024, 2, 1), new Date(2024, 5, 1), new Date(2025, 0, 1), new Date(2025, 2, 1)]
    const dated: DataTable = { name: 'daily', columns: ['date', 'value'], rows: dates.map((date, value) => ({ date, value })), timeProfiles: { date: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' } } }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'year-full'; config.dateAxisStepUnit = 'year'; config.dateAxisAnchor = '2024-03-01'
    const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['2024', '', '2025', ''])
    expect(option.xAxis.axisLabel.interval(0)).toBe(true)
  })

  it('reduces daily labels to calendar month and week transitions', () => {
    const dates = Array.from({ length: 12 }, (_, index) => new Date(2024, 0, 29 + index))
    const dated: DataTable = { name: 'daily', columns: ['date', 'value'], rows: dates.map((date, value) => ({ date, value })) }
    const monthConfig = base('line'); monthConfig.xField = 'date'; monthConfig.dateLabelFormat = 'month-only-ru'
    const month = getChartPlugin('line').buildOption(dated, monthConfig) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    expect(month.xAxis.data.map((value, index) => month.xAxis.axisLabel.formatter(value, index)).filter(Boolean)).toEqual(['янв.', 'февр.'])
    const weekConfig = { ...monthConfig, dateLabelFormat: 'week-only' as const }
    const week = getChartPlugin('line').buildOption(dated, weekConfig) as typeof month
    expect(week.xAxis.data.map((value, index) => week.xAxis.axisLabel.formatter(value, index)).filter(Boolean)).toEqual(['W05', 'W06'])
  })

  it('labels the first observed month, quarter, half-year and year', () => {
    const dated: DataTable = { name: 'partial periods', columns: ['date', 'value'], rows: [
      new Date(2024, 1, 15), new Date(2024, 4, 12), new Date(2024, 7, 9), new Date(2025, 2, 3),
    ].map((date, value) => ({ date, value })) }
    for (const [dateLabelFormat, expected] of [
      ['month-only-ru', ['февр.', 'май', 'авг.', 'мар.']],
      ['quarter-only-ru', ['К1', 'К2', 'К3', 'К1']],
      ['half-only-ru', ['П1', 'П2', 'П1']],
      ['year-full', ['2024', '2025']],
    ] as const) {
      const config = base('line'); config.xField = 'date'; config.dateLabelFormat = dateLabelFormat
      const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
      expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index)).filter(Boolean), dateLabelFormat).toEqual(expected)
    }
  })

  it('uses the same planned date labels for line and heatmap axes', () => {
    const dated: DataTable = { name: 'dated matrix', columns: ['date', 'north', 'south'], rows: [
      new Date(2025, 8, 4), new Date(2025, 8, 5), new Date(2025, 9, 2), new Date(2025, 9, 3),
    ].map((date, value) => ({ date, north: value, south: value + 1 })) }
    const lineConfig = base('line'); lineConfig.xField = 'date'; lineConfig.dateLabelFormat = 'day-context-month-ru'; lineConfig.dateAxisAnchor = '2025-09-05'
    const heatmapConfig = { ...lineConfig, kind: 'heatmap' as const, yField: 'north', yFields: ['north', 'south'] }
    const line = getChartPlugin('line').buildOption(dated, lineConfig) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    const heatmap = getChartPlugin('heatmap').buildOption(dated, heatmapConfig) as typeof line
    expect(heatmap.xAxis.data.map((value, index) => heatmap.xAxis.axisLabel.formatter(value, index))).toEqual(
      line.xAxis.data.map((value, index) => line.xAxis.axisLabel.formatter(value, index)),
    )
  })

  it('shows half-year labels only at real half-year boundaries', () => {
    const dated: DataTable = { name: 'monthly', columns: ['date', 'value'], rows: Array.from({ length: 12 }, (_, month) => ({ date: new Date(2025, month, 1), value: month })), timeProfiles: { date: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' } } }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'half-only'
    const option = getChartPlugin('line').buildOption(dated, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index)).filter(Boolean)).toEqual(['H1', 'H2'])
  })

  it('reserves room to the right of the final label for every cartesian chart', () => {
    const dated: DataTable = { name: 'dated', columns: ['date', 'value'], rows: [{ date: new Date(2025, 0, 1), value: 1 }, { date: new Date(2025, 11, 31), value: 2 }] }
    for (const kind of ['line', 'spline', 'step-line', 'range-line', 'step-range-line', 'confidence-line', 'area', 'stacked-area', 'normalized-stacked-area', 'bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'dumbbell', 'scatter', 'bubble'] as const) {
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
    expect(option.xAxis.axisLabel.formatter(option.xAxis.data[0], 0)).toBe('К2\n2025')
    expect(option.xAxis.axisLabel.interval(0)).toBe(true)
  })

  it('puts month context under the first displayed day when the period boundary is absent or hidden', () => {
    const daily: DataTable = { name: 'partial months', columns: ['date', 'value'], rows: [
      new Date(2025, 8, 4), new Date(2025, 8, 5), new Date(2025, 9, 2), new Date(2025, 9, 3),
    ].map((date, value) => ({ date, value })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'day-context-month-ru'; config.dateAxisAnchor = '2025-09-05'
    const option = getChartPlugin('line').buildOption(daily, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
    const labels = option.xAxis.data.map((value, index) => option.xAxis.axisLabel.interval(index) ? option.xAxis.axisLabel.formatter(value, index) : '')
    expect(labels).toEqual(['', '5\nсент.', '2\nокт.', '3'])
  })

  it('places an ISO year only below the first contextual week', () => {
    const weekly: DataTable = { name: 'weeks', columns: ['date', 'value'], rows: [new Date(2024, 11, 30), new Date(2025, 0, 6), new Date(2025, 0, 13)].map((date, value) => ({ date, value })) }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'week-context-en'
    const option = getChartPlugin('line').buildOption(weekly, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string } } }
    expect(option.xAxis.data.map((value, index) => option.xAxis.axisLabel.formatter(value, index))).toEqual(['W01\n2025', 'W02', 'W03'])
  })

  it('keeps ISO week 1 visible when automatic label density skips neighboring weeks', () => {
    const weekly: DataTable = { name: 'weeks', columns: ['date', 'value'], rows: Array.from({ length: 12 }, (_, index) => ({ date: new Date(2024, 11, 23 + index * 7), value: index })) }
    for (const dateLabelFormat of ['week-only', 'week-year', 'week-year-en', 'year-week-en', 'week-context-en', 'week-context-ru'] as const) {
      const config = base('line'); config.xField = 'date'; config.dateLabelFormat = dateLabelFormat; config.canvasWidth = 320
      const option = getChartPlugin('line').buildOption(weekly, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
      const weekOneIndex = weekly.rows.findIndex((row) => row.date instanceof Date && isoWeekParts(row.date).week === 1)
      expect(option.xAxis.axisLabel.interval(weekOneIndex), dateLabelFormat).toBe(true)
      expect(option.xAxis.axisLabel.formatter(option.xAxis.data[weekOneIndex], weekOneIndex), dateLabelFormat).not.toBe('')
    }
  })

  it('labels week 1 in daily data even when its Monday is outside the dataset', () => {
    const daily: DataTable = { name: 'days', columns: ['date', 'value'], rows: Array.from({ length: 10 }, (_, index) => ({ date: new Date(2025, 0, 1 + index), value: index })), timeProfiles: { date: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' } } }
    const config = base('line'); config.xField = 'date'; config.dateLabelFormat = 'week-context-ru'
    const option = getChartPlugin('line').buildOption(daily, config) as { xAxis: { data: string[]; axisLabel: { formatter(value: string, index: number): string; interval(index: number): boolean } } }
    expect(option.xAxis.axisLabel.formatter(option.xAxis.data[0], 0)).toBe('Нед. 1\n2025')
    expect(option.xAxis.axisLabel.interval(0)).toBe(true)
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
    expect(option.grid.bottom).toBe(32)
  })

  it('does not reserve rotated category labels twice', () => {
    const categories: DataTable = { name: 'countries', columns: ['country', 'value'], rows: [{ country: 'США', value: 29 }, { country: 'Великобритания', value: 4 }] }
    const horizontal = base('bar'); horizontal.xField = 'country'; horizontal.xAxisLabelRotate = 0
    const vertical = { ...horizontal, xAxisLabelRotate: 90 as const }
    const horizontalOption = getChartPlugin('bar').buildOption(categories, horizontal) as { grid: { bottom: number; containLabel: boolean }; xAxis: { nameGap: number; axisLabel: { rotate: number } } }
    const verticalOption = getChartPlugin('bar').buildOption(categories, vertical) as typeof horizontalOption
    expect(verticalOption.xAxis.axisLabel.rotate).toBe(90)
    expect(verticalOption.xAxis.nameGap).toBeGreaterThan(horizontalOption.xAxis.nameGap)
    expect(verticalOption.grid).toEqual(horizontalOption.grid)
    expect(verticalOption.grid.containLabel).toBe(true)
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

  it('uses the matching label and title gaps after axes are transposed for linear bars', () => {
    const config = base('horizontal-bar'); config.xAxisTitleGap = 7; config.yAxisTitleGap = 23; config.yAxisLabelGap = 17; config.barOrientation = 'vertical'
    const option = getChartPlugin('horizontal-bar').buildOption(table, config) as { xAxis: { name: string; nameGap: number; nameTextStyle: { fontSize: number }; axisLabel: { margin: number } }; yAxis: { name: string }; graphic: Array<{ id?: string; style?: { text?: string; fontSize?: number } }> }
    expect(option.xAxis.name).toBe('value')
    expect(option.xAxis.nameGap).toBe(58)
    expect(option.xAxis.axisLabel.margin).toBe(17)
    expect(option.xAxis.nameTextStyle.fontSize).toBe(12)
    expect(option.yAxis.name).toBe('')
    expect(option.graphic.find((item) => item.id === 'chart-y-axis-title')).toMatchObject({ style: { text: 'month', fontSize: 12 } })
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
    expect(option.grid).toMatchObject({ top: 102, bottom: 18 })
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

  it('exposes defaults, mapping inference and validation for every plugin', () => {
    for (const plugin of chartRegistry) {
      expect(plugin.defaultConfig.kind).toBe(plugin.id)
      expect(plugin.inferMapping(table)).toMatchObject({ xField: 'month', yField: 'value', yFields: ['value'] })
      expect(plugin.validate(table, base(plugin.id))).toHaveProperty('ok')
    }
  })

  it('builds vertical and horizontal lollipop charts from stems and interactive dots', () => {
    for (const kind of ['lollipop', 'horizontal-lollipop'] as const) {
      const config = base(kind); config.showValues = true; config.barValueLabelAbsorption = true; config.barCategorySort = 'name-asc'
      const option = getChartPlugin(kind).buildOption(table, config) as { xAxis: { type: string; data?: string[] }; yAxis: { type: string; data?: string[] }; series: Array<{ name: string; type: string; symbolSize?: number; encode?: { x: number; y: number }; data: Array<{ label?: { show?: boolean; position?: string; formatter?: string } }> }> }
      const stem = option.series.find((series) => series.name === '__lollipop-stems')!
      const dots = option.series.find((series) => series.type === 'scatter')!
      expect(stem).toMatchObject({ type: 'custom' })
      expect(stem.encode).toEqual(kind === 'horizontal-lollipop' ? { x: 1, y: 0 } : { x: 0, y: 1 })
      expect(dots.symbolSize).toBe(12)
      expect(dots.data[0].label).toMatchObject({ show: true, position: kind === 'horizontal-lollipop' ? 'right' : 'top', formatter: '20' })
      expect(kind === 'horizontal-lollipop' ? option.yAxis.data : option.xAxis.data).toEqual(['0:Фев', '1:Янв'])
      expect(kind === 'horizontal-lollipop' ? option.xAxis.type : option.yAxis.type).toBe('value')
    }
  })

  it('keeps dense lollipop value labels at the configured size', () => {
    const dense: DataTable = {
      name: 'dense',
      columns: ['category', 'value'],
      rows: Array.from({ length: 20 }, (_, index) => ({ category: `Категория ${index + 1}`, value: (index + 1) * 123456789 })),
    }
    const config = { ...base('lollipop'), xField: 'category', yField: 'value', yFields: ['value'], showValues: true, canvasWidth: 300 }
    const option = getChartPlugin('lollipop').buildOption(dense, config) as {
      series: Array<{ type: string; labelLayout?: { hideOverlap?: boolean; moveOverlap?: string }; data: Array<{ label?: { fontSize?: number } }> }>
    }
    const dots = option.series.find((series) => series.type === 'scatter')!
    expect(dots.labelLayout).toMatchObject({ hideOverlap: false, moveOverlap: 'shiftX' })
    expect(dots.data.every((point) => point.label?.fontSize === config.valueText.size)).toBe(true)

    const hidden = getChartPlugin('lollipop').buildOption(dense, { ...config, valueLabelHideOverlap: true }) as {
      series: Array<{ type: string; data: Array<{ label?: { show?: boolean; fontSize?: number } }> }>
    }
    const hiddenDots = hidden.series.find((series) => series.type === 'scatter')!
    expect(hiddenDots.data.some((point) => point.label?.show === false)).toBe(true)
    expect(hiddenDots.data.every((point) => point.label?.fontSize === config.valueText.size)).toBe(true)
  })

  it('does not inherit the right direct-legend size for the last lollipop value', () => {
    const config = { ...base('lollipop'), xField: 'category', yField: 'value', yFields: ['value'], showValues: true, showDirectLabels: true, directLabelText: { ...base('lollipop').valueText, size: 31 } }
    const option = getChartPlugin('lollipop').buildOption(table, config) as {
      series: Array<{ type: string; data: Array<{ label?: { fontSize?: number } }> }>
    }
    const dots = option.series.find((series) => series.type === 'scatter')!
    expect(dots.data.at(-1)?.label?.fontSize).toBe(config.valueText.size)
  })

  it('builds slope charts for exactly two X positions', () => {
    const slopeTable: DataTable = { name: 'slope', columns: ['period', 'value'], rows: [{ period: 'Было', value: 10 }, { period: 'Стало', value: 18 }] }
    const config = { ...base('slope'), xField: 'period', yField: 'value', yFields: ['value'], showValues: false }
    expect(getChartPlugin('slope').validate(slopeTable, config).ok).toBe(true)
    const option = getChartPlugin('slope').buildOption(slopeTable, { ...config, showVerticalGrid: true }) as { legend: { show: boolean }; xAxis: { boundaryGap: boolean; axisLine: { show: boolean }; splitLine: { show: boolean } }; yAxis: { axisLabel: { show: boolean } }; series: Array<{ name?: string; type: string; showSymbol: boolean; symbolSize: number; data: Array<{ itemStyle?: { color?: string }; label?: { position?: string; formatter?: string } }> }> }
    const series = option.series.find((item) => item.type === 'line')!
    expect(series).toMatchObject({ showSymbol: true, symbolSize: 11 })
    expect(series.data.map((point) => point.label?.position)).toEqual(['left', 'right'])
    expect(series.data.map((point) => point.label?.formatter)).toEqual(['10', '{value|18} {name|value}'])
    expect(series.data.map((point) => point.itemStyle?.color)).toEqual([config.color, config.color])
    expect(option.legend.show).toBe(false)
    expect(option.yAxis.axisLabel.show).toBe(false)
    expect(option.xAxis.boundaryGap).toBe(true)
    expect(option.xAxis.axisLine.show).toBe(false)
    expect(option.xAxis.splitLine.show).toBe(false)
    expect(option.series.some((series) => series.name === '__slope-guides__')).toBe(true)
    const namesOnly = getChartPlugin('slope').buildOption(slopeTable, { ...config, slopeShowValues: false }) as { series: Array<{ type: string; data: Array<{ label?: { show?: boolean; formatter?: string } }> }> }
    expect(namesOnly.series.find((item) => item.type === 'line')?.data.map((point) => point.label?.formatter)).toEqual([undefined, '{name|value}'])
    const hidden = getChartPlugin('slope').buildOption(slopeTable, { ...config, slopeShowValues: false, slopeShowSeriesNames: false }) as { series: Array<{ type: string; data: Array<{ label?: { show?: boolean } }> }> }
    expect(hidden.series.find((item) => item.type === 'line')?.data.every((point) => point.label?.show === false)).toBe(true)
  })

  it('builds a slope chart from two selected X positions', () => {
    const slopeTable: DataTable = { name: 'slope', columns: ['period', 'value', 'plan'], rows: [{ period: '2022', value: 10, plan: 12 }, { period: '2023', value: 14, plan: 15 }, { period: '2024', value: 18, plan: 17 }] }
    const config = { ...base('slope'), xField: 'period', yField: 'value', yFields: ['value', 'plan'], slopeXValues: ['string:2022', 'string:2024'] }
    expect(getChartPlugin('slope').validate(slopeTable, config).ok).toBe(true)
    const option = getChartPlugin('slope').buildOption(slopeTable, config) as { xAxis: { data: string[] }; series: Array<{ name: string; data: unknown[] }> }
    expect(option.xAxis.data).toEqual(['0:2022', '1:2024'])
    expect(option.series.filter((series) => series.name === 'value' || series.name === 'plan').map((series) => series.data)).toHaveLength(2)
    expect(option.series.filter((series) => series.name === 'value' || series.name === 'plan').every((series) => series.data.length === 2)).toBe(true)
  })

  it('honours Y-axis settings for slope charts', () => {
    const config = { ...base('slope'), slopeShowYAxis: true, showYAxisTitle: true, showYAxisLine: true, showYTicks: true }
    const option = getChartPlugin('slope').buildOption(table, config) as { graphic: Array<{ id: string }>; yAxis: { axisLabel: { show: boolean }; axisLine: { show: boolean }; axisTick: { show: boolean }; splitLine: { show: boolean } } }
    expect(option.yAxis).toMatchObject({ axisLabel: { show: false }, axisLine: { show: true }, axisTick: { show: true }, splitLine: { show: false } })
    expect(option.graphic.some((item) => item.id === 'chart-y-axis-title')).toBe(true)
  })

  it('builds indexed and year-comparison line variants', () => {
    const indexedTable: DataTable = { name: 'indexed', columns: ['date', 'value'], rows: [{ date: new Date(2024, 0, 1), value: 20 }, { date: new Date(2024, 1, 1), value: 30 }] }
    const indexedConfig = { ...base('indexed-line'), xField: 'date', yField: 'value', yFields: ['value'], indexBaseXValue: `date:${new Date(2024, 0, 1).toISOString()}` }
    expect(getChartPlugin('indexed-line').validate(indexedTable, indexedConfig).ok).toBe(true)
    const indexedOption = getChartPlugin('indexed-line').buildOption(indexedTable, indexedConfig) as { series: Array<{ name: string; data: Array<{ value?: number }> }> }
    expect(indexedOption.series.find((series) => series.name === 'value')!.data.map((point) => point.value)).toEqual([100, 150])

    const seasonalTable: DataTable = { name: 'seasonal', columns: ['date', 'value'], rows: [{ date: new Date(2023, 0, 1), value: 10 }, { date: new Date(2024, 0, 1), value: 20 }] }
    const seasonalConfig = { ...base('seasonal-line'), xField: 'date', yField: 'value', yFields: ['value'], seasonalAccentYears: ['2024'] }
    expect(getChartPlugin('seasonal-line').validate(seasonalTable, seasonalConfig).ok).toBe(true)
    const seasonalOption = getChartPlugin('seasonal-line').buildOption(seasonalTable, seasonalConfig) as { grid: { right: number }; series: Array<{ name: string; z?: number; lineStyle?: { color?: string; opacity?: number }; endLabel?: { show?: boolean; formatter?: string } }> }
    expect(seasonalOption.series.find((series) => series.name === '2023')!.lineStyle).toMatchObject({ color: '#d9d7df', opacity: .45 })
    expect(seasonalOption.series.find((series) => series.name === '2024')!.lineStyle).toMatchObject({ color: seasonalConfig.color, opacity: 1 })
    expect(seasonalOption.series.find((series) => series.name === '2024')).toMatchObject({ z: 1001, endLabel: { show: true, formatter: '{name|2024}' } })
    expect(seasonalOption.series.find((series) => series.name === '2023')!.endLabel).toBeUndefined()
    expect(seasonalOption.grid.right).toBeGreaterThan(30)
  })

  it('builds moving averages for every selected series', () => {
    expect(movingAverage([1, 2, 3, 4, null, 6], 3)).toEqual([null, null, 2, 3, null, null])
    const smoothTable: DataTable = { name: 'smooth', columns: ['period', 'a', 'b'], rows: [1, 2, 3, 4].map((period) => ({ period, a: period, b: period * 10 })) }
    for (const kind of ['moving-average-line', 'moving-average-scatter'] as const) {
      const config = { ...base(kind), xField: 'period', yField: 'a', yFields: ['a', 'b'], movingAverageWindow: 3, movingAverageRawOpacity: .2 }
      const option = getChartPlugin(kind).buildOption(smoothTable, config) as { series: Array<{ name: string; type: string; z: number; lineStyle?: { opacity?: number }; data: Array<{ value?: number | null; symbolSize?: number }> }> }
      expect(option.series.find((series) => series.name === 'a · среднее (3)')!.data.map((point) => point.value)).toEqual([null, null, 2, 3])
      expect(option.series.find((series) => series.name === 'b · среднее (3)')!.data.map((point) => point.value)).toEqual([null, null, 20, 30])
      const raw = option.series.find((series) => series.name.startsWith('a · исходные'))!
      expect(raw.type).toBe(kind === 'moving-average-scatter' ? 'scatter' : 'line')
      if (kind === 'moving-average-scatter') expect(raw.data.every((point) => point.symbolSize === 7)).toBe(true)
      expect(raw.z).toBeLessThan(option.series.find((series) => series.name === 'a · среднее (3)')!.z)
    }
  })

  it('builds a wide heatmap from multiple selected series', () => {
    const heatTable: DataTable = { name: 'heat', columns: ['month', 'Север', 'Юг'], rows: [{ month: 'Янв', Север: -10, Юг: 30 }, { month: 'Фев', Север: 20, Юг: -5 }] }
    const config = { ...base('heatmap'), xField: 'month', yField: 'Север', yFields: ['Север', 'Юг'], xAxisLabelGap: 17, xAxisTitleGap: 23, heatmapScaleMode: 'diverging' as const, heatmapMidpoint: 0, heatmapLowColor: '#225599', heatmapMidColor: '#ffffff', heatmapHighColor: '#bb2233', heatmapCellGap: 3 }
    expect(getChartPlugin('heatmap').validate(heatTable, config).ok).toBe(true)
    const option = getChartPlugin('heatmap').buildOption(heatTable, config) as { graphic: Array<{ id?: string; left?: number; info?: { ratio?: number }; shape?: { width?: number; height?: number }; style?: { text?: string } }>; grid: Record<'top' | 'right' | 'bottom' | 'left', number>; xAxis: { data: string[]; nameGap: number; axisLabel: { margin: number } }; yAxis: { data: string[]; name: string }; visualMap: { show: boolean; min: number; max: number; inRange: { color: string[] } }; series: Array<{ type: string; itemStyle: { borderWidth: number }; data: Array<{ value: number[]; itemStyle: { color: string }; label: { color: string } }> }> }
    expect(option.xAxis.data).toEqual(['Янв', 'Фев'])
    expect(option.yAxis.data).toEqual(['Север', 'Юг'])
    expect(option.yAxis.name).toBe('')
    expect(option.xAxis.axisLabel.margin).toBe(17)
    expect(option.xAxis.nameGap).toBe(58)
    expect(option.graphic.filter((item) => item.id === 'chart-y-axis-title')).toHaveLength(1)
    expect(option.visualMap).toMatchObject({ min: -30, max: 30, inRange: { color: ['#225599', '#ffffff', '#bb2233'] } })
    expect(option.series[0]).toMatchObject({ type: 'heatmap', itemStyle: { borderWidth: 3 } })
    expect(option.series[0].data.map((point) => point.value)).toEqual([[0, 0, -10], [1, 0, 20], [0, 1, 30], [1, 1, -5]])
    const baseGrid = option.grid
    for (const position of ['left', 'top', 'bottom'] as const) {
      const positioned = getChartPlugin('heatmap').buildOption(heatTable, { ...config, heatmapScalePosition: position }) as typeof option
      expect(positioned.grid[position]).toBeGreaterThan(baseGrid[position])
      const bar = positioned.graphic.find((item) => item.id === 'heatmap-scale-bar')!
      expect(position === 'left' ? Number(bar.shape?.height) : Number(bar.shape?.width)).toBeGreaterThan(position === 'left' ? Number(bar.shape?.width) : Number(bar.shape?.height))
      expect(positioned.graphic.find((item) => item.id === 'heatmap-scale-label-1')?.style?.text).toBe('0')
      if (position === 'left') expect(positioned.graphic.find((item) => item.id === 'chart-y-axis-title')?.left).toBe(112)
    }
    const bounded = getChartPlugin('heatmap').buildOption(heatTable, { ...config, heatmapScaleMin: -50, heatmapScaleMax: 80 }) as typeof option
    expect(bounded.visualMap).toMatchObject({ min: -50, max: 80 })
    expect(bounded.graphic.find((item) => item.id === 'heatmap-scale-label-1')?.info?.ratio).toBeCloseTo(80 / 130)
    expect(bounded.series[0].data.find((point) => point.value[2] === -10)?.itemStyle.color).not.toBe(
      bounded.series[0].data.find((point) => point.value[2] === 20)?.itemStyle.color,
    )
    expect(bounded.series[0].data.every((point) => ['#202027', '#ffffff'].includes(point.label.color))).toBe(true)
    const reversed = getChartPlugin('heatmap').buildOption(heatTable, { ...config, heatmapScaleMin: 80, heatmapScaleMax: -50 }) as typeof option
    expect(reversed.visualMap).toMatchObject({ min: -50, max: 80 })

    const incompleteTable: DataTable = { name: 'heat gaps', columns: ['month', 'Север', 'Юг', 'Запад'], rows: [{ month: 'Янв', Север: 5, Юг: 30, Запад: null }, { month: 'Фев', Север: 10, Юг: 20, Запад: 1 }] }
    const polished = getChartPlugin('heatmap').buildOption(incompleteTable, { ...config, yFields: ['Север', 'Юг', 'Запад'], heatmapRowSort: 'average', heatmapRowSortDirection: 'descending', heatmapMissingColor: '#abcdef', heatmapMissingLabel: 'н/д', showValues: true }) as unknown as { yAxis: { data: string[] }; series: Array<{ label: { formatter(params: { value?: Array<number | null> }): string }; data: Array<{ value: Array<number | null>; itemStyle?: { color: string } }> }> }
    expect(polished.yAxis.data).toEqual(['Юг', 'Север', 'Запад'])
    expect(polished.series[0].data.find((point) => point.value[2] == null)?.itemStyle).toEqual({ color: '#abcdef' })
    expect(polished.series[0].label.formatter({ value: [0, 2, null] })).toBe('н/д')
  })

  it('reports missing numeric mappings before rendering', () => {
    const invalid = { ...base('bar'), yField: 'missing', yFields: ['missing'] }
    expect(getChartPlugin('bar').validate(table, invalid)).toEqual({
      ok: false,
      errors: [{ field: 'yField', message: 'Выберите числовую колонку для значения.' }],
    })
  })
})
