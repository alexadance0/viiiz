import type { DataRow, DataTable, TimeFrequency } from './types'

export type UnitTransform = 'level' | 'change' | 'change-year' | 'percent-change' | 'percent-year' | 'annual-rate' | 'continuous-rate' | 'continuous-annual-rate' | 'log' | 'index'
export type FrequencyAggregation = 'average' | 'sum' | 'end' | 'start' | 'min' | 'max'
export interface EconomicTransformOptions {
  timeColumn: string
  valueColumn: string
  start?: string
  end?: string
  frequency: 'original' | Exclude<TimeFrequency, 'irregular'>
  aggregation: FrequencyAggregation
  units: UnitTransform
  indexDate?: string
}

const periodsPerYear: Record<Exclude<TimeFrequency, 'irregular'>, number> = { daily: 365, weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, annual: 1 }
const labels: Record<Exclude<TimeFrequency, 'irregular'>, string> = { daily: 'Дневные', weekly: 'Недельные', monthly: 'Месячные', quarterly: 'Квартальные', semiannual: 'Полугодовые', annual: 'Годовые' }
const parseInputDate = (text?: string, end = false) => {
  if (!text) return undefined
  const [year, month = 1, day = 1] = text.split('-').map(Number)
  return new Date(year, month - 1, end && text.length === 7 ? new Date(year, month, 0).getDate() : day).getTime()
}
const bucketDate = (date: Date, frequency: Exclude<TimeFrequency, 'irregular'>) => {
  const year = date.getFullYear(), month = date.getMonth()
  if (frequency === 'annual') return new Date(year, 0, 1)
  if (frequency === 'semiannual') return new Date(year, Math.floor(month / 6) * 6, 1)
  if (frequency === 'quarterly') return new Date(year, Math.floor(month / 3) * 3, 1)
  if (frequency === 'monthly') return new Date(year, month, 1)
  if (frequency === 'weekly') { const result = new Date(year, month, date.getDate()); result.setDate(result.getDate() - (result.getDay() + 6) % 7); result.setHours(0, 0, 0, 0); return result }
  return new Date(year, month, date.getDate())
}
const aggregate = (values: number[], method: FrequencyAggregation) => {
  if (!values.length) return null
  if (method === 'sum') return values.reduce((sum, value) => sum + value, 0)
  if (method === 'average') return values.reduce((sum, value) => sum + value, 0) / values.length
  if (method === 'min') return values.reduce((result, value) => value < result ? value : result, Number.POSITIVE_INFINITY)
  if (method === 'max') return values.reduce((result, value) => value > result ? value : result, Number.NEGATIVE_INFINITY)
  return method === 'start' ? values[0] : values.at(-1)!
}
const groupKey = (row: DataRow, fields: string[]) => fields.map((field) => `${typeof row[field]}:${String(row[field])}`).join('\u001f')

export function transformEconomicSeries(table: DataTable, options: EconomicTransformOptions): DataTable {
  const profile = table.timeProfiles?.[options.timeColumn]
  const sourceFrequency = profile?.frequency === 'irregular' || !profile ? undefined : profile.frequency
  const targetFrequency = options.frequency === 'original' ? sourceFrequency : options.frequency
  if (!targetFrequency) throw new Error('Не удалось определить исходную периодичность. Выберите частоту явно.')
  const start = parseInputDate(options.start), end = parseInputDate(options.end, true)
  const dimensions = table.columns.filter((column) => column !== options.timeColumn && column !== options.valueColumn && table.rows.some((row) => typeof row[column] === 'string' || typeof row[column] === 'boolean'))
  const filtered = table.rows.filter((row) => row[options.timeColumn] instanceof Date && (start == null || (row[options.timeColumn] as Date).getTime() >= start) && (end == null || (row[options.timeColumn] as Date).getTime() <= end))
  if (!filtered.length) throw new Error('В выбранном периоде нет наблюдений')
  const buckets = new Map<string, { date: Date; template: DataRow; values: number[] }>()
  filtered.forEach((row) => {
    const date = bucketDate(row[options.timeColumn] as Date, targetFrequency)
    const key = `${groupKey(row, dimensions)}\u001e${date.getTime()}`
    const entry = buckets.get(key) ?? { date, template: row, values: [] }
    if (typeof row[options.valueColumn] === 'number' && Number.isFinite(row[options.valueColumn] as number)) entry.values.push(row[options.valueColumn] as number)
    buckets.set(key, entry)
  })
  const rows = [...buckets.values()].map(({ date, template, values }) => ({ ...template, [options.timeColumn]: date, [options.valueColumn]: aggregate(values, options.aggregation) }))
    .sort((a, b) => groupKey(a, dimensions).localeCompare(groupKey(b, dimensions)) || (a[options.timeColumn] as Date).getTime() - (b[options.timeColumn] as Date).getTime())
  const groups = new Map<string, DataRow[]>()
  rows.forEach((row) => { const key = groupKey(row, dimensions); groups.set(key, [...(groups.get(key) ?? []), row]) })
  const lag = periodsPerYear[targetFrequency]
  groups.forEach((series) => {
    const indexTime = parseInputDate(options.indexDate)
    const base = indexTime == null ? undefined : series.find((row) => (row[options.timeColumn] as Date).getTime() >= indexTime)?.[options.valueColumn]
    const source = series.map((row) => row[options.valueColumn] as number | null)
    series.forEach((row, index) => {
      const value = source[index]
      const previous = source[index - 1]
      const previousYear = source[index - lag]
      let result: number | null = value
      if (value == null) result = null
      else if (options.units === 'change') result = previous == null ? null : value - previous
      else if (options.units === 'change-year') result = previousYear == null ? null : value - previousYear
      else if (options.units === 'percent-change') result = previous == null || previous === 0 ? null : (value / previous - 1) * 100
      else if (options.units === 'percent-year') result = previousYear == null || previousYear === 0 ? null : (value / previousYear - 1) * 100
      else if (options.units === 'annual-rate') result = previous == null || previous <= 0 || value <= 0 ? null : (Math.pow(value / previous, lag) - 1) * 100
      else if (options.units === 'continuous-rate') result = previous == null || previous <= 0 || value <= 0 ? null : Math.log(value / previous) * 100
      else if (options.units === 'continuous-annual-rate') result = previous == null || previous <= 0 || value <= 0 ? null : Math.log(value / previous) * lag * 100
      else if (options.units === 'log') result = value > 0 ? Math.log(value) : null
      else if (options.units === 'index') result = typeof base === 'number' && base !== 0 ? value / base * 100 : null
      row[options.valueColumn] = result
    })
  })
  return {
    ...table,
    rows,
    rawRows: rows.map((row) => ({ ...row })),
    observationFlags: undefined,
    imputedCells: undefined,
    timeProfiles: { ...table.timeProfiles, [options.timeColumn]: { frequency: targetFrequency, label: labels[targetFrequency], confidence: 100, source: 'intervals' } },
  }
}
