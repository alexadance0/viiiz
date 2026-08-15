import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeWaterfallScene, legacyWaterfallBuilderGuard } from './compiler'
import { resolveNativeWaterfallScene } from './layout'

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

  it('keeps compiler independent of ECharts and fails closed through the legacy guard', () => {
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|renderWaterfallScene|buildOption/)
    expect(() => legacyWaterfallBuilderGuard()).toThrow(/removed/)
  })
})
