import { describe, expect, it } from 'vitest'
import { addDerivedTimeSeries, fillTimeGaps } from './timeSeriesTransform'
import { normalizeImportedTable } from './normalization'

const types = { period: 'date', value: 'number' } as const

describe('time gap filling', () => {
  const source = () => normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows: [
    { period: '2024-01', value: 10 }, { period: '2024-04', value: 40 },
  ] })

  it('creates missing periods and linearly interpolates values', () => {
    const result = fillTimeGaps(source(), types, { timeColumn: 'period', valueColumn: 'value', method: 'linear' })
    expect(result.inserted).toBe(2)
    expect(result.filled).toBe(2)
    expect(result.table.rows.map((row) => row.value)).toEqual([10, 20, 30, 40])
    expect(result.table.imputedCells?.value[1].method).toBe('linear')
    expect(result.table.rawRows?.[1].value).toBe(20)
  })

  it('supports forward fill and empty periods', () => {
    expect(fillTimeGaps(source(), types, { timeColumn: 'period', valueColumn: 'value', method: 'forward' }).table.rows.map((row) => row.value)).toEqual([10, 10, 10, 40])
    expect(fillTimeGaps(source(), types, { timeColumn: 'period', valueColumn: 'value', method: 'empty' }).table.rows.map((row) => row.value)).toEqual([10, null, null, 40])
  })

  it('uses the same season from the previous year when available', () => {
    const table = normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows: [
      { period: '2023-01', value: 100 }, { period: '2023-12', value: 120 }, { period: '2024-02', value: 140 },
    ] })
    const result = fillTimeGaps(table, types, { timeColumn: 'period', valueColumn: 'value', method: 'seasonal' })
    const january2024 = result.table.rows.find((row) => (row.period as Date).getFullYear() === 2024 && (row.period as Date).getMonth() === 0)
    expect(january2024?.value).toBe(100)
  })
})

describe('derived smoothing columns', () => {
  it('creates a centered moving average without overwriting source values', () => {
    const table = normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows: [1, 2, 3, 4, 5].map((value, index) => ({ period: `2024-0${index + 1}`, value })) })
    const result = addDerivedTimeSeries(table, types, { timeColumn: 'period', valueColumn: 'value', name: 'value_ma', method: 'moving-average', window: 3 })
    expect(result.rows.map((row) => row.value)).toEqual([1, 2, 3, 4, 5])
    expect(result.rows.map((row) => row.value_ma)).toEqual([null, 2, 3, 4, null])
  })

  it('performs additive classical seasonal adjustment on two annual cycles', () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({ period: `${2023 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`, value: 100 + index + (index % 12) * 2 }))
    const table = normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows })
    const result = addDerivedTimeSeries(table, types, { timeColumn: 'period', valueColumn: 'value', name: 'value_sa', method: 'seasonal-additive' })
    expect(result.columns).toContain('value_sa')
    expect(result.rows.every((row) => typeof row.value_sa === 'number')).toBe(true)
  })

  it('rejects non-positive values for multiplicative adjustment', () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({ period: `${2023 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`, value: index === 5 ? 0 : index + 1 }))
    const table = normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows })
    expect(() => addDerivedTimeSeries(table, types, { timeColumn: 'period', valueColumn: 'value', name: 'value_sa', method: 'seasonal-multiplicative' })).toThrow('положительных')
  })
})
