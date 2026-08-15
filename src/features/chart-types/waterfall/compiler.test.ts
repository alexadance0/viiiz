import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeWaterfallScene, legacyWaterfallBuilderGuard } from './compiler'
import { resolveNativeWaterfallScene } from './layout'
import { chartElementColor } from '../../../core/chartRegistry'

const table: DataTable = { name: 'waterfall', columns: ['factor', 'change'], rows: [{ factor: 'Revenue', change: 100 }, { factor: 'Cost', change: -30 }, { factor: 'Other', change: 20 }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'waterfall', xField: 'factor', yField: 'change', yFields: ['change'], aggregation: 'none', showValues: true, ...overrides })

describe('native Waterfall compiler and layout', () => {
  it('emits cumulative semantic marks, connectors, and a stable synthetic total', () => {
    const first = compileNativeWaterfallScene(table, config()), changedLabel = compileNativeWaterfallScene(table, config({ waterfallTotalLabel: 'Grand total' }))
    expect(first.plot.kind).toBe('waterfall')
    expect(first.plot.marks.map(({ start, end, total }) => ({ start, end, total }))).toEqual([{ start: 0, end: 100, total: false }, { start: 100, end: 70, total: false }, { start: 70, end: 90, total: false }, { start: 0, end: 90, total: true }])
    expect(first.plot.connectors).toHaveLength(3)
    expect(first.plot.marks.at(-1)?.datumId).toBe(changedLabel.plot.marks.at(-1)?.datumId)
    expect(first.plot.marks.at(-1)?.id).toBe(changedLabel.plot.marks.at(-1)?.id)
  })

  it('resolves every floating rectangle and connector before rendering', () => {
    const resolved = resolveNativeWaterfallScene(compileNativeWaterfallScene(table, config({ valueLabelPosition: 'auto' })))
    expect(Object.keys(resolved.waterfallGeometry.marks)).toHaveLength(4)
    expect(Object.values(resolved.waterfallGeometry.marks).every((mark) => mark.rect.width > 0 && mark.rect.height > 0)).toBe(true)
    expect(Object.keys(resolved.waterfallGeometry.connectors)).toHaveLength(3)
  })

  it.each([
    ['auto', 'top'],
    ['bottom', 'bottom'],
  ] as const)('reserves the native %s rail and keeps an external extrema label inside content', (valueLabelPosition, side) => {
    const resolved = resolveNativeWaterfallScene(compileNativeWaterfallScene(table, config({ valueLabelPosition, barValueLabelAbsorption: false })))
    expect(resolved.geometry.reservations[`waterfall:value-labels:${side}`]).toBeTruthy()
    const labels = Object.values(resolved.waterfallGeometry.marks).flatMap((mark) => mark.label && !mark.label.inside ? [mark.label] : [])
    const edges = labels.map((label) => ({ top: label.verticalAlign === 'top' ? label.y : label.verticalAlign === 'bottom' ? label.y - label.height : label.y - label.height / 2, bottom: label.verticalAlign === 'bottom' ? label.y : label.verticalAlign === 'top' ? label.y + label.height : label.y + label.height / 2 }))
    expect(Math.min(...edges.map((edge) => edge.top))).toBeGreaterThanOrEqual(resolved.geometry.content.y)
    expect(Math.max(...edges.map((edge) => edge.bottom))).toBeLessThanOrEqual(resolved.geometry.content.y + resolved.geometry.content.height)
  })

  it('includes the maximum configured gap in source and total extrema rails', () => {
    const extreme: DataTable = { name: 'extreme', columns: ['factor', 'change'], rows: [{ factor: 'Only', change: 100 }] }
    const resolved = resolveNativeWaterfallScene(compileNativeWaterfallScene(extreme, config({ valueLabelPosition: 'bottom', waterfallLabelGap: 40, yAxisMin: 0, yAxisMax: 100, barValueLabelAbsorption: false })))
    const topRail = resolved.geometry.reservations['waterfall:value-labels:top'], bottomRail = resolved.geometry.reservations['waterfall:value-labels:bottom']
    expect(topRail.height).toBeGreaterThanOrEqual(40)
    expect(bottomRail.height).toBeGreaterThanOrEqual(40)
    const labels = Object.values(resolved.waterfallGeometry.marks).flatMap((mark) => mark.label && !mark.label.inside ? [mark.label] : [])
    const edges = labels.map((label) => ({ top: label.verticalAlign === 'top' ? label.y : label.y - label.height, bottom: label.verticalAlign === 'bottom' ? label.y : label.y + label.height }))
    expect(Math.min(...edges.map((edge) => edge.top))).toBeGreaterThanOrEqual(resolved.geometry.content.y)
    expect(Math.max(...edges.map((edge) => edge.bottom))).toBeLessThanOrEqual(resolved.geometry.content.y + resolved.geometry.content.height)
  })

  it('keeps source-family document semantics and honors element color and label-position overrides', () => {
    const initial = compileNativeWaterfallScene(table, config())
    const sourceKey = initial.plot.marks[1].legacyKey, totalKey = initial.plot.marks.at(-1)!.legacyKey
    const customized = config({ elementStyles: { [sourceKey]: { color: '#123456', waterfallLabelPosition: 'inside-bottom' }, [totalKey]: { color: '#654321', waterfallLabelPosition: 'inside-center' } } })
    const scene = compileNativeWaterfallScene(table, customized)
    expect(scene.document.chart).toMatchObject({ family: 'waterfall', kind: 'waterfall' })
    expect(scene.plot.marks[1]).toMatchObject({ style: { color: '#123456' }, label: { position: 'inside-bottom' } })
    expect(scene.plot.marks.at(-1)).toMatchObject({ style: { color: '#654321' }, label: { position: 'inside-center' } })
    expect(chartElementColor(table, customized, sourceKey)).toBe('#123456')
    expect(chartElementColor(table, customized, totalKey)).toBe('#654321')
  })

  it.each([
    ['beginning', [null, 10, -2]],
    ['middle', [10, null, -2]],
    ['end', [10, -2, null]],
  ] as const)('keeps connectors finite across a null step at the %s', (_name, values) => {
    const nullTable: DataTable = { ...table, rows: table.rows.map((row, index) => ({ ...row, change: values[index] })) }
    const resolved = resolveNativeWaterfallScene(compileNativeWaterfallScene(nullTable, config()))
    expect(Object.keys(resolved.waterfallGeometry.marks)).toHaveLength(3)
    expect(Object.values(resolved.waterfallGeometry.connectors)).toHaveLength(3)
    expect(Object.values(resolved.waterfallGeometry.connectors).every((line) => Object.values(line).every(Number.isFinite) && (line.x1 !== 0 || line.y1 !== 0 || line.x2 !== 0 || line.y2 !== 0))).toBe(true)
  })

  it('keeps compiler independent of ECharts and fails closed through the legacy guard', () => {
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|renderWaterfallScene|buildOption/)
    expect(() => legacyWaterfallBuilderGuard()).toThrow(/removed/)
  })
})
