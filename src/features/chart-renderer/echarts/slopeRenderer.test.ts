import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartElementColor, chartValueLabelSelections, getChartPlugin } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import type { NativeSlopeChartScene } from '../../../entities/chart/model/ChartScene'
import { nativeMarkSelections } from '../../../entities/chart/model/sceneVisitors'
import { slopeConfig, slopeTable } from '../../../test-fixtures/charts/slope'
import { resolveNativeSlopeScene } from '../../chart-types/slope/layout'
import { renderScene } from './renderScene'

type RenderedSlope = {
  grid: { left: number; top: number; right: number; bottom: number; containLabel: boolean }
  legend: { show: boolean }
  graphic: Array<{ id?: string; type?: string; style?: { text?: string; align?: string; fill?: string } }>
  xAxis: { position: string; boundaryGap: boolean; data: string[]; axisLabel?: { align?: string } }
  yAxis: { position: string; axisLabel: { show: boolean } }
  series: Array<{ name: string; type: string; data: Array<{ label?: { show?: boolean; formatter?: string; position?: string } }> }>
  tooltip: { formatter: (input: unknown) => string }
}

const nativeSlope = (overrides: Partial<ChartConfig> = {}) => {
  const scene = getChartPlugin('slope').compile(slopeTable, slopeConfig(overrides))
  if (scene.plot.kind !== 'slope') throw new Error('Expected native Slope scene')
  return scene as NativeSlopeChartScene
}

