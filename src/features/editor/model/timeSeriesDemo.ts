import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import data from './data/timeSeriesExamples.json'

const date = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const keyRateDemoTable: DataTable = {
  name: 'Банк России · ключевая ставка · 2020–2026',
  columns: ['Дата', 'Ключевая ставка'],
  rows: data.keyRate.observations.filter(([day]) => String(day) >= '2020-01-01').map(([day, value]) => ({ Дата: date(String(day)), 'Ключевая ставка': Number(value) })),
  timeProfiles: { Дата: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' } },
}

export const usInflationDemoTable: DataTable = {
  name: 'FRED / BLS · инфляция в США · 1948–2026',
  columns: ['Дата', 'Инфляция'],
  rows: data.usInflation.observations.map(([day, value]) => ({ Дата: date(String(day)), Инфляция: value == null ? null : Number(value) })),
  timeProfiles: { Дата: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' } },
}

export function createTimeSeriesDemoConfig(kind: 'step-line' | 'line'): ChartConfig {
  const keyRate = kind === 'step-line'
  const field = keyRate ? 'Ключевая ставка' : 'Инфляция'
  return {
    ...createDefaultChartConfig(), kind,
    xField: 'Дата', yField: field, yFields: [field], seriesField: '',
    preferredDataSelection: { xField: 'Дата', yFields: [field], seriesField: '' },
    xAxisTitle: 'Дата', yAxisTitle: field,
    title: keyRate ? 'Ключевая ставка Банка России (2020–2026)' : 'Инфляция в США (1948–2026)',
    subtitle: keyRate ? '% годовых' : '% к соответствующему месяцу предыдущего года',
    note: '',
    source: keyRate ? 'Источник: Банк России' : 'Источник: FRED',
    seriesStyles: { [field]: { color: '#1923e3' } },
  }
}
