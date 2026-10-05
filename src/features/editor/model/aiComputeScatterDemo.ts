import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import rows from './data/aiTrainingCompute.json'

const xField = 'Дата публикации', yField = 'Вычисления, петаFLOP'

export const aiComputeScatterDemoTable: DataTable = {
  name: 'Вычисления для обучения ИИ — 1950–2026',
  columns: ['Система', xField, yField],
  textColumns: ['Система'],
  timeProfiles: { [xField]: { frequency: 'irregular', label: 'Даты публикаций', confidence: 100, source: 'notation' } },
  rows: rows.map((row) => {
    const [year, month, day] = row.date.split('-').map(Number)
    return { Система: row.system, [xField]: new Date(year, month - 1, day), [yField]: row.compute }
  }),
}

export function createAiComputeScatterDemoConfig(): ChartConfig {
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('scatter').defaultConfig,
    kind: 'scatter', xField, yField, yFields: [yField], seriesField: '',
    preferredDataSelection: { xField, yFields: [yField], seriesField: '' },
    scatterLabelField: 'Система', scatterPointSize: 6,
    seriesStyles: { [yField]: { color: '#1923e3' } },
    yAxisScaleType: 'log', dateLabelFormat: 'year-full',
    showLegend: false, showXAxisTitle: true, showYAxisTitle: true,
    showVerticalGrid: true, showYAxisLine: true,
    xAxisTitle: xField, yAxisTitle: yField,
    title: 'Как росли вычисления для обучения ИИ',
    subtitle: '1950–2026. Каждая точка — система искусственного интеллекта',
    note: 'Оценки вычислений в петаFLOP (10¹⁵ операций). Шкала — логарифмическая',
    source: 'Источник: Epoch AI, Our World in Data',
  }
}
