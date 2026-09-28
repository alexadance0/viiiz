import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeHeatmapScene } from './compiler'
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
    const scale = resolved.geometry.heatmap.scale!
    if (position === 'left' || position === 'right') {
      expect(scale.bar.height).toBeLessThanOrEqual(360)
      expect(scale.bar.y + scale.bar.height / 2).toBeCloseTo(resolved.geometry.plot.y + resolved.geometry.plot.height / 2)
    }
  })

  it('renders custom resolved cells without HeatmapChart or visualMap', () => {
    const option = renderHeatmapScene(resolveNativeHeatmapScene(compileNativeHeatmapScene(table, config()))) as { series: Array<{ type: string; data: unknown[] }>; visualMap?: unknown; graphic: Array<{ id?: string }> }
    expect(option.series).toHaveLength(1)
    expect(option.series[0]).toMatchObject({ type: 'custom' })
    expect(option.series[0].data).toHaveLength(9)
    expect(option.visualMap).toBeUndefined()
    expect(option.graphic.some((item) => item.id === 'heatmap-scale-bar')).toBe(true)
  })

  it('mirrors plot-edge and outer-edge row alignment with the axis side', () => {
    const axisLabel = (overrides: Partial<ChartConfig>) => (renderHeatmapScene(resolveNativeHeatmapScene(compileNativeHeatmapScene(table, config(overrides)))) as { yAxis: { axisLabel: { align: string; margin: number } } }).yAxis.axisLabel
    expect(axisLabel({ yAxisPosition: 'left' })).toMatchObject({ align: 'right', margin: 8 })
    expect(axisLabel({ yAxisPosition: 'right' })).toMatchObject({ align: 'left', margin: 8 })
    expect(axisLabel({ yAxisPosition: 'left', categoryAxisLabelAlignment: 'outer' }).align).toBe('left')
    expect(axisLabel({ yAxisPosition: 'right', categoryAxisLabelAlignment: 'outer' }).align).toBe('right')
  })

  it('anchors the longest left row label to the common content edge', () => {
    const resolved = resolveNativeHeatmapScene(compileNativeHeatmapScene(table, config({
      categoryLabelOverrides: { y: { north: 'Очень длинное название региона', south: 'Юг' } },
      yAxisPosition: 'left',
      showYAxisTitle: true,
      yAxisTitle: 'Не создаёт пустой резерв',
    })))
    const rail = resolved.geometry.reservations['axis:row']
    expect(rail.x).toBe(resolved.geometry.content.x)
    expect(resolved.geometry.plot.x).toBe(rail.x + rail.width)
    expect(resolved.plot.rowAxis.labels.size + resolved.plot.rowAxis.labels.gap).toBe(rail.width)
    const option = renderHeatmapScene(resolved) as { nativeCategoryLayouts: Array<{ axis: string; category: string; top: number }> }
    const layout = option.nativeCategoryLayouts.find((item) => item.axis === 'y' && item.category === resolved.plot.rows[0].sourceKey)!
    const cell = resolved.geometry.heatmap.cells[resolved.plot.rows[0].cells[0].id]
    const lineHeight = Math.round(resolved.plot.rowAxis.labels.style.size * resolved.plot.rowAxis.labels.style.lineHeight / 100)
    expect(layout.top + lineHeight / 2).toBeCloseTo(cell.y + cell.height / 2)
  })

  it('centers horizontal labels on their cells and isolates a compact bottom scale', () => {
    const resolved = resolveNativeHeatmapScene(compileNativeHeatmapScene(table, config({ heatmapScalePosition: 'bottom', xAxisLabelRotate: 0 })))
    const option = renderHeatmapScene(resolved) as { xAxis: { boundaryGap: boolean; axisTick: { alignWithLabel: boolean }; axisLabel: { align: string } } }
    const firstCell = resolved.geometry.heatmap.cells[resolved.plot.rows[0].cells[0].id]
    const firstLabel = resolved.geometry.elements[`category-label:${resolved.plot.categories[0].id}`]
    expect(firstCell.x + firstCell.width / 2).toBe(firstLabel.x + firstLabel.width / 2)
    expect(option.xAxis).toMatchObject({ boundaryGap: true, axisTick: { alignWithLabel: true }, axisLabel: { align: 'center' } })
    const scale = resolved.geometry.heatmap.scale!
    const scaleRail = resolved.geometry.reservations['guide:color-scale']
    const footer = resolved.geometry.reservations['frame:footer']
    const lineHeight = Math.round(resolved.compatibilityConfig.legendText.size * resolved.compatibilityConfig.legendText.lineHeight / 100)
    expect(scale.bar.width).toBeLessThanOrEqual(360)
    expect(scale.bar.x + scale.bar.width / 2).toBeCloseTo(resolved.geometry.plot.x + resolved.geometry.plot.width / 2)
    expect(scale.ticks.every((tick) => tick.y > scale.bar.y + scale.bar.height && tick.verticalAlign === 'top')).toBe(true)
    expect(Math.max(...scale.ticks.map((tick) => tick.y + lineHeight))).toBeLessThanOrEqual(scaleRail.y + scaleRail.height)
    expect(scaleRail.y - (resolved.geometry.plot.y + resolved.geometry.plot.height)).toBeGreaterThanOrEqual(12)
    expect(scaleRail.y + scaleRail.height + resolved.document.composition.plotFooter).toBeLessThanOrEqual(footer.y)
  })

  it('measures formatted scale labels, clips cell text, and exposes editable row labels', () => {
    const source = config({ numberPrefix: 'Очень длинный префикс ', heatmapScalePosition: 'right', categoryLabelOverrides: { y: { north: 'Северный регион' } } })
    const resolved = resolveNativeHeatmapScene(compileNativeHeatmapScene(table, source))
    expect(resolved.geometry.reservations['guide:color-scale'].width).toBeGreaterThan(80)
    expect(resolved.elements.filter((element) => element.role === 'category-label')).toHaveLength(resolved.plot.categories.length + resolved.plot.rows.length)
    const option = renderHeatmapScene(resolved) as { series: Array<{ renderItem(params: { dataIndex: number }): { clipPath?: unknown; children: Array<{ type: string; style?: { width?: number; overflow?: string } }> } }>; nativeCategoryLayouts: Array<{ axis: string; category: string }> }
    const rendered = option.series[0].renderItem({ dataIndex: 0 })
    expect(rendered.clipPath).toBeTruthy()
    expect(option.nativeCategoryLayouts.some((layout) => layout.axis === 'y' && layout.category === resolved.plot.rows[0].sourceKey)).toBe(true)
  })

  it('has no ECharts compiler dependency and fails closed through the legacy guard', () => {
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|buildOption/)
  })
})
