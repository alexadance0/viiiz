import { addPeriod, groupingColumns } from './dataQuality'
import type { ColumnType, DataRow, DataTable, DataValue, TimeFrequency } from './types'

export type GapFillMethod = 'empty' | 'linear' | 'forward' | 'seasonal'
export interface GapFillOptions { timeColumn: string; valueColumn: string; method: GapFillMethod }
const MAX_INSERTED_PERIODS_PER_GAP = 10_000

const seasonLength = (frequency: TimeFrequency): number | null => ({ daily: 7, weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, annual: 1, irregular: 0 }[frequency] || null)
const keyFor = (row: DataRow, columns: string[]) => columns.map((column) => `${column}:${String(row[column] ?? '')}`).join('\u001f') || '__all__'

export function fillTimeGaps(table: DataTable, types: Record<string, ColumnType>, options: GapFillOptions): { table: DataTable; inserted: number; filled: number } {
  const profile = table.timeProfiles?.[options.timeColumn]
  if (!profile || profile.frequency === 'irregular') throw new Error('Для столбца не определена регулярная периодичность')
  if (types[options.valueColumn] !== 'number') throw new Error('Заполнять можно только числовой столбец')
  const groupsBy = groupingColumns(table, types, options.timeColumn)
  const groups = new Map<string, Array<{ row: DataRow; raw: DataRow; oldIndex: number }>>()
  const undated: Array<{ row: DataRow; raw: DataRow; oldIndex: number }> = []
  table.rows.forEach((row, index) => {
    if (!(row[options.timeColumn] instanceof Date)) { undated.push({ row, raw: table.rawRows?.[index] ?? row, oldIndex: index }); return }
    const key = keyFor(row, groupsBy)
    const list = groups.get(key) ?? []
    list.push({ row, raw: table.rawRows?.[index] ?? row, oldIndex: index }); groups.set(key, list)
  })

  const output: Array<{ row: DataRow; raw: DataRow; oldIndex?: number; imputed?: boolean }> = []
  let inserted = 0, filled = 0
  for (const records of groups.values()) {
    records.sort((a, b) => (a.row[options.timeColumn] as Date).getTime() - (b.row[options.timeColumn] as Date).getTime())
    const seenDates = new Set<number>()
    records.forEach((record) => {
      const timestamp = (record.row[options.timeColumn] as Date).getTime()
      if (seenDates.has(timestamp)) throw new Error('В одном временном ряду есть повторяющиеся периоды — сначала устраните дубликаты')
      seenDates.add(timestamp)
    })
    const businessDays = profile.frequency === 'daily' && records.every(({ row }) => {
      const day = (row[options.timeColumn] as Date).getDay(); return day !== 0 && day !== 6
    })
    const knownByTime = new Map(records.map((record) => [(record.row[options.timeColumn] as Date).getTime(), record]))
    for (let index = 0; index < records.length; index++) {
      const current = records[index]
      output.push(current)
      const next = records[index + 1]
      if (!next) continue
      const currentDate = current.row[options.timeColumn] as Date
      const nextDate = next.row[options.timeColumn] as Date
      const gaps: Date[] = []
      let expected = addPeriod(currentDate, profile.frequency, businessDays)
      while (expected.getTime() < nextDate.getTime() && gaps.length < MAX_INSERTED_PERIODS_PER_GAP) { gaps.push(expected); expected = addPeriod(expected, profile.frequency, businessDays) }
      if (expected.getTime() < nextDate.getTime()) throw new Error(`Разрыв содержит больше ${MAX_INSERTED_PERIODS_PER_GAP.toLocaleString('ru-RU')} периодов — сузьте диапазон данных`)
      gaps.forEach((date, gapIndex) => {
        const row: DataRow = Object.fromEntries(table.columns.map((column) => [column, null]))
        groupsBy.forEach((column) => { row[column] = current.row[column] })
        row[options.timeColumn] = date
        let value: DataValue = null
        const previous = current.row[options.valueColumn]
        const following = next.row[options.valueColumn]
        if (options.method === 'forward' && typeof previous === 'number') value = previous
        if (options.method === 'linear' && typeof previous === 'number' && typeof following === 'number') value = previous + (following - previous) * ((gapIndex + 1) / (gaps.length + 1))
        if (options.method === 'seasonal') {
          const periods = seasonLength(profile.frequency)
          if (periods) {
            let seasonalDate = date
            for (let step = 0; step < periods; step++) seasonalDate = addPeriod(seasonalDate, profile.frequency, businessDays, -1)
            const seasonal = knownByTime.get(seasonalDate.getTime())?.row[options.valueColumn]
            if (typeof seasonal === 'number') value = seasonal
          }
        }
        row[options.valueColumn] = value
        if (typeof value === 'number') filled++
        output.push({ row, raw: { ...row }, imputed: true }); inserted++
      })
    }
  }
  output.push(...undated)
  const observationFlags: DataTable['observationFlags'] = {}
  const imputedCells: NonNullable<DataTable['imputedCells']> = {}
  output.forEach((record, newIndex) => {
    if (record.oldIndex != null) for (const [column, flags] of Object.entries(table.observationFlags ?? {})) {
      if (flags[record.oldIndex]) (observationFlags[column] ??= {})[newIndex] = flags[record.oldIndex]
    }
    if (record.oldIndex != null) for (const [column, cells] of Object.entries(table.imputedCells ?? {})) {
      if (cells[record.oldIndex]) (imputedCells[column] ??= {})[newIndex] = cells[record.oldIndex]
    }
    if (record.imputed) (imputedCells[options.valueColumn] ??= {})[newIndex] = { method: options.method, generatedPeriod: true }
  })
  return { table: { ...table, rows: output.map((item) => item.row), rawRows: output.map((item) => item.raw), observationFlags, imputedCells }, inserted, filled }
}

