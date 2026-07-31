import { formatTimeValue, inferTimeProfile } from './timeFrequency'
import type { ColumnType, DataIssue, DataTable, DataValue, TimeFrequency, TimeProfile } from './types'

const serialize = (value: DataValue) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value)}`

const transposeHeader = (value: DataValue, index: number) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  return String(value ?? '').trim() || `Строка ${index + 1}`
}

export function transposeTable(table: DataTable): DataTable {
  if (table.columns.length < 2) throw new Error('Для транспонирования нужны минимум два столбца')
  if (!table.rows.length) throw new Error('Нельзя транспонировать пустую таблицу')

  const firstColumn = table.columns[0]
  const usedHeaders = new Set([firstColumn])
  const transposedHeaders = table.rows.map((row, index) => {
    const base = transposeHeader(row[firstColumn], index)
    let header = base
    let suffix = 2
    while (usedHeaders.has(header)) header = `${base} (${suffix++})`
    usedHeaders.add(header)
    return header
  })
  const rows = table.columns.slice(1).map((sourceColumn) => {
    const row: Record<string, DataValue> = { [firstColumn]: sourceColumn }
    table.rows.forEach((sourceRow, index) => { row[transposedHeaders[index]] = sourceRow[sourceColumn] ?? null })
    return row
  })

  return { name: table.name, columns: [firstColumn, ...transposedHeaders], rows }
}

export function findDuplicateRowIndices(table: DataTable): number[] {
  const seen = new Map<string, number>()
  const duplicates: number[] = []
  table.rows.forEach((row, index) => {
    const key = table.columns.map((column) => serialize(row[column])).join('\u001f')
    if (seen.has(key)) duplicates.push(index)
    else seen.set(key, index)
  })
  return duplicates
}

export function removeDuplicateRows(table: DataTable): DataTable {
  const duplicateSet = new Set(findDuplicateRowIndices(table))
  if (!duplicateSet.size) return table
  return removeRows(table, [...duplicateSet])
}

function reindexMetadata<T>(metadata: Record<string, Record<number, T>> | undefined, keptIndices: number[]) {
  if (!metadata) return undefined
  return Object.fromEntries(Object.entries(metadata).map(([column, values]) => {
    const next: Record<number, T> = {}
    keptIndices.forEach((oldIndex, newIndex) => { if (values[oldIndex] != null) next[newIndex] = values[oldIndex] })
    return [column, next]
  }))
}

export function removeRows(table: DataTable, indices: number[]): DataTable {
  const removed = new Set(indices.filter((index) => Number.isInteger(index) && index >= 0 && index < table.rows.length))
  if (!removed.size) return table
  if (removed.size === table.rows.length) throw new Error('Нельзя удалить все строки таблицы')
  const keptIndices = table.rows.map((_, index) => index).filter((index) => !removed.has(index))
  const rows = keptIndices.map((index) => table.rows[index])
  const rawRows = table.rawRows ? keptIndices.map((index) => table.rawRows![index]) : undefined
  const timeProfiles = Object.fromEntries(Object.keys(table.timeProfiles ?? {}).flatMap((column) => {
    const profile = inferTimeProfile((rawRows ?? rows).map((row) => row[column]), rows.map((row) => row[column]))
    return profile ? [[column, profile]] : []
  }))
  return {
    ...table,
    rows,
    rawRows,
    observationFlags: reindexMetadata(table.observationFlags, keptIndices),
    imputedCells: reindexMetadata(table.imputedCells, keptIndices),
    timeProfiles,
  }
}

export function removeColumns(table: DataTable, columns: string[]): DataTable {
  const removed = new Set(columns.filter((column) => table.columns.includes(column)))
  if (!removed.size) return table
  if (removed.size === table.columns.length) throw new Error('Нельзя удалить все столбцы таблицы')
  const kept = table.columns.filter((column) => !removed.has(column))
  const pickRow = (row: DataTable['rows'][number]) => Object.fromEntries(kept.map((column) => [column, row[column] ?? null]))
  const pickMetadata = <T>(metadata: Record<string, T> | undefined) => metadata ? Object.fromEntries(kept.flatMap((column) => metadata[column] == null ? [] : [[column, metadata[column]]])) : undefined
  return {
    ...table,
    columns: kept,
    rows: table.rows.map(pickRow),
    rawRows: table.rawRows?.map(pickRow),
    normalizations: pickMetadata(table.normalizations),
    observationFlags: pickMetadata(table.observationFlags),
    timeProfiles: pickMetadata(table.timeProfiles),
    dateRules: pickMetadata(table.dateRules),
    imputedCells: pickMetadata(table.imputedCells),
  }
}

export const addPeriod = (date: Date, frequency: TimeFrequency, businessDays: boolean, direction = 1): Date => {
  const next = new Date(date)
  if (frequency === 'daily') {
    next.setDate(next.getDate() + direction)
    if (businessDays) while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + direction)
  }
  if (frequency === 'weekly') next.setDate(next.getDate() + 7 * direction)
  const monthStep = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : frequency === 'semiannual' ? 6 : frequency === 'annual' ? 12 : 0
  if (monthStep) {
    const day = next.getDate()
    const wasEndOfMonth = day === new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(1); next.setMonth(next.getMonth() + monthStep * direction)
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(wasEndOfMonth ? lastDay : Math.min(day, lastDay))
  }
  return next
}

export function groupingColumns(table: DataTable, types: Record<string, ColumnType>, timeColumn: string): string[] {
  return table.columns.filter((column) => column !== timeColumn && (types[column] === 'text' || types[column] === 'boolean'))
    .map((column) => ({ column, unique: new Set(table.rows.map((row) => String(row[column] ?? ''))).size }))
    .filter(({ unique }) => unique > 1 && unique <= 500)
    .sort((a, b) => a.unique - b.unique)
    .slice(0, 2)
    .map(({ column }) => column)
}

export function findTimeGaps(table: DataTable, column: string, profile: TimeProfile, types: Record<string, ColumnType>): { count: number; examples: string[] } {
  if (profile.frequency === 'irregular') return { count: 0, examples: [] }
  const groupColumns = groupingColumns(table, types, column)
  const groups = new Map<string, { label: string; dates: Date[] }>()
  table.rows.forEach((row) => {
    const value = row[column]
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return
    const parts = groupColumns.map((field) => `${field}: ${String(row[field] ?? '—')}`)
    const key = parts.join('\u001f') || '__all__'
    const group = groups.get(key) ?? { label: parts.join(', '), dates: [] }
    group.dates.push(value); groups.set(key, group)
  })

  let count = 0
  const examples: string[] = []
  for (const group of groups.values()) {
    const dates = [...new Map(group.dates.map((date) => [date.getTime(), date])).values()].sort((a, b) => a.getTime() - b.getTime())
    if (dates.length < 2) continue
    const businessDays = profile.frequency === 'daily' && dates.every((date) => date.getDay() !== 0 && date.getDay() !== 6)
    for (let index = 1; index < dates.length; index++) {
      let expected = addPeriod(dates[index - 1], profile.frequency, businessDays)
      let guard = 0
      while (expected.getTime() < dates[index].getTime() && guard++ < 10_000) {
        count++
        if (examples.length < 6) examples.push(`${formatTimeValue(expected, profile)}${group.label ? ` · ${group.label}` : ''}`)
        expected = addPeriod(expected, profile.frequency, businessDays)
      }
    }
  }
  return { count, examples }
}

export function datasetQualityIssues(table: DataTable, types: Record<string, ColumnType>): DataIssue[] {
  const issues: DataIssue[] = []
  const duplicates = findDuplicateRowIndices(table)
  if (duplicates.length) issues.push({
    column: '', kind: 'duplicate', severity: 'warning', count: duplicates.length,
    message: `${duplicates.length} точных дубликатов строк`, examples: duplicates.slice(0, 6).map((index) => `Строка ${index + 1}`),
  })
  for (const [column, profile] of Object.entries(table.timeProfiles ?? {})) {
    if (types[column] !== 'date') continue
    const gaps = findTimeGaps(table, column, profile, types)
    if (gaps.count) issues.push({
      column, kind: 'time-gap', severity: 'warning', count: gaps.count,
      message: `${gaps.count} пропущенных периодов`, examples: gaps.examples,
    })
  }
  return issues
}
