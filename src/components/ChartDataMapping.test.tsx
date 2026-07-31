import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createDefaultChartConfig } from '../entities/chart/model/defaultChartConfig'
import { ChartDataMapping } from './ChartDataMapping'

const table = { name: 'demo', columns: ['country', 'value', 'population'], rows: [{ country: 'Россия', value: 10, population: 20 }] }

describe('ChartDataMapping', () => {
  it('requires an aggregation choice when X values repeat', () => {
    const repeated = { ...table, rows: [{ country: 'Россия', value: 10, population: 20 }, { country: 'Россия', value: 15, population: 25 }] }
    const config = { ...createDefaultChartConfig(), xField: 'country', yField: 'value', yFields: ['value'] }
    const markup = renderToString(<ChartDataMapping table={repeated} numericColumns={['value', 'population']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('Для одного X найдено несколько значений')
    expect(markup).toContain('Способ агрегации повторяющихся X')
  })

  it('shows a size field only for bubble charts', () => {
    const props = { table, numericColumns: ['value', 'population'], onChange: vi.fn(), onToggleField: vi.fn() }
    const bubble = renderToString(<ChartDataMapping {...props} config={{ ...createDefaultChartConfig(), kind: 'bubble' }}/>)
    const scatter = renderToString(<ChartDataMapping {...props} config={{ ...createDefaultChartConfig(), kind: 'scatter' }}/>)
    expect(bubble).toContain('Размер точек')
    expect(scatter).not.toContain('Размер точек')
  })

  it('offers exactly two X positions for a slope chart', () => {
    const slopeTable = { ...table, rows: [{ country: '2022', value: 10, population: 20 }, { country: '2023', value: 12, population: 22 }, { country: '2024', value: 14, population: 24 }] }
    const config = { ...createDefaultChartConfig(), kind: 'slope' as const, xField: 'country', slopeXValues: ['string:2022', 'string:2024'] }
    const markup = renderToString(<ChartDataMapping table={slopeTable} numericColumns={['value', 'population']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('Сравнение двух позиций')
    expect(markup).toMatch(/Выбрано:.*2.*из 2/)
    expect(markup).toContain('Ряды данных')
  })

  it('offers every numeric field as a heatmap row', () => {
    const config = { ...createDefaultChartConfig(), kind: 'heatmap' as const, xField: 'country', yField: 'value', yFields: ['value', 'population'] }
    const markup = renderToString(<ChartDataMapping table={table} numericColumns={['value', 'population']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('Ряды тепловой карты')
    expect(markup).toContain('value')
    expect(markup).toContain('population')
    expect(markup).not.toContain('Строки / ось Y')
  })

  it('offers multiple independent measures on both Butterfly sides', () => {
    const config = { ...createDefaultChartConfig(), kind: 'butterfly' as const, xField: 'country', yField: 'value', yFields: ['value', 'population'], butterflyLeftFields: ['value'], butterflyRightFields: ['population'] }
    const markup = renderToString(<ChartDataMapping table={table} numericColumns={['value', 'population']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('Левая сторона')
    expect(markup).toContain('Правая сторона')
    expect(markup).toContain('Несколько рядов складываются внутри категории')
    expect(markup.match(/type="checkbox"/g)).toHaveLength(4)
  })

  it('maps categories, subcategories and one value for a treemap', () => {
    const hierarchy = { ...table, rows: [...table.rows, { country: 'Казахстан', value: 20, population: 30 }] }
    const config = { ...createDefaultChartConfig(), kind: 'treemap' as const, xField: 'country', yField: 'value', yFields: ['value'], treemapSubcategoryField: 'population' }
    const markup = renderToString(<ChartDataMapping table={hierarchy} numericColumns={['value', 'population']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('Категория')
    expect(markup).toContain('Подкатегория')
    expect(markup).toContain('Размер блоков')
    expect(markup).toContain('Как объединять одинаковые ветви')
    expect(markup).toContain('Какие категории показывать · ')
    expect(markup).toMatch(/2<!-- --> из <!-- -->2/)
    expect(markup).toContain('Россия')
    expect(markup).toContain('Казахстан')
    expect(markup).toContain('Подписи значений')
    expect(markup).toContain('Доля от суммы, %')
    expect(markup).not.toContain('Для одного X найдено несколько значений')
  })

  it('offers multiple measures and optional category grouping for distributions', () => {
    const config = { ...createDefaultChartConfig(), kind: 'violinplot' as const, xField: 'value', yField: 'value', yFields: ['value', 'population'] }
    const markup = renderToString(<ChartDataMapping table={table} numericColumns={['value', 'population']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('Распределяемые показатели')
    expect(markup).toContain('value')
    expect(markup).toContain('population')
    expect(markup).toContain('Не разбивать — сравнить показатели')
    expect(markup).toContain('country')
    expect(markup).not.toContain('Период / ось X')
  })

  it('allows a numeric code column to group a distribution', () => {
    const coded = { name: 'coded', columns: ['regionCode', 'value'], rows: [{ regionCode: 1, value: 10 }] }
    const config = { ...createDefaultChartConfig(), kind: 'boxplot' as const, xField: 'value', yField: 'value', yFields: ['value'] }
    const markup = renderToString(<ChartDataMapping table={coded} numericColumns={['regionCode', 'value']} config={config} onChange={vi.fn()} onToggleField={vi.fn()}/>)
    expect(markup).toContain('regionCode')
  })
})
