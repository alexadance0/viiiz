import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import data from './data/usMusicRevenue1973_2025.json'

// Keep the historical layers in the reference's bottom-to-top order.
const formats = [
  ['8-track', '8-track', '#2b82d9'],
  ['cassette', 'Кассеты', '#35a58e'],
  ['cd', 'CD', '#084f91'],
  ['downloads', 'Загрузки', '#c65356'],
  ['streaming', 'Стриминг', '#8067a5'],
  ['vinyl', 'Винил', '#ee7b2c'],
  ['other', 'Прочее', '#202027'],
] as const

export const streamGraphDemoTable: DataTable = {
  name: 'Музыка в США · 1973–2025',
  columns: ['Год', ...formats.map(([, label]) => label)],
  rows: data.years.map((row) => ({
    Год: new Date(row.year, 0, 1),
    ...Object.fromEntries(formats.map(([key, label]) => [label, row.adjusted[data.groups.indexOf(key)]])),
  })),
}

export function createStreamGraphDemoConfig(): ChartConfig {
  const fields = streamGraphDemoTable.columns.slice(1)
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('stream-graph').defaultConfig,
    kind: 'stream-graph', xField: 'Год', yField: fields[0], yFields: fields, seriesField: '',
    preferredDataSelection: { xField: 'Год', yFields: fields, seriesField: '' },
    title: 'От винила к стримингу',
    subtitle: 'Выручка музыкальной индустрии США по форматам · 1973–2025',
    note: 'Млрд долларов в ценах 2025 года · оптовая выручка. I полугодие 2026: $5,975 млрд в текущих ценах.',
    source: 'Источник: RIAA · US Revenue Database; Mid-Year 2026',
    dateLabelFormat: 'year-full', dateAxisStepUnit: 'year', xAxisStep: 5, dateAxisAnchor: '1975-01-01',
    streamBaseline: 'centered', streamOrder: 'data', streamSmooth: true,
    numberDecimals: 2, numberSuffix: ' млрд $', areaFillOpacity: 1,
    canvasPreset: 'custom', canvasWidth: 1000, canvasHeight: 650,
    seriesStyles: Object.fromEntries(formats.map(([, label, color]) => [label, { color }])),
  }
}
