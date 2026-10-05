import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import data from './data/lifeExpectancy2023.json'

const valueField = 'Продолжительность жизни'

export const lifeExpectancyDemoTable: DataTable = {
  name: 'Our World in Data · продолжительность жизни · 2023',
  columns: ['Код', 'Страна', valueField],
  rows: data.observations.map(([country, code, value]) => ({ Код: String(code), Страна: String(country), [valueField]: value == null ? null : Number(value) })),
}

export function createLifeExpectancyDemoConfig(kind: 'map-world' | 'tilemap-world'): ChartConfig {
  return {
    ...createDefaultChartConfig(), kind,
    xField: 'Код', yField: valueField, yFields: [valueField], seriesField: '',
    preferredDataSelection: { xField: 'Код', yFields: [valueField], seriesField: '' },
    xAxisTitle: 'Страна', yAxisTitle: valueField,
    aggregation: 'sum', heatmapScaleMode: 'sequential', heatmapLowColor: '#edf2f7', heatmapHighColor: '#1923e3',
    mapShowNames: kind === 'tilemap-world',
    title: 'Ожидаемая продолжительность жизни (2023)',
    subtitle: 'При рождении, лет', note: '', source: 'Источник: Our World in Data',
  }
}
