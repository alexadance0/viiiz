import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App, { resetChartPresentation, chartModeDefaults, chartModeState, compatibleMeasureSelection, designChangeKey, moveTreemapItem, rememberDataSelection, shouldHideXAxisTitle } from './App'
import { chartRegistry } from './core/chartRegistry'
import { createDefaultChartConfig } from './entities/chart/model/defaultChartConfig'
import { chartTransitionMode } from './components/ChartCanvas'

describe('editor startup', () => {
  it('renders the initial editor route without a runtime exception', () => {
    const html = renderToString(<MemoryRouter><App/></MemoryRouter>)
    expect(html).toContain('Добавьте данные')
    expect(html).toContain('Трудности бизнеса')
  })

  it.each(['horizontal-bar', 'horizontal-stacked-bar', 'horizontal-normalized-stacked-bar', 'horizontal-lollipop', 'butterfly', 'dumbbell'] as const)('%s starts with a vertical value grid', (kind) => {
    expect(chartModeDefaults(kind)).toMatchObject({ showHorizontalGrid: false, showVerticalGrid: true })
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

  it('resets the entire chart presentation while retaining the document and mapping', () => {
    const previous = { ...createDefaultChartConfig(), kind: 'marimekko' as const, title: 'Мой график', canvasWidth: 1200, yFields: ['a', 'b'], xAxisLabelRotate: 0 as const, xAxisLabelOverflow: 'wrap' as const, showValues: true, showLegend: true, showVerticalGrid: true, yAxisPosition: 'right' as const, legendPosition: 'right' as const, yAxisMin: 10, elementStyles: { a: { color: '#ffffff' } }, butterflyCategoryPosition: 'right' as const }
    const next = resetChartPresentation(previous)
    expect(next).toMatchObject({ title: 'Мой график', canvasWidth: 1200, yFields: ['a', 'b'], xAxisLabelRotate: 'auto', xAxisLabelOverflow: 'auto', showValues: false, showLegend: false, showVerticalGrid: false, yAxisPosition: 'left', legendPosition: 'top', yAxisMin: null, elementStyles: {} })
    expect(next.butterflyCategoryPosition).toBeUndefined()
    expect(previous.showValues).toBe(true)
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

  it('distinguishes explicit mapping edits from automatic chart adaptation', () => {
    const line = { ...createDefaultChartConfig(), yField: 'revenue', yFields: ['revenue', 'orders', 'plan'] }
    const remembered = rememberDataSelection(line, { ...line, yField: 'orders', yFields: ['orders'] })
    expect(remembered.preferredDataSelection?.yFields).toEqual(['orders'])
    const adapted = { ...remembered, kind: 'waterfall' as const, yFields: ['orders'] }
    expect(adapted.preferredDataSelection?.yFields).toEqual(['orders'])
  })

  it('uses stable updates for compatible chart transitions and honors reduced motion', () => {
    expect(chartTransitionMode('line', 'spline', false)).toBe('morph')
    expect(chartTransitionMode('scatter', 'bubble', false)).toBe('morph')
    expect(chartTransitionMode('strip-plot', 'jitter-plot', false)).toBe('morph')
    expect(chartTransitionMode('heatmap', 'waterfall', false)).toBe('fade')
    expect(chartTransitionMode('line', 'spline', true)).toBe('none')
  })

  it('moves treemap items before a target or to the end', () => {
    expect(moveTreemapItem(['A', 'B', 'Другое', 'C'], 'Другое', 'B')).toEqual(['A', 'Другое', 'B', 'C'])
    expect(moveTreemapItem(['A', 'B', 'Другое', 'C'], 'Другое', 'B', 'after')).toEqual(['A', 'B', 'Другое', 'C'])
    expect(moveTreemapItem(['A', 'B', 'Другое', 'C'], 'Другое')).toEqual(['A', 'B', 'C', 'Другое'])
  })

  it('groups only repeated edits of the same design property', () => {
    const initial = createDefaultChartConfig()
    const color = { ...initial, elementStyles: { block: { color: '#1677a6' } } }
    const nextColor = { ...color, elementStyles: { block: { color: '#8b7cf0' } } }
    const label = { ...nextColor, elementStyles: { block: { ...nextColor.elementStyles.block, showLabel: false } } }
    expect(designChangeKey(initial, color)).toBe('elementStyles:block:color')
    expect(designChangeKey(color, nextColor)).toBe('elementStyles:block:color')
    expect(designChangeKey(nextColor, label)).toBe('elementStyles:block:showLabel')
    expect(designChangeKey(initial, { ...initial, barCategorySort: 'value-desc' })).toBe('barCategorySort')
  })
})
