import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartElementColor, chartValueLabelSelections, getChartPlugin } from '../../../core/chartRegistry'
import { barFixtures } from '../../../test-fixtures/charts/bar'
import { resolveNativeBarScene } from '../../chart-types/bar/layout'
import { NATIVE_BAR_KINDS } from '../../chart-types/bar/compiler'
import { renderScene } from './renderScene'

describe('native ECharts bar adapter', () => {
  it('uses resolved Viiiz geometry as an authoritative containLabel-free grid', () => {
    const source = barFixtures.find((fixture) => fixture.name === 'both non-default sides')!
    const scene = getChartPlugin('bar').compile(source.table, source.config)
    const resolved = resolveNativeBarScene(scene)
    const option = renderScene(resolved) as { grid: { left: number; top: number; right: number; bottom: number; containLabel: boolean } }
    expect(option.grid).toEqual({ left: resolved.geometry.plot.x, top: resolved.geometry.plot.y, right: resolved.geometry.canvas.width - resolved.geometry.plot.x - resolved.geometry.plot.width, bottom: resolved.geometry.canvas.height - resolved.geometry.plot.y - resolved.geometry.plot.height, containLabel: false })
    expect(resolved.geometry.reservations).toHaveProperty('axis:category')
    expect(resolved.geometry.reservations).toHaveProperty('axis:value')
  })

  it.each(NATIVE_BAR_KINDS)('%s compiles, renders and serves helpers when buildOption throws', (kind) => {
    const source = barFixtures[2]
    const plugin = getChartPlugin(kind)
    const original = plugin.buildOption
    plugin.buildOption = () => { throw new Error('legacy builder reached') }
    try {
      const config = { ...source.config, kind }
      expect(() => renderScene(plugin.compile(source.table, config))).not.toThrow()
      expect(chartElementColor(source.table, config, `first\u001fstring:Alpha`)).toBeTruthy()
      expect(chartValueLabelSelections(source.table, config)).not.toHaveLength(0)
    } finally { plugin.buildOption = original }
  })

  it('keeps the semantic compiler free from renderer and ECharts imports', () => {
    const source = readFileSync(new URL('../../chart-types/bar/compiler.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/echarts|renderBarScene|buildOption/)
  })

  it('renders the complete direct-series guide from semantic label intent', () => {
    const source = barFixtures.find((fixture) => fixture.name === 'direct labels')!
    const config = { ...source.config, showDirectLabelLines: true, seriesStyles: { ...source.config.seriesStyles, first: { legendLabel: 'Primary', legendNote: 'Latest value' } } }
    const option = renderScene(getChartPlugin('bar').compile(source.table, config)) as {
      series: Array<{ data: Array<{ label?: { formatter?: string } }> }>
      graphic: Array<{ id?: string }>
    }
    expect(option.series[0].data.at(-1)?.label?.formatter).toBe('Primary\nLatest value')
    expect(option.graphic.some((item) => item.id?.startsWith('direct-guide-line:'))).toBe(true)
  })
})
