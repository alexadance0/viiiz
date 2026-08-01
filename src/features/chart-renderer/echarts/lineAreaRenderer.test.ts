import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartElementColor, chartValueLabelSelections, getChartPlugin } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import { lineAreaFixtures } from '../../../test-fixtures/charts/lineArea'
import { resolveNativeCartesianScene } from '../../chart-types/bar/layout'
import { NATIVE_LINE_KINDS } from '../../chart-types/line/compiler'
import { NATIVE_AREA_KINDS } from '../../chart-types/area/compiler'
import { renderScene } from './renderScene'

function resolve(kind: 'bar' | 'line' | 'area', categories: Array<string | Date>, overrides: Partial<ChartConfig> = {}) {
  const source = lineAreaFixtures[0]
  const table: DataTable = { name: 'axis-alignment', columns: ['period', 'first'], rows: categories.map((period, index) => ({ period, first: index + 1 })) }
  const scene = getChartPlugin(kind).compile(table, { ...source.config, kind, ...overrides })
  if (scene.migrationMode !== 'native') throw new Error('Expected native scene')
  return resolveNativeCartesianScene(scene)
}

describe('native ECharts line and area adapter', () => {
  it.each([...NATIVE_LINE_KINDS, ...NATIVE_AREA_KINDS])('%s never reaches the legacy builder', (kind) => {
    const source = lineAreaFixtures[10], plugin = getChartPlugin(kind), original = plugin.buildOption
    plugin.buildOption = () => { throw new Error('legacy builder reached') }
    try {
      const config = { ...source.config, kind }
      expect(() => renderScene(plugin.compile(source.table, config))).not.toThrow()
      const category = source.table.rows[0].period
      expect(chartElementColor(source.table, config, `first\u001f${category instanceof Date ? category.toISOString() : String(category)}`)).toBeTruthy()
      expect(chartValueLabelSelections(source.table, config)).not.toHaveLength(0)
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

  it('keeps semantic compilers free from renderer and ECharts imports', () => {
    const line = readFileSync(new URL('../../chart-types/line/compiler.ts', import.meta.url), 'utf8')
    const area = readFileSync(new URL('../../chart-types/area/compiler.ts', import.meta.url), 'utf8')
    expect(`${line}\n${area}`).not.toMatch(/echarts|renderLineAreaScene|buildOption/)
  })

  it('keeps specialized line-like families explicitly legacy', () => {
    for (const kind of ['indexed-line', 'seasonal-line', 'slope', 'range-line', 'step-range-line', 'confidence-line', 'moving-average-line', 'scatter', 'waterfall'] as const) expect(getChartPlugin(kind).compilerMode).toBe('legacy')
  })
})
