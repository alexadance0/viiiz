import { describe, expect, it } from 'vitest'
import { transformEconomicSeries } from './economicTransform'
import { normalizeImportedTable } from './normalization'

const monthly = () => normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows: Array.from({ length: 15 }, (_, index) => ({
  period: `${2023 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`,
  value: 100 + index * 10,
})) })

describe('FRED-like economic transformations', () => {
  it('limits the selected date period', () => {
    const result = transformEconomicSeries(monthly(), { timeColumn: 'period', valueColumn: 'value', start: '2023-03-01', end: '2023-05-31', frequency: 'original', aggregation: 'average', units: 'level' })
    expect(result.rows.map((row) => row.value)).toEqual([120, 130, 140])
  })

  it('calculates percent change from year ago using the detected frequency', () => {
    const result = transformEconomicSeries(monthly(), { timeColumn: 'period', valueColumn: 'value', frequency: 'original', aggregation: 'average', units: 'percent-year' })
    expect(result.rows.slice(0, 12).every((row) => row.value == null)).toBe(true)
    expect(result.rows[12].value).toBeCloseTo(120)
  })

  it('changes monthly frequency to quarterly and aggregates observations', () => {
    const result = transformEconomicSeries(monthly(), { timeColumn: 'period', valueColumn: 'value', start: '2023-01-01', end: '2023-06-30', frequency: 'quarterly', aggregation: 'average', units: 'level' })
    expect(result.rows.map((row) => row.value)).toEqual([110, 140])
    expect(result.timeProfiles?.period.frequency).toBe('quarterly')
  })

  it('indexes the series to 100 on the chosen date', () => {
    const result = transformEconomicSeries(monthly(), { timeColumn: 'period', valueColumn: 'value', frequency: 'original', aggregation: 'average', units: 'index', indexDate: '2023-03-01' })
    expect(result.rows[2].value).toBe(100)
    expect(result.rows[0].value).toBeCloseTo(100 / 120 * 100)
  })

  it('keeps independent categorical series independent', () => {
    const table = normalizeImportedTable({ name: 'groups', columns: ['period', 'country', 'value'], rows: [
      { period: '2024-01', country: 'A', value: 10 }, { period: '2024-02', country: 'A', value: 15 },
      { period: '2024-01', country: 'B', value: 100 }, { period: '2024-02', country: 'B', value: 120 },
    ] })
    const result = transformEconomicSeries(table, { timeColumn: 'period', valueColumn: 'value', frequency: 'original', aggregation: 'average', units: 'change' })
    expect(result.rows.map((row) => row.value)).toEqual([null, 5, null, 20])
  })
})
