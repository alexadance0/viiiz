import { describe, expect, it } from 'vitest'
import { datasetQualityIssues, findDuplicateRowIndices, findTimeGaps, removeDuplicateRows, removeRows } from './dataQuality'
import { normalizeImportedTable } from './normalization'
import type { TimeProfile } from './types'

const monthly: TimeProfile = { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'notation' }

describe('duplicate rows', () => {
  it('finds only full-row duplicates, including equal dates', () => {
    const table = { name: 'data', columns: ['date', 'value'], rows: [
      { date: new Date(2024, 0, 1), value: 10 },
      { date: new Date(2024, 0, 1), value: 10 },
      { date: new Date(2024, 0, 1), value: 11 },
    ] }
    expect(findDuplicateRowIndices(table)).toEqual([1])
  })

  it('removes later copies and reindexes raw rows and observation flags', () => {
    const table = {
      name: 'data', columns: ['value'], rows: [{ value: 10 }, { value: 10 }, { value: 20 }],
      rawRows: [{ value: '10' }, { value: '10' }, { value: '20' }],
      observationFlags: { value: { 1: ['p'], 2: ['e'] } },
    }
    const cleaned = removeDuplicateRows(table)
    expect(cleaned.rows.map((row) => row.value)).toEqual([10, 20])
    expect(cleaned.rawRows?.map((row) => row.value)).toEqual(['10', '20'])
    expect(cleaned.observationFlags?.value).toEqual({ 1: ['e'] })
  })

  it('removes selected rows and reindexes all cell metadata', () => {
    const table = {
      name: 'data', columns: ['value'], rows: [{ value: 10 }, { value: 20 }, { value: 30 }],
      rawRows: [{ value: '10' }, { value: '20' }, { value: '30' }],
      observationFlags: { value: { 2: ['e'] } },
      imputedCells: { value: { 1: { method: 'linear' as const, generatedPeriod: true } } },
    }
    const result = removeRows(table, [0])
    expect(result.rows.map((row) => row.value)).toEqual([20, 30])
    expect(result.observationFlags?.value).toEqual({ 1: ['e'] })
    expect(result.imputedCells?.value).toEqual({ 0: { method: 'linear', generatedPeriod: true } })
    expect(() => removeRows(table, [0, 1, 2])).toThrow('все строки')
  })
})

describe('missing time periods', () => {
  it('finds a missing month separately for each category', () => {
    const table = normalizeImportedTable({ name: 'series', columns: ['period', 'country', 'value'], rows: [
      { period: '2024-01', country: 'A', value: 1 },
      { period: '2024-03', country: 'A', value: 3 },
      { period: '2024-01', country: 'B', value: 4 },
      { period: '2024-02', country: 'B', value: 5 },
    ] })
    const gaps = findTimeGaps(table, 'period', monthly, { period: 'date', country: 'text', value: 'number' })
    expect(gaps.count).toBe(1)
    expect(gaps.examples[0]).toContain('февр. 2024')
    expect(gaps.examples[0]).toContain('country: A')
  })

  it('handles month-end series without inventing false gaps', () => {
    const table = { name: 'series', columns: ['period'], rows: [
      { period: new Date(2024, 0, 31) }, { period: new Date(2024, 1, 29) }, { period: new Date(2024, 2, 31) },
    ] }
    expect(findTimeGaps(table, 'period', monthly, { period: 'date' }).count).toBe(0)
  })

  it('does not treat weekends as gaps in a business-day series', () => {
    const daily: TimeProfile = { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' }
    const table = { name: 'series', columns: ['period'], rows: [
      { period: new Date(2024, 0, 5) }, { period: new Date(2024, 0, 8) }, { period: new Date(2024, 0, 9) },
    ] }
    expect(findTimeGaps(table, 'period', daily, { period: 'date' }).count).toBe(0)
  })

  it('adds duplicate and time-gap problems to the dataset profile', () => {
    const table = normalizeImportedTable({ name: 'series', columns: ['period', 'value'], rows: [
      { period: '2024-01', value: 1 }, { period: '2024-01', value: 1 }, { period: '2024-03', value: 3 },
    ] })
    const issues = datasetQualityIssues(table, { period: 'date', value: 'number' })
    expect(issues.some((issue) => issue.kind === 'duplicate')).toBe(true)
    expect(issues.some((issue) => issue.kind === 'time-gap')).toBe(true)
  })
})
