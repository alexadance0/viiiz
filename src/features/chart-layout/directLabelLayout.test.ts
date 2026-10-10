import { describe, expect, it } from 'vitest'
import { wrapSeriesLabel, prepareDirectLabelLayout } from './directLabelLayout'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'
import { getChartPlugin } from '../../core/chartRegistry'

const style = createDefaultChartConfig().directLabelText!
describe('shared direct label layout', () => {
  it('balances a long name over two lines without splitting words', () => {
    const text = 'Выручка от цифровой музыки'
    const result = wrapSeriesLabel(text, style, 100)
    expect(result.split('\n')).toHaveLength(2)
    expect(result.replace('\n', ' ')).toBe(text)
    expect(result).toBe('Выручка от\nцифровой музыки')
  })
  it('preserves short labels, explicit newlines and indivisible names', () => {
    expect(wrapSeriesLabel('CD', style)).toBe('CD')
    expect(wrapSeriesLabel('Первая\nВторая', style)).toBe('Первая\nВторая')
    expect(wrapSeriesLabel('Неделимоеслово', style, 40)).toBe('Неделимоеслово')
  })
  it.each(['line', 'bar', 'horizontal-bar', 'stacked-area', 'stream-graph', 'bump', 'moving-average-line'] as const)('uses the same wrapping policy for %s', (kind) => {
    const name = 'Выручка от цифровой музыки'
    const table = { name: 'Labels', columns: ['period', name], rows: [{ period: 'Jan', [name]: 10 }, { period: 'Feb', [name]: 20 }, { period: 'Mar', [name]: 30 }] }
    const config = { ...createDefaultChartConfig(), ...getChartPlugin(kind).defaultConfig, kind, xField: 'period', yField: name, yFields: [name], showDirectLabels: true, directLabelMaxWidth: 100 }
    const scene = getChartPlugin(kind).compile(table, config)
    const wrapped = prepareDirectLabelLayout(scene)
    const label = wrapped.guides.find((guide) => guide.kind === 'direct-series')?.items[0].label
    expect(label).toContain('\n')
    expect(prepareDirectLabelLayout({ ...scene, compatibilityConfig: { ...config, directLabelWrap: false } }).guides).toEqual(scene.guides)
    expect(scene.guides.find((guide) => guide.kind === 'direct-series')?.items[0].label).not.toContain('\n')
  })
})
