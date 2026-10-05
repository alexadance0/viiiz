import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import rows from './data/usBornInSameState2024.json'

const valueField = 'Родились в своём штате, %'

export const usBornInSameStateDemoTable: DataTable = {
  name: 'Родившиеся в своём штате — США, 2024',
  columns: ['Штат', valueField],
  rows: rows.map((row) => ({ Штат: row.state, [valueField]: row.percent })),
}

export function createUsBornInSameStateDemoConfig(): ChartConfig {
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('map-usa').defaultConfig,
    kind: 'map-usa', xField: 'Штат', yField: valueField, yFields: [valueField], seriesField: '',
    preferredDataSelection: { xField: 'Штат', yFields: [valueField], seriesField: '' },
    xAxisTitle: 'Штат', yAxisTitle: valueField,
    numberSuffix: '%', numberDecimals: 1,
    title: 'Где родился, там и пригодился',
    subtitle: 'Доля жителей каждого штата США, родившихся в этом же штате, %. 2024 год',
    note: '', source: 'Источник: U.S. Census Bureau',
  }
}
