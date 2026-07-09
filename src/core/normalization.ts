import type { DataTable, DataValue, NormalizationSummary } from './types'
import { dateFromIsoWeek, inferTimeProfile } from './timeFrequency'

const MISSING = new Set([
  '', 'na', 'n/a', 'n.a.', 'n.a', 'n.d.', 'n.d', 'nd', '#n/a', '#na',
  'null', 'none', 'nan', 'nil', 'missing', 'not available', 'not applicable',
  'нет', 'нет данных', 'н/д', 'пропуск',
])
const CONTEXT_MISSING: Record<string, string> = {
  '.': 'данные отсутствуют', '..': 'данные отсутствуют за период', '...': 'данные не применимы', '…': 'данные отсутствуют',
  ':': 'данные отсутствуют', '-': 'значение отсутствует', '–': 'значение отсутствует', '—': 'значение отсутствует',
  x: 'не применимо или скрыто', 'х': 'сопоставление невозможно', '(x)': 'не применимо', '(х)': 'не применимо',
  '(na)': 'данные недоступны', '(n/a)': 'данные недоступны', np: 'источник не участвовал',
  f: 'слишком ненадёжно для публикации', d: 'скрыто для защиты данных', s: 'не соответствует стандарту публикации',
  z: 'меньше половины единицы измерения', c: 'конфиденциально',
}
const FLAG_CODES = new Set(['p', 'r', 'e', 'b', 'i', 'u', 'c', 's', 'x', 'f', 'd', 'z'])
const TRUE_VALUES = new Set(['true', 'yes', 'y', 'да', 'д', 'истина', '1'])
const FALSE_VALUES = new Set(['false', 'no', 'n', 'нет', 'н', 'ложь', '0'])
const DATE_NAME_HINT = /(^|[\s_-])(date|time|year|month|day|дата|время|год|месяц|день)([\s_-]|$)/i
const YEAR_ONLY_HINT = /(^|[\s_-])(year|год)([\s_-]|$)/i

export const MONTHS: Record<string, number> = {
  january: 1, jan: 1, январь: 1, января: 1, янв: 1,
  february: 2, feb: 2, февраль: 2, февраля: 2, фев: 2,
  march: 3, mar: 3, март: 3, марта: 3, мар: 3,
  april: 4, apr: 4, апрель: 4, апреля: 4, апр: 4,
  may: 5, май: 5, мая: 5,
  june: 6, jun: 6, июнь: 6, июня: 6, июн: 6,
  july: 7, jul: 7, июль: 7, июля: 7, июл: 7,
  august: 8, aug: 8, август: 8, августа: 8, авг: 8,
  september: 9, sep: 9, sept: 9, сентябрь: 9, сентября: 9, сен: 9, сент: 9,
  october: 10, oct: 10, октябрь: 10, октября: 10, окт: 10,
  november: 11, nov: 11, ноябрь: 11, ноября: 11, ноя: 11,
  december: 12, dec: 12, декабрь: 12, декабря: 12, дек: 12,
}

type DateOrder = 'dmy' | 'mdy' | 'ymd'
interface ParsedDate { value: Date; format: string; ambiguous: boolean }

