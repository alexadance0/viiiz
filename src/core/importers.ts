import Papa from 'papaparse'
import readWorkbook, { type SheetData } from 'read-excel-file/browser'
import { parquetReadObjects } from 'hyparquet'
import type { DataTable, DataValue } from './types'

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
  const gid = new URL(url).searchParams.get('gid') ?? '0'
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`)
  if (!response.ok) throw new Error('Таблица должна быть доступна по ссылке')
  const parsed = Papa.parse<Record<string, unknown>>(await response.text(), { header: true, dynamicTyping: true, skipEmptyLines: true })
  if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message)
  return makeTable('Google Sheets', parsed.data, parsed.errors.map((error) => `Строка ${(error.row ?? 0) + 1}: ${error.message}`).slice(0, 20))
}

const demoRows = Array.from({ length: 36 }, (_, index) => {
  const seasonal = Math.sin(index / 2.2) * 14
  const revenue = Math.round(72 + index * 4.2 + seasonal)
  return {
    day: new Date(2025, 0, index + 1),
    week: new Date(2024, 0, 1 + index * 7),
    month: new Date(2022, index, 1),
    quarter: new Date(2017, index * 3, 1),
    half_year: new Date(2008, index * 6, 1),
    year: new Date(1990 + index, 0, 1),
    revenue,
    orders: Math.round(revenue * .43 + Math.cos(index / 3) * 4),
    profit: Math.round(revenue * (.16 + (index % 5) * .012)),
    plan: Math.round(76 + index * 4),
  }
})

export const demoTable: DataTable = {
  ...makeTable('Демо-данные · разные частоты', demoRows),
  timeProfiles: {
    day: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' },
    week: { frequency: 'weekly', label: 'Недельные', confidence: 100, source: 'intervals' },
    month: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' },
    quarter: { frequency: 'quarterly', label: 'Квартальные', confidence: 100, source: 'intervals' },
    half_year: { frequency: 'semiannual', label: 'Полугодовые', confidence: 100, source: 'intervals' },
    year: { frequency: 'annual', label: 'Годовые', confidence: 100, source: 'intervals' },
  },
}

export const categoricalDemoTable: DataTable = makeTable('Демо-данные · топ стран', [
  ['США', 29.2, 1], ['Китай', 18.7, 2], ['Германия', 4.7, 3], ['Япония', 4.1, 4], ['Индия', 3.9, 5],
  ['Великобритания', 3.6, 6], ['Франция', 3.2, 7], ['Италия', 2.4, 8], ['Канада', 2.2, 9], ['Бразилия', 2.2, 10],
].map(([country, gdp, place]) => ({ country, gdp_trillion_usd: gdp, place })))
