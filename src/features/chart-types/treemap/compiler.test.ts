import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeTreemapScene, legacyTreemapBuilderGuard, validateNativeTreemapMapping } from './compiler'
import { resolveNativeTreemapScene } from './layout'
import { wrapTreemapLabelText } from './text'
import { renderTreemapScene } from '../../chart-renderer/echarts/renderTreemapScene'

const table: DataTable = { name: 'hierarchy', columns: ['group', 'leaf', 'value'], rows: [{ group: 'Transport', leaf: 'Bus', value: 10 }, { group: 'Transport', leaf: 'Bus', value: 5 }, { group: 'Transport', leaf: 'Train', value: 20 }, { group: 'Network', leaf: 'Internet', value: 30 }, { group: 'Ignored', leaf: 'Bad', value: -8 }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'treemap', xField: 'group', yField: 'value', yFields: ['value'], treemapSubcategoryField: 'leaf', aggregation: 'sum', showValues: true, ...overrides })

describe('native Treemap compiler, layout, and renderer', () => {
  it('filters before aggregation and emits stable group and leaf semantics', () => {
    const scene = compileNativeTreemapScene(table, config())
    expect(scene.document.chart).toMatchObject({ family: 'treemap', kind: 'treemap' })
    expect(scene.plot.total).toBe(65)
    expect(scene.plot.nodes.map((node) => [node.name, node.value])).toEqual([['Transport', 35], ['Network', 30]])
    expect(scene.plot.nodes[0].children.map((node) => [node.name, node.value])).toEqual([['Train', 20], ['Bus', 15]])
    expect(scene.elements).toHaveLength(5)
    expect(scene.plot.nodes[0].legacyKey).toBe('treemap-group:Transport')
    expect(scene.plot.nodes[0].children[1].legacyKey).toBe('Transport\u001fstring:Bus')
  })

  it.each([
    ['count', 2], ['average', 7.5], ['min', 5], ['max', 10], ['sum', 15],
  ] as const)('aggregates positive rows with %s', (aggregation, expected) => {
    const bus = compileNativeTreemapScene(table, config({ aggregation })).plot.nodes.find((node) => node.name === 'Transport')?.children.find((node) => node.name === 'Bus')
    expect(bus?.value).toBe(expected)
  })

  it('renormalizes percentages after hidden groups and suppresses a duplicate single-child value', () => {
    const scene = compileNativeTreemapScene(table, config({ treemapHiddenCategories: ['Transport'], treemapValueFormat: 'percent', numberDecimals: 0 }))
    expect(scene.plot.total).toBe(30)
    expect(scene.plot.nodes[0]).toMatchObject({ name: 'Network', displayValue: '100%' })
    expect(scene.plot.nodes[0].children[0].label.text).toBe('Internet')
  })

  it('honors manual order and independent group/leaf overrides', () => {
    const original = compileNativeTreemapScene(table, config())
    const leafKey = original.plot.nodes.find((node) => node.name === 'Transport')!.children.find((node) => node.name === 'Bus')!.legacyKey
    const scene = compileNativeTreemapScene(table, config({ treemapGroupOrder: ['Network', 'Transport'], treemapLeafOrder: { Transport: ['Bus', 'Train'] }, elementStyles: { 'treemap-group:Transport': { color: '#ff00aa', showValue: false, treemapLabelPosition: 'top-right' }, [leafKey]: { color: '#000000', showName: false, showValue: true, treemapLabelPosition: 'bottom-right' } } }))
    expect(scene.plot.nodes.map((node) => node.name)).toEqual(['Network', 'Transport'])
    const transport = scene.plot.nodes[1]
    expect(transport).toMatchObject({ color: '#ff00aa', label: { position: 'top-right' } })
    expect(transport.children.map((node) => node.name)).toEqual(['Bus', 'Train'])
    expect(transport.children[0]).toMatchObject({ color: '#000000', label: { text: '15', position: 'bottom-right', color: '#ffffff' } })
  })

  it('uses a flat single level without a synthetic duplicate group', () => {
    const scene = compileNativeTreemapScene(table, config({ treemapSubcategoryField: undefined }))
    expect(scene.plot.nodes.every((node) => node.role === 'leaf' && node.children.length === 0)).toBe(true)
    expect(scene.plot.nodes.map((node) => node.name)).toEqual(['Transport', 'Network'])
  })

  it('resolves every rectangle and fits labels before rendering', () => {
    const resolved = resolveNativeTreemapScene(compileNativeTreemapScene(table, config()))
    expect(Object.keys(resolved.geometry.treemap.nodes)).toHaveLength(5)
    expect(Object.values(resolved.geometry.treemap.nodes).every(({ rect }) => rect.width > 0 && rect.height > 0)).toBe(true)
    const group = resolved.plot.nodes[0], groupGeometry = resolved.geometry.treemap.nodes[group.id]
    expect(groupGeometry.labelRect).toBeTruthy()
    expect(group.children.every((leaf) => resolved.geometry.treemap.nodes[leaf.id].rect.y >= groupGeometry.rect.y)).toBe(true)
  })

  it('hyphenates long Russian labels deterministically without ellipsis', () => {
    const lines = wrapTreemapLabelText('Экономическая и политическая нестабильность\n8', 150, 17, 'Arial', 700)
    expect(lines.join('\n')).toContain('Экономическая')
    expect(lines.at(-1)).toBe('8')
    expect(lines.join('')).not.toContain('…')
  })

  it('renders resolved custom rectangles and selection hit metadata', () => {
    const option = renderTreemapScene(resolveNativeTreemapScene(compileNativeTreemapScene(table, config()))) as { series: Array<{ type: string; data: unknown[] }>; nativeSelectionHits: unknown[]; nativeTreemapHits: unknown[] }
    expect(option.series).toMatchObject([{ type: 'custom' }])
    expect(option.series[0].data).toHaveLength(5)
    expect(option.nativeSelectionHits).toHaveLength(5)
    expect(option.nativeTreemapHits).toHaveLength(5)
  })

  it('validates positive data and fails closed through the legacy guard', () => {
    expect(validateNativeTreemapMapping(table, config()).ok).toBe(true)
    expect(validateNativeTreemapMapping({ ...table, rows: [{ group: 'A', leaf: 'A1', value: 0 }] }, config()).ok).toBe(false)
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|buildOption/)
    expect(() => legacyTreemapBuilderGuard()).toThrow(/native semantic scene/)
  })
})
