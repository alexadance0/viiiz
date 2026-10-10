import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartElementColor, chartValueLabelSelections, getChartPlugin } from '../../../core/chartRegistry'
import { barFixtures } from '../../../test-fixtures/charts/bar'
import { resolveNativeBarScene } from '../../chart-types/bar/layout'
import { NATIVE_BAR_KINDS } from '../../chart-types/bar/compiler'
import { renderScene } from './renderScene'

describe('native ECharts bar adapter', () => {
  it.each(['bar', 'horizontal-bar', 'stacked-bar'] as const)('%s places dates by elapsed time in native bars and custom label layers', (kind) => {
    const source = barFixtures[0]
    const dates = [new Date(1950, 0, 1), new Date(2010, 0, 1), new Date(2025, 0, 1)]
    const table = { name: 'Uneven dates', columns: ['Date', 'Value'], rows: dates.map((Date, index) => ({ Date, Value: index + 1 })) }
    const option = getChartPlugin(kind).buildOption(table, { ...source.config, kind, xField: 'Date', yField: 'Value', yFields: ['Value'], seriesField: '', showValues: true, barValueLabelAbsorption: true, barBorderWidth: 1, dateLabelFormat: 'year-full', xAxisStep: 10 }) as {
      xAxis: { type: string; min: number; max: number }
      yAxis: { type: string; min: number; max: number }
      series: Array<{ name: string; data: Array<{ value: number[] }> }>
    }
    expect(kind === 'horizontal-bar' ? option.yAxis : option.xAxis).toMatchObject({ type: 'time', min: +dates[0], max: +dates[2] })
    expect(option.series[0].data.map((point) => point.value[0])).toEqual(dates.map(Number))
    for (const series of option.series.filter((item) => item.name.startsWith('__native-bar:') || item.name.startsWith('__bar-value-labels:'))) {
      expect(series.data.every((point) => dates.some((date) => +date === point.value[0]))).toBe(true)
    }
  })

  it('uses resolved Viiiz geometry as an authoritative containLabel-free grid', () => {
    const source = barFixtures.find((fixture) => fixture.name === 'both non-default sides')!
    const scene = getChartPlugin('bar').compile(source.table, source.config)
    const resolved = resolveNativeBarScene(scene)
    const option = renderScene(resolved) as { grid: { left: number; top: number; right: number; bottom: number; containLabel: boolean } }
    expect(option.grid).toEqual({ left: resolved.geometry.plot.x, top: resolved.geometry.plot.y, right: resolved.geometry.canvas.width - resolved.geometry.plot.x - resolved.geometry.plot.width, bottom: resolved.geometry.canvas.height - resolved.geometry.plot.y - resolved.geometry.plot.height, containLabel: false, outerBoundsMode: 'none' })
    expect(resolved.geometry.reservations).toHaveProperty('axis:category')
    expect(resolved.geometry.reservations).toHaveProperty('axis:value')
  })

  it.each(NATIVE_BAR_KINDS)('%s compiles, renders and serves helpers when buildOption throws', (kind) => {
    const source = barFixtures[2]
    const plugin = getChartPlugin(kind)
    const original = plugin.buildOption
    plugin.buildOption = () => { throw new Error('legacy builder reached') }
    try {
      const config = { ...source.config, kind }
      expect(() => renderScene(plugin.compile(source.table, config))).not.toThrow()
      expect(chartElementColor(source.table, config, `first\u001fstring:Alpha`)).toBeTruthy()
      expect(chartValueLabelSelections(source.table, config)).not.toHaveLength(0)
    } finally { plugin.buildOption = original }
  })

  it('constrains horizontal wrap to the category rail and gives truncation a width', () => {
    const source = barFixtures[0]
    const plugin = getChartPlugin('horizontal-bar')
    const resolved = resolveNativeBarScene(plugin.compile(source.table, { ...source.config, kind: 'horizontal-bar', xAxisLabelOverflow: 'wrap' }))
    const option = renderScene(resolved) as { yAxis: { axisLabel: { width?: number; formatter: (value: string, index: number) => string } } }
    expect(option.yAxis.axisLabel.width).toBeUndefined()
    expect(option.yAxis.axisLabel.formatter('', 0)).toBe(resolved.plot.categories[0].label)
    const truncated = renderScene(getChartPlugin('bar').compile(source.table, { ...source.config, xAxisLabelOverflow: 'truncate' })) as { xAxis: { axisLabel: { width: number; overflow: string } } }
    expect(truncated.xAxis.axisLabel.width).toBeGreaterThan(0)
    expect(truncated.xAxis.axisLabel.overflow).toBe('truncate')
  })

  it.each(['inside-top', 'inside-bottom'] as const)('anchors horizontal %s labels within the bar edge', (position) => {
    const source = barFixtures[0]
    const option = renderScene(getChartPlugin('horizontal-bar').compile(source.table, { ...source.config, kind: 'horizontal-bar', barOrientation: 'horizontal', showValues: true, valueLabelPosition: position, palette: ['#fff'], barFillOpacity: .1 })) as { series: Array<{ data: Array<{ label: { align: string; color: string } }> }> }
    expect(option.series[0].data[0].label).toMatchObject({ align: position === 'inside-top' ? 'right' : 'left', color: '#202027' })
  })

  it('suppresses native emphasis labels when a separate absorbed layer owns the values', () => {
    const source = barFixtures[0]
    const option = renderScene(getChartPlugin('bar').compile(source.table, { ...source.config, showValues: true, barValueLabelAbsorption: true, showDirectLabels: true })) as { series: Array<{ name: string; data: Array<{ label?: { show?: boolean }; emphasis?: { label: { show?: boolean } } }> }> }
    expect(option.series[0].data.every((point) => !point.label?.show && !point.emphasis?.label.show)).toBe(true)
    expect(option.series.some((series) => series.name.startsWith('__bar-value-labels:'))).toBe(true)
    expect(option.series.some((series) => series.name.startsWith('__bar-direct-label:'))).toBe(true)
  })

  it('keeps the semantic compiler free from renderer and ECharts imports', () => {
    const source = readFileSync(new URL('../../chart-types/bar/compiler.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/echarts|renderBarScene|buildOption/)
  })

  it('renders the complete direct-series guide from semantic label intent', () => {
    const source = barFixtures.find((fixture) => fixture.name === 'direct labels')!
    const config = { ...source.config, showDirectLabelLines: true, seriesStyles: { ...source.config.seriesStyles, first: { legendLabel: 'Primary', legendNote: 'Latest value' } } }
    const option = renderScene(getChartPlugin('bar').compile(source.table, config)) as {
      series: Array<{ data: Array<{ label?: { formatter?: string } }> }>
      graphic: Array<{ id?: string }>
    }
    expect(option.series[0].data.at(-1)?.label?.formatter).not.toBe('Primary\nLatest value')
    expect(option.series.some((series) => series.data.some((point) => (point as { directLegendLabel?: boolean }).directLegendLabel))).toBe(true)
    expect(option.graphic.some((item) => item.id?.startsWith('direct-guide-line:'))).toBe(true)
  })

  it('derives value-label text alignment from placement instead of text style', () => {
    const source = barFixtures[0]
    const option = renderScene(getChartPlugin('bar').compile(source.table, { ...source.config, showValues: true, valueLabelPosition: 'top', valueText: { ...source.config.valueText, align: 'left' } })) as { series: Array<{ label: { align: string; verticalAlign: string } }> }
    expect(option.series[0].label).toMatchObject({ align: 'center', verticalAlign: 'bottom' })
  })
})
