import { formatXAxisNumber } from './numberFormat'
import { measureTextWidth } from './textMetrics'
import { dateValue, orderedBounds } from './chartScale'
import { addPeriod } from './dataQuality'
import { formatTimeValue, inferTimeProfile, isoWeekParts } from './timeFrequency'
import type { ChartConfig, DataTable, DataValue, TimeProfile, TimeFrequency } from './types'

export const missingCalendarPeriod = (previous: DataValue, next: DataValue, frequency?: TimeFrequency) => {
  // Daily observations may follow a trading/working-day calendar. Weekends
  // and holidays cannot be inferred as missing observations from dates alone.
  if (!(previous instanceof Date) || !(next instanceof Date) || !frequency || frequency === 'daily' || frequency === 'irregular') return null
  const expected = addPeriod(previous, frequency, false)
  return +expected < +next ? expected : null
}

const yearOnlyFormat = (config: ChartConfig) =>
  config.dateLabelFormat === 'year-full' || config.dateLabelFormat === 'year-short' || config.dateLabelFormat === 'year-first-full'

const inferredFormatStepUnit = (config: ChartConfig) => {
  if (yearOnlyFormat(config)) return 'year' as const
  if (config.dateLabelFormat?.startsWith('week-') || config.dateLabelFormat?.startsWith('year-week-')) return 'week' as const
  if (config.dateLabelFormat?.startsWith('month-') || config.dateLabelFormat?.startsWith('year-month')) return 'month' as const
  if (config.dateLabelFormat?.includes('quarter') || config.dateLabelFormat === 'quarter-only') return 'quarter' as const
  if (config.dateLabelFormat?.includes('half') || config.dateLabelFormat === 'half-only') return 'half' as const
  if (config.dateLabelFormat?.startsWith('day-') || config.dateLabelFormat === 'iso') return 'day' as const
  return null
}

export const effectiveDateStepUnit = (config: ChartConfig) => {
  const format = inferredFormatStepUnit(config)
  const requested = config.dateAxisStepUnit && config.dateAxisStepUnit !== 'auto' ? config.dateAxisStepUnit : null
  const order = ['day', 'week', 'month', 'quarter', 'half', 'year']
  return requested && (!format || order.indexOf(requested) >= order.indexOf(format)) ? requested : format
}

const dateBounds = (dates: Date[], table: DataTable, config: ChartConfig) => {
  const [requestedMin, requestedMax] = orderedBounds(dateValue(config.xAxisMin), dateValue(config.xAxisMax))
  const start = new Date(dates.reduce((min, date) => Math.min(min, +date), Infinity))
  const frequency = table.timeProfiles?.[config.xField]?.frequency ?? inferTimeProfile(dates, dates)?.frequency
  // Imported calendar observations may retain a time or use the end of their
  // period. Include its boundary without changing the source timestamps.
  start.setHours(0, 0, 0, 0)
  const unit = effectiveDateStepUnit(config)
  if (unit !== 'day' && unit !== 'week') {
    if (frequency === 'annual') start.setMonth(0, 1)
    else if (frequency === 'semiannual') start.setMonth(Math.floor(start.getMonth() / 6) * 6, 1)
    else if (frequency === 'quarterly') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1)
    else if (frequency === 'monthly') start.setDate(1)
  }
  return { min: requestedMin ?? +start, max: requestedMax ?? dates.reduce((max, date) => Math.max(max, +date), -Infinity) }
}

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

