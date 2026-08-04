import { describe, expect, it } from 'vitest'
import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { compileNativeIntervalScene } from '../../chart-types/interval/compiler'
import { renderIntervalScene, type ResolvedIntervalScene } from './renderIntervalScene'
import { readFileSync } from 'node:fs'

const table: DataTable = { name: 'crossing', columns: ['x', 'low', 'high', 'main'], rows: [
  { x: 'A', low: 1, high: 5, main: 3 }, { x: 'B', low: 6, high: 2, main: 4 }, { x: 'C', low: 3, high: 8, main: 5 },
] }
const config = (kind: 'range-line' | 'confidence-line', overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'x', yField: 'low', yFields: ['main', 'low', 'high'], rangeLowerField: 'low', rangeUpperField: 'high', ...overrides })

describe('native interval ECharts adapter', () => {
  it('renders semantic cells as clipped silent polygons below real lines', () => {
    const scene = resolveNativeCartesianScene(compileNativeIntervalScene(table, config('range-line'))) as ResolvedIntervalScene
    const option = renderIntervalScene(scene) as { series: Array<{ name: string; type: string; silent?: boolean; tooltip?: { show?: boolean }; z?: number; data: unknown[]; renderItem?: (params: { dataIndex: number; coordSys: { x: number; y: number; width: number; height: number } }, api: { coord(value: unknown[]): [number, number] }) => { type: string; shape: { points: number[][] } } }> }
    const band = option.series[0]
    expect(band).toMatchObject({ name: expect.stringMatching(/^__interval-band:/), type: 'custom', silent: true, tooltip: { show: false }, z: 0 })
    expect(band.data).toHaveLength(scene.plot.bands[0].cells.length)
    const polygon = band.renderItem!({ dataIndex: 0, coordSys: { x: 0, y: 0, width: 100, height: 100 } }, { coord: ([x, y]) => [String(x) === '0:A' ? 0 : String(x) === '1:B' ? 50 : 100, 100 - Number(y) * 10] })
    expect(polygon.type).toBe('polygon')
    expect(polygon.shape.points).toHaveLength(4)
    expect(new Set(polygon.shape.points.map((point) => point.join(','))).size).toBeGreaterThan(2)
    expect(option.series.filter((series) => series.name === 'low' || series.name === 'high')).toHaveLength(2)
    expect(option.series.every((series) => !series.name.includes('-base') && !series.name.includes('-fill'))).toBe(true)
  })

  it('renders only confidence source lines made visible by showBounds', () => {
    const hidden = renderIntervalScene(resolveNativeCartesianScene(compileNativeIntervalScene(table, config('confidence-line'))) as ResolvedIntervalScene) as { series: Array<{ name: string }> }
    const shown = renderIntervalScene(resolveNativeCartesianScene(compileNativeIntervalScene(table, config('confidence-line', { intervalGroups: [{ main: 'main', lower: 'low', upper: 'high', showBounds: true }] }))) as ResolvedIntervalScene) as { series: Array<{ name: string }> }
    expect(hidden.series.some((series) => series.name === 'low' || series.name === 'high')).toBe(false)
    expect(shown.series.some((series) => series.name === 'low')).toBe(true)
    expect(shown.series.some((series) => series.name === 'high')).toBe(true)
  })

  it('gets confidence direct-label membership only from the semantic guide', () => {
    const scene = resolveNativeCartesianScene(compileNativeIntervalScene(table, config('confidence-line', { showDirectLabels: true }))) as ResolvedIntervalScene
    const option = renderIntervalScene(scene) as { series: Array<{ name: string; endLabel?: { show?: boolean }; data?: Array<{ directLegendLabel?: boolean }> }> }
    expect(option.series.find((series) => series.name === 'main')?.endLabel?.show).toBe(true)
    expect(option.series.some((series) => series.name === 'low' || series.name === 'high')).toBe(false)
    expect(readFileSync(new URL('../../../components/ChartCanvas.tsx', import.meta.url), 'utf8')).not.toMatch(/confidenceGroups|config\.kind === ['"]confidence-line['"]/)
  })

  it('returns the same serializable structure for the same scene', () => {
    const scene = resolveNativeCartesianScene(compileNativeIntervalScene(table, config('range-line'))) as ResolvedIntervalScene
    const serialize = () => JSON.stringify(renderIntervalScene(scene), (_key, value) => typeof value === 'function' ? '[function]' : value)
    expect(serialize()).toBe(serialize())
  })
})