function centeredMovingAverage(values: Array<number | null>, window: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null)
  const average = (items: Array<number | null>) => items.every((value) => typeof value === 'number') ? items.reduce<number>((sum, value) => sum + (value as number), 0) / items.length : null
  if (window % 2 === 1) {
    const half = Math.floor(window / 2)
    for (let index = half; index < values.length - half; index++) result[index] = average(values.slice(index - half, index + half + 1))
  } else {
    const half = window / 2
    for (let index = half; index < values.length - half; index++) {
      const left = average(values.slice(index - half, index + half))
      const right = average(values.slice(index - half + 1, index + half + 1))
      result[index] = left != null && right != null ? (left + right) / 2 : null
    }
  }
  return result
}

export interface DerivedOptions { timeColumn: string; valueColumn: string; name: string; method: 'moving-average' | 'seasonal-additive' | 'seasonal-multiplicative'; window?: number }

export function addDerivedTimeSeries(table: DataTable, types: Record<string, ColumnType>, options: DerivedOptions): DataTable {
  if (table.columns.includes(options.name)) throw new Error('Столбец с таким названием уже существует')
  const profile = table.timeProfiles?.[options.timeColumn]
  if (!profile) throw new Error('Периодичность временного столбца не определена')
  const groupsBy = groupingColumns(table, types, options.timeColumn)
  const groups = new Map<string, number[]>()
  table.rows.forEach((row, index) => { const key = keyFor(row, groupsBy); const list = groups.get(key) ?? []; list.push(index); groups.set(key, list) })
  const derived: Array<number | null> = Array(table.rows.length).fill(null)
  for (const indices of groups.values()) {
    indices.sort((a, b) => ((table.rows[a][options.timeColumn] as Date)?.getTime?.() ?? 0) - ((table.rows[b][options.timeColumn] as Date)?.getTime?.() ?? 0))
    const values = indices.map((index) => typeof table.rows[index][options.valueColumn] === 'number' ? table.rows[index][options.valueColumn] as number : null)
    if (options.method === 'moving-average') {
      const smoothed = centeredMovingAverage(values, Math.max(2, options.window ?? 3))
      indices.forEach((rowIndex, position) => { derived[rowIndex] = smoothed[position] })
      continue
    }
    const period = seasonLength(profile.frequency)
    if (!period) throw new Error('Для этой периодичности сезонная корректировка недоступна')
    if (values.length < period * 2) throw new Error(`Для сезонной корректировки нужно минимум ${period * 2} наблюдений в каждом ряду`)
    if (options.method === 'seasonal-multiplicative' && values.some((value) => value != null && value <= 0)) throw new Error('Мультипликативная модель требует положительных значений')
    const trend = centeredMovingAverage(values, period)
    const seasonalBuckets: number[][] = Array.from({ length: period }, () => [])
    values.forEach((value, index) => {
      if (value == null || trend[index] == null || trend[index] === 0) return
      seasonalBuckets[index % period].push(options.method === 'seasonal-additive' ? value - trend[index]! : value / trend[index]!)
    })
    if (seasonalBuckets.some((bucket) => !bucket.length)) throw new Error('Недостаточно данных для оценки всех сезонных периодов')
    let seasonal = seasonalBuckets.map((bucket) => bucket.reduce((sum, value) => sum + value, 0) / bucket.length)
    if (options.method === 'seasonal-additive') { const mean = seasonal.reduce((a, b) => a + b, 0) / period; seasonal = seasonal.map((value) => value - mean) }
    else { const mean = seasonal.reduce((a, b) => a + b, 0) / period; seasonal = seasonal.map((value) => value / mean) }
    indices.forEach((rowIndex, position) => { const value = values[position]; derived[rowIndex] = value == null ? null : options.method === 'seasonal-additive' ? value - seasonal[position % period] : value / seasonal[position % period] })
  }
  return {
    ...table,
    columns: [...table.columns, options.name],
    rows: table.rows.map((row, index) => ({ ...row, [options.name]: derived[index] })),
    rawRows: (table.rawRows ?? table.rows).map((row, index) => ({ ...row, [options.name]: derived[index] })),
  }
}
