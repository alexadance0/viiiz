import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeHeatmapScene, legacyHeatmapBuilderGuard } from './compiler'
import { resolveNativeHeatmapScene } from './layout'
import { renderHeatmapScene } from '../../chart-renderer/echarts/renderHeatmapScene'

const table: DataTable = { name: 'heatmap', columns: ['month', 'north', 'south', 'empty'], rows: [{ month: 'Jan', north: 1, south: 5, empty: null }, { month: 'Feb', north: 9, south: null, empty: null }, { month: 'Mar', north: 4, south: 7, empty: null }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'heatmap', xField: 'month', yField: 'north', yFields: ['north', 'south', 'empty'], aggregation: 'none', showValues: true, ...overrides })

describe('native Heatmap compiler, layout, and renderer', () => {
  it('keeps every matrix cell, missing identity, labels, and source document', () => {
    const scene = compileNativeHeatmapScene(table, config({ heatmapMissingColor: '#abcdef', heatmapMissingLabel: 'n/a' }))
    expect(scene.document.chart).toMatchObject({ family: 'heatmap', kind: 'heatmap' })
    expect(scene.plot.rows.flatMap((row) => row.cells)).toHaveLength(9)
    expect(scene.plot.rows[1].cells[1]).toMatchObject({ value: null, color: '#abcdef', displayValue: 'n/a' })
    expect(scene.elements.filter((element) => element.role === 'mark')).toHaveLength(9)
  })

  it('sorts last by the last finite observation, preserving stable identities', () => {
    const original = compileNativeHeatmapScene(table, config())
    const sorted = compileNativeHeatmapScene(table, config({ heatmapRowSort: 'last', heatmapRowSortDirection: 'descending' }))
    expect(sorted.plot.rows.map((row) => row.name)).toEqual(['south', 'north', 'empty'])
    expect(new Set(sorted.plot.rows.flatMap((row) => row.cells.map((cell) => cell.id)))).toEqual(new Set(original.plot.rows.flatMap((row) => row.cells.map((cell) => cell.id))))
  })

  it.each([
    [{ heatmapScaleMin: -50, heatmapScaleMax: 80 }, [-50, 80]],
    [{ heatmapScaleMin: 80, heatmapScaleMax: -50 }, [-50, 80]],
    [{ heatmapScaleMin: 5, heatmapScaleMax: 5 }, [-9, 9]],
    [{ heatmapScaleMin: 10 }, [10, 11]],
    [{ heatmapScaleMax: -10 }, [-11, -10]],
  ] as const)('normalizes configured bounds %#', (bounds, expected) => {
    const domain = compileNativeHeatmapScene(table, config(bounds)).plot.colorDomain
    expect([domain.min, domain.max]).toEqual(expected)
  })

  it('keeps an asymmetric midpoint ratio in both semantic and resolved guides', () => {
    const scene = compileNativeHeatmapScene(table, config({ heatmapScaleMin: -50, heatmapScaleMax: 80, heatmapMidpoint: 0 }))
    expect(scene.plot.colorDomain.midpointRatio).toBeCloseTo(50 / 130)
    const guide = scene.guides[0]
    expect(guide.kind === 'color-scale' && guide.stops?.[1].offset).toBeCloseTo(50 / 130)
  })

  it.each(['top', 'right', 'bottom', 'left'] as const)('owns cell and %s scale geometry before rendering', (position) => {
    const resolved = resolveNativeHeatmapScene(compileNativeHeatmapScene(table, config({ heatmapScalePosition: position })))
    expect(Object.keys(resolved.geometry.heatmap.cells)).toHaveLength(9)
    expect(Object.values(resolved.geometry.heatmap.cells).every((rect) => rect.width > 0 && rect.height > 0)).toBe(true)
    expect(resolved.geometry.reservations['guide:color-scale']).toBeTruthy()
    expect(resolved.geometry.heatmap.scale?.bar.width).toBeGreaterThan(0)
  })

  it('renders custom resolved cells without HeatmapChart or visualMap', () => {
    const option = renderHeatmapScene(resolveNativeHeatmapScene(compileNativeHeatmapScene(table, config()))) as { series: Array<{ type: string; data: unknown[] }>; visualMap?: unknown; graphic: Array<{ id?: string }> }
    expect(option.series).toHaveLength(1)
    expect(option.series[0]).toMatchObject({ type: 'custom' })
    expect(option.series[0].data).toHaveLength(9)
    expect(option.visualMap).toBeUndefined()
    expect(option.graphic.some((item) => item.id === 'heatmap-scale-bar')).toBe(true)
  })

  it('has no ECharts compiler dependency and fails closed through the legacy guard', () => {
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|buildOption/)
    expect(() => legacyHeatmapBuilderGuard()).toThrow(/native semantic scene/)
  })
})
