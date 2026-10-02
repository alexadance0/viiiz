import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { createPanelConfig, resizeMultiples, resolveMultiplesPanels, resolveMultiplesRowHeights, sharedCategoryRows, type Multiples } from './multiples'
import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resolveNativeScene } from '../../chart-renderer/echarts/renderScene'

describe('multiples composition', () => {
  it('keeps every occupied slot when narrowing or shrinking the grid', () => {
    const panel = { id: 'last', config: createDefaultChartConfig() }
    const grid = { columns: 2, rows: 2, gap: 24, panels: [null, null, null, panel] }
    const resized = resizeMultiples(grid, 1, 1)
    expect(resized.rows).toBe(4)
    expect(resized.panels).toEqual(grid.panels)
    expect(resizeMultiples(resized, 3, 1).panels).toEqual([null, null, null, panel, null, null])
  })

  it('creates an independent compact chart from the existing configuration', () => {
    const original = createDefaultChartConfig()
    original.seriesStyles = { revenue: { color: '#1677a6' } }
    original.multiples = { columns: 1, rows: 1, gap: 24, panels: [] }
    const panel = createPanelConfig(original, 'Выручка')
    panel.seriesStyles.revenue.color = '#000000'
    expect(original.seriesStyles.revenue.color).toBe('#1677a6')
    expect(panel.multiples).toBeUndefined()
    expect(panel.title).toBe('Выручка')
    expect(panel.showSource).toBe(false)
    expect(panel.yFields).toEqual(original.yFields)
  })
})

const table: DataTable = { name: 'Comparison', columns: ['category', 'a', 'b'], rows: [{ category: 'Длинная категория', a: 30, b: 20 }, { category: 'Другая категория', a: 10, b: 35 }] }
const panel = (field: string, patch: Partial<ChartConfig> = {}) => ({ ...createPanelConfig(createDefaultChartConfig(), field), kind: 'horizontal-bar' as const, xField: 'category', yField: field, yFields: [field], ...patch })
const grid = (configs: ChartConfig[], patch: Partial<Multiples> = {}): Multiples => ({ columns: configs.length, rows: 1, gap: 20, panels: configs.map((config, index) => ({ id: String(index), config })), ...patch })

