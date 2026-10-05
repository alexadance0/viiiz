import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import rows from './data/f1ConstructorStandings.json'

const teamColors: Record<string, string> = {
  McLaren: '#ff8000', Mercedes: '#27f4d2', 'Red Bull': '#3671c6', Ferrari: '#e8002d',
  Williams: '#1868db', 'Racing Bulls': '#6692ff', 'Aston Martin': '#229971',
  Haas: '#b6babd', Sauber: '#52e252', Alpine: '#00a1e8',
}

export const f1ConstructorsDemoTable: DataTable = {
  name: 'Места команд в Кубке конструкторов F1 — 2021–2025',
  columns: ['Сезон', ...Object.keys(teamColors)],
  textColumns: ['Сезон'], rows,
}

export function createF1ConstructorsDemoConfig(): ChartConfig {
  const teams = Object.keys(teamColors)
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('bump').defaultConfig,
    kind: 'bump', xField: 'Сезон', yField: teams[0], yFields: teams, seriesField: '',
    preferredDataSelection: { xField: 'Сезон', yFields: teams, seriesField: '' },
    bumpMode: 'rank',
    seriesStyles: Object.fromEntries(teams.map((team) => [team, { color: teamColors[team] }])),
    xAxisTitle: 'Сезон', yAxisTitle: 'Место',
    title: 'Борьба за Кубок конструкторов (2021–2025)',
    subtitle: 'Итоговые места команд по сезонам',
    note: 'Sauber включает Alfa Romeo; Racing Bulls — AlphaTauri и RB',
    source: 'Источник: Formula 1',
  }
}
