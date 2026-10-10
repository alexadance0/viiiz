import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { seriesTooltip, activeTooltipHtml, styleChartTooltip } from './chartTooltip'

const config = { ...createDefaultChartConfig(), numberSuffix: ' млрд $' }
const series = [{ name: 'Загрузки', color: '#c65356' }, { name: 'CD', color: '#084f91' }]
const entries = [
  { seriesName: 'Загрузки', dataIndex: 0, data: { displayValue: '1,25 млрд $', displayCategory: '2017' } },
  { seriesName: 'CD', dataIndex: 0, data: { displayValue: '0,00 млрд $' } },
]

describe('chart tooltip presentation', () => {
  it('shows units once, aligned values and category-colored markers without losing zeros', () => {
    const html = seriesTooltip(entries, config, series, () => '')
    expect(html.match(/млрд \$/g)).toHaveLength(1)
    expect(html).toContain('<strong>2017</strong>')
    expect(html).toContain('background-color:#c65356')
    expect(html).toContain('chart-tooltip-value">1,25</td>')
    expect(html).toContain('chart-tooltip-value">0,00</td>')
    expect(html).toContain('is-muted')
  })
  it('escapes data and custom labels, and rejects colors that inject CSS', () => {
    const html = seriesTooltip([{ seriesName: '<img>', data: { displayValue: '<script>', displayCategory: '<b>year</b>', displayColor: 'red;background-image:url(https://example.com)' } }], { ...config, seriesStyles: { '<img>': { legendLabel: 'Custom <name>' } } }, [], () => '')
    expect(html).toContain('Custom &lt;name&gt;')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<img>')
    expect(html).not.toContain('background-image')
  })
  it('keeps missing values and color-encoding details, and filters interaction layers', () => {
    const html = seriesTooltip([...entries, { seriesName: '__hit__:CD' }, { seriesName: 'CD', data: { streamBand: true } }, { seriesName: 'Other', data: { displayValue: '—', colorLabel: 'Группа A' } }], config, series, () => '')
    expect(html.match(/class="chart-tooltip-row/g)).toHaveLength(3)
    expect(html).toContain('Группа A')
    expect(html).toContain('—')
    expect(seriesTooltip([], config, series, () => '')).toBe('')
    expect(seriesTooltip([{ seriesName: 'CD', data: { selectionTarget: 'guide', displayValue: 'пропуск' } }, { seriesName: 'CD', data: { directLegendLabel: true } }], config, series, () => '')).toBe('')
  })
  it('highlights the hovered series by identity, even when its display name changes', () => {
    const html = seriesTooltip(entries, { ...config, seriesStyles: { CD: { legendLabel: 'Диски' } } }, series, () => '')
    expect(activeTooltipHtml(html, 'CD')).toContain('data-series="CD" data-active="true"')
    expect(activeTooltipHtml(html, 'CD')).toContain('Диски')
  })
  it('preserves specialized tooltip information when applying the shared shell', () => {
    const option = { tooltip: { trigger: 'item', formatter: () => '<b>Медиана</b><br/>12' } }
    styleChartTooltip(option)
    expect(option.tooltip.formatter()).toContain('Медиана')
    expect(option.tooltip.formatter()).toContain('chart-tooltip-content')
    expect(option.tooltip).toMatchObject({ trigger: 'item', className: 'chart-tooltip', padding: 0 })
  })
})