describe('native ECharts Slope adapter', () => {
  it('dispatches by semantic plot kind and renders authoritative geometry', () => {
    const resolved = resolveNativeSlopeScene(nativeSlope({ xAxisPosition: 'top', yAxisPosition: 'right' }))
    const option = renderScene(resolved) as unknown as RenderedSlope
    expect(option.grid).toEqual({
      left: resolved.geometry.plot.x, top: resolved.geometry.plot.y,
      right: resolved.geometry.canvas.width - resolved.geometry.plot.x - resolved.geometry.plot.width,
      bottom: resolved.geometry.canvas.height - resolved.geometry.plot.y - resolved.geometry.plot.height,
      containLabel: false,
    })
    expect(option.xAxis).toMatchObject({ position: 'top', boundaryGap: true })
    expect(option.yAxis).toMatchObject({ position: 'right', axisLabel: { show: false } })
    expect(option.legend.show).toBe(false)
  })

  it('renders labels and local guides without a fake semantic or renderer guide series', () => {
    const scene = nativeSlope({ showHorizontalGrid: true, showVerticalGrid: true, showXAxisLine: true, slopeShowYAxis: true })
    expect(scene.guides).toEqual([])
    expect(scene.plot.series.map((series) => series.name)).toEqual(['actual', 'plan', 'risk'])
    const option = renderScene(scene) as unknown as RenderedSlope
    expect(option.series.some((series) => series.name === '__slope-guides__')).toBe(false)
    expect(option.graphic.some((item) => item.id?.startsWith('slope-guide:h:'))).toBe(true)
    expect(option.graphic.some((item) => item.id?.startsWith('slope-guide:v:'))).toBe(true)
    expect(option.graphic.some((item) => item.id === 'slope-axis:x')).toBe(true)
    expect(option.graphic.some((item) => item.id?.startsWith('slope-scale:'))).toBe(true)
    expect(option.series.find((series) => series.name === 'actual')?.data.every((point) => point.label?.show === false)).toBe(true)
    expect(option.graphic.filter((item) => item.id?.startsWith('slope-label:')).map((item) => item.style?.text)).toEqual(expect.arrayContaining(['12', '24 actual']))
  })

  it('keeps internal scale affixes scoped to the configured edges', () => {
    const option = renderScene(nativeSlope({ slopeShowYAxis: true, numberPrefix: '$', numberSuffix: 'm', yAxisAffixScope: 'edges', yAxisMin: 0, yAxisMax: 30, yAxisStep: 10 })) as unknown as RenderedSlope
    const texts = option.graphic.filter((item) => item.id?.startsWith('slope-scale:')).map((item) => item.style?.text)
    expect(texts).toEqual(['$0m', '10', '20', '$30m'])
  })

  it('keeps missing endpoint labels and connectors faithful to null values', () => {
    const table: DataTable = { name: 'missing', columns: ['period', 'start', 'end', 'both'], rows: [
      { period: 'A', start: null, end: 2, both: null }, { period: 'B', start: 1, end: null, both: null },
    ] }
    const config = slopeConfig({ yFields: ['start', 'end', 'both'] })
    const scene = getChartPlugin('slope').compile(table, config)
    const option = renderScene(scene) as unknown as RenderedSlope
    const texts = option.graphic.filter((item) => item.id?.startsWith('slope-label:')).map((item) => item.style?.text)
    expect(texts).toEqual(expect.arrayContaining(['2', '1 start']))
    expect(texts).not.toContain('both')
  })

  it('keeps fake hit targets out of tooltip output', () => {
    const option = renderScene(nativeSlope({ numberPrefix: '<', numberSuffix: '&' })) as unknown as RenderedSlope
    const formatter = option.tooltip.formatter
    expect(formatter([
      { seriesName: 'actual', data: { displayCategory: '<A>', displayValue: '<12&' } },
      { seriesName: '__hit__:actual', data: { displayCategory: '<A>', displayValue: '<12&' } },
    ])).toBe('<b>&lt;A&gt;</b><br/>actual: <b>&lt;12&amp;</b><br/>Изменение: <b>+&lt;12&amp;</b>')
  })

  it('renders endpoint ownership, leaders, change labels, and centered category labels as semantic graphics', () => {
    const crowded: DataTable = { name: 'crowded', columns: ['period', 'one', 'two'], rows: [
      { period: 'A', one: 10, two: 10 }, { period: 'B', one: 20, two: 20 },
    ] }
    const scene = getChartPlugin('slope').compile(crowded, slopeConfig({ yFields: ['one', 'two'], slopeShowChange: true, slopeColorByChange: true }))
    const option = renderScene(scene) as unknown as RenderedSlope
    expect(option.series.filter((item) => !item.name.startsWith('__')).every((item) => !('labelLayout' in item))).toBe(true)
    expect(option.series.filter((item) => !item.name.startsWith('__')).every((item) => item.data.every((point) => point.label?.show === false))).toBe(true)
    expect(option.graphic.some((item) => item.id?.startsWith('slope-label-leader:'))).toBe(true)
    expect(option.graphic.filter((item) => item.id?.startsWith('slope-change:'))).toHaveLength(2)
    expect(option.xAxis.axisLabel?.align).toBe('center')
  })

  it('never reaches the legacy Slope builder through compile, render, visitors, or compatibility helpers', () => {
    const plugin = getChartPlugin('slope'), legacy = plugin.buildOption
    plugin.buildOption = () => { throw new Error('legacy builder reached') }
    try {
      const config = slopeConfig(), scene = plugin.compile(slopeTable, config)
      expect(() => renderScene(scene)).not.toThrow()
      const marks = nativeMarkSelections(scene)
      expect(marks).toHaveLength(6)
      expect(chartElementColor(slopeTable, config, marks[0].legacyKey)).toBeTruthy()
      expect(chartValueLabelSelections(slopeTable, config)).toHaveLength(6)
    } finally { plugin.buildOption = legacy }
  })

  it.each([
    ['line', {}], ['area', {}],
    ['seasonal-line', { seasonalAccentYears: ['2025'] }],
    ['indexed-line', { indexBaseXValue: `date:${new Date(2025, 0, 1).toISOString()}` }],
  ] as const)('supports native %s → slope → %s without semantic leakage', (kind, extra) => {
    const table: DataTable = { name: 'native-transition', columns: ['period', 'actual'], rows: [
      { period: new Date(2025, 0, 1), actual: 10 }, { period: new Date(2025, 1, 1), actual: 20 },
    ] }
    const source = slopeConfig({ kind, xField: 'period', yField: 'actual', yFields: ['actual'], showLegend: true, showDirectLabels: true, slopeShowChange: true, slopeColorByChange: true, ...extra } as Partial<ChartConfig>)
    const middle = getChartPlugin('slope').compile(table, { ...source, kind: 'slope' })
    const after = getChartPlugin(kind).compile(table, source)
    expect(middle.plot.kind).toBe('slope')
    expect(middle.plot.kind === 'slope' && middle.plot.series[0].change).toMatchObject({ showLabel: true, colorByDirection: true })
    expect(after.plot.kind).not.toBe('slope')
    expect(source).toMatchObject({ showLegend: true, showDirectLabels: true })
  })

  it.each(['scatter'] as const)('supports slope → native %s → slope', (kind) => {
    const legacyConfig = slopeConfig({ kind, rangeLowerField: 'actual', rangeUpperField: 'plan' })
    const first = nativeSlope(), relationship = getChartPlugin(kind).compile(slopeTable, legacyConfig), last = nativeSlope()
    expect([first.plot.kind, relationship.plot.kind, last.plot.kind]).toEqual(['slope', 'xy', 'slope'])
    expect((renderScene(first) as unknown as RenderedSlope).graphic.some((item) => item.id?.startsWith('slope-'))).toBe(true)
    expect((renderScene(last) as unknown as RenderedSlope).series.some((series) => series.name === '__slope-guides__')).toBe(false)
  })

  it('keeps compiler/layout semantic and generic-shell boundaries clean', () => {
    const compiler = readFileSync(new URL('../../chart-types/slope/compiler.ts', import.meta.url), 'utf8')
    const layout = readFileSync(new URL('../../chart-types/slope/layout.ts', import.meta.url), 'utf8')
    const renderer = readFileSync(new URL('./renderSlopeScene.ts', import.meta.url), 'utf8')
    const lineRenderer = readFileSync(new URL('./renderLineAreaScene.ts', import.meta.url), 'utf8')
    const canvas = readFileSync(new URL('../../../components/ChartCanvas.tsx', import.meta.url), 'utf8')
    expect(`${compiler}\n${layout}`).not.toMatch(/echarts|zrender|EChartsOption|renderItem|boundaryGap|labelLayout|symbolSize|itemStyle|lineStyle|zlevel/)
    expect(compiler).not.toMatch(/renderSlopeScene|buildOption/)
    expect(renderer).not.toMatch(/prepareSlopeComparison|slopeXValues/)
    expect(renderer).not.toMatch(/labelLayout|moveOverlap/)
    expect(lineRenderer).not.toMatch(/plot\.kind === ['"]slope|compatibilityConfig\.kind === ['"]slope/)
    expect(canvas).not.toMatch(/kind === ['"]slope|kind !== ['"]slope/)
  })
})
