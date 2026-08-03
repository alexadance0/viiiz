import type { ChartConfig, DataTable } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'

const baseTable: DataTable = { name: 'smoothing', columns: ['period', 'a', 'b'], rows: [
  { period: 1, a: 1, b: 10 }, { period: 2, a: 2, b: 20 }, { period: 3, a: null, b: 30 }, { period: 4, a: 4, b: 40 }, { period: 5, a: 5, b: 50 },
] }
const baseConfig = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
  ...createDefaultChartConfig(), kind: 'moving-average-line', xField: 'period', yField: 'a', yFields: ['a'], movingAverageWindow: 3, ...overrides,
})
const dates: DataTable = { name: 'smoothing dates', columns: ['period', 'a'], rows: [1, 2, 3, 4].map((month) => ({ period: new Date(2025, month - 1, 1), a: month })) }
const repeated: DataTable = { name: 'smoothing aggregate', columns: ['period', 'a'], rows: [{ period: 'A', a: 1 }, { period: 'A', a: 3 }, { period: 'B', a: 5 }, { period: 'B', a: 7 }] }

export interface SmoothingFixture { name: string; table: DataTable; config: ChartConfig }
export const smoothingFixtures: SmoothingFixture[] = [
  { name: 'smoothing-single-series', table: baseTable, config: baseConfig() },
  { name: 'smoothing-multiple-series', table: baseTable, config: baseConfig({ yFields: ['a', 'b'] }) },
  { name: 'smoothing-window-two', table: baseTable, config: baseConfig({ movingAverageWindow: 2 }) },
  { name: 'smoothing-window-larger-than-data', table: baseTable, config: baseConfig({ movingAverageWindow: 50 }) },
  { name: 'smoothing-missing-gap', table: baseTable, config: baseConfig({ missingMode: 'gap' }) },
  { name: 'smoothing-missing-zero', table: baseTable, config: baseConfig({ missingMode: 'zero' }) },
  { name: 'smoothing-missing-connect', table: baseTable, config: baseConfig({ missingMode: 'connect' }) },
  { name: 'smoothing-date-categories', table: dates, config: baseConfig({ xField: 'period', dateLabelFormat: 'month-context-ru' }) },
  { name: 'smoothing-category-overrides', table: baseTable, config: baseConfig({ categoryLabelOverrides: { x: { '0:1': 'Первый\nпериод' } } }) },
  { name: 'smoothing-percent-mode', table: baseTable, config: baseConfig({ yFields: ['a', 'b'], valueMode: 'percent' }) },
  { name: 'smoothing-aggregation', table: repeated, config: baseConfig({ xField: 'period', aggregation: 'average' }) },
  { name: 'smoothing-custom-series-style', table: baseTable, config: baseConfig({ seriesStyles: { a: { color: '#168a72', lineWidth: 6, lineType: 'dashed', markerSize: 13 } } }) },
  { name: 'smoothing-element-overrides', table: baseTable, config: baseConfig({ elementStyles: { ['a\u001fnumber:1']: { color: '#e56b45', markerSize: 15, showLabel: true } } }) },
  { name: 'smoothing-legend', table: baseTable, config: baseConfig({ showLegend: true, showDirectLabels: false, legendPosition: 'right' }) },
  { name: 'smoothing-direct-labels', table: baseTable, config: baseConfig({ showLegend: false, showDirectLabels: true, seriesStyles: { a: { legendLabel: 'Ряд A', legendNote: 'Среднее' } } }) },
  { name: 'smoothing-log-domain', table: dates, config: baseConfig({ xField: 'period', yAxisScaleType: 'log' }) },
  { name: 'smoothing-manual-domain', table: baseTable, config: baseConfig({ yAxisMin: -10, yAxisMax: 100, yAxisStep: 10 }) },
]
