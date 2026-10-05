import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resolveNativeScene, renderScene } from '../../chart-renderer/echarts/renderScene'
import { compileMarimekkoScene } from './compiler'
import type { ChartConfig, DataTable } from '../../../core/types'

const config: ChartConfig = { ...createDefaultChartConfig(), ...getChartPlugin('marimekko').defaultConfig, kind: 'marimekko', xField: 'Группа', yField: 'А', yFields: ['А', 'Б'], seriesField: '', showValues: true }
const source: DataTable = { name: 'markets', columns: ['Группа', 'А', 'Б'], rows: [{ Группа: 'Большая', А: 60, Б: 30 }, { Группа: 'Малая', А: 10, Б: 20 }, { Группа: 'Нулевая', А: 0, Б: null }] }

describe('Marimekko', () => {
  it('preserves volume in widths, shares in heights, and volume in every segment area', () => {
    const scene = compileMarimekkoScene(source, config)
    expect(scene.plot.categories.map((category) => category.value)).toEqual(['Большая', 'Малая'])
    expect(scene.plot.categories.map((category) => category.span)).toEqual([{ start: 0, end: 75, total: 90 }, { start: 75, end: 100, total: 30 }])
    scene.plot.categories.forEach((category, index) => {
      expect(scene.plot.series.reduce((sum, series) => sum + (series.marks[index].value ?? 0), 0)).toBeCloseTo(100)
      scene.plot.series.forEach((series) => {
        const value = source.rows[index][series.name] as number
        expect((category.span!.end - category.span!.start) * series.marks[index].value! / 10000).toBeCloseTo(value / 120)
      })
    })
    expect(scene.plot.series[0].marks[0].label.text).toBe('66,67%')
    expect(scene.plot.series[0].marks[0].displayValue).toBe('60 · 66,67%')
    expect(scene.document.chart).toMatchObject({ kind: 'marimekko', family: 'bar', stacking: 'normalized' })
    const geometry = resolveNativeScene(scene).geometry.elements
    const [large, small] = scene.plot.categories.map((category) => geometry[`category-label:${category.id}`])
    expect(large.width / small.width).toBeCloseTo(3)
    expect(small.x).toBeCloseTo(large.x + large.width)
  })

  it.each(['vertical', 'horizontal'] as const)('renders absolute Mekko values and proportional category spans: %s', (barOrientation) => {
    const scene = compileMarimekkoScene(source, { ...config, marimekkoMode: 'absolute', barOrientation, valueMode: 'percent' })
    expect(scene.document.chart).toMatchObject({ orientation: barOrientation, stacking: 'stacked' })
    expect(scene.plot.series.map((series) => series.marks.map((mark) => mark.value))).toEqual([[60, 10], [30, 20]])
    expect(scene.plot.series[0].marks[0].label.text).toBe('60')
    expect(scene.plot.series[0].marks[0].displayValue).toBe('60')
    expect(scene.plot.valueDomain.max).toBeGreaterThanOrEqual(90)
    const resolved = resolveNativeScene(scene)
    const [large, small] = scene.plot.categories.map((category) => resolved.geometry.elements[`category-label:${category.id}`])
    const dimension = barOrientation === 'horizontal' ? 'height' : 'width'
    expect(large[dimension] / small[dimension]).toBeCloseTo(3)
    const option = renderScene(resolved) as { xAxis: { max: number; axisLabel: { formatter: (value: number) => string } }; yAxis: { max: number; axisLabel: { formatter: (value: number) => string } } }
    const axis = barOrientation === 'horizontal' ? option.xAxis : option.yAxis
    expect(axis.max).toBe(scene.plot.valueDomain.max)
    expect(axis.axisLabel.formatter(60)).toBe('60')
  })

  it.each([true, false])('rotates normalized Mekko geometry and respects category order: inverse=%s', (categoryAxisInverse) => {
    const scene = compileMarimekkoScene(source, { ...config, barOrientation: 'horizontal', categoryAxisInverse })
    expect(scene.document.chart).toMatchObject({ orientation: 'horizontal', stacking: 'normalized' })
    const resolved = resolveNativeScene(scene)
    const [large, small] = scene.plot.categories.map((category) => resolved.geometry.elements[`category-label:${category.id}`])
    expect(large.height / small.height).toBeCloseTo(3)
    expect(large.y < small.y).toBe(categoryAxisInverse)
    const option = renderScene(resolved) as { xAxis: { max: number; axisLabel: { formatter: (value: number) => string } }; yAxis: { inverse: boolean }; series: Array<{ data: Array<{ value: number[] }>; renderItem(params: unknown, api: unknown): { children: Array<{ shape: { width: number; height: number } }> } }> }
    expect(option.yAxis.inverse).toBe(categoryAxisInverse)
    expect(option.xAxis.axisLabel.formatter(100)).toBe('100%')
    const series = option.series[0]
    const render = (index: number) => series.renderItem({}, { value: (dimension: number) => series.data[index].value[dimension], coord: ([x, y]: number[]) => [x * 4, (categoryAxisInverse ? y : 100 - y) * 4] }).children[0].shape
    expect(render(0).height / render(1).height).toBeCloseTo(3)
    expect(render(0).width).toBeCloseTo(400 * 60 / 90)
  })

  it('aggregates long-format records and recomputes widths when categories are sorted', () => {
    const table: DataTable = { name: 'long', columns: ['Группа', 'Бренд', 'Объём'], rows: [
      { Группа: 'Большая', Бренд: 'А', Объём: 40 }, { Группа: 'Большая', Бренд: 'А', Объём: 20 },
      { Группа: 'Большая', Бренд: 'Б', Объём: 30 }, { Группа: 'Малая', Бренд: 'А', Объём: 10 }, { Группа: 'Малая', Бренд: 'Б', Объём: 20 },
    ] }
    const settings = { ...config, yField: 'Объём', yFields: ['Объём'], seriesField: 'Бренд', barCategorySort: 'value-asc' as const }
    expect(getChartPlugin('marimekko').validate(table, settings).ok).toBe(true)
    const scene = compileMarimekkoScene(table, settings)
    expect(scene.plot.categories.map((category) => category.span?.total)).toEqual([30, 90])
    expect(scene.plot.categories[0].span).toMatchObject({ start: 0, end: 25 })
    expect(scene.plot.series[0].marks[1].displayValue).toBe('60 · 66,67%')
  })

  it('retains original volume despite inherited percent mode and preserves individual styles and identities', () => {
    const original = compileMarimekkoScene(source, config), mark = original.plot.series[0].marks[0]
    const scene = compileMarimekkoScene(source, { ...config, valueMode: 'percent', elementStyles: { [mark.legacyKey]: { color: '#202027', label: 'Особая подпись', showLabel: true } } })
    expect(scene.plot.categories[0].span?.end).toBe(75)
    expect(scene.plot.series[0].marks[0]).toMatchObject({ id: mark.id, legacyKey: mark.legacyKey, style: { color: '#202027' }, label: { text: 'Особая подпись', visible: true } })
  })

  it.each([-1, 0, null])('rejects data without usable nonnegative volume: %s', (value) => {
    const table: DataTable = { ...source, rows: [{ Группа: 'Группа', А: value, Б: 0 }] }
    expect(getChartPlugin('marimekko').validate(table, config).ok).toBe(false)
  })

  it('renders correctly proportioned selectable rectangles and hides labels that do not fit', () => {
    const scene = compileMarimekkoScene(source, config)
    const option = renderScene(scene) as { series: Array<{ data: Array<{ value: number[]; elementKey: string }>; renderItem(params: unknown, api: unknown): { children: Array<{ type: string; shape: { width: number; height: number }; info: { elementKey: string } }> } }>; xAxis: { type: string; min: number; max: number }; yAxis: { min: number; max: number } }
    expect(option.xAxis).toMatchObject({ type: 'value', min: 0, max: 100 })
    expect(option.yAxis).toMatchObject({ min: 0, max: 100 })
    const series = option.series[0]
    const render = (index: number, pixels: number) => series.renderItem({}, { value: (dimension: number) => series.data[index].value[dimension], coord: ([x, y]: number[]) => [x * pixels / 100, (100 - y) * pixels / 100] })
    const large = render(0, 400), small = render(1, 400)
    expect(large.children[0].shape.width / small.children[0].shape.width).toBeCloseTo(3)
    expect(large.children[0].info.elementKey).toBe(series.data[0].elementKey)
    expect(large.children.some((child) => child.type === 'text')).toBe(true)
    expect(render(1, 10).children.some((child) => child.type === 'text')).toBe(false)
  })

  it('keeps the plot usable when a tiny group has a long name', () => {
    const table: DataTable = { ...source, rows: [{ Группа: 'Большая', А: 999, Б: 0 }, { Группа: 'Очень длинное название маленькой группы', А: 1, Б: 0 }] }
    const scene = compileMarimekkoScene(table, config)
    const resolved = resolveNativeScene(scene)
    expect(resolved.geometry.plot.height).toBeGreaterThan(200)
    const option = renderScene(resolved) as { graphic: Array<{ id?: string }> }
    expect(option.graphic.some((graphic) => graphic.id === `category-label:${scene.plot.categories[1].id}`)).toBe(false)
  })
})
