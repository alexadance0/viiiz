import { formatXAxisNumber } from './numberFormat'
import { formatTimeValue, inferTimeProfile, isoWeekParts } from './timeFrequency'
import type { ChartConfig, DataTable, DataValue, TimeProfile } from './types'

const yearOnlyFormat = (config: ChartConfig) =>
  config.dateLabelFormat === 'year-full' || config.dateLabelFormat === 'year-short' || config.dateLabelFormat === 'year-first-full'

const inferredFormatStepUnit = (config: ChartConfig) => {
  if (yearOnlyFormat(config)) return 'year' as const
  if (config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat?.startsWith('year-week-')) return 'week' as const
  if (config.dateLabelFormat?.startsWith('month-') || config.dateLabelFormat?.startsWith('year-month')) return 'month' as const
  if (config.dateLabelFormat?.includes('quarter') || config.dateLabelFormat === 'quarter-only') return 'quarter' as const
  if (config.dateLabelFormat?.includes('half') || config.dateLabelFormat === 'half-only') return 'half' as const
  return null
}

export const effectiveDateStepUnit = (config: ChartConfig) =>
  config.dateAxisStepUnit && config.dateAxisStepUnit !== 'auto' ? config.dateAxisStepUnit : inferredFormatStepUnit(config)

export const stackedContextFormat = (format?: ChartConfig['dateLabelFormat']) =>
  format === 'quarter-context-en' || format === 'quarter-context-ru' || format === 'month-context-ru' ||
  format === 'month-context-en' || format === 'day-context-month-ru' || format === 'day-context-month-en' ||
  format === 'week-context-en' || format === 'week-context-ru'

export const formatDateLabel = (
  value: Date,
  profile: TimeProfile | undefined,
  format: ChartConfig['dateLabelFormat'],
  showContext = false,
  index = 0,
) => {
  const year = value.getFullYear(), month = value.getMonth(), week = isoWeekParts(value)
  const context = (primary: string, secondary: string) => showContext ? `${primary}\n${secondary}` : primary
  if (format === 'quarter-context-en') return context(`Q${Math.floor(month / 3) + 1}`, String(year))
  if (format === 'quarter-context-ru') return context(`К${Math.floor(month / 3) + 1}`, String(year))
  if (format === 'month-context-ru') return context(formatTimeValue(value, undefined, 'month-only-ru'), String(year))
  if (format === 'month-context-en') return context(formatTimeValue(value, undefined, 'month-only-en'), String(year))
  if (format === 'day-context-month-ru') return context(String(value.getDate()), formatTimeValue(value, undefined, 'month-only-ru'))
  if (format === 'day-context-month-en') return context(String(value.getDate()), formatTimeValue(value, undefined, 'month-only-en'))
  if (format === 'week-context-en') return context(`W${String(week.week).padStart(2, '0')}`, String(week.year))
  if (format === 'week-context-ru') return context(`Нед. ${week.week}`, String(week.year))
  return formatTimeValue(value, profile, format, index)
}

export const continuousDateLabel = (value: Date, profile: TimeProfile | undefined, format: ChartConfig['dateLabelFormat'], firstDisplayed = false) => {
  const week = isoWeekParts(value)
  const showContext = firstDisplayed || (format === 'day-context-month-ru' || format === 'day-context-month-en'
    ? value.getDate() === 1
    : format === 'week-context-en' || format === 'week-context-ru'
      ? week.week === 1
      : stackedContextFormat(format) && value.getMonth() === 0)
  return formatDateLabel(value, profile, format, showContext)
}

export const moveDateContextToVisibleLabels = (
  labels: string[],
  categories: DataValue[],
  format: ChartConfig['dateLabelFormat'],
  visible: (index: number) => boolean,
) => {
  if (!stackedContextFormat(format)) return labels
  const seen = new Set<number>()
  return labels.map((label, index) => {
    const value = categories[index]
    if (!label || !(value instanceof Date) || !visible(index)) return label.split('\n')[0]
    const dayContext = format === 'day-context-month-ru' || format === 'day-context-month-en'
    const weekContext = format === 'week-context-en' || format === 'week-context-ru'
    const key = dayContext ? value.getFullYear() * 12 + value.getMonth() : weekContext ? isoWeekParts(value).year : value.getFullYear()
    if (seen.has(key)) return label.split('\n')[0]
    seen.add(key)
    return formatDateLabel(value, undefined, format, true)
  })
}

const calendarBucket = (date: Date, unit: Exclude<ChartConfig['dateAxisStepUnit'], 'auto' | undefined>) => {
  const year = date.getFullYear()
  const month = date.getMonth()
  if (unit === 'year') return year
  if (unit === 'quarter') return year * 4 + Math.floor(month / 3)
  if (unit === 'half') return year * 2 + Math.floor(month / 6)
  if (unit === 'month') return year * 12 + month
  if (unit === 'week') return Math.floor((Date.UTC(year, month, date.getDate()) - Date.UTC(1970, 0, 5)) / 604800000)
  return Math.floor(Date.UTC(year, month, date.getDate()) / 86400000)
}

