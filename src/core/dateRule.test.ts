import { describe, expect, it } from 'vitest'
import { applyDateRule, parseDateByRule } from './dateRule'
import type { DateParseRule } from './types'

const rule = (format: string, pivot = 50, invalid: DateParseRule['invalid'] = 'keep'): DateParseRule => ({ format, twoDigitYearPivot: pivot, invalid })

describe('manual date format rules', () => {
  it.each([
    ['31.12.2024', 'DD.MM.YYYY', 2024, 11, 31],
    ['2024::06::28', 'YYYY::MM::DD', 2024, 5, 28],
    ['6_8_24', 'M_D_YY', 2024, 5, 8],
    ['Jun 28, 2024', 'MMM DD, YYYY', 2024, 5, 28],
    ['28 июня 2024', 'DD MMMM YYYY', 2024, 5, 28],
    ['2024-Q3', 'YYYY-Q', 2024, 6, 1],
    ['Q2 2024', 'Q YYYY', 2024, 3, 1],
    ['2024', 'YYYY', 2024, 0, 1],
  ] as const)('parses %s with %s', (source, format, year, month, day) => {
    const result = parseDateByRule(source, rule(format))
    expect(result.matched).toBe(true)
    expect([result.value?.getFullYear(), result.value?.getMonth(), result.value?.getDate()]).toEqual([year, month, day])
  })

  it('uses a stable configurable pivot for two-digit years', () => {
    expect(parseDateByRule('49', rule('YY', 50)).value?.getFullYear()).toBe(2049)
    expect(parseDateByRule('50', rule('YY', 50)).value?.getFullYear()).toBe(1950)
    expect(parseDateByRule('30', rule('YY', 30)).value?.getFullYear()).toBe(1930)
  })

  it('rejects mismatches and impossible calendar dates', () => {
    expect(parseDateByRule('2024/01/02', rule('DD.MM.YYYY')).matched).toBe(false)
    expect(parseDateByRule('31.02.2024', rule('DD.MM.YYYY')).reason).toBe('Такой даты не существует')
    expect(parseDateByRule('31.12', rule('DD.MM')).reason).toBe('В маске отсутствует год')
  })

  it('applies the rule from raw values and preserves invalid values by policy', () => {
    const table = {
      name: 'manual.csv', columns: ['period'],
      rows: [{ period: '01|02|20' }, { period: 'bad' }],
      rawRows: [{ period: '01|02|20' }, { period: 'bad' }],
    }
    const keep = applyDateRule(table, 'period', rule('DD|MM|YY'))
    expect((keep.rows[0].period as Date).getFullYear()).toBe(2020)
    expect(keep.rows[1].period).toBe('bad')
    expect(keep.normalizations?.period.confidence).toBe(50)
    expect(keep.dateRules?.period.format).toBe('DD|MM|YY')
    const empty = applyDateRule(keep, 'period', rule('DD|MM|YY', 50, 'null'))
    expect(empty.rows[1].period).toBeNull()
  })

  it('does not resurrect a missing marker when a manual rule is applied', () => {
    const table = {
      name: 'manual.csv', columns: ['period'], rows: [{ period: new Date(2020, 0, 1) }, { period: null }],
      rawRows: [{ period: '2020' }, { period: ':' }],
    }
    const result = applyDateRule(table, 'period', rule('YYYY'))
    expect(result.rows[1].period).toBeNull()
  })

  it('can recover a value nulled by an earlier incorrect manual rule', () => {
    const table = { name: 'manual.csv', columns: ['period'], rows: [{ period: '31.12.2024' }], rawRows: [{ period: '31.12.2024' }] }
    const wrong = applyDateRule(table, 'period', rule('MM.DD.YYYY', 50, 'null'))
    expect(wrong.rows[0].period).toBeNull()
    const corrected = applyDateRule(wrong, 'period', rule('DD.MM.YYYY', 50, 'null'))
    expect(corrected.rows[0].period).toBeInstanceOf(Date)
  })

  it('recovers a valid raw date missed by automatic normalization', () => {
    const table = { name: 'manual.csv', columns: ['period'], rows: [{ period: null }], rawRows: [{ period: '2024::06::28' }], observationFlags: { period: { 0: ['Не удалось распознать дату'] } } }
    const result = applyDateRule(table, 'period', rule('YYYY::MM::DD'))
    expect(result.rows[0].period).toBeInstanceOf(Date)
    expect((result.rows[0].period as Date).getDate()).toBe(28)
    expect(result.observationFlags?.period).toBeUndefined()
  })
})
