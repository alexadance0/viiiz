import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { ChartConfig, DataTable } from '../../../core/types'
import { compileNativeWaterfallScene } from '../../chart-types/waterfall/compiler'
import { resolveNativeWaterfallScene } from '../../chart-types/waterfall/layout'
import { compileNativeButterflyScene } from '../../chart-types/butterfly/compiler'
import { resolveNativeButterflyScene } from '../../chart-types/butterfly/layout'
import { renderWaterfallScene } from './renderWaterfallScene'
import { renderButterflyScene } from './renderButterflyScene'

const defaults = createDefaultChartConfig()
describe('native Waterfall and Butterfly ECharts adapters', () => {
  it('renders Waterfall only from resolved custom geometry', () => {
    const table: DataTable = { name: 'wf', columns: ['x', 'y'], rows: [{ x: 'A', y: 10 }, { x: 'B', y: -3 }] }
    const config: ChartConfig = { ...defaults, kind: 'waterfall', xField: 'x', yField: 'y', yFields: ['y'], aggregation: 'none' }
    const option = renderWaterfallScene(resolveNativeWaterfallScene(compileNativeWaterfallScene(table, config))) as { series: Array<{ type: string; data: Array<{ elementId: string }> }>; graphic: Array<{ id?: string }> }
    expect(option.series).toHaveLength(1)
    expect(option.series[0].type).toBe('custom')
    expect(option.series[0].data.every((mark) => Boolean(mark.elementId))).toBe(true)
    expect(option.graphic.filter((item) => item.id?.startsWith('waterfall-connector:'))).toHaveLength(2)
  })

  it('renders Butterfly as resolved custom series with selectable identity', () => {
    const table: DataTable = { name: 'bf', columns: ['x', 'l', 'r'], rows: [{ x: 'A', l: 10, r: 12 }] }
    const config: ChartConfig = { ...defaults, kind: 'butterfly', xField: 'x', yField: 'l', yFields: ['l', 'r'], butterflyLeftFields: ['l'], butterflyRightFields: ['r'], aggregation: 'none' }
    const option = renderButterflyScene(resolveNativeButterflyScene(compileNativeButterflyScene(table, config))) as { series: Array<{ type: string; data: Array<{ elementId: string }> }>; graphic: Array<{ id?: string }> }
    expect(option.series.map((series) => series.type)).toEqual(['custom', 'custom'])
    expect(option.series.flatMap((series) => series.data).every((mark) => Boolean(mark.elementId))).toBe(true)
    expect(option.graphic.some((item) => item.id?.startsWith('category-label:'))).toBe(true)
  })
})
