import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import rows from './data/russiaTurnout2026.json'

export const russiaTurnoutDemoTable: DataTable = {
  name: 'Явка на выборах в Госдуму (2026)',
  columns: ['Регион', 'Явка, %'],
  rows: rows.map((row) => ({ Регион: row.Регион, 'Явка, %': row.Явка })),
}

export function createRussiaTurnoutDemoConfig(): ChartConfig {
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('map-russia').defaultConfig,
    kind: 'map-russia', xField: 'Регион', yField: 'Явка, %', yFields: ['Явка, %'], seriesField: '',
    preferredDataSelection: { xField: 'Регион', yFields: ['Явка, %'], seriesField: '' },
    xAxisTitle: 'Регион', yAxisTitle: 'Явка',
    numberSuffix: '%', numberDecimals: 2,
    heatmapScaleMin: 0, heatmapScaleMax: 100,
    heatmapScaleMode: 'diverging', heatmapMidpoint: 50, heatmapShowScale: true,
    heatmapLowColor: '#E8F000', heatmapMidColor: '#F09A32', heatmapHighColor: '#CF0606',
    title: 'Явка на выборах в Госдуму (2026)',
    subtitle: 'Доля проголосовавших избирателей по регионам, %',
    note: 'Данные на 20 сентября',
    source: 'Источник: ЦИК',
  }
}
