import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartElementColor, chartValueLabelSelections, getChartPlugin } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import { lineAreaFixtures } from '../../../test-fixtures/charts/lineArea'
import { seasonalTrendConfig, seasonalTrendTable } from '../../../test-fixtures/charts/specializedTrends'
import { indexedTrendConfig, indexedTrendTable } from '../../../test-fixtures/charts/specializedTrends'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { NATIVE_LINE_KINDS } from '../../chart-types/line/compiler'
import { NATIVE_AREA_KINDS } from '../../chart-types/area/compiler'
import { renderScene } from './renderScene'
import { nativeMarkSelections } from '../../../entities/chart/model/sceneVisitors'

function resolve(kind: 'bar' | 'line' | 'area', categories: Array<string | Date>, overrides: Partial<ChartConfig> = {}) {
  const source = lineAreaFixtures[0]
  const table: DataTable = { name: 'axis-alignment', columns: ['period', 'first'], rows: categories.map((period, index) => ({ period, first: index + 1 })) }
  const scene = getChartPlugin(kind).compile(table, { ...source.config, kind, ...overrides })
  if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
  return resolveNativeCartesianScene(scene)
}

describe('native ECharts line and area adapter', () => {
  it.each([...NATIVE_LINE_KINDS, ...NATIVE_AREA_KINDS])('%s never reaches the legacy builder', (kind) => {
    const fixture = lineAreaFixtures[10]
    const table = kind === 'seasonal-line' ? { ...fixture.table, rows: [...fixture.table.rows, ...fixture.table.rows.map((row) => ({ ...row, period: new Date((row.period as Date).getFullYear() + 1, (row.period as Date).getMonth(), 1) }))] } : fixture.table
    const plugin = getChartPlugin(kind), original = plugin.buildOption
    plugin.buildOption = () => { throw new Error('legacy builder reached') }
    try {
      const config = { ...fixture.config, kind, showValues: true, ...(kind === 'indexed-line' ? { indexBaseXValue: `date:${(table.rows[0].period as Date).toISOString()}` } : {}), ...(kind === 'seasonal-line' ? { seasonalAccentYears: ['2026'] } : {}) }
      const scene = plugin.compile(table, config)
      expect(() => renderScene(scene)).not.toThrow()
      const selections = scene.migrationMode === 'native' ? nativeMarkSelections(scene) : []
      expect(selections).not.toHaveLength(0)
      expect(chartElementColor(table, config, selections[0].legacyKey)).toBeTruthy()
      expect(chartValueLabelSelections(table, config)).not.toHaveLength(0)
    } finally { plugin.buildOption = original }
  })

  it('dispatches from semantic plot kind and preserves authoritative geometry', () => {
    const source = lineAreaFixtures[16]
    const scene = getChartPlugin(source.config.kind).compile(source.table, source.config)
    if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
    const resolved = resolveNativeCartesianScene(scene)
    const option = renderScene(resolved) as { grid: Record<string, number | boolean>; xAxis: { boundaryGap: boolean }; series: Array<{ areaStyle?: unknown }> }
    expect(option.grid).toEqual({ left: resolved.geometry.plot.x, top: resolved.geometry.plot.y, right: resolved.geometry.canvas.width - resolved.geometry.plot.x - resolved.geometry.plot.width, bottom: resolved.geometry.canvas.height - resolved.geometry.plot.y - resolved.geometry.plot.height, containLabel: false })
    expect(option.xAxis.boundaryGap).toBe(false)
    expect(option.series[0].areaStyle).toBeTruthy()
  })

  it('anchors Bar and Line left value-label rails to the same document edge', () => {
    const bar = resolve('bar', ['Alpha', 'Beta', 'Gamma'])
    const line = resolve('line', ['Alpha', 'Beta', 'Gamma'])
    expect(line.geometry.axes.value.x).toBe(bar.geometry.axes.value.x)
    expect(line.geometry.axes.value.x).toBe(line.geometry.content.x)
  })

  it.each([
    ['bottom', 'left'],
    ['top', 'left'],
    ['bottom', 'right'],
  ] as const)('keeps point-axis edge overflow local with X %s and Y %s', (xAxisPosition, yAxisPosition) => {
    const scene = resolve('line', ['A very long first date label', 'Middle', 'A very long final date label'], { xAxisPosition, yAxisPosition })
    expect(scene.geometry.reservations['axis:category-edge-left']).toBeUndefined()
    expect(scene.geometry.reservations['axis:category-edge']).toBeUndefined()
    if (yAxisPosition === 'left') expect(scene.geometry.axes.value.x).toBe(scene.geometry.content.x)
    else expect(scene.geometry.axes.value.x + scene.geometry.axes.value.width).toBe(scene.geometry.content.x + scene.geometry.content.width)
    for (const category of scene.plot.categories) {
      const bounds = scene.geometry.elements[`category-label:${category.id}`]
      expect(bounds.x).toBeGreaterThanOrEqual(scene.geometry.content.x)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(scene.geometry.content.x + scene.geometry.content.width)
    }
  })

  it.each([
    ['short', ['A', 'B', 'C'], {}],
    ['long dates', [new Date(2025, 0, 1), new Date(2025, 1, 1), new Date(2025, 11, 1)], { dateLabelFormat: 'month-context-ru' }],
    ['multiline', ['First\nline', 'Middle', 'Last\nline'], { xAxisLabelOverflow: 'wrap' }],
    ['rotated', ['First category', 'Middle category', 'Last category'], { xAxisLabelRotate: 45 }],
  ] as const)('does not let %s X labels move the Y rail or plot origin', (_name, categories, overrides) => {
    const reference = resolve('line', ['A', 'B', 'C'])
    const scene = resolve('line', [...categories], overrides)
    expect(scene.geometry.axes.value.x).toBe(reference.geometry.axes.value.x)
    expect(scene.geometry.plot.x).toBe(reference.geometry.plot.x)
  })

  it('uses the same shared edge contract for Area and keeps value labels rail-aligned', () => {
    for (const kind of ['line', 'area'] as const) {
      const scene = resolve(kind, ['Long first category', 'Middle', 'Long last category'])
      const option = renderScene(scene) as { grid: { left: number }; yAxis: { axisLabel: { align: string } } }
      expect(scene.geometry.axes.value.x).toBe(scene.geometry.content.x)
      expect(option.grid.left).toBe(scene.geometry.plot.x)
      expect(option.yAxis.axisLabel.align).toBe('right')
    }
  })

  it('renders Seasonal presentation and direct identification from semantic fields', () => {
    const scene = getChartPlugin('seasonal-line').compile(seasonalTrendTable, { ...seasonalTrendConfig, showLegend: false, showDirectLabels: true })
    if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
    const option = renderScene(scene) as { series: Array<{ name: string; z?: number; lineStyle?: { color?: string; opacity?: number }; endLabel?: { formatter?: string } }> }
    expect(option.series.find((series) => series.name === '2023')).toMatchObject({ lineStyle: { color: '#d9d7df', opacity: .45 } })
    expect(option.series.find((series) => series.name === '2024')).toMatchObject({ z: 1001, lineStyle: { color: seasonalTrendConfig.color, opacity: 1 }, endLabel: { formatter: '{name|2024}' } })
    expect(option.series.find((series) => series.name === '2023')?.endLabel).toBeUndefined()
  })

  it('renders indexed values consistently in marks, labels, tooltip metadata, and zero line', () => {
    const scene = getChartPlugin('indexed-line').compile(indexedTrendTable, { ...indexedTrendConfig, showValues: true, showZeroLine: true })
    if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
    const option = renderScene(scene) as { series: Array<{ name: string; markLine?: unknown; data: Array<{ value?: number | null; displayValue?: string; label?: { formatter?: string } }> }> }
    const series = option.series.find((item) => item.name === 'value')!
    expect(series.data.map((point) => point.value)).toEqual([100, 150, null, 50])
    expect(series.data[0]).toMatchObject({ displayValue: '100', label: { formatter: '100' } })
    expect(series.markLine).toBeTruthy()
  })

  it('renders legend labels from the semantic guide without changing series identity', () => {
    const scene = getChartPlugin('indexed-line').compile(indexedTrendTable, { ...indexedTrendConfig, showLegend: true, showDirectLabels: false, seriesStyles: { value: { legendLabel: 'Индекс' } } })
    if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
    const option = renderScene(scene) as { legend: { formatter: (name: string) => string }; series: Array<{ name: string }> }
    expect(option.series.some((series) => series.name === 'value')).toBe(true)
    expect(option.legend.formatter('value')).toBe('Индекс')
  })

  it('renders a generic categorical group item without a fake series or Seasonal config', () => {
    const scene = getChartPlugin('indexed-line').compile(indexedTrendTable, { ...indexedTrendConfig, showLegend: true, showDirectLabels: false })
    if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
    if (scene.plot.kind !== 'line') throw new Error('Expected native line plot')
    const guide = scene.guides.find((item) => item.kind === 'categorical-legend')!
    guide.items = [{ id: 'legend:group:test', label: 'Группа', visible: true, color: '#778899', target: { kind: 'group', seriesIds: [scene.plot.series[0].id] } }]
    const option = renderScene(scene) as { legend: { data: Array<{ name: string }> }; graphic: Array<{ id?: string; children?: Array<{ style?: { fill?: string; text?: string } }> }>; series: Array<{ name: string }> }
    expect(option.legend.data).toEqual([])
    expect(option.graphic).toContainEqual(expect.objectContaining({
      id: 'categorical-legend:legend:group:test',
      children: expect.arrayContaining([
        expect.objectContaining({ style: expect.objectContaining({ stroke: '#778899' }) }),
        expect.objectContaining({ style: expect.objectContaining({ text: 'Группа' }) }),
      ]),
    }))
    expect(option.series.some((series) => series.name === 'Группа' || series.name === 'legend:group:test')).toBe(false)
  })

  it('keeps semantic compilers free from renderer and ECharts imports', () => {
    const line = readFileSync(new URL('../../chart-types/line/compiler.ts', import.meta.url), 'utf8')
    const area = readFileSync(new URL('../../chart-types/area/compiler.ts', import.meta.url), 'utf8')
    expect(`${line}\n${area}`).not.toMatch(/echarts|renderLineAreaScene|buildOption/)
    const renderer = readFileSync(new URL('./renderLineAreaScene.ts', import.meta.url), 'utf8')
    expect(renderer).not.toMatch(/compatibilityConfig\.kind|seasonalAccentYears|seasonal-line/)
    const layout = readFileSync(new URL('../../chart-types/bar/layout.ts', import.meta.url), 'utf8')
    expect(layout).not.toMatch(/seasonalAccentYears|seasonal-line/)
  })

  it('keeps migrated specialized families explicitly native', () => {
    expect(getChartPlugin('slope').compilerMode).toBe('native')
    for (const kind of ['range-line', 'step-range-line', 'confidence-line'] as const) expect(getChartPlugin(kind).compilerMode).toBe('native')
    expect(getChartPlugin('scatter').compilerMode).toBe('native')
    expect(getChartPlugin('waterfall').compilerMode).toBe('native')
    expect(getChartPlugin('butterfly').compilerMode).toBe('native')
  })
})
