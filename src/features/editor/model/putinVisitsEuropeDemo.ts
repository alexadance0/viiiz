import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { mapRegions } from '../../chart-types/map/catalog'
import rows from './data/putinPresidentialVisitsEurope2000_2026.json'

const valueField = 'Визиты'
const countryNames = new Map(mapRegions('europe').map((region) => [region.id, region.name]))

export const putinVisitsEuropeDemoTable: DataTable = {
  name: 'Визиты Путина в Европу — 2000–2026',
  columns: ['Страна', valueField],
  rows: rows.map((row) => ({ Страна: countryNames.get(row.iso2) ?? row.country, [valueField]: row.visits })),
}

export function createPutinVisitsEuropeDemoConfig(): ChartConfig {
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('map-europe').defaultConfig,
    kind: 'map-europe', xField: 'Страна', yField: valueField, yFields: [valueField], seriesField: '',
    preferredDataSelection: { xField: 'Страна', yFields: [valueField], seriesField: '' },
    xAxisTitle: 'Страна', yAxisTitle: valueField,
    numberSuffix: '', numberDecimals: 0,
    title: 'Визиты Путина в страны Европы',
    subtitle: 'Число президентских визитов · 7 мая 2000 — сентябрь 2026',
    note: 'Поездки в должности премьер-министра в 2008–2012 годах не учитываются',
    source: 'Источник: Wikipedia · данные из CSV',
  }
}
