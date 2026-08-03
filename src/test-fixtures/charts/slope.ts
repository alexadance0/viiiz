import type { ChartConfig, DataTable } from '../../core/types'
import { createDefaultChartConfig } from '../../entities/chart/model/defaultChartConfig'

export const slopeTable: DataTable = {
  name: 'slope-fixture', columns: ['period', 'actual', 'plan', 'risk'], rows: [
    { period: 'Было', actual: 12, plan: 18, risk: -4 },
    { period: 'Стало', actual: 24, plan: 15, risk: 6 },
  ],
}

export const slopeConfig = (overrides: Partial<ChartConfig> = {}): ChartConfig => ({
  ...createDefaultChartConfig(), kind: 'slope', title: '', subtitle: '', note: '', source: '',
  showTitle: false, showSubtitle: false, showNote: false, showSource: false,
  xField: 'period', yField: 'actual', yFields: ['actual', 'plan', 'risk'], seriesField: '',
  showXAxisTitle: false, showYAxisTitle: false, slopeShowValues: true,
  slopeShowSeriesNames: true, slopeShowYAxis: false, ...overrides,
})
