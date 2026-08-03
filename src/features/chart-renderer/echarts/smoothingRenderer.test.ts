import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getChartPlugin, chartElementColor, chartValueLabelSelections } from '../../../core/chartRegistry'
import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { nativeMarkSelections } from '../../../entities/chart/model/sceneVisitors'
import { renderScene } from './renderScene'

const table: DataTable = { name: 'smooth', columns: ['period', 'value'], rows: [1, 2, 3, 4].map((period) => ({ period, value: period })) }
const config = (kind: 'moving-average-line' | 'moving-average-scatter', overrides: Partial<ChartConfig> = {}): ChartConfig => ({ ...createDefaultChartConfig(), kind, xField: 'period', yField: 'value', yFields: ['value'], movingAverageWindow: 3, ...overrides })

describe('native ECharts smoothing adapter', () => {
  it.each(['moving-average-line', 'moving-average-scatter'] as const)('%s never reaches its legacy builder through compile, render, visitors, or compatibility helpers', (kind) => {
    const plugin = getChartPlugin(kind), previous = plugin.buildOption
    plugin.buildOption = () => { throw new Error('legacy builder reached') }
    try {
      const source = config(kind), scene = plugin.compile(table, source)
      if (scene.migrationMode !== 'native' || scene.plot.kind !== 'smoothing') throw new Error('Expected native smoothing scene')
      expect(renderScene(scene)).toMatchObject({ grid: expect.any(Object), xAxis: expect.any(Object), yAxis: expect.any(Object) })
      const marks = nativeMarkSelections(scene)
      expect(marks).toHaveLength(4)
      expect(chartElementColor(table, source, marks[0].legacyKey)).toBeTruthy()
      expect(chartValueLabelSelections(table, source)).toHaveLength(4)
    } finally { plugin.buildOption = previous }
  })

  it('renders raw points and average lines from semantic render modes with semantic legend markers', () => {
    const scene = getChartPlugin('moving-average-scatter').compile(table, config('moving-average-scatter', { showLegend: true }))
    if (scene.migrationMode !== 'native' || scene.plot.kind !== 'smoothing') throw new Error('Expected native smoothing scene')
    const plot = scene.plot
    const option = renderScene(scene) as { series: Array<{ id?: string; name: string; type: string; data: Array<{ value: number | null }>; itemStyle?: { opacity?: number } }>; legend: { data: Array<{ name: string; icon: string; itemStyle: { opacity: number } }> }; tooltip: { formatter: (input: unknown) => string } }
    const raw = option.series.find((series) => series.id === plot.layers[0].id)!
    const average = option.series.find((series) => series.id === plot.layers[1].id)!
    expect(raw).toMatchObject({ type: 'scatter', itemStyle: { opacity: .22 } })
    expect(average.type).toBe('line')
    expect(average.data.map((point) => point.value)).toEqual([null, null, 2, 3])
    expect(option.legend.data.map((item) => [item.icon, item.itemStyle.opacity])).toEqual([['circle', .22], ['path://M0 4H24V7H0Z', 1]])
    expect(option.tooltip.formatter([{ seriesName: raw.name, value: 1, dataIndex: 0, data: { displayCategory: '1', displayValue: '1' } }, { seriesName: average.name, value: null, dataIndex: 0, data: { displayCategory: '1', displayValue: 'пропуск' } }])).toContain('пропуск')
  })

  it('supports native Line → smoothing → Area and native Slope → smoothing → Slope transitions', () => {
    const modes = ['line', 'moving-average-line', 'area', 'slope', 'moving-average-scatter', 'slope'] as const
    const scenes = modes.map((kind) => getChartPlugin(kind).compile(table, { ...config('moving-average-line'), kind, slopeXValues: ['number:1', 'number:4'] }))
    expect(scenes.map((scene) => scene.migrationMode)).toEqual(modes.map(() => 'native'))
    expect(scenes.map((scene) => scene.migrationMode === 'native' ? scene.plot.kind : '')).toEqual(['line', 'smoothing', 'area', 'slope', 'smoothing', 'slope'])
  })

  it('keeps compiler/layout/renderer boundaries free from compatibility kind branches and legacy transform code', () => {
    const compiler = readFileSync(new URL('../../chart-types/smoothing/compiler.ts', import.meta.url), 'utf8')
    const renderer = readFileSync(new URL('./renderSmoothingScene.ts', import.meta.url), 'utf8')
    const canvas = readFileSync(new URL('../../../components/ChartCanvas.tsx', import.meta.url), 'utf8')
    const registry = readFileSync(new URL('../../../core/chartRegistry.ts', import.meta.url), 'utf8')
    expect(compiler).not.toMatch(/echarts|buildOption|renderSmoothingScene/)
    expect(renderer).not.toMatch(/compatibilityConfig\.kind|moving-average-line|moving-average-scatter/)
    expect(canvas).not.toMatch(/moving-average-line|moving-average-scatter|plot\.kind === ['"]smoothing/)
    expect(registry).not.toMatch(/const smoothing\s*=|function movingAverage|export const movingAverage/)
  })
})
