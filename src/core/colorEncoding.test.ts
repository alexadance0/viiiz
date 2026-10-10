import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../entities/chart/model/defaultChartConfig'
import { colorCategories, createColorEncoding, intervalPalette } from './colorEncoding'
import { getChartPlugin } from './chartRegistry'
import { renderScene } from '../features/chart-renderer/echarts/renderScene'
import type { ChartConfig, DataTable } from './types'

const table: DataTable = { name: 'colors', columns: ['country', 'value', 'group', 'ratio'], rows: [
  { country: 'US', value: 20, group: 'High', ratio: 0 }, { country: 'FR', value: 30, group: 'Low', ratio: 2 }, { country: 'JP', value: 40, group: 'High', ratio: null },
] }
const config: ChartConfig = { ...createDefaultChartConfig(), xField: 'country', yField: 'value', yFields: ['value'], showLegend: true, colorEncoding: { mode: 'categories', field: 'group', categories: [{ value: 'Low', label: 'Низкая', color: '#168a72' }, { value: 'High', label: 'Высокая', color: '#1923e3' }], missingPattern: 'diagonal' } }

describe('data color encoding', () => {
  it('spreads numerical interval colors across the palette without cycling', () => {
    const colors = intervalPalette(['#1923e3', '#ffffff'], 13)
    expect(new Set(colors).size).toBe(13)
    expect(colors[0]).toBe('#1923e3')
    expect(colors.at(-1)).toBe('#ffffff')
  })
  it('keeps colors tied to category values across sorting and filtering, with an explicit legend order', () => {
    expect(colorCategories(table, config).map((item) => item.value)).toEqual(['Low', 'High'])
    const full = createColorEncoding(table, config), filtered = createColorEncoding({ ...table, rows: table.rows.toReversed().filter((row) => row.group === 'High') }, config)
    expect(full.resolve([table.rows[0]], 20).color).toBe(filtered.resolve([table.rows[0]], 20).color)
    full.resolve([table.rows[1]], 30)
    const legend = full.legend()
    if (legend.kind !== 'categorical-legend') throw new Error('Legend expected')
    expect(legend.items.map((item) => item.label)).toEqual(['Низкая', 'Высокая'])
  })

  it('uses explicit numeric intervals with inclusive lower bounds, keeps zero and separates missing values', () => {
    const bins = createColorEncoding(table, { ...config, colorEncoding: { mode: 'bins', field: 'ratio', thresholds: [0, 2], binColors: ['#1923e3', '#168a72', '#e56b45'], missingPattern: 'diagonal' } })
    expect(bins.resolve([table.rows[0]], 20)).toMatchObject({ color: '#168a72', missing: false })
    expect(bins.resolve([table.rows[1]], 30)).toMatchObject({ color: '#e56b45', missing: false })
    expect(bins.resolve([table.rows[2]], 40)).toMatchObject({ missing: true, pattern: 'diagonal' })
    expect(bins.resolve([{ country: 'DE', value: 60, ratio: -1 }], 60).color).toBe('#1923e3')
    const scale = bins.legend()
    if (scale.kind !== 'color-scale') throw new Error('Discrete color scale expected')
    expect(scale.segments).toEqual([{ from: -1, to: 0, color: '#1923e3' }, { from: 0, to: 2, color: '#168a72' }, { from: 2, to: 4, color: '#e56b45' }])
    expect(scale.ticks?.map((tick) => tick.value)).toEqual([-1, 0, 2])
    expect(scale.missing).toMatchObject({ label: 'Нет данных', pattern: 'diagonal' })
  })

  it('reports conflicting categories instead of taking the first aggregated row', () => {
    expect(createColorEncoding(table, config).resolve([table.rows[0], table.rows[1]], 50)).toMatchObject({ conflict: true, label: 'Несколько категорий', pattern: 'diagonal' })
  })

  it.each(['bar', 'horizontal-bar', 'stacked-bar', 'normalized-stacked-bar'] as const)('colors %s marks without altering their numerical data', (kind) => {
    const plain = getChartPlugin(kind).compile(table, { ...config, kind, colorEncoding: undefined })
    const colored = getChartPlugin(kind).compile(table, { ...config, kind })
    if (plain.plot.kind !== 'bar' || colored.plot.kind !== 'bar') throw new Error('Bar expected')
    expect(colored.plot.series[0].marks.map((mark) => mark.value)).toEqual(plain.plot.series[0].marks.map((mark) => mark.value))
    expect(colored.plot.series[0].marks.map((mark) => mark.style.color)).toEqual(['#1923e3', '#168a72', '#1923e3'])
    const option = renderScene(colored) as { graphic: Array<{ id: string }> }
    expect(option.graphic.some((item) => item.id.startsWith('color-legend:'))).toBe(true)
  })

  it('supports categorical maps without numeric measures and applies colors to aliases of one territory', () => {
    const textOnly: DataTable = { name: 'map', columns: ['country', 'group'], rows: [{ country: 'US', group: 'High' }, { country: 'France', group: 'Low' }] }
    const source = { ...config, kind: 'map-world' as const, yField: '', yFields: [] }
    expect(getChartPlugin('map-world').validate(textOnly, source).ok).toBe(true)
    const scene = getChartPlugin('map-world').compile(textOnly, source)
    if (scene.plot.kind !== 'map') throw new Error('Map expected')
    expect(scene.plot.regions.find((region) => region.regionId === 'US')).toMatchObject({ color: '#1923e3', value: null })
    expect(scene.plot.regions.find((region) => region.regionId === 'FR')).toMatchObject({ color: '#168a72', value: null })
    expect(scene.plot.regions.find((region) => region.regionId === 'JP')).toMatchObject({ colorPattern: 'diagonal', colorLabel: 'Нет данных' })
  })
})
