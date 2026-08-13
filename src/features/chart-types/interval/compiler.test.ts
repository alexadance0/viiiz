import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { nativeMarkSelections, nativePointSeries } from '../../../entities/chart/model/sceneVisitors'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resolveNativeCartesianScene } from '../bar/layout'
import { compileNativeIntervalScene, NATIVE_INTERVAL_KINDS } from './compiler'
import { demoTable } from '../../../core/demoData'

const table: DataTable = { name: 'interval', columns: ['period', 'main', 'low', 'high', 'other'], rows: [
  { period: 'A', main: 3, low: 1, high: 5, other: 20 },
  { period: 'B', main: 5, low: 3, high: 7, other: 30 },
  { period: 'C', main: 9, low: 4, high: 8, other: 40 },
] }
const config = (kind: ChartConfig['kind'], overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'period', yField: 'main', yFields: ['main', 'low', 'high'], rangeLowerField: 'low', rangeUpperField: 'high', ...overrides })

describe('native interval compiler', () => {
  it('classifies exactly the three interval variants as native', () => {
    expect(NATIVE_INTERVAL_KINDS).toEqual(['range-line', 'step-range-line', 'confidence-line'])
    for (const kind of NATIVE_INTERVAL_KINDS) expect(getChartPlugin(kind).compilerMode).toBe('native')
    expect(getChartPlugin('scatter').compilerMode).toBe('native')
  })

  it('compiles Range with unique real source series, stable group/layer IDs and no seriesField', () => {
    const first = compileNativeIntervalScene(table, config('range-line', { seriesField: 'period', intervalFillMode: 'custom', intervalFillColor: '#db5a5a' }))
    const changed = compileNativeIntervalScene(table, config('range-line', { intervalFillOpacity: .7, canvasWidth: 700 }))
    expect(first.plot).toMatchObject({ kind: 'interval', variant: 'range' })
    expect(first.plot.series.map((series) => series.name)).toEqual(['low', 'high'])
    expect(first.plot.groups[0].id).toBe(changed.plot.groups[0].id)
    expect(first.plot.groups[0].bandLayerId).toBe(changed.plot.groups[0].bandLayerId)
    expect(first.plot.bands[0].cells.every((cell) => cell.fillColor === '#db5a5a')).toBe(true)
    expect(JSON.stringify(first.plot)).not.toMatch(/renderItem|areaStyle|itemStyle|zlevel|"stack"|"type":"custom"/)
  })

  it('preserves all crossing parts in a long date series', () => {
    const scene = compileNativeIntervalScene(demoTable, config('range-line', { xField: 'day', yField: 'plan', yFields: ['plan', 'revenue'], rangeLowerField: 'plan', rangeUpperField: 'revenue' }))
    expect(scene.plot.bands[0].cells.length).toBeGreaterThan(demoTable.rows.length - 1)
    expect(scene.plot.bands[0].cells.some((cell) => cell.fromT > 0 || cell.toT < 1)).toBe(true)
    expect(scene.plot.bands[0].cells.every((cell) => Number.isFinite(cell.startTop) && Number.isFinite(cell.endTop))).toBe(true)
  })

  it('keeps confidence bounds in domain/bands while visibility controls guides and visitors', () => {
    const hidden = compileNativeIntervalScene(table, config('confidence-line', { showLegend: true, showDirectLabels: true }))
    expect(hidden.plot.series.filter((series) => series.visible).map((series) => series.name)).toEqual(['main'])
    expect(hidden.plot.valueDomain.max).toBeGreaterThanOrEqual(8)
    expect(hidden.plot.bands[0].cells).toHaveLength(1)
    expect(nativePointSeries(hidden).map((series) => series.name)).toEqual(['main'])
    expect(nativeMarkSelections(hidden)).toHaveLength(3)
    const shown = compileNativeIntervalScene(table, config('confidence-line', { intervalGroups: [{ main: 'main', lower: 'low', upper: 'high', showBounds: true }] }))
    expect(shown.plot.series.filter((series) => series.visible).map((series) => series.name)).toEqual(['main', 'low', 'high'])
    expect(shown.plot.series.find((series) => series.name === 'low')).toMatchObject({ marker: { visible: false }, stroke: { color: shown.plot.series[0].color, width: 1.25, type: 'dashed', opacity: .58 } })
    expect(nativeMarkSelections(shown)).toHaveLength(9)
  })

  it('deduplicates reused fields, supports automatic groups and ignores incomplete trailing triples', () => {
    const scene = compileNativeIntervalScene(table, config('confidence-line', { yFields: ['main', 'low', 'high', 'other'] }))
    expect(scene.plot.groups).toHaveLength(1)
    expect(new Set(scene.plot.series.map((series) => series.id)).size).toBe(scene.plot.series.length)
  })

  it('keeps group identities stable across reorder and style changes', () => {
    const extra: DataTable = { ...table, columns: [...table.columns, 'main2', 'low2', 'high2'], rows: table.rows.map((row, index) => ({ ...row, main2: 20 + index, low2: 18 + index, high2: 23 + index })) }
    const groups = [{ main: 'main', lower: 'low', upper: 'high' }, { main: 'main2', lower: 'low2', upper: 'high2' }]
    const first = compileNativeIntervalScene(extra, config('confidence-line', { intervalGroups: groups }))
    const reordered = compileNativeIntervalScene(extra, config('confidence-line', { intervalGroups: [...groups].reverse(), intervalFillOpacity: .6 }))
    expect(new Set(reordered.plot.groups.map((group) => group.id))).toEqual(new Set(first.plot.groups.map((group) => group.id)))
    expect(reordered.plot.groups.map((group) => group.id)).toEqual([...first.plot.groups.map((group) => group.id)].reverse())
  })

  it('builds bands from prepared missing/percent values without connect bridging gaps', () => {
    const gaps: DataTable = { name: 'gaps', columns: ['period', 'low', 'high'], rows: [{ period: 'A', low: 1, high: 3 }, { period: 'B', low: null, high: 4 }, { period: 'C', low: 2, high: 5 }] }
    for (const missingMode of ['gap', 'connect'] as const) expect(compileNativeIntervalScene(gaps, config('range-line', { yField: 'low', yFields: ['low', 'high'], missingMode })).plot.bands[0].cells).toEqual([])
    const zero = compileNativeIntervalScene(gaps, config('range-line', { yField: 'low', yFields: ['low', 'high'], missingMode: 'zero' }))
    expect(zero.plot.bands[0].cells).toHaveLength(2)
    const percent = compileNativeIntervalScene(table, config('range-line', { valueMode: 'percent' }))
    expect(percent.plot.bands[0].cells[0].startBottom).toBe(percent.plot.series[0].points[0].value)
    expect(percent.plot.bands[0].cells[0].startTop).toBe(percent.plot.series[1].points[0].value)
  })

  it('keeps all interval sources in linear/log domains and normalizes opacity safely', () => {
    const linear = compileNativeIntervalScene(table, config('confidence-line', { yAxisMin: 0, yAxisMax: 100, intervalFillOpacity: 9 }))
    const log = resolveNativeCartesianScene(compileNativeIntervalScene(table, config('confidence-line', { yAxisScaleType: 'log' })))
    expect(linear.plot.valueDomain).toMatchObject({ min: 0, max: 100 })
    expect(linear.plot.bands[0].fill.opacity).toBe(1)
    expect(log.plot.valueDomain.min).toBeGreaterThan(0)
    expect(log.geometry.plot.width).toBeGreaterThan(0)
  })

  it('returns a safe empty native scene for invalid effective config', () => {
    const range = compileNativeIntervalScene(table, config('range-line', { rangeUpperField: 'low' }))
    const confidence = compileNativeIntervalScene(table, config('confidence-line', { yFields: ['main'] }))
    expect(range.plot).toMatchObject({ kind: 'interval', series: [], groups: [], bands: [] })
    expect(confidence.plot).toMatchObject({ kind: 'interval', series: [], groups: [], bands: [] })
  })

  it('shares point-scale top/right/multiline/rotated Cartesian layout', () => {
    const overrides: Partial<ChartConfig> = { xAxisPosition: 'top', yAxisPosition: 'right', xAxisLabelRotate: 45, categoryLabelOverrides: { x: { '0:A': 'First\nlabel' } } }
    const interval = resolveNativeCartesianScene(compileNativeIntervalScene(table, config('range-line', overrides)))
    const line = getChartPlugin('line').compile(table, { ...config('line', overrides), yFields: ['low', 'high'] })
    if (line.migrationMode !== 'native') throw new Error('Expected native Line')
    const resolvedLine = resolveNativeCartesianScene(line)
    expect(interval.geometry.axes).toEqual(resolvedLine.geometry.axes)
    expect(interval.geometry.plot).toEqual(resolvedLine.geometry.plot)
  })

  it('keeps compiler/layout/renderer boundaries explicit', () => {
    const compiler = readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')
    const registry = readFileSync(new URL('../../../core/chartRegistry.ts', import.meta.url), 'utf8')
    const renderer = readFileSync(new URL('../../chart-renderer/echarts/renderIntervalScene.ts', import.meta.url), 'utf8')
    const canvas = readFileSync(new URL('../../../components/ChartCanvas.tsx', import.meta.url), 'utf8')
    expect(compiler).not.toMatch(/echarts|renderItem|buildOption/)
    expect(registry).not.toMatch(/const intervalLine|__range-line-band|__confidence-line-band/)
    expect(renderer).not.toMatch(/compatibilityConfig\.kind|rangeLowerField|rangeUpperField|intervalGroups|intervalFillMode/)
    expect(renderer).not.toMatch(/as NativeChartScene|as ResolvedPointScene/)
    expect(canvas).not.toMatch(/plot\.kind === ['"]interval|plot\.kind !== ['"]interval/)
  })
})
