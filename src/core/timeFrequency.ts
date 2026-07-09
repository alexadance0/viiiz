import type { DataValue, DateLabelFormat, TimeFrequency, TimeProfile } from './types'

const LABELS: Record<TimeFrequency, string> = {
  daily: 'Дневные', weekly: 'Недельные', monthly: 'Месячные', quarterly: 'Квартальные',
  semiannual: 'Полугодовые', annual: 'Годовые', irregular: 'Нерегулярные',
}

function notationFrequency(value: DataValue): TimeFrequency | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (/^(?:YR)?\d{4}$/i.test(text)) return 'annual'
  if (/^(?:\d{4}[- ]?Q[1-4]|Q[1-4][ -]?\d{4})$/i.test(text)) return 'quarterly'
  if (/^\d{4}[- ]?(?:S|H)[12]$/i.test(text)) return 'semiannual'
  if (/^(?:\d{4}[- ]?M(?:0?[1-9]|1[0-2])|\d{4}-(?:0[1-9]|1[0-2]))$/i.test(text)) return 'monthly'
  if (/^\d{4}-?W\d{2}$/i.test(text)) return 'weekly'
  if (/^\d{4}[/]\d{2,4}$/.test(text)) return 'annual'
  return null
}

const isEndOfMonth = (date: Date) => date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const monthDistance = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()

export function isoWeekParts(value: Date): { year: number; week: number } {
  const timestamp = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
  const date = new Date(timestamp)
  const isoDay = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() + 3 - isoDay)
  const year = date.getUTCFullYear()
  const januaryFourth = new Date(Date.UTC(year, 0, 4))
  const firstThursday = new Date(januaryFourth)
  firstThursday.setUTCDate(januaryFourth.getUTCDate() + 3 - ((januaryFourth.getUTCDay() + 6) % 7))
  return { year, week: 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000) }
}

export function dateFromIsoWeek(year: number, week: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null
  const januaryFourth = new Date(year, 0, 4)
  const monday = new Date(year, 0, 4 - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7)
  const actual = isoWeekParts(monday)
  return actual.year === year && actual.week === week ? monday : null
}

function intervalFrequency(dates: Date[]): { frequency: TimeFrequency; confidence: number } {
  const sorted = [...new Map(dates.map((date) => [date.getTime(), date])).values()].sort((a, b) => a.getTime() - b.getTime())
  if (sorted.length < 2) return { frequency: 'irregular', confidence: 40 }
  const pairs = sorted.slice(1).map((date, index) => ({ a: sorted[index], b: date }))
  const monthSteps = pairs.map(({ a, b }) => ({
    months: monthDistance(a, b),
    aligned: a.getDate() === b.getDate() || (isEndOfMonth(a) && isEndOfMonth(b)),
  }))
  const aligned = monthSteps.filter((step) => step.aligned && step.months > 0)
  if (aligned.length / pairs.length >= .7) {
    const steps = aligned.map((step) => step.months)
    const candidates: Array<[TimeFrequency, number]> = [['annual', 12], ['semiannual', 6], ['quarterly', 3], ['monthly', 1]]
    for (const [frequency, base] of candidates) {
      const matches = steps.filter((step) => step % base === 0 && step <= base * 3).length
      if (matches / pairs.length >= .7 && !steps.some((step) => step < base)) return { frequency, confidence: Math.round(matches / pairs.length * 100) }
    }
  }
  const daySteps = pairs.map(({ a, b }) => (b.getTime() - a.getTime()) / 86_400_000)
  const weekly = daySteps.filter((days) => days >= 5 && days <= 10 || days % 7 === 0 && days <= 21).length
  if (weekly / pairs.length >= .7) return { frequency: 'weekly', confidence: Math.round(weekly / pairs.length * 100) }
  const daily = daySteps.filter((days) => days >= 1 && days <= 4).length
  if (daily / pairs.length >= .7) return { frequency: 'daily', confidence: Math.round(daily / pairs.length * 100) }
  return { frequency: 'irregular', confidence: 60 }
}

