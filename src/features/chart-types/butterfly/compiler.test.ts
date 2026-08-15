import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeButterflyScene, legacyButterflyBuilderGuard, validateNativeButterflyMapping } from './compiler'
import { resolveNativeButterflyScene } from './layout'

const table: DataTable = { name: 'butterfly', columns: ['group', 'leftA', 'leftB', 'rightA', 'rightB'], rows: [{ group: 'A', leftA: 20, leftB: 35, rightA: 30, rightB: 50 }, { group: 'B', leftA: -15, leftB: 10, rightA: 25, rightB: 5 }] }
const config = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind: 'butterfly', xField: 'group', yField: 'leftA', yFields: ['leftA', 'leftB', 'rightA', 'rightB'], butterflyLeftFields: ['leftA', 'leftB'], butterflyRightFields: ['rightA', 'rightB'], aggregation: 'none', ...overrides })

describe('native Butterfly compiler and layout', () => {
  it('emits independent left/right stacks with a symmetric semantic domain', () => {
    const scene = compileNativeButterflyScene(table, config())
    expect(scene.plot.kind).toBe('butterfly')
    expect(scene.plot.series.map((series) => series.side)).toEqual(['left', 'left', 'right', 'right'])
    expect(scene.plot.series.map((series) => series.marks[0].stackEnd)).toEqual([20, 55, 30, 80])
    expect(scene.plot.valueDomain.min).toBe(-scene.plot.valueDomain.max)
    expect(validateNativeButterflyMapping(table, config({ butterflyRightFields: ['leftA'] })).ok).toBe(false)
  })

  it.each(['center', 'left', 'right'] as const)('resolves mirrored rectangles and %s category placement', (placement) => {
    const resolved = resolveNativeButterflyScene(compileNativeButterflyScene(table, config({ butterflyCategoryPosition: placement })))
    expect(Object.keys(resolved.butterflyGeometry.marks)).toHaveLength(8)
    expect(resolved.butterflyGeometry.centerGap > 0).toBe(placement === 'center')
    const left = resolved.butterflyGeometry.marks[resolved.plot.series[0].marks[0].id], right = resolved.butterflyGeometry.marks[resolved.plot.series[2].marks[0].id]
    expect(left.x + left.width).toBeLessThanOrEqual(right.x)
  })

  it('keeps compiler independent of ECharts and fails closed through the legacy guard', () => {
    expect(readFileSync(new URL('./compiler.ts', import.meta.url), 'utf8')).not.toMatch(/echarts|renderButterflyScene|buildOption/)
    expect(() => legacyButterflyBuilderGuard()).toThrow(/removed/)
  })
})
