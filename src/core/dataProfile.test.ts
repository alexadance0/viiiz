import { describe, expect, it } from 'vitest'
import { convertColumn, editCell, renameColumn } from './dataProfile'
import { profileData } from './dataProfile'
import { normalizeImportedTable } from './normalization'

describe('reversible column type conversion', () => {
  it('restores original numbers after switching to date and back', () => {
    const original = normalizeImportedTable({
      name: 'data.csv', columns: ['value'], rows: [{ value: '20,5' }, { value: '100,25' }],
    })
    const asDate = convertColumn(original, 'value', 'date')
    const asNumber = convertColumn(asDate, 'value', 'number')
    expect(asNumber.rows.map((row) => row.value)).toEqual([20.5, 100.25])
  })

  it('restores original dates after switching to number and back', () => {
    const original = normalizeImportedTable({
      name: 'data.csv', columns: ['date'], rows: [{ date: '01/02/20' }, { date: '25/03/20' }],
    })
    const asNumber = convertColumn(original, 'date', 'number')
    const asDate = convertColumn(asNumber, 'date', 'date')
    expect((asDate.rows[0].date as Date).getFullYear()).toBe(2020)
    expect((asDate.rows[0].date as Date).getMonth()).toBe(1)
  })

  it('interprets a two-digit value as a year only when date is selected manually', () => {
    const table = normalizeImportedTable({ name: 'years.csv', columns: ['year'], rows: [{ year: 20 }, { year: 99 }] })
    const dates = convertColumn(table, 'year', 'date')
    expect((dates.rows[0].year as Date).getFullYear()).toBe(2020)
    expect((dates.rows[1].year as Date).getFullYear()).toBe(1999)
  })

  it('renames raw values together with visible values', () => {
    const table = normalizeImportedTable({ name: 'data.csv', columns: ['amount'], rows: [{ amount: '10,5' }] })
    const renamed = renameColumn(table, 'amount', 'price')
    expect(renamed.rows[0].price).toBe(10.5)
    expect(renamed.rawRows?.[0].price).toBe('10,5')
    expect(renamed.rawRows?.[0].amount).toBeUndefined()
  })

  it('renames observation flags together with the column', () => {
    const table = normalizeImportedTable({ name: 'data.csv', columns: ['amount'], rows: [{ amount: '10 p' }] })
    const renamed = renameColumn(table, 'amount', 'price')
    expect(renamed.observationFlags?.price[0]).toEqual(['p'])
    expect(renamed.observationFlags?.amount).toBeUndefined()
  })

  it('renames imputation metadata together with the column', () => {
    const table = { name: 'data', columns: ['amount'], rows: [{ amount: 10 }], imputedCells: { amount: { 0: { method: 'linear' as const, generatedPeriod: true } } } }
    const renamed = renameColumn(table, 'amount', 'price')
    expect(renamed.imputedCells?.price[0]).toMatchObject({ method: 'linear', generatedPeriod: true })
    expect(renamed.imputedCells?.amount).toBeUndefined()
  })

  it('preserves an original null when changing a column type', () => {
    const table = { name: 'data', columns: ['value'], rows: [{ value: 42 }], rawRows: [{ value: null }] }
    expect(convertColumn(table, 'value', 'text').rows[0].value).toBeNull()
  })

  it('creates an immutable source layer before the first manual conversion', () => {
    const table = { name: 'data', columns: ['value'], rows: [{ value: '0012' }] }
    const asNumber = convertColumn(table, 'value', 'number')
    expect(asNumber.rows[0].value).toBe(12)
    expect(asNumber.rawRows?.[0].value).toBe('0012')
    expect(convertColumn(asNumber, 'value', 'text').rows[0].value).toBe('0012')
  })

  it('reports ambiguous numeric separators', () => {
    const table = normalizeImportedTable({ name: 'data.csv', columns: ['value'], rows: [{ value: '1.234' }, { value: '2.345' }] })
    expect(profileData(table, { value: 'number' })[0].message).toContain('неоднозначный')
  })

  it('edits a numeric cell while preserving the new source value', () => {
    const table = normalizeImportedTable({ name: 'data.csv', columns: ['value'], rows: [{ value: '10,5' }] })
    const edited = editCell(table, 0, 'value', '25,75', 'number')
    expect(edited.rows[0].value).toBe(25.75)
    expect(edited.rawRows?.[0].value).toBe('25,75')
    expect(convertColumn(edited, 'value', 'text').rows[0].value).toBe('25,75')
  })

  it('clears stale quality and imputation metadata after a cell is edited', () => {
    const table = { name: 'data', columns: ['value'], rows: [{ value: 10 }], observationFlags: { value: { 0: ['неоднозначно'] } }, imputedCells: { value: { 0: { method: 'linear' as const, generatedPeriod: false } } } }
    const edited = editCell(table, 0, 'value', '12', 'number')
    expect(edited.observationFlags?.value).toBeUndefined()
    expect(edited.imputedCells?.value).toBeUndefined()
  })

  it('validates edited dates and supports clearing a cell', () => {
    const table = normalizeImportedTable({ name: 'data.csv', columns: ['date'], rows: [{ date: '2024-01-01' }] })
    expect(editCell(table, 0, 'date', '31.02.2024', 'date').rows[0].date).toBe('31.02.2024')
    expect(editCell(table, 0, 'date', '', 'date').rows[0].date).toBeNull()
  })
})