// Frequency describes the observations; the axis format describes the visible
// time span. They need not have the same granularity.
const dateAxisPlan = (categories: DataValue[], table: DataTable, config: ChartConfig, availableLength?: number, orientation: 'horizontal' | 'vertical' = 'horizontal') => {
  const dates = categories.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()))
  const frequency = table.timeProfiles?.[config.xField]?.frequency ?? inferTimeProfile(categories, categories)?.frequency ?? 'irregular'
  if (!dates.length) return { format: config.dateLabelFormat, unit: effectiveDateStepUnit(config), count: config.xAxisStep ?? 1, frequency }
  const { min, max } = dateBounds(dates, table, config)
  const spanDays = (max - min) / 86400000
  const explicitUnit = config.dateAxisStepUnit && config.dateAxisStepUnit !== 'auto' ? config.dateAxisStepUnit : null
  const automaticUnit = spanDays >= 365.25 * 2 || frequency === 'annual' ? 'year'
    : frequency === 'semiannual' ? 'half' : frequency === 'quarterly' ? 'quarter'
    : spanDays >= 60 || frequency === 'monthly' ? 'month' : frequency === 'weekly' ? 'week' : 'day'
  const unitFormats = { year: 'year-full', half: 'half-year-ru', quarter: 'quarter-context-ru', month: 'month-context-ru', week: 'week-context-ru', day: 'day-context-month-ru' } as const
  const format = !config.dateLabelFormat || config.dateLabelFormat === 'auto' ? unitFormats[explicitUnit ?? automaticUnit] : config.dateLabelFormat
  const unit = effectiveDateStepUnit({ ...config, dateLabelFormat: format }) ?? 'day'
  const style = config.xAxisLabelText ?? config.axisLabelText
  const width = Math.max(80, availableLength ?? (config.canvasWidth ?? 1000) - (config.canvasMarginLeft ?? 32) - (config.canvasMarginRight ?? 24) - 60)
  const labelWidth = Math.max(...dates.slice(0, 12).map((value) => {
    const lines = formatDateLabel(value, undefined, format, true).split('\n')
    return orientation === 'vertical' ? lines.length * style.size * style.lineHeight / 100 : Math.max(...lines.map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight)))
  }))
  const capacity = Math.max(2, Math.floor(width / (labelWidth + 24)))
  const required = Math.max(1, Math.ceil((calendarBucket(new Date(max), unit) - calendarBucket(new Date(min), unit)) / capacity))
  const niceSteps = unit === 'month' ? [1, 2, 3, 6, 12, 24, 60, 120] : unit === 'quarter' ? [1, 2, 4, 8, 20, 40] : [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  const count = config.xAxisStep == null ? niceSteps.find((step) => step >= required) ?? required : Math.max(1, Math.round(config.xAxisStep))
  return { format, unit, count, frequency }
}

// Calendar ticks belong to the axis, not to observations. Holidays and gaps
// must not remove January 1 or change the elapsed distance between points.
export const planDateAxisTicks = (categories: DataValue[], table: DataTable, config: ChartConfig, availableLength?: number, orientation: 'horizontal' | 'vertical' = 'horizontal') => {
  const dates = categories.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()))
  if (!dates.length) return undefined
  const { min, max } = dateBounds(dates, table, config)
  const { format, unit, count, frequency } = dateAxisPlan(categories, table, config, availableLength, orientation)
  if (!unit) return undefined
  const start = new Date(min)
  const parsedAnchor = config.dateAxisAnchor ? new Date(`${config.dateAxisAnchor}T00:00:00`) : null
  const anchor = parsedAnchor && Number.isFinite(+parsedAnchor) ? parsedAnchor : null
  const origin = anchor ? calendarBucket(anchor, unit) : unit === 'year' ? 0 : calendarBucket(start, unit)
  const bucketDate = (bucket: number) => unit === 'year' ? new Date(bucket, 0, 1)
    : unit === 'month' ? new Date(Math.floor(bucket / 12), bucket % 12, 1)
    : unit === 'quarter' ? new Date(Math.floor(bucket / 4), bucket % 4 * 3, 1)
    : unit === 'half' ? new Date(Math.floor(bucket / 2), bucket % 2 * 6, 1)
    : (() => { const utc = new Date(unit === 'week' ? Date.UTC(1970, 0, 5) + bucket * 604800000 : bucket * 86400000); return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()) })()
  const first = origin + Math.ceil((calendarBucket(start, unit) - origin) / count) * count
  const tickDates: Date[] = []
  for (let bucket = first; bucket <= calendarBucket(new Date(max), unit); bucket += count) {
    const day = bucketDate(bucket)
    if (+day >= min && +day <= max && (!anchor || +day >= +anchor)) tickDates.push(day)
  }
  if (unit === 'week' && config.xAxisStep == null) {
    for (let bucket = calendarBucket(start, unit); bucket <= calendarBucket(new Date(max), unit); bucket++) {
      const day = bucketDate(bucket)
      if (+day >= min && +day <= max && (!anchor || +day >= +anchor) && isoWeekParts(day).week === 1 && !tickDates.some((tick) => +tick === +day)) tickDates.push(day)
    }
    tickDates.sort((a, b) => +a - +b)
  }
  if (min === max && !tickDates.length) tickDates.push(start)
  const labels = moveDateContextToVisibleLabels(tickDates.map((day, index) => formatDateLabel(day, table.timeProfiles?.[config.xField], format, true, index)), tickDates, format, () => true)
  return { min, max, frequency, ticks: tickDates.map((day, index) => ({ value: +day, label: config.categoryLabelOverrides?.x?.[day.toISOString()] ?? labels[index] })) }
}

