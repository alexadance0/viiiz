import type { ChartConfig, DataTable } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'

export interface BarFixture { name: string; table: DataTable; config: ChartConfig }
const table = (rows: DataTable['rows'], columns = Object.keys(rows[0] ?? {})): DataTable => ({ name: 'bar-fixture', columns, rows })
const baseTable = table([{ category: 'Alpha', first: 12, second: 8 }, { category: 'Beta', first: -4, second: 16 }, { category: 'Gamma', first: 0, second: 5 }])
const base = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
  ...createDefaultChartConfig(), title: '', subtitle: '', note: '', source: '', showTitle: false, showSubtitle: false, showNote: false, showSource: false,
  xField: 'category', yField: 'first', yFields: ['first'], seriesField: '', showXAxisTitle: false, showYAxisTitle: false, ...overrides,
})
const fixture = (name: string, overrides: Partial<ChartConfig> = {}, source = baseTable): BarFixture => ({ name, table: source, config: base(overrides) })

const many = table(Array.from({ length: 24 }, (_, index) => ({ category: `Category ${index + 1}`, first: index % 4 ? index : -index })))
const dates = table([0, 1, 2].map((month) => ({ category: new Date(2025, month, 1), first: month + 1 })))

export const barFixtures: BarFixture[] = [
  fixture('vertical single series'),
  fixture('horizontal single series', { kind: 'horizontal-bar' }),
  fixture('multi-series grouped', { yFields: ['first', 'second'] }),
  fixture('vertical stacked', { kind: 'stacked-bar', yFields: ['first', 'second'] }),
  fixture('horizontal stacked', { kind: 'horizontal-stacked-bar', yFields: ['first', 'second'] }),
  fixture('normalized stacked', { kind: 'normalized-stacked-bar', yFields: ['first', 'second'] }),
  fixture('mixed positive and negative'),
  fixture('zeros', {}, table([{ category: 'Zero', first: 0 }], ['category', 'first'])),
  fixture('long categories', {}, table([{ category: 'A very long category label that needs space', first: 3 }], ['category', 'first'])),
  fixture('explicit multiline category override', { xAxisLabelOverflow: 'wrap', categoryLabelOverrides: { x: { '0:Alpha': 'Alpha\nfirst' } } }),
  fixture('many categories', {}, many),
  fixture('axis top', { xAxisPosition: 'top' }),
  fixture('value axis right', { yAxisPosition: 'right' }),
  fixture('both non-default sides', { xAxisPosition: 'top', yAxisPosition: 'right' }),
  fixture('rotated categories', { xAxisLabelRotate: 45 }),
  fixture('hidden axis furniture', { showXAxisLabels: false, showYAxisLabels: false, showXTicks: false, showYTicks: false, showXAxisTitle: false, showYAxisTitle: false }),
  fixture('multiline frame', { title: 'Title\nline', subtitle: 'Subtitle\nline', note: 'Note\nline', source: 'Source\nline', showTitle: true, showSubtitle: true, showNote: true, showSource: true }),
  fixture('regular legend', { showLegend: true, yFields: ['first', 'second'] }),
  fixture('direct labels', { showDirectLabels: true, yFields: ['first', 'second'] }),
  fixture('value labels outside', { showValues: true, valueLabelPosition: 'top' }),
  fixture('series override', { seriesStyles: { first: { barWidth: 52 } } }),
  fixture('element override', { elementStyles: { ['first\u001fstring:Beta']: { showLabel: true, label: 'Peak' } } }),
  fixture('category sorting', { barCategorySort: 'value-desc' }),
  fixture('numeric formatting', { numberPrefix: '$', numberSuffix: 'm', numberDecimals: 1 }),
  fixture('date categories', { dateLabelFormat: 'month-year' }, dates),
]