export function inferTimeProfile(rawValues: DataValue[], values: DataValue[]): TimeProfile | null {
  const notation = rawValues.map(notationFrequency).filter((value): value is TimeFrequency => value != null)
  if (notation.length) {
    const counts = notation.reduce<Record<string, number>>((result, value) => ({ ...result, [value]: (result[value] ?? 0) + 1 }), {})
    const frequency = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as TimeFrequency
    const confidence = Math.round((counts[frequency] / notation.length) * 100)
    if (confidence >= 70) return { frequency, label: LABELS[frequency], confidence, source: 'notation' }
  }
  const dates = values.filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
  if (dates.length < 2) return null
  const result = intervalFrequency(dates)
  return { ...result, label: LABELS[result.frequency], source: 'intervals' }
}

export function formatTimeValue(value: DataValue, profile?: TimeProfile, format: DateLabelFormat = 'auto', index = 0): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return String(value ?? '')
  const year = value.getFullYear()
  const shortYear = `'${String(year).slice(-2)}`
  const month = value.getMonth() + 1
  const day = value.getDate()
  const quarter = Math.floor(value.getMonth() / 3) + 1
  const half = value.getMonth() < 6 ? 1 : 2
  const isoWeek = isoWeekParts(value)
  const ruMonths = ['янв.', 'февр.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']
  const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (format === 'year-full') return String(year)
  if (format === 'year-short') return shortYear
  if (format === 'year-first-full') return index === 0 ? String(year) : shortYear
  if (format === 'half-only') return `H${half}`
  if (format === 'half-year-en') return `H${half} ${year}`
  if (format === 'year-half-en') return `${year} H${half}`
  if (format === 'quarter-only') return `Q${quarter}`
  if (format === 'quarter-year-en') return `Q${quarter} ${year}`
  if (format === 'year-quarter-en') return `${year} Q${quarter}`
  if (format === 'month-only-ru') return ruMonths[value.getMonth()]
  if (format === 'month-full-ru') return new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(value)
  if (format === 'month-number') return String(month).padStart(2, '0')
  if (format === 'month-number-year') return `${String(month).padStart(2, '0')}.${year}`
  if (format === 'month-only-en') return enMonths[value.getMonth()]
  if (format === 'month-en-year') return `${enMonths[value.getMonth()]} ${year}`
  if (format === 'year-month-en') return `${year} ${enMonths[value.getMonth()]}`
  if (format === 'iso') return `${year}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  if (format === 'day-month') return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(value)
  if (format === 'day-month-year') return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
  if (format === 'date-dmy-slash') return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  if (format === 'date-mdy-slash') return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
  if (format === 'date-dmy-en') return `${String(day).padStart(2, '0')} ${enMonths[value.getMonth()]} ${year}`
  if (format === 'date-mdy-en') return `${enMonths[value.getMonth()]} ${String(day).padStart(2, '0')}, ${year}`
  if (format === 'quarter-year') return `К${Math.floor(value.getMonth() / 3) + 1} ${year}`
  if (format === 'year-quarter') return `${year} · К${Math.floor(value.getMonth() / 3) + 1}`
  if (format === 'year-month') return `${year}-${String(value.getMonth() + 1).padStart(2, '0')}`
  if (format === 'month-year') return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(value)
  if (format === 'month-short-year') return new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' }).format(value)
  if (format === 'week-only') return `W${String(isoWeek.week).padStart(2, '0')}`
  if (format === 'week-year') return `Нед. ${isoWeek.week} · ${isoWeek.year}`
  if (format === 'week-year-en') return `W${String(isoWeek.week).padStart(2, '0')} ${isoWeek.year}`
  if (format === 'year-week-en') return `${isoWeek.year}-W${String(isoWeek.week).padStart(2, '0')}`
  if (profile?.frequency === 'annual') return String(year)
  if (profile?.frequency === 'semiannual') return `${year} · П${value.getMonth() < 6 ? 1 : 2}`
  if (profile?.frequency === 'quarterly') return `${year} · К${Math.floor(value.getMonth() / 3) + 1}`
  if (profile?.frequency === 'monthly') return new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(value)
  if (profile?.frequency === 'weekly') return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(value)
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
}