export type CalendarAxis = NonNullable<ReturnType<typeof planDateAxisTicks>>

// Layout knows the space left after titles, value labels and legends. All chart
// families choose their calendar step here, using that actual axis length.
export const fitCalendarAxis = (axis: CalendarAxis, config: ChartConfig, length: number, orientation: 'horizontal' | 'vertical') =>
  planDateAxisTicks([new Date(axis.min), new Date(axis.max)], {
    name: '', columns: [], rows: [], timeProfiles: { [config.xField]: { frequency: axis.frequency, label: '', confidence: 100, source: 'intervals' } },
  }, { ...config, xAxisMin: new Date(axis.min).toISOString(), xAxisMax: new Date(axis.max).toISOString() }, length, orientation)!

// Band charts retain one band per observation. Calendar marks can fall between
// bands; interpolating their positions avoids relabeling a later observation.
export const planCategoryDateTicks = (categories: DataValue[], table: DataTable, config: ChartConfig) => {
  const dated = categories.flatMap((value, index) => value instanceof Date && Number.isFinite(+value) ? [{ value: +value, index }] : [])
  if (!dated.length) return undefined
  const axis = planDateAxisTicks(categories, table, config)!
  let right = 0
  return axis.ticks.flatMap((tick) => {
    if (tick.value < axis.min || tick.value > dated.at(-1)!.value) return []
    while (right + 1 < dated.length && dated[right].value < tick.value) right++
    const next = dated[right], previous = dated[Math.max(0, right - 1)]
    const position = next.value === previous.value ? next.index : previous.index + (next.index - previous.index) * (tick.value - previous.value) / (next.value - previous.value)
    return [{ ...tick, position }]
  })
}

export const planCategoryDateLabels = (
  categories: DataValue[],
  table: DataTable,
  config: ChartConfig,
) => {
  const firstNumericIndex = categories.findIndex((value) => typeof value === 'number')
  const lastNumericIndex = categories.findLastIndex((value) => typeof value === 'number')
  const { unit, frequency, count, format } = dateAxisPlan(categories, table, config)
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
      if (!isCalendarBoundary(value, unit, frequency) && !(validAnchor && firstObservedInBucket)) return ''
      firstBucket ??= anchorBucket ?? (unit === 'year' ? 0 : bucket)
      const keepIsoYear = unit === 'week' && config.xAxisStep == null && isoWeekParts(value).week === 1
      if (bucket === previousBucket || (bucket - firstBucket) % count !== 0 && !keepIsoYear) return ''
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
      if ((format?.startsWith('month-') || format?.startsWith('year-month')) && !firstMonthLabel) return ''
      if ((format?.includes('quarter') || format === 'quarter-only') && !firstQuarterLabel) return ''
      if ((format?.startsWith('week-') || format?.startsWith('year-week-')) && !firstWeekLabel) return ''
      if (format === 'quarter-context-en' || format === 'quarter-context-ru' || format === 'month-context-ru' || format === 'month-context-en') return formatDateLabel(value, undefined, format, firstYearLabel)
      if (format === 'day-context-month-ru' || format === 'day-context-month-en') return formatDateLabel(value, undefined, format, firstMonthLabel)
      if (format === 'week-context-en' || format === 'week-context-ru') return formatDateLabel(value, undefined, format, firstIsoYearLabel)
    }
    const label = typeof value === 'number'
      ? formatXAxisNumber(value, config, index === firstNumericIndex ? 'first' : index === lastNumericIndex ? 'last' : 'middle')
      : formatTimeValue(value, table.timeProfiles?.[config.xField], value instanceof Date ? format : config.dateLabelFormat, displayedIndex)
    displayedIndex += 1
    return label
  })
}
