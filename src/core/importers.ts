import Papa from 'papaparse'
import readWorkbook, { type SheetData } from 'read-excel-file/browser'
import { parquetReadObjects } from 'hyparquet'
import type { DataTable, DataValue } from './types'

export { categoricalDemoTable, demoTable, distributionDemoTable, dumbbellDemoTable } from './demoData'

const normalize = (value: unknown): DataValue => {
  if (value == null) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER ? Number(value) : value.toString()
  try { return JSON.stringify(value) ?? String(value) } catch { return String(value) }
}

const uniqueHeaders = (headers: unknown[]): string[] => {
  const used = new Set<string>()
  return headers.map((header, index) => {
    const base = String(header ?? '').trim() || `column_${index + 1}`
    let name = base, suffix = 2
    while (used.has(name)) name = `${base}_${suffix++}`
    used.add(name)
    return name
  })
}

function makeTable(name: string, input: Record<string, unknown>[], importWarnings: string[] = []): DataTable {
  const columns = Array.from(new Set(input.flatMap(Object.keys)))
  const rows = input.map((row) => Object.fromEntries(columns.map((column) => [column, normalize(row[column])])))
  return { name, columns, rows, importWarnings }
}

function sheetToTable(fileName: string, sheetName: string, data: SheetData): DataTable {
  const [headers = [], ...values] = data
  const columns = uniqueHeaders(headers)
  const rows = values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])))
  return makeTable(`${fileName} · ${sheetName}`, rows)
}

export async function importExcelSheets(file: File): Promise<Array<{ name: string; table: DataTable }>> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'xlsx') throw new Error('Для выбора листов нужен файл XLSX')
  const sheets = await readWorkbook(file)
  return sheets.map(({ sheet, data }) => ({ name: sheet, table: sheetToTable(file.name, sheet, data) }))
}

export async function importFile(file: File): Promise<DataTable> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'csv') {
    const text = await file.text()
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message)
    return makeTable(file.name, parsed.data, parsed.errors.map((error) => `Строка ${(error.row ?? 0) + 1}: ${error.message}`).slice(0, 20))
  }
  if (extension === 'xlsx' || extension === 'xls') {
    if (extension === 'xls') throw new Error('Старый формат XLS пока не поддерживается — сохраните файл как XLSX')
    const sheets = await importExcelSheets(file)
    if (!sheets.length) throw new Error('В книге Excel нет доступных листов')
    return sheets[0].table
  }
  if (extension === 'parquet') {
    const { compressors } = await import('hyparquet-compressors')
    const rows = await parquetReadObjects({
      file: { byteLength: file.size, slice: (start, end) => file.slice(start, end).arrayBuffer() },
      rowFormat: 'object',
      compressors,
    })
    return makeTable(file.name, rows)
  }
  throw new Error('Поддерживаются CSV, XLSX, XLS и Parquet')
}

export async function importGoogleSheet(url: string): Promise<DataTable> {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Не удалось распознать ссылку Google Sheets')
  const source = new URL(url)
  const gid = source.searchParams.get('gid') ?? new URLSearchParams(source.hash.replace(/^#/, '')).get('gid')
  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${match[1]}/export`)
  exportUrl.searchParams.set('format', 'csv')
  if (gid) exportUrl.searchParams.set('gid', gid)
  const response = await fetch(exportUrl.toString())
  if (!response.ok) throw new Error('Таблица должна быть доступна по ссылке')
  const parsed = Papa.parse<Record<string, unknown>>(await response.text(), { header: true, dynamicTyping: true, skipEmptyLines: true })
  if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message)
  return makeTable('Google Sheets', parsed.data, parsed.errors.map((error) => `Строка ${(error.row ?? 0) + 1}: ${error.message}`).slice(0, 20))
}

export async function importGoogleSheets(url: string): Promise<Array<{ name: string; table: DataTable }>> {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Не удалось распознать ссылку Google Sheets')
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`)
  if (!response.ok) throw new Error('Таблица должна быть доступна по ссылке')
  const file = new File([await response.blob()], 'Google Sheets.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  return importExcelSheets(file)
}
