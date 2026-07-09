import { describe, expect, it } from 'vitest'
import { normalizeImportedTable, parseDateValue, parseLocalizedNumber } from './normalization'

describe('localized numbers', () => {
  it.each([
    ['1 234,56', 1234.56],
    ['1\u00a0234,56 ₽', 1234.56],
    ['$1,234.56', 1234.56],
    ['1.234,56 €', 1234.56],
    ['−42,5', -42.5],
    ['(1 200,50)', -1200.5],
    ['25%', .25],
    ["1'234.5", 1234.5],
  ])('parses %s', (source, expected) => {
    expect(parseLocalizedNumber(source)?.value).toBeCloseTo(expected)
  })

  it('uses the column decimal hint for mixed values', () => {
    expect(parseLocalizedNumber('1,234', ',')?.value).toBe(1.234)
    expect(parseLocalizedNumber('1,234')?.value).toBe(1234)
  })
})

describe('dates', () => {
  it.each([
    ['28.06.20', 'dmy', 2020, 5, 28],
    ['03/12/99', 'dmy', 1999, 11, 3],
    ['12/31/2024', 'mdy', 2024, 11, 31],
    ['2024-02-29', 'ymd', 2024, 1, 29],
    ['28 июня 2020', 'dmy', 2020, 5, 28],
    ['Jun 28, 2020', 'mdy', 2020, 5, 28],
    ['20240628', 'ymd', 2024, 5, 28],
    ['06.2020', 'dmy', 2020, 5, 1],
    ['2024-Q3', 'ymd', 2024, 6, 1],
    ['Q2 2024', 'ymd', 2024, 3, 1],
    ['2024-S2', 'ymd', 2024, 6, 1],
    ['2024M03', 'ymd', 2024, 2, 1],
    ['2024-03', 'ymd', 2024, 2, 1],
    ['2024-W01', 'ymd', 2024, 0, 1],
    ['2020/21', 'ymd', 2020, 0, 1],
  ] as const)('parses %s', (source, order, year, month, day) => {
    const date = parseDateValue(source, order)?.value
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate()]).toEqual([year, month, day])
  })

  it('rejects impossible dates', () => {
    expect(parseDateValue('31.02.2024')).toBeNull()
    expect(parseDateValue('29.02.2023')).toBeNull()
    expect(parseDateValue('2021-W53')).toBeNull()
  })

  it('marks dates with interchangeable day and month as ambiguous', () => {
    expect(parseDateValue('01/02/2024', 'dmy')?.ambiguous).toBe(true)
  })
})

describe('column normalization', () => {
  it('infers day-first order from evidence in the whole column', () => {
    const table = normalizeImportedTable({
      name: 'dates.csv', columns: ['date'], rows: [
        { date: '01/02/20' }, { date: '25/03/20' }, { date: '04/05/20' },
      ],
    })
    expect(table.rows[0].date).toBeInstanceOf(Date)
    expect((table.rows[0].date as Date).getMonth()).toBe(1)
    expect(table.normalizations?.date.format).toBe('DD/MM/YY')
    expect(table.rawRows?.[0].date).toBe('01/02/20')
  })

  it('normalizes decimal commas and missing markers together', () => {
    const table = normalizeImportedTable({
      name: 'numbers.csv', columns: ['amount'], rows: [
        { amount: '10,5' }, { amount: '20,25' }, { amount: '—' },
      ],
    })
    expect(table.rows.map((row) => row.amount)).toEqual([10.5, 20.25, null])
    expect(table.normalizations?.amount.kind).toBe('number')
  })

  it('uses locale only when every numeric date is ambiguous', () => {
    const source = { name: 'dates.csv', columns: ['date'], rows: [{ date: '01/02/2020' }, { date: '03/04/2020' }] }
    const ru = normalizeImportedTable(source, 'ru-RU')
    const us = normalizeImportedTable(source, 'en-US')
    expect((ru.rows[0].date as Date).getMonth()).toBe(1)
    expect((us.rows[0].date as Date).getMonth()).toBe(0)
    expect(ru.normalizations?.date.confidence).toBe(68)
    expect(ru.normalizations?.date.ambiguous).toBe(2)
  })

  it('keeps a mixed column unchanged when confidence is too low', () => {
    const table = normalizeImportedTable({
      name: 'mixed.csv', columns: ['value'], rows: [
        { value: '01.02.2020' }, { value: 'не дата' }, { value: 'ещё текст' },
      ],
    })
    expect(table.rows[0].value).toBe('01.02.2020')
    expect(table.normalizations?.value).toBeUndefined()
  })

  it('recognizes years in a time column without changing ordinary integer columns', () => {
    const table = normalizeImportedTable({
      name: 'wb.csv', columns: ['year', 'value'], rows: [
        { year: 2020, value: 2020 }, { year: 2021, value: 2021 },
      ],
    })
    expect(table.rows[0].year).toBeInstanceOf(Date)
    expect(table.rows[0].value).toBe(2020)
  })

  it('does not interpret month and day numbers as two-digit years', () => {
    const table = normalizeImportedTable({
      name: 'calendar.csv', columns: ['month', 'day'], rows: [
        { month: 1, day: 15 }, { month: 2, day: 16 }, { month: 3, day: 17 },
      ],
    })
    expect(table.rows[0]).toEqual({ month: 1, day: 15 })
    expect(table.normalizations?.month.kind).toBe('number')
  })

  it('preserves statistical-looking symbols in a text column', () => {
    const table = normalizeImportedTable({
      name: 'labels.csv', columns: ['label'], rows: [{ label: '-' }, { label: ':' }, { label: 'обычная категория' }],
    })
    expect(table.rows.map((row) => row.label)).toEqual(['-', ':', 'обычная категория'])
  })

  it('preserves Eurostat quality flags and missing markers', () => {
    const table = normalizeImportedTable({
      name: 'eurostat.tsv', columns: ['value'], rows: [
        { value: '123.4 p' }, { value: '125.1 e' }, { value: ': c' }, { value: 'x' },
      ],
    })
    expect(table.rows.map((row) => row.value)).toEqual([123.4, 125.1, null, null])
    expect(table.observationFlags?.value[0]).toEqual(['p'])
    expect(table.observationFlags?.value[1]).toEqual(['e'])
    expect(table.observationFlags?.value[2]).toEqual(['c'])
    expect(table.observationFlags?.value[3]?.[0]).toContain('скрыто')
  })

  it.each(['.', '..', '...', '…', ':', '(NA)', '(X)', 'F', 'D', 'Z', 'NP'])('recognizes statistical marker %s in a numeric column', (marker) => {
    const table = normalizeImportedTable({
      name: 'agency.csv', columns: ['value'], rows: [{ value: '10.5' }, { value: marker }, { value: '12.5' }],
    })
    expect(table.rows[1].value).toBeNull()
  })
})
