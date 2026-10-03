import { waffleCellCoordinates, waffleLabelArea } from './cells'
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


it('fills from the top by default and grows complete blocks from every corner', () => {
  expect(compileNativeWaffleScene(table, config()).compatibilityConfig.waffleFillDirection).toBe('top')
  expect(waffleCellCoordinates(3, 2).slice(0, 3)).toEqual([[0, 0], [1, 0], [2, 0]])
  expect(waffleCellCoordinates(3, 2, 'bottom')[0]).toEqual([0, 1])
  for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
    const cells = waffleCellCoordinates(5, 3, 'corner', corner, [4, 11])
    expect(new Set(cells.map(String)).size).toBe(15)
    const first = cells.slice(0, 4)
    expect(new Set(first.map(([column]) => column)).size).toBe(2)
    expect(new Set(first.map(([, row]) => row)).size).toBe(2)
    expect(cells[0]).toEqual([corner.endsWith('right') ? 4 : 0, corner.startsWith('bottom') ? 2 : 0])
    const area = waffleLabelArea(5, 3, first)
    expect(area.width * area.height).toBe(4)
    for (let row = area.row; row < area.row + area.height; row++) for (let column = area.column; column < area.column + area.width; column++) expect(first).toContainEqual([column, row])
  }
})

it('uses the actual cell value, calculates rows and leaves the final row incomplete', () => {
  const data = { ...table, rows: [{ Категория: 'Норматив', Значение: 1700 }, { Категория: 'Сверх нормы', Значение: 1157 }] }
  const settings = config({ waffleCellValue: 10, waffleColumns: 14, waffleShowUnitLegend: true, waffleUnitLabel: 'человек', showValues: false })
  const scene = compileNativeWaffleScene(data, settings)
  expect(scene.plot.counts).toEqual([170, 116])
  expect(scene.plot.rows).toBe(21)
  const option = renderScene(scene) as { series: Array<{ data: unknown[] }>; graphic: Array<{ id?: string; children?: Array<{ type: string; style: { text?: string } }> }> }
  expect(option.series.reduce((sum, series) => sum + series.data.length, 0)).toBe(286)
  expect(option.graphic.find((item) => item.id === 'waffle-unit-legend')?.children?.find((item) => item.type === 'text')?.style.text).toBe('= 10 человек')
  for (const waffleCellValue of [0, -1, Infinity, .001, 100000]) expect(getChartPlugin('waffle').validate(data, { ...settings, waffleCellValue }).ok).toBe(false)
})


it('keeps every corner-filled category connected on square and rectangular grids', () => {
  for (const [columns, rows] of [[10, 10], [45, 25], [3, 7], [7, 3], [1, 5], [5, 1]]) {
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      const total = columns * rows, counts = [Math.floor(total * .24), Math.floor(total * .21), Math.floor(total * .26)]
      counts.push(total - counts.reduce((sum, count) => sum + count, 0))
      const cells = waffleCellCoordinates(columns, rows, 'corner', corner, counts)
      expect(new Set(cells.map(String)).size).toBe(total)
      let offset = 0
      for (const count of counts) {
        const remaining = new Set(cells.slice(offset, offset + count).map(String))
        const queue = count ? [cells[offset]] : []
        if (count) remaining.delete(String(cells[offset]))
        for (let index = 0; index < queue.length; index++) {
          const [column, row] = queue[index]
          for (const neighbor of [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]] as Array<[number, number]>) if (remaining.delete(String(neighbor))) queue.push(neighbor)
        }
        expect(remaining.size).toBe(0)
        offset += count
      }
    }
  }
})

