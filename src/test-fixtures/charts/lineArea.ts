import type { ChartConfig, DataTable } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'

export interface LineAreaFixture { name: string; table: DataTable; config: ChartConfig }
const table = (rows: DataTable['rows']): DataTable => ({ name: 'line-area-fixture', columns: Object.keys(rows[0] ?? {}), rows })
const values = table([{ period: 'Alpha', first: 12, second: 8 }, { period: 'Beta', first: null, second: 16 }, { period: 'Gamma', first: -4, second: 5 }])
const dates = table([0, 1, 2, 3].map((month) => ({ period: new Date(2025, month, 1), first: month + 1, second: 4 - month })))
const base = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
  ...createDefaultChartConfig(), kind: 'line', title: '', subtitle: '', note: '', source: '', showTitle: false, showSubtitle: false, showNote: false, showSource: false,
  xField: 'period', yField: 'first', yFields: ['first'], seriesField: '', showXAxisTitle: false, showYAxisTitle: false, ...overrides,
})
const fixture = (name: string, overrides: Partial<ChartConfig> = {}, source = values): LineAreaFixture => ({ name, table: source, config: base(overrides) })

export const lineAreaFixtures: LineAreaFixture[] = [
  fixture('line with gaps'),
  fixture('line connecting gaps', { missingMode: 'connect' }),
  fixture('line replacing gaps with zero', { missingMode: 'zero' }),
  fixture('spline', { kind: 'spline' }),
  fixture('step start', { kind: 'step-line', stepPosition: 'start' }),
  fixture('step end', { kind: 'step-line', stepPosition: 'end' }),
  fixture('markers and values', { showValues: true, seriesStyles: { first: { showMarker: true, markerShape: 'diamond', markerSize: 11 } } }),
  fixture('element overrides', { missingMode: 'zero', elementStyles: { ['first\u001fstring:Beta']: { showMarker: true, markerShape: 'rect', color: '#6956e8', lineWidth: 5, lineType: 'dashed', showLabel: true, label: 'Edited' } } }),
  fixture('direct labels left', { showDirectLabels: true, yAxisPosition: 'right', yFields: ['first', 'second'] }),
  fixture('direct labels right', { showDirectLabels: true, yFields: ['first', 'second'] }),
  fixture('date categories', { dateLabelFormat: 'month-context-ru' }, dates),
  fixture('log and manual domain', { yAxisScaleType: 'log', yAxisMin: 1, yAxisMax: 100 }, dates),
  fixture('area', { kind: 'area' }),
  fixture('stacked area', { kind: 'stacked-area', yFields: ['first', 'second'] }),
  fixture('normalized stacked area', { kind: 'normalized-stacked-area', yFields: ['first', 'second'] }),
  fixture('area fill override', { kind: 'area', areaFillOpacity: .55, seriesStyles: { first: { fillOpacity: .2 } } }),
  fixture('axis sides and grid', { kind: 'area', xAxisPosition: 'top', yAxisPosition: 'right', showVerticalGrid: true }),
  fixture('multiline frame', { kind: 'stacked-area', title: 'Title\nline', subtitle: 'Subtitle', note: 'Note', source: 'Source', showTitle: true, showSubtitle: true, showNote: true, showSource: true }),
]
