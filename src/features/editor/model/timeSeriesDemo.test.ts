import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { createTimeSeriesDemoConfig, keyRateDemoTable, usInflationDemoTable } from './timeSeriesDemo'
import data from './data/timeSeriesExamples.json'

describe('official time series examples', () => {
  it('keeps all published key-rate observations and monthly CPI-U inflation without filling missing dates', () => {
    const rate = keyRateDemoTable.rows.find((row) => (row.Дата as Date).getFullYear() === 2022 && (row.Дата as Date).getMonth() === 1 && (row.Дата as Date).getDate() === 28)
    expect(rate?.['Ключевая ставка']).toBe(20)
    expect(keyRateDemoTable.rows.find((row) => (row.Дата as Date).getTime() === new Date(2022, 1, 25).getTime())?.['Ключевая ставка']).toBe(9.5)
    expect(keyRateDemoTable.rows.find((row) => (row.Дата as Date).getTime() === new Date(2022, 1, 27).getTime())).toBeUndefined()
    expect(keyRateDemoTable.rows.find((row) => (row.Дата as Date).getTime() === new Date(2022, 2, 6).getTime())).toBeUndefined()
    expect(keyRateDemoTable.rows[0].Дата).toEqual(new Date(2020, 0, 3))
    expect(keyRateDemoTable.rows.at(-1)?.Дата).toEqual(new Date(2026, 9, 2))
    expect(keyRateDemoTable.rows.at(-1)?.['Ключевая ставка']).toBe(14)
    expect(usInflationDemoTable.rows).toHaveLength(944)
    expect(usInflationDemoTable.rows[0].Дата).toEqual(new Date(1948, 0, 1))
    expect(usInflationDemoTable.rows[0].Инфляция).toBe(10.24209)
    expect(usInflationDemoTable.rows[893].Инфляция).toBe(8.97936) // June 2022, seasonally adjusted
    expect(usInflationDemoTable.rows[933].Инфляция).toBeNull() // October 2025 is unpublished
    expect(usInflationDemoTable.rows.at(-1)?.Дата).toEqual(new Date(2026, 7, 1))
    expect(usInflationDemoTable.rows.at(-1)?.Инфляция).toBe(3.35302)
    for (const table of [keyRateDemoTable, usInflationDemoTable]) {
      const dates = table.rows.map((row) => (row.Дата as Date).getTime())
      expect(dates.every((value, index) => Number.isFinite(value) && (!index || value > dates[index - 1]))).toBe(true)
    }
    expect(keyRateDemoTable.rows).toHaveLength(1712)
    expect(keyRateDemoTable.rows.map((row) => {
      const day = row.Дата as Date
      return [`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`, row['Ключевая ставка']]
    })).toEqual(data.keyRate.observations.filter(([day]) => String(day) >= '2020-01-01'))
  })

  it.each(['step-line', 'line'] as const)('%s keeps base presentation settings', (kind) => {
    const base = createDefaultChartConfig()
    const demo = createTimeSeriesDemoConfig(kind)
    const changed = Object.keys(base).filter((key) => JSON.stringify(base[key as keyof typeof base]) !== JSON.stringify(demo[key as keyof typeof demo]))
    expect(changed.sort()).toEqual(['kind', 'preferredDataSelection', 'xField', 'yField', 'yFields', 'xAxisTitle', 'yAxisTitle', 'title', 'subtitle', 'note', 'source', 'seriesStyles'].sort())
  })
})
