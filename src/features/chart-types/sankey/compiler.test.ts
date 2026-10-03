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
})
