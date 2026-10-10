import { describe, expect, it } from 'vitest'
import { getChartPlugin } from './chartRegistry'
import { planCategoryDateLabels, planCategoryDateTicks, planDateAxisTicks } from './chartDateAxis'
import { createDefaultChartConfig } from '../entities/chart/model/defaultChartConfig'
import { keyRateDemoTable, usInflationDemoTable } from '../features/editor/model/timeSeriesDemo'
import type { ChartKind, DataTable } from './types'
import { resolveNativeScene } from '../features/chart-renderer/echarts/renderScene'
import { categoryAxisFraction } from '../features/chart-layout/axisLayout'

const config = { ...createDefaultChartConfig(), xField: 'Дата', yField: 'Инфляция', yFields: ['Инфляция'], title: '', subtitle: '', note: '', source: '' }

describe('calendar date labels', () => {
  const timelineKinds: ChartKind[] = ['bar', 'stacked-bar', 'normalized-stacked-bar', 'horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'lollipop', 'horizontal-lollipop', 'dumbbell', 'dot-plot', 'arrow-plot', 'waterfall', 'butterfly', 'heatmap', 'line', 'spline', 'step-line', 'indexed-line', 'bump', 'area', 'stacked-area', 'normalized-stacked-area', 'stream-graph', 'moving-average-line', 'moving-average-scatter', 'range-line', 'step-range-line', 'confidence-line', 'scatter', 'connected-scatter', 'bubble']
  it.each(timelineKinds)('%s uses the shared calendar axis even when observations cluster at the end', (kind) => {
    const dates = [new Date(1950, 0, 1), new Date(2010, 0, 1), ...Array.from({ length: 120 }, (_, index) => new Date(2020, index, 1))]
    const table: DataTable = { name: 'Clustered dates', columns: ['Дата', 'Инфляция', 'Другой'], rows: dates.map((Дата) => ({ Дата, Инфляция: 1, Другой: 2 })) }
    const setup = { ...config, kind, yFields: ['Инфляция', 'Другой'], dateLabelFormat: 'year-full' as const, xAxisStep: 10, showValues: false, showLegend: false, showDirectLabels: false, waterfallShowTotal: false, dumbbellStartField: 'Инфляция', dumbbellEndField: 'Другой', rangeLowerField: 'Инфляция', rangeUpperField: 'Другой' }
    const scene = resolveNativeScene(getChartPlugin(kind).compile(table, setup))
    const axis = scene.plot.kind === 'xy' ? scene.plot.xAxis : 'categoryAxis' in scene.plot ? scene.plot.categoryAxis : undefined
    expect(axis?.timeScale?.ticks.map((tick) => tick.label)).toEqual(['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'])
    if ('categories' in scene.plot && axis) {
      const fraction = categoryAxisFraction(scene.plot.categories, axis, 1)
      expect(fraction).toBeGreaterThan(.7)
      // Precomputed/custom marks must use the same scale as native marks.
      const id = scene.plot.kind === 'comparison-stem' ? scene.plot.series[0].points[1].id
        : scene.plot.kind === 'heatmap' ? scene.plot.rows[0].cells[1].id
          : scene.plot.kind === 'waterfall' ? scene.plot.marks[1].id
            : scene.plot.kind === 'butterfly' ? scene.plot.series[0].marks[1].id : undefined
      const rect = id && scene.geometry.elements[id]
      if (rect) {
        const actual = axis.orientation === 'horizontal' ? (rect.x + rect.width / 2 - scene.geometry.plot.x) / scene.geometry.plot.width : (rect.y + rect.height / 2 - scene.geometry.plot.y) / scene.geometry.plot.height
        expect(actual).toBeCloseTo(fraction, 5)
      }
    }
    const option = getChartPlugin(kind).buildOption(table, setup) as Record<string, { type: string } | Array<{ type: string }>>
    expect([option.xAxis, option.yAxis].flat().some((axis) => axis.type === 'time')).toBe(true)
    expect(table.rows).toHaveLength(dates.length)
  })

  it.each([1, 31])('includes January at the left edge for imported monthly dates on day %s', (day) => {
    const dates = [new Date(2000, 0, day, 3), new Date(2025, 10, 1, 3)]
    const table: DataTable = { name: 'imported monthly dates', columns: ['Дата', 'Инфляция'], rows: dates.map((Дата) => ({ Дата, Инфляция: 1 })), timeProfiles: { Дата: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' } } }
    const axis = planDateAxisTicks(dates, table, { ...config, dateLabelFormat: 'year-full', xAxisStep: 5 })!
    expect(axis.ticks.map((tick) => tick.label)).toEqual(['2000', '2005', '2010', '2015', '2020', '2025'])
    expect(axis.min).toBe(+new Date(2000, 0, 1))
    const manual = planDateAxisTicks(dates, table, { ...config, dateLabelFormat: 'year-full', xAxisStep: 5, xAxisMin: '2000-01-02' })!
    expect(manual.ticks.some((tick) => tick.label === '2000')).toBe(false)
    const band = planCategoryDateTicks(dates, table, { ...config, dateLabelFormat: 'year-full', xAxisStep: 5 })!
    expect(band[0]).toMatchObject({ label: '2000', position: 0 })
    const scatter = getChartPlugin('scatter').buildOption(table, { ...config, kind: 'scatter', dateLabelFormat: 'year-full', xAxisStep: 5 }) as { xAxis: { min: number } }
    expect(scatter.xAxis.min).toBe(axis.min)
  })
  it('uses round decades for an automatic long monthly series', () => {
    const dates = usInflationDemoTable.rows.map((row) => row.Дата)
    const labels = planCategoryDateLabels(dates, usInflationDemoTable, config)
    expect(labels.filter(Boolean)).toEqual(['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'])
    labels.forEach((label, index) => {
      if (label) expect((dates[index] as Date).getMonth()).toBe(0)
    })
  })

  it('waits for January rather than labeling a partial first year', () => {
    const table: DataTable = { name: 'partial first year', columns: ['Дата', 'Инфляция'], rows: Array.from({ length: 24 }, (_, index) => ({ Дата: new Date(2016, 3 + index, 1), Инфляция: index })) }
    const dates = table.rows.map((row) => row.Дата)
    const labels = planCategoryDateLabels(dates, table, { ...config, dateLabelFormat: 'year-full' })
    expect(labels[0]).toBe('')
    expect(labels[9]).toBe('2017')
    expect(labels[21]).toBe('2018')
    expect(labels.filter(Boolean)).toEqual(['2017', '2018'])
  })

  it.each(['line', 'step-line', 'area', 'bar', 'lollipop', 'waterfall'] as const)('%s applies a decade step once and keeps sparse year labels horizontal', (kind) => {
    const option = getChartPlugin(kind).buildOption(usInflationDemoTable, { ...config, kind, dateLabelFormat: 'year-full', dateAxisStepUnit: 'year', xAxisStep: 10 }) as { xAxis: { type: string; data: string[]; axisLabel: { customValues: number[]; interval(index: number): boolean; formatter(value: string | number, index: number): string; rotate: number; fontSize: number } } }
    const graphics = (option as unknown as { graphic: Array<{ id?: string; type?: string; style?: { text?: string } }> }).graphic
    const labels = (option.xAxis.type === 'time' ? option.xAxis.axisLabel.customValues.map((value, index) => option.xAxis.axisLabel.formatter(value, index)) : graphics.filter((item) => item.id?.startsWith('calendar-category:') && item.type === 'text').map((item) => item.style?.text ?? '')).filter((value) => /^\d{4}$/.test(value))
    expect(labels).toEqual(['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'])
    expect(option.xAxis.axisLabel.rotate).toBe(0)
    expect(option.xAxis.axisLabel.fontSize).toBe(config.xAxisLabelText?.size)
  })

  it('places calendar years independently of published key-rate dates and keeps original points', () => {
    const dates = keyRateDemoTable.rows.map((row) => row.Дата)
    const axis = planDateAxisTicks(dates, keyRateDemoTable, config)!
    expect(axis.ticks.map((tick) => tick.label)).toEqual(Array.from({ length: 6 }, (_, index) => String(2021 + index)))
    for (const tick of axis.ticks) {
      expect(new Date(tick.value).getMonth()).toBe(0)
      expect(new Date(tick.value).getDate()).toBe(1)
      expect(dates.some((day) => Number(day) === tick.value)).toBe(false)
    }
    const rateConfig = { ...config, kind: 'step-line' as const, yField: 'Ключевая ставка', yFields: ['Ключевая ставка'] }
    const option = getChartPlugin('step-line').buildOption(keyRateDemoTable, rateConfig) as { xAxis: { type: string; min: number; max: number; axisTick: { customValues: number[] }; axisLabel: { customValues: number[]; rotate: number } }; series: Array<{ name: string; data: Array<{ value: [number, number] }> }> }
    expect(option.xAxis.type).toBe('time')
    expect(option.xAxis.axisLabel.customValues).toEqual(axis.ticks.map((tick) => tick.value))
    expect(option.xAxis.axisTick.customValues).toEqual(option.xAxis.axisLabel.customValues)
    expect(option.xAxis.axisLabel.rotate).toBe(0)
    expect(option.series.find((series) => series.name === 'Ключевая ставка')!.data.map((point) => point.value)).toEqual(keyRateDemoTable.rows.map((row) => [Number(row.Дата), row['Ключевая ставка']]))
  })

  it('chooses an automatic step from calendar span even for two observations', () => {
    const dates = [new Date(2000, 0, 1), new Date(2025, 0, 1)]
    const table: DataTable = { name: 'sparse', columns: ['Дата', 'Инфляция'], rows: dates.map((Дата) => ({ Дата, Инфляция: 1 })) }
    const ticks = planDateAxisTicks(dates, table, { ...config, canvasWidth: 500 })!.ticks
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.length).toBeLessThanOrEqual(10)
    expect(ticks.map((tick) => tick.label)).toEqual(['2000', '2005', '2010', '2015', '2020', '2025'])
  })

  it('prevents repeated year labels with a finer requested interval', () => {
    const dates = Array.from({ length: 12 }, (_, month) => new Date(2025, month, 1))
    const ticks = planDateAxisTicks(dates, { name: '', columns: [], rows: [] }, { ...config, dateLabelFormat: 'year-full', dateAxisStepUnit: 'month', xAxisStep: 1 })!.ticks
    expect(ticks.map((tick) => tick.label)).toEqual(['2025'])
  })

  it.each(['line', 'spline', 'step-line', 'area', 'indexed-line', 'moving-average-line', 'range-line'] as const)('%s keeps observations across manual bounds and clips at the selected dates', (kind) => {
    const table: DataTable = { name: 'range', columns: ['Дата', 'Инфляция', 'Верхняя'], rows: [2000, 2010, 2020].map((year) => ({ Дата: new Date(year, 0, 1), Инфляция: 10, Верхняя: 20 })) }
    const setup = { ...config, kind, xAxisMin: '2005-01-01', xAxisMax: '2025-01-01', rangeLowerField: 'Инфляция', rangeUpperField: 'Верхняя', movingAverageWindow: 2, indexBaseXValue: `date:${new Date(2000, 0, 1).toISOString()}` }
    const scene = getChartPlugin(kind).compile(table, setup)
    expect('categories' in scene.plot && scene.plot.categories.length).toBe(3)
    const option = getChartPlugin(kind).buildOption(table, setup) as { xAxis: { type: string; min: number; max: number } }
    expect(option.xAxis).toMatchObject({ type: 'time', min: +new Date(2005, 0, 1), max: +new Date(2025, 0, 1) })
  })

  it.each(['bar', 'horizontal-bar', 'waterfall', 'lollipop', 'horizontal-lollipop', 'dumbbell', 'heatmap'] as const)('%s renders January marks between observed categories without adding rows', (kind) => {
    const table: DataTable = { name: 'holidays', columns: ['Дата', 'Инфляция', 'Другой'], rows: [new Date(2016, 11, 28), new Date(2017, 0, 9), new Date(2018, 0, 10)].map((Дата) => ({ Дата, Инфляция: 1, Другой: 2 })) }
    const setup = { ...config, kind, yFields: ['Инфляция', 'Другой'], dateLabelFormat: 'year-full' as const, xAxisStep: 1 }
    const ticks = planCategoryDateTicks(table.rows.map((row) => row.Дата), table, setup)!
    expect(ticks.map((tick) => tick.label)).toEqual(['2017', '2018'])
    expect(ticks[0].position).toBeGreaterThan(0)
    expect(ticks[0].position).toBeLessThan(1)
    const option = getChartPlugin(kind).buildOption(table, setup) as { graphic: Array<{ id?: string; type?: string; style?: { text?: string } }> }
    const axes = option as unknown as Record<string, { type: string; axisLabel: { customValues: number[]; formatter(value: number): string } }>
    const axis = axes.xAxis.type === 'time' ? axes.xAxis : axes.yAxis
    expect(axis.type).toBe('time')
    expect(axis.axisLabel.customValues.map((value) => axis.axisLabel.formatter(value))).toEqual(['2017', '2018'])
    expect(table.rows).toHaveLength(3)
  })

  it.each(['scatter', 'connected-scatter', 'bubble'] as const)('%s applies a calendar step and anchor to its time axis', (kind) => {
    const table: DataTable = { name: 'years', columns: ['Дата', 'Инфляция'], rows: [2000, 2025].map((year) => ({ Дата: new Date(year, 0, 1), Инфляция: year })) }
    const option = getChartPlugin(kind).buildOption(table, { ...config, kind, dateLabelFormat: 'year-full', dateAxisStepUnit: 'year', dateAxisAnchor: '2005-01-01', xAxisStep: 10 }) as { xAxis: { axisLabel: { customValues: number[]; formatter(value: number): string; rotate: number }; axisTick: { customValues: number[] } } }
    expect(option.xAxis.axisLabel.customValues.map((value) => option.xAxis.axisLabel.formatter(value))).toEqual(['2005', '2015', '2025'])
    expect(option.xAxis.axisTick.customValues).toEqual(option.xAxis.axisLabel.customValues)
    expect(option.xAxis.axisLabel.rotate).toBe(0)
  })

  it.each(['line', 'area', 'step-line'] as const)('%s breaks missing calendar periods in both visible and hover layers', (kind) => {
    const table: DataTable = { name: 'missing February', columns: ['Дата', 'Инфляция'], rows: [{ Дата: new Date(2025, 0, 1), Инфляция: 1 }, { Дата: new Date(2025, 2, 1), Инфляция: 3 }], timeProfiles: { Дата: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' } } }
    const option = getChartPlugin(kind).buildOption(table, { ...config, kind, missingMode: 'gap' }) as { series: Array<{ name: string; data: Array<{ value: [number, number | null] }> }> }
    for (const series of option.series.filter((series) => series.name === 'Инфляция' || series.name === '__hit__:Инфляция')) {
      expect(series.data.map((point) => point.value)).toEqual([[+new Date(2025, 0, 1), 1], [+new Date(2025, 1, 1), null], [+new Date(2025, 2, 1), 3]])
    }
    const connected = getChartPlugin(kind).buildOption(table, { ...config, kind, missingMode: 'connect' }) as typeof option
    expect(connected.series.find((series) => series.name === 'Инфляция')!.data).toHaveLength(2)
    expect(table.rows).toHaveLength(2)
  })
})
