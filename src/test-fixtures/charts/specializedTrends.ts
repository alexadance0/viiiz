import type { ChartConfig, DataTable } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'

const base = (kind: 'indexed-line' | 'seasonal-line', overrides: Partial<ChartConfig>): ChartConfig => ({
  ...createDefaultChartConfig(), kind, title: '', subtitle: '', note: '', source: '', showTitle: false, showSubtitle: false, showNote: false, showSource: false,
  xField: 'date', yField: 'value', yFields: ['value'], seriesField: '', showXAxisTitle: false, showYAxisTitle: false, ...overrides,
})

export const indexedTrendTable: DataTable = {
  name: 'indexed-trend', columns: ['date', 'value', 'comparison'], rows: [
    { date: new Date(2024, 0, 1), value: 20, comparison: -10 },
    { date: new Date(2024, 1, 1), value: 30, comparison: -5 },
    { date: new Date(2024, 2, 1), value: null, comparison: 0 },
    { date: new Date(2024, 3, 1), value: 10, comparison: -20 },
  ],
}

export const indexedTrendConfig = base('indexed-line', {
  yFields: ['value', 'comparison'], indexBaseXValue: `date:${(indexedTrendTable.rows[0].date as Date).toISOString()}`,
})

export const seasonalTrendTable: DataTable = {
  name: 'seasonal-trend', columns: ['date', 'value'], rows: [
    { date: new Date(2023, 0, 1), value: 10 }, { date: new Date(2023, 0, 15), value: 20 }, { date: new Date(2023, 2, 1), value: 30 },
    { date: new Date(2024, 0, 1), value: 20 }, { date: new Date(2024, 1, 1), value: 40 }, { date: new Date(2024, 2, 1), value: 60 },
  ],
}

export const seasonalTrendConfig = base('seasonal-line', {
  aggregation: 'average', seasonalAccentYears: ['2024'], showLegend: true,
})