const isCalendarBoundary = (
  date: Date,
  unit: Exclude<ChartConfig['dateAxisStepUnit'], 'auto' | undefined>,
  frequency: NonNullable<ReturnType<typeof inferTimeProfile>>['frequency'],
) => {
  const month = date.getMonth()
  const day = date.getDate()
  if (unit === 'day') return true
  if (unit === 'week') return frequency === 'weekly' || date.getDay() === 1
  if (unit === 'month') return frequency === 'monthly' || day === 1
  if (unit === 'quarter') {
    if (frequency === 'quarterly') return true
    return month % 3 === 0 && (frequency === 'monthly' || day === 1)
  }
  if (unit === 'half') {
    if (frequency === 'semiannual') return true
    return month % 6 === 0 && (frequency === 'quarterly' || frequency === 'monthly' || day === 1)
  }
  if (frequency === 'annual') return true
  if (frequency === 'semiannual' || frequency === 'quarterly' || frequency === 'monthly') return month === 0
  if (frequency === 'weekly') return isoWeekParts(date).week === 1
  return month === 0 && day === 1
}

export const planCategoryDateLabels = (
  categories: DataValue[],
  table: DataTable,
  config: ChartConfig,
) => {
  const firstNumericIndex = categories.findIndex((value) => typeof value === 'number')
  const lastNumericIndex = categories.findLastIndex((value) => typeof value === 'number')
  const unit = effectiveDateStepUnit(config)
  const frequency = table.timeProfiles?.[config.xField]?.frequency ?? inferTimeProfile(categories, categories)?.frequency ?? 'irregular'
  const count = Math.max(1, Math.round(config.xAxisStep ?? 1))
  const anchorDate = config.dateAxisAnchor ? new Date(`${config.dateAxisAnchor}T00:00:00`) : null
  const validAnchor = anchorDate && !Number.isNaN(anchorDate.getTime()) ? anchorDate : null
  const anchorBucket = unit && validAnchor ? calendarBucket(validAnchor, unit) : undefined
  let firstBucket: number | undefined
  let previousBucket: number | undefined
  let previousObservedBucket: number | undefined
  let previousContextMonth: number | undefined
  let previousContextQuarter: number | undefined
  let previousContextWeek: number | undefined
  let previousContextYear: number | undefined
  let previousContextIsoYear: number | undefined
  let displayedIndex = 0
  return categories.map((value, index) => {
    if (unit && value instanceof Date) {
      if (validAnchor && value.getTime() < validAnchor.getTime()) return ''
      const bucket = calendarBucket(value, unit)
      const firstObservedInBucket = bucket !== previousObservedBucket
      previousObservedBucket = bucket
      if (!firstObservedInBucket && !isCalendarBoundary(value, unit, frequency)) return ''
      firstBucket ??= anchorBucket ?? bucket
      if (bucket === previousBucket || (bucket - firstBucket) % count !== 0) return ''
      previousBucket = bucket
    }
    if (value instanceof Date) {
      const year = value.getFullYear()
      const month = value.getMonth()
      const quarter = Math.floor(month / 3) + 1
      const week = isoWeekParts(value)
      const firstMonthLabel = previousContextMonth !== year * 12 + month
      const firstQuarterLabel = previousContextQuarter !== year * 4 + quarter
      const firstWeekLabel = previousContextWeek !== week.year * 100 + week.week
      const firstYearLabel = previousContextYear !== year
      const firstIsoYearLabel = previousContextIsoYear !== week.year
      previousContextMonth = year * 12 + month
      previousContextQuarter = year * 4 + quarter
      previousContextWeek = week.year * 100 + week.week
      previousContextYear = year
      previousContextIsoYear = week.year
      if ((config.dateLabelFormat?.startsWith('month-') || config.dateLabelFormat?.startsWith('year-month')) && !firstMonthLabel) return ''
      if ((config.dateLabelFormat?.includes('quarter') || config.dateLabelFormat === 'quarter-only') && !firstQuarterLabel) return ''
      if ((config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat?.startsWith('year-week-')) && !firstWeekLabel) return ''
      if (config.dateLabelFormat === 'quarter-context-en' || config.dateLabelFormat === 'quarter-context-ru' || config.dateLabelFormat === 'month-context-ru' || config.dateLabelFormat === 'month-context-en') return formatDateLabel(value, undefined, config.dateLabelFormat, firstYearLabel)
      if (config.dateLabelFormat === 'day-context-month-ru' || config.dateLabelFormat === 'day-context-month-en') return formatDateLabel(value, undefined, config.dateLabelFormat, firstMonthLabel)
      if (config.dateLabelFormat === 'week-context-en' || config.dateLabelFormat === 'week-context-ru') return formatDateLabel(value, undefined, config.dateLabelFormat, firstIsoYearLabel)
    }
    const label = typeof value === 'number'
      ? formatXAxisNumber(value, config, index === firstNumericIndex ? 'first' : index === lastNumericIndex ? 'last' : 'middle')
      : formatTimeValue(value, table.timeProfiles?.[config.xField], config.dateLabelFormat, displayedIndex)
    displayedIndex += 1
    return label
  })
}
