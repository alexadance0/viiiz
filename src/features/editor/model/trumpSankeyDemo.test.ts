import { expect, it } from 'vitest'
import { sankeyDemoTable } from '../../../core/demoData'
import { compileNativeSankeyScene, validateNativeSankeyMapping } from '../../chart-types/sankey/compiler'
import { resolveNativeSankeyScene } from '../../chart-types/sankey/layout'
import { createTrumpSankeyDemoConfig } from './trumpSankeyDemo'

it('keeps the infographic categories, balanced branch totals and branch colors', () => {
  const config = createTrumpSankeyDemoConfig()
  expect(validateNativeSankeyMapping(sankeyDemoTable, config).ok).toBe(true)
  const scene = compileNativeSankeyScene(sankeyDemoTable, config)
  expect(scene.plot.total).toBe(171)
  expect(scene.plot.links).toHaveLength(22)
  for (const node of scene.plot.nodes) {
    const incoming = scene.plot.links.filter((link) => link.target === node.name)
    const outgoing = scene.plot.links.filter((link) => link.source === node.name)
    if (incoming.length && outgoing.length) expect(incoming.reduce((sum, link) => sum + link.value, 0)).toBe(outgoing.reduce((sum, link) => sum + link.value, 0))
  }
  expect(scene.plot.nodes.find((node) => node.name === 'СМИ')).toMatchObject({ value: 89, color: '#b9adff' })
  expect(scene.plot.nodes.find((node) => node.name === 'Хиллари')).toMatchObject({ value: 8, color: '#49b6e9' })
  expect(scene.plot.nodes.find((node) => node.name === 'Коми')).toMatchObject({ value: 7 })
  const resolved = resolveNativeSankeyScene(scene)
  const top = (name: string) => resolved.geometry.sankey.nodes[scene.plot.nodes.find((node) => node.name === name)!.id].rect.y
  expect(top('Конкретные издания')).toBe(top('СМИ'))
  expect(top('Публичные фигуры')).toBe(top('Коми'))
  expect(top('Публичные фигуры')).toBeGreaterThan(top('Другие'))
  for (const { rect } of Object.values(resolved.geometry.sankey.nodes)) {
    expect(rect.y).toBeGreaterThanOrEqual(resolved.geometry.plot.y)
    expect(rect.y + rect.height).toBeLessThanOrEqual(resolved.geometry.plot.y + resolved.geometry.plot.height + .01)
  }
})

it('fits compact endpoint captions near their nodes and preserves manual line breaks', () => {
  const config = createTrumpSankeyDemoConfig()
  const scene = compileNativeSankeyScene(sankeyDemoTable, config)
  const resolved = resolveNativeSankeyScene(scene)
  const endpoints = scene.plot.nodes.filter((node) => !scene.plot.links.some((link) => link.source === node.name))
    .map((node) => resolved.geometry.sankey.nodes[node.id]).sort((a, b) => a.label.y - b.label.y)
  for (const [index, { rect, label }] of endpoints.entries()) {
    expect(Math.abs(label.y - rect.y - rect.height / 2)).toBeLessThanOrEqual(config.valueText.size)
    expect(label.x + label.width).toBeLessThanOrEqual(resolved.geometry.plot.x + resolved.geometry.plot.width)
    if (index) expect(label.y - label.height / 2).toBeGreaterThanOrEqual(endpoints[index - 1].label.y + endpoints[index - 1].label.height / 2)
  }
  const hillary = scene.plot.nodes.find((node) => node.name === 'Хиллари')!
  expect(resolved.geometry.sankey.nodes[hillary.id].label.text).toBe('Хиллари 8')
  const edited = resolveNativeSankeyScene(compileNativeSankeyScene(sankeyDemoTable, { ...config, elementStyles: { ...config.elementStyles, 'sankey-node:Хиллари': { label: 'Хиллари\nСейчас' } } }))
  expect(edited.geometry.sankey.nodes[hillary.id].label.text).toBe('Хиллари\nСейчас\n8')
})
