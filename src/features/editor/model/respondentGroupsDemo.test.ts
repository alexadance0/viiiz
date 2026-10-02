import { expect, it } from 'vitest'
import { createRespondentGroupsDemoConfig, respondentGroupsDemoTable } from './respondentGroupsDemo'
import { normalizeImportedTable } from '../../../core/normalization'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resolveMultiplesPanels, resolveMultiplesRowHeights } from './multiples'
import { resolveNativeScene } from '../../chart-renderer/echarts/renderScene'

it('keeps the synthetic group data numeric and stacks each category to 100 with equal spacing', () => {
  const table = normalizeImportedTable(respondentGroupsDemoTable)
  const config = createRespondentGroupsDemoConfig(), grid = config.multiples!
  const heights = resolveMultiplesRowHeights(table, grid, 904, 950)
  const panels = resolveMultiplesPanels(table, grid, 904, heights)
  const scenes = panels.map((panel) => getChartPlugin(panel!.kind).compile(table, panel!))
  for (const scene of scenes) {
    expect(scene.plot.kind).toBe('bar')
    if (scene.plot.kind !== 'bar') continue
    const plot = scene.plot
    expect(plot.series[0].marks.every((mark) => typeof mark.value === 'number')).toBe(true)
    expect(plot.series[0].marks.map((mark, index) => mark.value! + plot.series[1].marks[index].value!)).toEqual(plot.categories.map(() => 100))
    expect(resolveNativeScene(scene).geometry.plot.height).toBeGreaterThan(0)
  }
})