const cleanText = (value: unknown) => String(value).trim().replace(/[\u00A0\u202F]/g, ' ')
const expandYear = (year: number, digits: number, pivot = 50) => digits === 2 ? (year < pivot ? 2000 + year : 1900 + year) : year
const validDate = (year: number, month: number, day: number) => {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function dateOrder(values: string[], locale: string): { order: DateOrder; confidence: number } {
  let ymd = 0, dmy = 0, mdy = 0
  for (const value of values) {
    const match = value.match(/^(\d{1,4})[./_-](\d{1,2})[./_-](\d{1,4})/)
    if (!match) continue
    const [, a, b] = match
    if (a.length === 4) ymd += 4
    else if (Number(a) > 12) dmy += 3
    else if (Number(b) > 12) mdy += 3
    else if (value.includes('.')) dmy += 1
  }
  if (ymd > Math.max(dmy, mdy)) return { order: 'ymd', confidence: .99 }
  if (dmy > mdy) return { order: 'dmy', confidence: dmy >= 3 ? .96 : .82 }
  if (mdy > dmy) return { order: 'mdy', confidence: .96 }
  return { order: locale.toLowerCase() === 'en-us' ? 'mdy' : 'dmy', confidence: .68 }
}

export function parseDateValue(input: DataValue, order: DateOrder = 'dmy', pivot = 50, allowYearOnly = false): ParsedDate | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return { value: new Date(input), format: 'Дата Excel/ISO', ambiguous: false }
  if (allowYearOnly && typeof input === 'number' && Number.isInteger(input)) {
    const year = input <= 99 && input >= 0 ? expandYear(input, 2, pivot) : input
    const date = validDate(year, 1, 1)
    return date ? { value: date, format: input <= 99 ? 'YY' : 'YYYY', ambiguous: false } : null
  }
  if (typeof input !== 'string') return null
  const text = cleanText(input).replace(/\s+/g, ' ')
  if (!text) return null

  if (allowYearOnly && /^(\d{2}|\d{4})$/.test(text)) {
    const year = expandYear(Number(text), text.length, pivot)
    const date = validDate(year, 1, 1)
    return date ? { value: date, format: text.length === 2 ? 'YY' : 'YYYY', ambiguous: false } : null
  }
  if (allowYearOnly && /^YR\d{4}$/i.test(text)) {
    const year = Number(text.slice(2))
    return { value: new Date(year, 0, 1), format: 'YRYYYY', ambiguous: false }
  }

  // SDMX/Eurostat and common economic time-series period notations.
  const quarter = text.match(/^(?:(\d{4})[- ]?Q([1-4])|Q([1-4])[ -]?(\d{4}))$/i)
  if (quarter) {
    const year = Number(quarter[1] ?? quarter[4]), value = Number(quarter[2] ?? quarter[3])
    return { value: new Date(year, (value - 1) * 3, 1), format: 'YYYY-QN', ambiguous: false }
  }
  const semester = text.match(/^(\d{4})[- ]?(?:S|H)([12])$/i)
  if (semester) return { value: new Date(Number(semester[1]), (Number(semester[2]) - 1) * 6, 1), format: 'YYYY-SN', ambiguous: false }
  const sdmxMonth = text.match(/^(\d{4})[- ]?M(0?[1-9]|1[0-2])$/i)
  if (sdmxMonth) return { value: new Date(Number(sdmxMonth[1]), Number(sdmxMonth[2]) - 1, 1), format: 'YYYY-MNN', ambiguous: false }
  const isoMonth = text.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  if (isoMonth) return { value: new Date(Number(isoMonth[1]), Number(isoMonth[2]) - 1, 1), format: 'YYYY-MM', ambiguous: false }
  const week = text.match(/^(\d{4})-?W(\d{2})$/i)
  if (week && Number(week[2]) >= 1 && Number(week[2]) <= 53) {
    const year = Number(week[1]), weekNumber = Number(week[2])
    const monday = dateFromIsoWeek(year, weekNumber)
    return monday ? { value: monday, format: 'YYYY-WNN', ambiguous: false } : null
  }
  const fiscal = text.match(/^(?:FY\s*)?(\d{4})[/-](\d{2}|\d{4})$/i)
  if (fiscal) {
    const endYear = expandYear(Number(fiscal[2]), fiscal[2].length, pivot)
    if (endYear === Number(fiscal[1]) + 1) return { value: new Date(Number(fiscal[1]), 0, 1), format: 'YYYY/YY', ambiguous: false }
  }

  // Full ISO timestamps are unambiguous and may include a timezone.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const value = new Date(text)
    return Number.isNaN(value.getTime()) ? null : { value, format: 'ISO 8601', ambiguous: false }
  }

  const named = text.toLowerCase().replace(/[,г.]$/g, '').match(/^(\d{1,2})[\s-]+([a-zа-яё]+)[\s,-]+(\d{2}|\d{4})(?:\s+.*)?$/i)
    ?? text.toLowerCase().replace(/,$/, '').match(/^([a-zа-яё]+)[\s-]+(\d{1,2}),?[\s-]+(\d{2}|\d{4})(?:\s+.*)?$/i)
  if (named) {
    const firstIsMonth = MONTHS[named[1]] != null
    const month = MONTHS[firstIsMonth ? named[1] : named[2]]
    const day = Number(firstIsMonth ? named[2] : named[1])
    const yearText = named[3]
    const date = validDate(expandYear(Number(yearText), yearText.length, pivot), month, day)
    return date ? { value: date, format: firstIsMonth ? 'MMMM D, YYYY' : 'D MMMM YYYY', ambiguous: false } : null
  }

  const numeric = text.match(/^(\d{1,4})([./_-])(\d{1,2})\2(\d{1,4})(?:[ T].*)?$/)
  if (numeric) {
    const [, a, delimiter, b, c] = numeric
    let day: number, month: number, yearText: string
    if (a.length === 4 || order === 'ymd') { yearText = a; month = Number(b); day = Number(c) }
    else if (order === 'mdy') { month = Number(a); day = Number(b); yearText = c }
    else { day = Number(a); month = Number(b); yearText = c }
    const date = validDate(expandYear(Number(yearText), yearText.length, pivot), month, day)
    const ambiguous = a.length !== 4 && Number(a) <= 12 && Number(b) <= 12
    const yearToken = yearText.length === 2 ? 'YY' : 'YYYY'
    const format = a.length === 4 || order === 'ymd' ? `YYYY${delimiter}MM${delimiter}DD` : order === 'mdy' ? `MM${delimiter}DD${delimiter}${yearToken}` : `DD${delimiter}MM${delimiter}${yearToken}`
    return date ? { value: date, format, ambiguous } : null
  }

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) {
    const date = validDate(Number(compact[1]), Number(compact[2]), Number(compact[3]))
    return date ? { value: date, format: 'YYYYMMDD', ambiguous: false } : null
  }
  const monthYear = text.match(/^(\d{1,2})[./_-](\d{4})$/)
  if (monthYear) {
    const date = validDate(Number(monthYear[2]), Number(monthYear[1]), 1)
    return date ? { value: date, format: 'MM.YYYY', ambiguous: false } : null
  }
  return null
}