it('matches the unit legend marker to the grid cells and anchors captions to their own blocks', () => {
  const data = { ...table, rows: [{ Категория: 'Юг', Значение: 23.6 }, { Категория: 'Восток', Значение: 20.6 }, { Категория: 'Север', Значение: 25.82 }, { Категория: 'Запад', Значение: 29.98 }] }
  const scene = compileNativeWaffleScene(data, config({ waffleFillDirection: 'corner', waffleCorner: 'top-right', waffleShowUnitLegend: true }))
  const option = renderScene(scene) as { series: Array<{ data: unknown[]; renderItem(params: { dataIndex: number }): { shape: { x: number; y: number; width: number; height: number } } }>; graphic: Array<{ id?: string; children?: Array<{ type: string; shape?: { width: number; height: number; points?: Array<[number, number]> } }> }> }
  const marker = option.graphic.find((item) => item.id === 'waffle-unit-legend')?.children?.find((item) => item.type === 'rect')!.shape!
  const cell = option.series[0].renderItem({ dataIndex: 0 }).shape
  expect(marker.width).toBe(cell.width)
  expect(marker.height).toBe(cell.height)
  const leaders = option.graphic.filter((item) => item.id?.startsWith('waffle-label:')).map((item) => item.children?.find((child) => child.type === 'polyline')?.shape?.points)
  expect(leaders.every(Boolean)).toBe(true)
  expect(new Set(leaders.map((points) => points![0][1])).size).toBe(4)
  for (const label of option.graphic.filter((item) => item.id?.startsWith('waffle-label:'))) {
    const series = option.series[scene.plot.slices.findIndex((slice) => label.id === `waffle-label:${slice.id}`)]
    const [anchorX, anchorY] = label.children!.find((child) => child.type === 'polyline')!.shape!.points![0]
    const blocks = series.data.map((_, dataIndex) => series.renderItem({ dataIndex }).shape)
    const edge = blocks.filter((block) => Math.abs(block.x + block.width - anchorX) < .001)
    expect(edge.length).toBeGreaterThan(0)
    expect(anchorY).toBeGreaterThanOrEqual(Math.min(...edge.map((block) => block.y)))
    expect(anchorY).toBeLessThanOrEqual(Math.max(...edge.map((block) => block.y + block.height)))
  }
})

it.each(['top', 'bottom', 'left', 'right'] as const)('aligns the unit legend at the %s without overlapping the grid', (waffleUnitLegendPosition) => {
  const scene = compileNativeWaffleScene(table, config({ waffleShowUnitLegend: true, waffleUnitLegendPosition, waffleUnitLabel: 'человек' }))
  const option = renderScene(scene) as {
    nativeSelectionHits: Array<{ rect: { x: number; y: number; width: number; height: number }; info: { selectionTarget?: string } }>
    graphic: Array<{ id?: string; children?: Array<{ type: string; shape?: { x: number; y: number; width: number; height: number }; style?: { y: number; verticalAlign: string } }> }>
  }
  const cells = option.nativeSelectionHits.filter((hit) => !hit.info.selectionTarget).map((hit) => hit.rect)
  const left = Math.min(...cells.map((cell) => cell.x)), right = Math.max(...cells.map((cell) => cell.x + cell.width))
  const top = Math.min(...cells.map((cell) => cell.y)), bottom = Math.max(...cells.map((cell) => cell.y + cell.height))
  const legend = option.graphic.find((item) => item.id === 'waffle-unit-legend')!.children!
  const marker = legend.find((item) => item.type === 'rect')!.shape!
  const text = legend.find((item) => item.type === 'text')!.style!
  expect(marker.width).toBeCloseTo(cells[0].width)
  expect(text.y).toBeCloseTo(marker.y + marker.height / 2)
  expect(text.verticalAlign).toBe('middle')
  if (waffleUnitLegendPosition === 'top' || waffleUnitLegendPosition === 'bottom') expect(marker.x).toBeCloseTo(left)
  if (waffleUnitLegendPosition === 'top') expect(marker.y + marker.height).toBeLessThan(top)
  if (waffleUnitLegendPosition === 'bottom') expect(marker.y).toBeGreaterThan(bottom)
  if (waffleUnitLegendPosition === 'left') expect(marker.x + marker.width).toBeLessThan(left)
  if (waffleUnitLegendPosition === 'right') expect(marker.x).toBeGreaterThan(right)
})


it('places corner-fill remainders in an outer row rather than bending around two edges', () => {
  const cells = waffleCellCoordinates(45, 25, 'corner', 'top-left', [4, 12, 24, 71, 1014])
  const firstForty = cells.slice(0, 40)
  expect(firstForty.filter(([, row]) => row < 6)).toHaveLength(36)
  expect(firstForty.filter(([, row]) => row === 6)).toEqual([[0, 6], [1, 6], [2, 6], [3, 6]])
  expect(firstForty.every(([column]) => column < 6)).toBe(true)
})
