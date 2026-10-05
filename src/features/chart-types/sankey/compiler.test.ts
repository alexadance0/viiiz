import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { getChartPlugin } from '../../../core/chartRegistry'
import type { DataTable } from '../../../core/types'
import { compileNativeSankeyScene, validateNativeSankeyMapping } from './compiler'
import { resolveNativeSankeyScene } from './layout'

const table: DataTable = { name: 'flows', columns: ['from', 'to', 'value'], rows: [
  { from: 'All', to: 'Available', value: 70 }, { from: 'All', to: 'Unavailable', value: 30 },
  { from: 'Available', to: 'Current', value: 40 }, { from: 'Available', to: 'Old', value: 20 }, { from: 'Available', to: 'Old', value: 10 },
] }
const config = { ...createDefaultChartConfig(), kind: 'sankey' as const, xField: 'from', sankeyTargetField: 'to', yField: 'value', yFields: ['value'], showValues: true, sankeyValueFormat: 'percent' as const }

describe('Sankey flows', () => {
  it('aggregates links and computes shares against the initial flow only', () => {
    const scene = compileNativeSankeyScene(table, config)
    expect(scene.document.chart).toMatchObject({ family: 'sankey', targetField: 'to' })
    expect(scene.plot.total).toBe(100)
    expect(scene.plot.links).toHaveLength(4)
    expect(scene.plot.nodes.find((node) => node.name === 'Old')).toMatchObject({ value: 30, depth: 2, displayValue: '30%' })
    expect(validateNativeSankeyMapping(table, config).ok).toBe(true)
    expect(getChartPlugin('sankey').inferMapping(table)).toMatchObject({ xField: 'from', sankeyTargetField: 'to', yField: 'value' })
  })
  it('can show shares within a branch as in multistage infographics', () => {
    const scene = compileNativeSankeyScene(table, { ...config, sankeyPercentBase: 'parent', numberDecimals: 1 })
    expect(scene.plot.nodes.find((node) => node.name === 'Current')?.displayValue).toBe('57,1%')
    expect(scene.plot.nodes.find((node) => node.name === 'Available')?.displayValue).toBe('70,0%')
  })
  it('rejects cycles, self links, missing roles, negative and invalid values', () => {
    for (const rows of [[{ from: 'A', to: 'A', value: 1 }], [{ from: 'A', to: 'B', value: 1 }, { from: 'B', to: 'A', value: 1 }], [{ from: 'A', to: 'B', value: -1 }], [{ from: 'A', to: 'B', value: Infinity }], [{ from: 'A', to: 'B', value: 'bad' }]]) expect(validateNativeSankeyMapping({ ...table, rows }, config).ok).toBe(false)
    expect(validateNativeSankeyMapping(table, { ...config, sankeyTargetField: 'from' }).ok).toBe(false)
    expect(compileNativeSankeyScene({ ...table, rows: [...table.rows, { from: 'All', to: 'Unused', value: 0 }, { from: '', to: 'Missing', value: 99 }] }, config).plot.total).toBe(100)
  })
  it('preserves thickness, bounds and early endpoints, and can align endpoints', () => {
    const scene = compileNativeSankeyScene(table, config), resolved = resolveNativeSankeyScene(scene)
    const rect = (name: string) => resolved.geometry.sankey.nodes[scene.plot.nodes.find((node) => node.name === name)!.id].rect
    expect(rect('Current').height / rect('All').height).toBeCloseTo(.4)
    expect(rect('Unavailable').x).toBeLessThan(rect('Current').x)
    for (const node of Object.values(resolved.geometry.sankey.nodes)) {
      expect(node.rect.y).toBeGreaterThanOrEqual(resolved.geometry.plot.y)
      expect(node.rect.y + node.rect.height).toBeLessThanOrEqual(resolved.geometry.plot.y + resolved.geometry.plot.height + .01)
    }
    const aligned = resolveNativeSankeyScene(compileNativeSankeyScene(table, { ...config, sankeyNodeAlign: 'justify' }))
    expect(aligned.geometry.sankey.nodes[scene.plot.nodes.find((node) => node.name === 'Unavailable')!.id].rect.x).toBe(rect('Current').x)
  })
  it('keeps individual node and link overrides and exports custom paths', () => {
    const overridden = { ...config, elementStyles: { 'sankey-node:Old': { color: '#aa0000', label: 'Old\ncaption' }, 'sankey-link:["All","Available"]': { color: '#00aa00', fillOpacity: .2 } } }
    const scene = compileNativeSankeyScene(table, overridden)
    expect(scene.plot.nodes.find((node) => node.name === 'Old')?.label.text).toContain('Old\ncaption')
    expect(scene.plot.links[0].color).toBe('#00aa00')
    const option = getChartPlugin('sankey').buildOption(table, overridden)
    expect(option.xAxis).toBeUndefined()
    expect(option.series).toMatchObject([{ type: 'custom', coordinateSystem: 'none' }])
  })
  it('keeps multistage branches in order without crossed ribbons when endpoints share the last stage', () => {
    const scene = compileNativeSankeyScene({ name: 'Early endpoints', columns: ['Откуда', 'Куда', 'Значение'], rows: [
      { Откуда: 'Все наборы данных', Куда: 'Обновляются', Значение: 80 },
      { Откуда: 'Все наборы данных', Куда: 'Исключены из плана', Значение: 20 },
      { Откуда: 'Обновляются', Куда: 'Доступны', Значение: 65 },
      { Откуда: 'Обновляются', Куда: 'Временно недоступны', Значение: 15 },
      { Откуда: 'Доступны', Куда: 'Актуальны', Значение: 42 },
      { Откуда: 'Доступны', Куда: 'Давно не обновлялись', Значение: 23 },
    ] }, { ...config, xField: 'Откуда', sankeyTargetField: 'Куда', yField: 'Значение', sankeyNodeAlign: 'justify' })
    const resolved = resolveNativeSankeyScene(scene)
    const endpoints = scene.plot.nodes.filter((node) => !scene.plot.links.some((link) => link.source === node.name))
      .sort((a, b) => resolved.geometry.sankey.nodes[a.id].rect.y - resolved.geometry.sankey.nodes[b.id].rect.y)
    expect(endpoints.map((node) => node.name)).toEqual(['Актуальны', 'Давно не обновлялись', 'Временно недоступны', 'Исключены из плана'])
    expect(new Set(endpoints.map((node) => resolved.geometry.sankey.nodes[node.id].rect.x)).size).toBe(1)
    const ribbons = scene.plot.links.map((link) => resolved.geometry.sankey.linkHits[link.id])
    const bandAt = (ribbon: Array<[number, number]>, x: number) => {
      const edge = ribbon.slice(0, ribbon.length / 2)
      const index = edge.findIndex((point, index) => index > 0 && point[0] >= x)
      const [x1, y1] = edge[index - 1], [x2, y2] = edge[index]
      const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
      return [y, y + ribbon[ribbon.length - 1][1] - ribbon[0][1]]
    }
    for (const [index, a] of ribbons.entries()) for (const b of ribbons.slice(index + 1)) {
      const left = Math.max(a[0][0], b[0][0]), right = Math.min(a[a.length / 2 - 1][0], b[b.length / 2 - 1][0])
      if (left >= right) continue
      for (let sample = 1; sample < 20; sample++) {
        const x = left + (right - left) * sample / 20
        const [aTop, aBottom] = bandAt(a, x), [bTop, bBottom] = bandAt(b, x)
        expect(Math.min(aBottom, bBottom) - Math.max(aTop, bTop)).toBeLessThanOrEqual(.01)
      }
    }
  })
})
