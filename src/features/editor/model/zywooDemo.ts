import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin } from '../../../core/chartRegistry'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import rows from './data/zywooWeaponKills.json'

export const zywooDemoTable: DataTable = {
  name: 'ZywOo · киллы по типам оружия · 2018–2026',
  columns: ['Год', 'Винтовки', 'Снайперские винтовки', 'Пистолеты-пулемёты', 'Пистолеты', 'Гранаты и прочее'],
  textColumns: ['Год'],
  rows: rows.map((row) => ({ ...row, Год: row.Год === '2026' ? '2026*' : row.Год })),
}

export function createZywooDemoConfig(): ChartConfig {
  const fields = zywooDemoTable.columns.slice(1)
  return {
    ...createDefaultChartConfig(), ...getChartPlugin('marimekko').defaultConfig,
    kind: 'marimekko', xField: 'Год', yField: fields[0], yFields: fields, seriesField: '',
    preferredDataSelection: { xField: 'Год', yFields: fields, seriesField: '' },
    xAxisTitle: 'Год', yAxisTitle: 'Доля киллов', showXTicks: false, showHorizontalGrid: false,
    title: 'Арсенал ZywOo: откуда берутся киллы (2018–2026)',
    subtitle: 'Доля киллов по оружию, %. Ширина блока — число киллов за год',
    note: '* 2026 — неполный год', source: 'Источник: HLTV',
  }
}
