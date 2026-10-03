import { expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { getChartPlugin } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import { renderScene, resolveNativeScene } from '../../chart-renderer/echarts/renderScene'
import { compileNativeWaffleScene } from './compiler'

const table: DataTable = { name: 'Доли', columns: ['Категория', 'Значение'], rows: [{ Категория: 'А', Значение: 1 }, { Категория: 'Б', Значение: 1 }, { Категория: 'В', Значение: 1 }] }
const config = (patch: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'waffle', xField: 'Категория', yField: 'Значение', yFields: ['Значение'], aggregation: 'sum', showValues: true, ...patch })

it('allocates the entire grid by largest remainders and retains exact shares and stable colors', () => {
  const scene = compileNativeWaffleScene(table, config())
  expect(scene.plot.counts).toEqual([34, 33, 33])
  expect(scene.plot.slices[0].percent).toBeCloseTo(100 / 3)
  expect(scene.document.chart).toMatchObject({ family: 'waffle', columns: 10, rows: 10 })
  const reordered = compileNativeWaffleScene(table, config({ seriesOrder: ['В', 'Б', 'А'] }))
  expect(reordered.plot.slices[2]).toMatchObject({ id: scene.plot.slices[0].id, color: scene.plot.slices[0].color })
  expect(compileNativeWaffleScene(table, config({ waffleColumns: 7, waffleRows: 3 })).plot.counts).toEqual([7, 7, 7])
  expect(compileNativeWaffleScene(table, config({ waffleColumns: 1, waffleRows: 1 })).plot.counts).toEqual([1, 0, 0])
})

it('aggregates duplicate categories, excludes zeros and validates invalid values', () => {
  const data = { ...table, rows: [{ Категория: 'А', Значение: 70 }, { Категория: 'А', Значение: 3 }, { Категория: 'Б', Значение: 27 }, { Категория: 'Ноль', Значение: 0 }] }
  expect(compileNativeWaffleScene(data, config()).plot.counts).toEqual([73, 27])
  expect(() => compileNativeWaffleScene(data, config({ aggregation: 'none' }))).toThrow('агрегации')
  for (const value of [0, -1]) expect(getChartPlugin('waffle').validate({ ...table, rows: [{ Категория: 'А', Значение: value }] }, config()).ok).toBe(false)
})

it('renders square cells inside the measured plot and preserves category selection metadata', () => {
  const scene = resolveNativeScene(compileNativeWaffleScene(table, config({ waffleColumns: 5, waffleRows: 4, waffleGap: 16, waffleRadius: 50, title: 'Структура' })))
  const option = renderScene(scene) as { xAxis: unknown; series: Array<{ data: unknown[]; renderItem(params: { dataIndex: number }): { shape: { x: number; y: number; width: number; height: number }; info: { elementKey: string } } }> }
  expect(option.xAxis).toBeUndefined()
  expect(option.series.reduce((sum, series) => sum + series.data.length, 0)).toBe(20)
  for (const series of option.series) for (let index = 0; index < series.data.length; index++) {
    const cell = series.renderItem({ dataIndex: index })
    expect(cell.shape.width).toBe(cell.shape.height)
    expect(cell.shape.x).toBeGreaterThanOrEqual(scene.geometry.plot.x)
    expect(cell.shape.y + cell.shape.height).toBeLessThanOrEqual(scene.geometry.plot.y + scene.geometry.plot.height + .01)
    expect(cell.info.elementKey).toContain('pie:')
  }
})

it('fits the side caption rail to short text and centers the grid together with its captions', () => {
  const scene = resolveNativeScene(compileNativeWaffleScene(table, config()))
  const option = renderScene(scene) as { nativeSelectionHits: Array<{ rect: { x: number; y: number; width: number; height: number }; info: { selectionTarget?: string } }> }
  const cells = option.nativeSelectionHits.filter((hit) => hit.info.selectionTarget !== 'value-label')
  const labels = option.nativeSelectionHits.filter((hit) => hit.info.selectionTarget === 'value-label')
  expect(labels).toHaveLength(3)
  expect(labels[0].rect.width).toBeLessThan(scene.geometry.plot.width * .2)
  const left = Math.min(...cells.map(({ rect }) => rect.x))
  const gridRight = Math.max(...cells.map(({ rect }) => rect.x + rect.width))
  const right = Math.max(...labels.map(({ rect }) => rect.x + rect.width))
  expect(labels[0].rect.x - gridRight).toBeLessThan(30)
  expect(Math.abs((left + right) / 2 - (scene.geometry.plot.x + scene.geometry.plot.width / 2))).toBeLessThan(2)
})

it.each(['text', 'category', 'auto'] as const)('renders side captions without markers in %s color mode', (waffleLabelColor) => {
  const option = renderScene(compileNativeWaffleScene(table, config({ waffleLabelColor }))) as { legend: { show: boolean }; graphic: Array<{ id?: string; children?: Array<{ type: string }> }> }
  const labels = option.graphic.filter((item) => item.id?.startsWith('waffle-label:'))
  expect(labels).toHaveLength(3)
  expect(labels.every((label) => label.children?.every((child) => child.type === 'text'))).toBe(true)
  expect(option.legend.show).toBe(false)
})

it('uses label placement as the only switch for the waffle top legend', () => {
  for (const placement of ['right', 'inside', 'legend'] as const) {
    const scene = compileNativeWaffleScene(table, config({ waffleLabelPosition: placement, showLegend: placement !== 'legend', legendPosition: 'bottom' }))
    expect(scene.guides[0]).toMatchObject({ visible: placement === 'legend', position: 'top' })
    expect(scene.compatibilityConfig.showLegend).toBe(placement === 'legend')
  }
  expect(compileNativeWaffleScene(table, config({ waffleLabelPosition: 'legend', showValues: false })).guides[0].visible).toBe(false)
})

it.each(['bar', 'line', 'pie', 'waffle'] as const)('colors %s legend text with the actual category or series color', (kind) => {
  const settings = config({ kind, waffleLabelPosition: 'legend', showLegend: true, legendLabelColorByCategory: true, seriesStyles: { 'А': { color: '#123456', legendLabel: 'Категория А' }, 'Значение': { color: '#654321', legendLabel: 'Мой ряд' } } })
  const option = getChartPlugin(kind).buildOption(table, settings) as { legend: { data: Array<{ itemStyle: { color: string }; textStyle?: { color: string } }> } }
  expect(option.legend.data.length).toBeGreaterThan(0)
  for (const item of option.legend.data) expect(item.textStyle?.color).toBe(item.itemStyle.color)
  const plain = getChartPlugin(kind).buildOption(table, { ...settings, legendLabelColorByCategory: false }) as typeof option
  for (const item of plain.legend.data) expect(item.textStyle?.color).toBeUndefined()
})
