import { describe, expect, it } from 'vitest'
import { formatTimeValue, inferTimeProfile } from './timeFrequency'

const dates = (...values: string[]) => values.map((value) => new Date(`${value}T00:00:00`))

describe('time frequency inference', () => {
  it.each([
    [['2020', '2021', '2022'], 'annual'],
    [['2024-S1', '2024-S2'], 'semiannual'],
    [['2024-Q1', '2024-Q2', '2024-Q4'], 'quarterly'],
    [['2024M01', '2024M02', '2024M04'], 'monthly'],
    [['2024-W01', '2024-W02'], 'weekly'],
  ])('recognizes notation %s as %s', (raw, expected) => {
    const profile = inferTimeProfile(raw, dates('2020-01-01', '2021-01-01', '2022-01-01'))
    expect(profile?.frequency).toBe(expected)
    expect(profile?.source).toBe('notation')
  })

  it.each([
    [dates('2024-01-01', '2024-01-02', '2024-01-04'), 'daily'],
    [dates('2024-01-01', '2024-01-08', '2024-01-22'), 'weekly'],
    [dates('2024-01-31', '2024-02-29', '2024-04-30'), 'monthly'],
    [dates('2024-01-01', '2024-04-01', '2024-10-01'), 'quarterly'],
    [dates('2022-01-01', '2023-01-01', '2025-01-01'), 'annual'],
  ])('infers interval frequency %s', (values, expected) => {
    expect(inferTimeProfile([], values)?.frequency).toBe(expected)
  })

  it('does not mistake sparse irregular observations for a fixed frequency', () => {
    expect(inferTimeProfile([], dates('2024-01-01', '2024-01-13', '2024-03-22'))?.frequency).toBe('irregular')
  })

  it('formats quarterly dates as periods rather than arbitrary days', () => {
    expect(formatTimeValue(new Date(2024, 3, 1), { frequency: 'quarterly', label: 'Квартальные', confidence: 100, source: 'notation' })).toBe('2024 · К2')
  })

  it('supports compact annual labels with a full first year', () => {
    const profile = { frequency: 'annual', label: 'Годовые', confidence: 100, source: 'intervals' } as const
    expect(formatTimeValue(new Date(2015, 0, 1), profile, 'year-first-full', 0)).toBe('2015')
    expect(formatTimeValue(new Date(2016, 0, 1), profile, 'year-first-full', 1)).toBe("'16")
  })

  it('supports frequency-specific calendar labels', () => {
    const date = new Date(2024, 3, 5)
    expect(formatTimeValue(date, undefined, 'quarter-year')).toBe('К2 2024')
    expect(formatTimeValue(date, undefined, 'iso')).toBe('2024-04-05')
  })

  it('supports common English quarter, week and date formats', () => {
    const date = new Date(2024, 3, 5)
    expect(formatTimeValue(date, undefined, 'year-quarter-en')).toBe('2024 Q2')
    expect(formatTimeValue(date, undefined, 'quarter-only')).toBe('Q2')
    expect(formatTimeValue(date, undefined, 'date-dmy-en')).toBe('05 Apr 2024')
    expect(formatTimeValue(date, undefined, 'date-mdy-en')).toBe('Apr 05, 2024')
    expect(formatTimeValue(new Date(2024, 0, 1), undefined, 'year-week-en')).toBe('2024-W01')
  })

  it('provides Russian counterparts for textual English period formats', () => {
    const date = new Date(2024, 3, 5)
    expect(formatTimeValue(date, undefined, 'half-only-ru')).toBe('П1')
    expect(formatTimeValue(date, undefined, 'half-year-ru')).toBe('П1 2024')
    expect(formatTimeValue(date, undefined, 'year-half-ru')).toBe('2024 · П1')
    expect(formatTimeValue(date, undefined, 'quarter-only-ru')).toBe('К2')
    expect(formatTimeValue(date, undefined, 'year-month-ru')).toBe('2024 апр.')
    expect(formatTimeValue(date, undefined, 'date-dmy-ru')).toBe('05 апр. 2024')
    expect(formatTimeValue(date, undefined, 'week-only-ru')).toBe('Нед. 14')
    expect(formatTimeValue(date, undefined, 'year-week-ru')).toBe('2024 · нед. 14')
  })

  it('uses ISO week years at calendar-year boundaries', () => {
    expect(formatTimeValue(new Date(2021, 0, 1), undefined, 'year-week-en')).toBe('2020-W53')
    expect(formatTimeValue(new Date(2021, 0, 4), undefined, 'year-week-en')).toBe('2021-W01')
  })

  it('supports full, short and numeric Russian month labels', () => {
    const date = new Date(2024, 3, 1)
    expect(formatTimeValue(date, undefined, 'month-full-ru')).toBe('апрель')
    expect(formatTimeValue(date, undefined, 'month-only-ru')).toBe('апр.')
    expect(formatTimeValue(date, undefined, 'month-number')).toBe('04')
    expect(formatTimeValue(date, undefined, 'month-number-year')).toBe('04.2024')
  })
})
