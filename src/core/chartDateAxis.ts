import { formatXAxisNumber } from './numberFormat'
import { formatTimeValue, inferTimeProfile, isoWeekParts } from './timeFrequency'
import type { ChartConfig, DataTable, DataValue } from './types'

const yearOnlyFormat = (config: ChartConfig) =>
  config.dateLabelFormat === 'year-full' || config.dateLabelFormat === 'year-short' || config.dateLabelFormat === 'year-first-full'

const inferredFormatStepUnit = (config: ChartConfig) => {
  if (yearOnlyFormat(config)) return 'year' as const
  if (config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat === 'year-week-en') return 'week' as const
  if (config.dateLabelFormat?.startsWith('month-') || config.dateLabelFormat === 'year-month') return 'month' as const
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

export const formatCategories = (
  categories: DataValue[],
  table: DataTable,
  config: ChartConfig,
) => {
  const unit = effectiveDateStepUnit(config)
  const frequency = table.timeProfiles?.[config.xField]?.frequency ?? inferTimeProfile(categories, categories)?.frequency ?? 'irregular'
  const count = Math.max(1, Math.round(config.xAxisStep ?? 1))
  const anchorDate = config.dateAxisAnchor ? new Date(`${config.dateAxisAnchor}T00:00:00`) : null
  const validAnchor = anchorDate && !Number.isNaN(anchorDate.getTime()) ? anchorDate : null
  const anchorBucket = unit && validAnchor ? calendarBucket(validAnchor, unit) : undefined
  let firstBucket: number | undefined
  let previousBucket: number | undefined
  let previousContextMonth: number | undefined
  let previousContextQuarter: number | undefined
  let previousContextWeek: number | undefined
  let displayedIndex = 0
  return categories.map((value) => {
    if (unit && value instanceof Date) {
      if (validAnchor && value.getTime() < validAnchor.getTime()) return ''
      if (!isCalendarBoundary(value, unit, frequency)) return ''
      const bucket = calendarBucket(value, unit)
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
      previousContextMonth = year * 12 + month
      previousContextQuarter = year * 4 + quarter
      previousContextWeek = week.year * 100 + week.week
      if ((config.dateLabelFormat?.startsWith('month-') || config.dateLabelFormat === 'year-month') && !firstMonthLabel) return ''
      if ((config.dateLabelFormat?.includes('quarter') || config.dateLabelFormat === 'quarter-only') && !firstQuarterLabel) return ''
      if ((config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat === 'year-week-en') && !firstWeekLabel) return ''
      if (config.dateLabelFormat === 'quarter-context-en') return `Q${quarter}${quarter === 1 ? `\n${year}` : ''}`
      if (config.dateLabelFormat === 'quarter-context-ru') return `К${quarter}${quarter === 1 ? `\n${year}` : ''}`
      if (config.dateLabelFormat === 'month-context-ru') return `${formatTimeValue(value, undefined, 'month-only-ru')}${month === 0 ? `\n${year}` : ''}`
      if (config.dateLabelFormat === 'month-context-en') return `${formatTimeValue(value, undefined, 'month-only-en')}${month === 0 ? `\n${year}` : ''}`
      if (config.dateLabelFormat === 'day-context-month-ru') return `${value.getDate()}${value.getDate() === 1 ? `\n${formatTimeValue(value, undefined, 'month-only-ru')}` : ''}`
      if (config.dateLabelFormat === 'day-context-month-en') return `${value.getDate()}${value.getDate() === 1 ? `\n${formatTimeValue(value, undefined, 'month-only-en')}` : ''}`
      if (config.dateLabelFormat === 'week-context-en') return `W${String(week.week).padStart(2, '0')}${week.week === 1 ? `\n${week.year}` : ''}`
      if (config.dateLabelFormat === 'week-context-ru') return `Нед. ${week.week}${week.week === 1 ? `\n${week.year}` : ''}`
    }
    const label = typeof value === 'number'
      ? formatXAxisNumber(value, config)
      : formatTimeValue(value, table.timeProfiles?.[config.xField], config.dateLabelFormat, displayedIndex)
    displayedIndex += 1
    return label
  })
}
