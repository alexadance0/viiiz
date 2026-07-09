import type { ColumnType, DataIssue, DataTable, DataValue } from './types'
import { parseDateValue, parseLocalizedNumber } from './normalization'
import { parseDateByRule } from './dateRule'
import { inferTimeProfile } from './timeFrequency'
import { datasetQualityIssues } from './dataQuality'

const missing = (value: DataValue) => value == null || value === ''

export function inferColumnType(table: DataTable, column: string): ColumnType {
  const values = table.rows.map((row) => row[column]).filter((value) => !missing(value))
  if (!values.length) return 'text'
  const sample = values.slice(0, 200)
  if (sample.every((value) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))))) return 'number'
  if (sample.every((value) => typeof value === 'boolean' || value === 'true' || value === 'false')) return 'boolean'
  if (sample.every((value) => value instanceof Date || parseDateValue(value) != null)) return 'date'
  return 'text'
}

export function inferTypes(table: DataTable): Record<string, ColumnType> {
  return Object.fromEntries(table.columns.map((column) => [column, inferColumnType(table, column)]))
}

export function profileData(table: DataTable, types: Record<string, ColumnType>): DataIssue[] {
  const issues: DataIssue[] = (table.importWarnings ?? []).map((message) => ({ column: '', count: 1, severity: 'warning', message }))
  for (const column of table.columns) {
    const normalization = table.normalizations?.[column]
    if (normalization?.kind === 'number' && normalization.ambiguous > 0) {
      issues.push({ column, count: normalization.ambiguous, severity: 'warning', message: `${normalization.ambiguous} чисел имеют неоднозначный разделитель` })
    }
    const flags = Object.values(table.observationFlags?.[column] ?? {}).flat()
    if (flags.length) {
      const serious = flags.some((flag) => /конфиденциаль|скрыто|ненадёж|невозможно|^[ufcdxz]$/i.test(flag))
      const labels = Array.from(new Set(flags)).slice(0, 4).join(', ')
      issues.push({ column, count: flags.length, severity: serious ? 'warning' : 'info', message: `${flags.length} значений с флагами: ${labels}` })
    }
    const emptyCount = table.rows.filter((row) => missing(row[column])).length
    if (emptyCount) {
      const ratio = emptyCount / Math.max(table.rows.length, 1)
      issues.push({ column, count: emptyCount, severity: ratio >= .2 ? 'critical' : 'warning', message: `${emptyCount} пропусков (${Math.round(ratio * 100)}%)` })
    }
    const nonEmpty = table.rows.filter((row) => !missing(row[column]))
    if (types[column] === 'number') {
      const invalid = nonEmpty.filter((row) => Number.isNaN(Number(row[column]))).length
      if (invalid) issues.push({ column, count: invalid, severity: 'critical', message: `${invalid} значений не являются числами` })
    }
    if (types[column] === 'date') {
      const invalid = nonEmpty.filter((row) => !(row[column] instanceof Date) || Number.isNaN((row[column] as Date).getTime())).length
      if (invalid) issues.push({ column, count: invalid, severity: 'critical', message: `${invalid} дат не распознано` })
    }
  }
  return [...issues, ...datasetQualityIssues(table, types)]
}

export function renameColumn(table: DataTable, oldName: string, newName: string): DataTable {
  const clean = newName.trim()
  if (!clean || clean === oldName || table.columns.includes(clean)) return table
  const renameRows = (rows: DataTable['rows'] | undefined) => rows?.map((row) => {
    const next = { ...row, [clean]: row[oldName] }
    delete next[oldName]
    return next
  })
  const normalizations = table.normalizations ? { ...table.normalizations } : undefined
  if (normalizations?.[oldName]) {
    normalizations[clean] = normalizations[oldName]
    delete normalizations[oldName]
  }
  const observationFlags = table.observationFlags ? { ...table.observationFlags } : undefined
  if (observationFlags?.[oldName]) {
    observationFlags[clean] = observationFlags[oldName]
    delete observationFlags[oldName]
  }
  const timeProfiles = table.timeProfiles ? { ...table.timeProfiles } : undefined
  if (timeProfiles?.[oldName]) {
    timeProfiles[clean] = timeProfiles[oldName]
    delete timeProfiles[oldName]
  }
  const dateRules = table.dateRules ? { ...table.dateRules } : undefined
  if (dateRules?.[oldName]) {
    dateRules[clean] = dateRules[oldName]
    delete dateRules[oldName]
  }
  const imputedCells = table.imputedCells ? { ...table.imputedCells } : undefined
  if (imputedCells?.[oldName]) {
    imputedCells[clean] = imputedCells[oldName]
    delete imputedCells[oldName]
  }
  return {
    ...table,
    columns: table.columns.map((column) => column === oldName ? clean : column),
    rows: renameRows(table.rows)!,
    rawRows: renameRows(table.rawRows),
    normalizations,
    observationFlags,
    timeProfiles,
    dateRules,
    imputedCells,
  }
}

