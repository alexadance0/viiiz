import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App, { chartModeDefaults, chartModeState, compatibleMeasureSelection, designChangeKey, moveTreemapItem, shouldHideXAxisTitle } from './App'
import { chartRegistry } from './core/chartRegistry'
import { createDefaultChartConfig } from './entities/chart/model/defaultChartConfig'

describe('editor startup', () => {
  it('renders the initial editor route without a runtime exception', () => {
    const html = renderToString(<MemoryRouter><App/></MemoryRouter>)
    expect(html).toContain('Добавьте данные')
    expect(html).toContain('Трудности бизнеса')
  })

  it('keeps chart-specific preview settings isolated by chart type', () => {
    const slope = chartModeDefaults('slope')
    const line = chartModeDefaults('line')
    expect(slope).toMatchObject({ showValues: true, showLegend: false, showYAxisTitle: false, showHorizontalGrid: false })
    expect(line).toMatchObject({ showValues: false, showLegend: false, showXAxisTitle: false, showYAxisTitle: false, showHorizontalGrid: true })
    for (const { id } of chartRegistry) expect(chartModeDefaults(id)).toMatchObject({ showXAxisTitle: false, showYAxisTitle: false })
    expect(chartModeDefaults('moving-average-line').showLegend).toBe(false)
    expect(chartModeDefaults('moving-average-scatter').showLegend).toBe(false)
    expect(chartModeDefaults('histogram').showLegend).toBe(true)
    expect(chartModeDefaults('kde-plot').showLegend).toBe(true)
    expect(chartModeDefaults('heatmap').showYAxisTitle).toBe(false)
    expect(chartModeDefaults('jitter-plot')).toMatchObject({ showXAxisLine: true, showYAxisLine: false, showXTicks: true, showYTicks: false, showHorizontalGrid: true, showVerticalGrid: false })

    const customized = createDefaultChartConfig()
    customized.showValues = true
    customized.showLegend = true
    customized.showVerticalGrid = true
    expect(chartModeState(customized)).toMatchObject({ showValues: true, showLegend: true, showVerticalGrid: true })
  })

  it('hides date-axis titles before a non-scatter chart is first rendered', () => {
    expect(shouldHideXAxisTitle('line', 'date')).toBe(true)
    expect(shouldHideXAxisTitle('scatter', 'date')).toBe(false)
    expect(shouldHideXAxisTitle('line', 'text')).toBe(false)
  })

  it('preserves selected measures when changing chart type', () => {
    expect(compatibleMeasureSelection(['profit', 'orders'], ['profit', 'orders', 'returns'], 'profit')).toEqual(['profit', 'orders'])
    expect(compatibleMeasureSelection(['region'], ['profit', 'orders'], 'region')).toEqual(['profit'])
  })

  it('moves treemap items before a target or to the end', () => {
    expect(moveTreemapItem(['A', 'B', 'Другое', 'C'], 'Другое', 'B')).toEqual(['A', 'Другое', 'B', 'C'])
    expect(moveTreemapItem(['A', 'B', 'Другое', 'C'], 'Другое', 'B', 'after')).toEqual(['A', 'B', 'Другое', 'C'])
    expect(moveTreemapItem(['A', 'B', 'Другое', 'C'], 'Другое')).toEqual(['A', 'B', 'C', 'Другое'])
  })

  it('groups only repeated edits of the same design property', () => {
    const initial = createDefaultChartConfig()
    const color = { ...initial, elementStyles: { block: { color: '#6956e8' } } }
    const nextColor = { ...color, elementStyles: { block: { color: '#8b7cf0' } } }
    const label = { ...nextColor, elementStyles: { block: { ...nextColor.elementStyles.block, showLabel: false } } }
    expect(designChangeKey(initial, color)).toBe('elementStyles:block:color')
    expect(designChangeKey(color, nextColor)).toBe('elementStyles:block:color')
    expect(designChangeKey(nextColor, label)).toBe('elementStyles:block:showLabel')
    expect(designChangeKey(initial, { ...initial, barCategorySort: 'value-desc' })).toBe('barCategorySort')
  })
})