export function parseLocalizedNumber(input: DataValue, decimalHint?: ',' | '.'): { value: number; format: string; ambiguous: boolean; flags: string[] } | null {
  if (typeof input === 'number' && Number.isFinite(input)) return { value: input, format: 'Число', ambiguous: false, flags: [] }
  if (typeof input !== 'string') return null
  let text = cleanText(input)
  if (!text || !/[0-9]/.test(text)) return null
  const flags: string[] = []
  const spacedSuffix = text.match(/^(.*?)\s+([a-z](?:[ ,]+[a-z])*)$/i)
  if (spacedSuffix) {
    const candidates = spacedSuffix[2].toLowerCase().split(/[ ,]+/)
    if (candidates.every((code) => FLAG_CODES.has(code))) { text = spacedSuffix[1]; flags.push(...candidates) }
  }
  const compactSuffix = text.match(/^(.*\d)([prE])$/)
  if (compactSuffix) { text = compactSuffix[1]; flags.push(compactSuffix[2].toLowerCase()) }
  text = text.replace(/(?:\[(\d+)]|[*†‡]+)$/g, '')
  const percent = /%\s*$/.test(text)
  const accounting = /^\(.*\)$/.test(text)
  text = text.replace(/[−–—]/g, '-').replace(/[()]/g, '').replace(/[%‰]/g, '')
  text = text.replace(/[₽$€£¥₸₹]|(?:rub|usd|eur|gbp|руб(?:лей|ля)?|р\.)/gi, '').trim()
  text = text.replace(/[ '\u00A0\u202F]/g, '')
  if (!/^-?[\d.,]+$/.test(text)) return null

  const comma = text.lastIndexOf(','), dot = text.lastIndexOf('.')
  let decimal: ',' | '.' | undefined = decimalHint
  let ambiguous = false
  if (comma >= 0 && dot >= 0) decimal = comma > dot ? ',' : '.'
  else if (!decimal) {
    const separator = comma >= 0 ? ',' : dot >= 0 ? '.' : undefined
    if (separator) {
      const parts = text.split(separator)
      const finalLength = parts.at(-1)?.length ?? 0
      if (parts.length > 2) decimal = finalLength <= 2 ? separator : undefined
      else if (finalLength <= 2) decimal = separator
      else if (finalLength === 3) ambiguous = true
    }
  }
  const thousands = decimal === ',' ? '.' : ','
  let normalized = text.split(thousands).join('')
  if (decimal) normalized = normalized.replace(decimal, '.')
  else normalized = normalized.replace(/[.,]/g, '')
  let value = Number(normalized)
  if (!Number.isFinite(value)) return null
  if (accounting) value = -Math.abs(value)
  if (percent) value /= 100
  return { value, format: percent ? 'Процент' : decimal === ',' ? 'Десятичная запятая' : decimal === '.' ? 'Десятичная точка' : 'Целое число', ambiguous, flags }
}

function decimalHint(values: string[]): ',' | '.' | undefined {
  let comma = 0, dot = 0
  for (const text of values) {
    if (/\d,\d{1,2}(?:\D|$)/.test(text)) comma++
    if (/\d\.\d{1,2}(?:\D|$)/.test(text)) dot++
    if (text.includes(',') && text.includes('.')) {
      if (text.lastIndexOf(',') > text.lastIndexOf('.')) comma++
      else dot++
    }
  }
  return comma > dot ? ',' : dot > comma ? '.' : undefined
}

function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>()
  let result = '', maximum = 0
  values.forEach((value) => {
    const count = (counts.get(value) ?? 0) + 1
    counts.set(value, count)
    if (count > maximum) { maximum = count; result = value }
  })
  return result
}

export function normalizeImportedTable(table: DataTable, locale = 'ru-RU', onProgress?: (completed: number, total: number) => void): DataTable {
  const rawRows = table.rows.map((row) => ({ ...row }))
  const rows = table.rows.map((row) => ({ ...row }))
  const normalizations: Record<string, NormalizationSummary> = {}
  const observationFlags: Record<string, Record<number, string[]>> = {}

  table.columns.forEach((column, columnIndex) => {
    const indexed = rows.map((row, index) => ({ value: row[column], index }))
    const strings = indexed.filter(({ value }) => typeof value === 'string').map(({ value }) => cleanText(value))

    let missingConverted = 0
    for (const item of indexed) if (typeof item.value === 'string' && MISSING.has(cleanText(item.value).toLowerCase())) { rows[item.index][column] = null; missingConverted++ }
    for (const item of indexed) if (typeof item.value === 'string') {
      const flaggedMissing = cleanText(item.value).match(/^(:|\.{1,3}|…|-|—)\s+([a-z](?:[ ,]+[a-z])*)$/i)
      if (flaggedMissing) {
        const flags = flaggedMissing[2].toLowerCase().split(/[ ,]+/)
        if (flags.every((flag) => FLAG_CODES.has(flag))) {
          rows[item.index][column] = null; missingConverted++
          ;(observationFlags[column] ??= {})[item.index] = flags
        }
      }
    }

    const contextualMissing = indexed.filter((item) => typeof item.value === 'string' && CONTEXT_MISSING[cleanText(item.value).toLowerCase()])
    const contextualIndexes = new Set(contextualMissing.map((item) => item.index))
    const meaningful = indexed.filter((item) => rows[item.index][column] != null && rows[item.index][column] !== '' && !contextualIndexes.has(item.index))
    if (!meaningful.length) { onProgress?.(columnIndex + 1, table.columns.length); return }

    const { order, confidence: orderConfidence } = dateOrder(strings, locale)
    const parsedDates = meaningful.map((item) => ({ item, parsed: parseDateValue(rows[item.index][column], order, 50, YEAR_ONLY_HINT.test(column)) })).filter((item) => item.parsed)
    const dateRatio = parsedDates.length / meaningful.length
    const yearOnly = meaningful.every((item) => /^\d{4}$/.test(String(item.value)))
    if (dateRatio >= .85 && (!yearOnly || DATE_NAME_HINT.test(column))) {
      for (const { item, parsed } of parsedDates) rows[item.index][column] = parsed!.value
      const format = mostFrequent(parsedDates.map((item) => item.parsed!.format))
      const ambiguous = parsedDates.filter((item) => item.parsed!.ambiguous).length
      const confidence = ambiguous ? Math.min(dateRatio, orderConfidence) : dateRatio
      normalizations[column] = { kind: 'date', format, confidence: Math.round(confidence * 100), converted: parsedDates.length, ambiguous }
      for (const item of contextualMissing) { rows[item.index][column] = null; (observationFlags[column] ??= {})[item.index] = [CONTEXT_MISSING[cleanText(item.value).toLowerCase()]] }
      onProgress?.(columnIndex + 1, table.columns.length); return
    }

    const hint = decimalHint(strings)
    const parsedNumbers = meaningful.map((item) => ({ item, parsed: parseLocalizedNumber(rows[item.index][column], hint) })).filter((item) => item.parsed)
    const numberRatio = parsedNumbers.length / meaningful.length
    if (numberRatio >= .85) {
      for (const { item, parsed } of parsedNumbers) {
        rows[item.index][column] = parsed!.value
        if (parsed!.flags.length) (observationFlags[column] ??= {})[item.index] = parsed!.flags
      }
      for (const item of contextualMissing) { rows[item.index][column] = null; (observationFlags[column] ??= {})[item.index] = [CONTEXT_MISSING[cleanText(item.value).toLowerCase()]] }
      const format = mostFrequent(parsedNumbers.map((item) => item.parsed!.format))
      normalizations[column] = { kind: 'number', format, confidence: Math.round(numberRatio * 100), converted: parsedNumbers.length, ambiguous: parsedNumbers.filter((item) => item.parsed!.ambiguous).length }
      onProgress?.(columnIndex + 1, table.columns.length); return
    }

    const bools = meaningful.filter((item) => {
      const value = cleanText(item.value).toLowerCase()
      return TRUE_VALUES.has(value) || FALSE_VALUES.has(value)
    })
    if (bools.length / meaningful.length >= .95) {
      for (const item of bools) rows[item.index][column] = TRUE_VALUES.has(cleanText(item.value).toLowerCase())
      for (const item of contextualMissing) { rows[item.index][column] = null; (observationFlags[column] ??= {})[item.index] = [CONTEXT_MISSING[cleanText(item.value).toLowerCase()]] }
      normalizations[column] = { kind: 'boolean', format: 'Да / Нет', confidence: Math.round(bools.length / meaningful.length * 100), converted: bools.length, ambiguous: 0 }
    } else if (missingConverted) {
      normalizations[column] = { kind: 'missing', format: 'Маркеры пропусков', confidence: 100, converted: missingConverted, ambiguous: 0 }
    }
    onProgress?.(columnIndex + 1, table.columns.length)
  })
  const timeProfiles = Object.fromEntries(table.columns.flatMap((column) => {
    const profile = inferTimeProfile(rawRows.map((row) => row[column]), rows.map((row) => row[column]))
    return profile ? [[column, profile]] : []
  }))
  return { ...table, rows, rawRows, normalizations, observationFlags, timeProfiles }
}