export function convertColumn(table: DataTable, column: string, type: ColumnType): DataTable {
  const format = table.normalizations?.[column]?.format ?? ''
  const dateOrder = format.startsWith('MM') ? 'mdy' : format.startsWith('YYYY') ? 'ymd' : 'dmy'
  const decimalHint = format === 'Десятичная запятая' ? ',' : format === 'Десятичная точка' ? '.' : undefined
  const rawRows = table.rawRows ?? table.rows.map((row) => ({ ...row }))
  const rows = table.rows.map((row, index) => {
    // Every conversion starts from the immutable imported value, not from the
    // result of a previous conversion. This makes type switching reversible.
    const source = rawRows[index]?.[column] ?? null
    if (missing(row[column]) || missing(source)) return { ...row, [column]: null }
    let converted: DataValue = source
    if (type === 'number') converted = parseLocalizedNumber(source, decimalHint)?.value ?? source
    if (type === 'text') converted = source instanceof Date ? source.toISOString() : String(source)
    if (type === 'boolean') {
      const normalized = String(source).trim().toLowerCase()
      if (['true', 'yes', 'y', 'да', 'д', 'истина', '1'].includes(normalized)) converted = true
      else if (['false', 'no', 'n', 'нет', 'н', 'ложь', '0'].includes(normalized)) converted = false
    }
    if (type === 'date') converted = parseDateValue(source, dateOrder, 50, true)?.value ?? source
    return { ...row, [column]: converted }
  })
  const timeProfiles = { ...(table.timeProfiles ?? {}) }
  if (type === 'date') {
    const profile = inferTimeProfile(rawRows.map((row) => row[column]), rows.map((row) => row[column]))
    if (profile) timeProfiles[column] = profile
    else delete timeProfiles[column]
  } else delete timeProfiles[column]
  return {
    ...table,
    rows,
    rawRows,
    timeProfiles,
  }
}

export function editCell(table: DataTable, rowIndex: number, column: string, input: string, type: ColumnType): DataTable {
  const raw: DataValue = input.trim() === '' ? null : input
  let value: DataValue = raw
  if (raw != null && type === 'number') value = parseLocalizedNumber(raw, table.normalizations?.[column]?.format === 'Десятичная запятая' ? ',' : undefined)?.value ?? raw
  if (raw != null && type === 'boolean') {
    const normalized = input.trim().toLowerCase()
    if (['true', 'yes', 'да', '1'].includes(normalized)) value = true
    else if (['false', 'no', 'нет', '0'].includes(normalized)) value = false
  }
  if (raw != null && type === 'date') {
    const rule = table.dateRules?.[column]
    value = (rule ? parseDateByRule(raw, rule).value : parseDateValue(raw, 'dmy', 50, true)?.value) ?? raw
  }
  const rows = table.rows.map((row, index) => index === rowIndex ? { ...row, [column]: value } : row)
  const sourceRows = table.rawRows ?? table.rows
  const rawRows = sourceRows.map((row, index) => index === rowIndex ? { ...row, [column]: raw } : { ...row })
  const timeProfiles = { ...(table.timeProfiles ?? {}) }
  if (type === 'date') {
    const profile = inferTimeProfile(rawRows.map((row) => row[column]), rows.map((row) => row[column]))
    if (profile) timeProfiles[column] = profile
    else delete timeProfiles[column]
  }
  const observationFlags = table.observationFlags ? { ...table.observationFlags } : undefined
  if (observationFlags?.[column]) {
    const values = { ...observationFlags[column] }; delete values[rowIndex]
    if (Object.keys(values).length) observationFlags[column] = values
    else delete observationFlags[column]
  }
  const imputedCells = table.imputedCells ? { ...table.imputedCells } : undefined
  if (imputedCells?.[column]) {
    const values = { ...imputedCells[column] }; delete values[rowIndex]
    if (Object.keys(values).length) imputedCells[column] = values
    else delete imputedCells[column]
  }
  return { ...table, rows, rawRows, timeProfiles, observationFlags, imputedCells }
}