describe('shared multiples axes', () => {
  it('gives two- and four-category rows the same category spacing, allowing for headings and shared scales', () => {
    const categories: DataTable = { name: 'Groups', columns: ['sex', 'age', 'value'], rows: Array.from({ length: 4 }, (_, index) => ({ sex: index % 2 ? 'Женщины' : 'Мужчины', age: `${index + 1} возрастная группа`, value: 10 + index })) }
    const source = grid([panel('value', { xField: 'sex', aggregation: 'average' }), panel('value', { xField: 'age', title: 'Длинный заголовок, который переносится на несколько строк' })], { columns: 1, rows: 2, equalCategorySpacing: true, sharedValueScale: true, sharedScaleLabels: 'bottom' })
    const heights = resolveMultiplesRowHeights(categories, source, 220, 700)
    expect(heights[1]).toBeGreaterThan(heights[0])
    expect(heights.reduce((sum, height) => sum + height, 0)).toBeCloseTo(700)
    const configs = resolveMultiplesPanels(categories, source, 220, heights)
    const plots = configs.map((config) => resolveNativeScene(getChartPlugin(config!.kind).compile(categories, config!)).geometry.plot)
    expect(Math.abs(plots[0].height / 2 - plots[1].height / 4)).toBeLessThan(1)
    expect(plots[0].width).toBe(plots[1].width)
    expect(configs[0]!.showYAxisLabels).toBe(false)
    expect(configs[0]!.yAxisMax).toBe(configs[1]!.yAxisMax)
    expect(source.panels[0]!.config.canvasHeight).not.toBe(configs[0]!.canvasHeight)
    expect(resolveMultiplesRowHeights(categories, { ...source, equalCategorySpacing: false }, 220, 700)).toEqual([350, 350])
    expect(resolveMultiplesRowHeights(categories, source, 220, 20)).toEqual([10, 10])
  })

  it('uses the largest category count in a row and preserves ordinary heights for unrelated charts and empty rows', () => {
    const source = grid([panel('a'), panel('b'), panel('a', { kind: 'line' })], { columns: 2, rows: 3, equalCategorySpacing: true })
    source.panels.push(null, null, null)
    const heights = resolveMultiplesRowHeights(table, source, 300, 900)
    expect(heights).toEqual([300, 300, 300])
    expect(resolveMultiplesPanels(table, source, 300, heights)[2]!.canvasHeight).toBe(300)
  })

  it('keeps value labels at the left occupied panel of each compatible row without changing plots or saved settings', () => {
    const configs = [panel('a', { kind: 'line' }), panel('b', { kind: 'line' }), panel('a', { kind: 'line' }), panel('b', { kind: 'line' })]
    const source = grid(configs, { columns: 2, rows: 2, sharedValueScale: true, sharedScaleLabels: 'left' })
    const resolved = resolveMultiplesPanels(table, source, 300, 350)
    expect(resolved.map((config) => config!.showYAxisLabels ?? true)).toEqual([true, false, true, false])
    const plots = resolved.map((config) => resolveNativeScene(getChartPlugin(config!.kind).compile(table, config!)).geometry.plot)
    expect(plots.every((plot) => JSON.stringify(plot) === JSON.stringify(plots[0]))).toBe(true)
    expect(source.panels.every((item) => item!.config.showYAxisLabels !== false)).toBe(true)
    expect(resolveMultiplesPanels(table, { ...source, sharedScaleLabels: 'all' }, 300, 350).every((config) => config!.showYAxisLabels !== false)).toBe(true)
    source.panels[0] = null
    expect(resolveMultiplesPanels(table, source, 300, 350)[1]!.showYAxisLabels ?? true).toBe(true)
    const incompatible = { ...source, panels: [...source.panels] }
    incompatible.panels[3] = { id: 'different-unit', config: { ...configs[3], numberSuffix: ' ₽' } }
    expect(resolveMultiplesPanels(table, incompatible, 300, 350)[3]!.showYAxisLabels ?? true).toBe(true)
  })

  it('keeps horizontal value and shared X labels at the lowest compatible occupied panel in each column', () => {
    const source = grid([panel('a'), panel('b'), panel('a'), panel('b')], { columns: 2, rows: 2, sharedValueScale: true, sharedScaleLabels: 'bottom' })
    expect(resolveMultiplesPanels(table, source, 300, 350).map((config) => config!.showYAxisLabels ?? true)).toEqual([false, false, true, true])
    source.panels[3] = null
    expect(resolveMultiplesPanels(table, source, 300, 350).map((config) => config ? config.showYAxisLabels ?? true : null)).toEqual([false, true, true, null])
    const xy = grid([panel('a', { kind: 'scatter', xField: 'a' }), panel('b', { kind: 'scatter', xField: 'a' })], { columns: 1, rows: 2, sharedXScale: true, sharedScaleLabels: 'bottom' })
    expect(resolveMultiplesPanels(table, xy, 300, 350).map((config) => config!.showXAxisLabels ?? true)).toEqual([false, true])
    expect(resolveMultiplesPanels(table, { ...xy, sharedXScale: false }, 300, 350).map((config) => config!.showXAxisLabels ?? true)).toEqual([true, true])
  })

  it('uses compiled stacked totals and preserves independent settings when turned off', () => {
    const source = grid([panel('a', { kind: 'horizontal-stacked-bar', yFields: ['a', 'b'], yAxisMax: 12 }), panel('b')], { sharedValueScale: true })
    const configs = resolveMultiplesPanels(table, source, 300, 350)
    expect(configs[0]!.yAxisMax).toBeGreaterThanOrEqual(50)
    expect(configs[0]!.yAxisMax).toBe(configs[1]!.yAxisMax)
    expect(configs[0]!.yAxisMin).toBe(0)
    expect(source.panels[0]!.config.yAxisMax).toBe(12)
    expect(resolveMultiplesPanels(table, { ...source, sharedValueScale: false }, 300, 350)[0]!.yAxisMax).toBe(12)
  })

  it('shares category order and actual plot dimensions with unequal headings and labels', () => {
    const source = grid([panel('a', { barCategorySort: 'value-desc' }), panel('b', { barCategorySort: 'value-desc', title: 'Длинный заголовок, который занимает несколько строк' })], { sharedCategoryLabels: true, sharedValueScale: true, valueMax: 40, valueStep: 10 })
    const configs = resolveMultiplesPanels(table, source, 200, 400)
    const scenes = configs.map((config) => resolveNativeScene(getChartPlugin(config!.kind).compile(table, config!)))
    expect(configs[0]!.categoryOrder).toEqual(configs[1]!.categoryOrder)
    expect(configs[1]!.showXAxisLabels).toBe(false)
    expect(scenes[0].geometry.plot).toEqual(scenes[1].geometry.plot)
    expect(configs[0]!.yAxisMax).toBe(40)
    expect(configs[0]!.yAxisStep).toBe(10)
    expect(sharedCategoryRows(table, grid([panel('a'), panel('b', { kind: 'scatter' })], { sharedCategoryLabels: true }))).toEqual([])
  })

  it('shares continuous X ranges and keeps incompatible units separate', () => {
    const source = grid([panel('a', { kind: 'scatter', xField: 'a', numberSuffix: ' ₽' }), panel('b', { kind: 'scatter', xField: 'b', numberSuffix: ' %' })], { sharedXScale: true, sharedValueScale: true })
    const configs = resolveMultiplesPanels(table, source, 350, 350)
    expect(configs[0]!.xAxisMin).toBe(configs[1]!.xAxisMin)
    expect(configs[0]!.xAxisMax).toBe(configs[1]!.xAxisMax)
    expect(configs[0]!.yAxisMax).not.toBe(configs[1]!.yAxisMax)
  })

  it('shares a date range across locally cropped line charts', () => {
    const dates: DataTable = { ...table, columns: ['date', 'a'], rows: Array.from({ length: 4 }, (_, month) => ({ date: new Date(2025, month, 1), a: month * 10 })) }
    const source = grid([panel('a', { kind: 'line', xField: 'date', xAxisMax: '2025-02-01' }), panel('a', { kind: 'line', xField: 'date', xAxisMin: '2025-03-01' })], { sharedXScale: true })
    const configs = resolveMultiplesPanels(dates, source, 300, 350)
    expect(configs[0]!.xAxisMin).toBe('2025-01-01')
    expect(configs[1]!.xAxisMax).toBe('2025-04-01')
  })
})
