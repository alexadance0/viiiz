import type { DataTable, DataValue, DateParseRule } from './types'
import { MONTHS } from './normalization'
import { inferTimeProfile } from './timeFrequency'

type Token = 'YYYY' | 'MMMM' | 'MMM' | 'YY' | 'MM' | 'DD' | 'M' | 'D' | 'Q'
const TOKENS = /YYYY|MMMM|MMM|YY|MM|DD|M|D|Q/g
const TOKEN_PATTERN: Record<Token, string> = {
  YYYY: '(\\d{4})', YY: '(\\d{2})', MM: '(0[1-9]|1[0-2])', M: '([1-9]|1[0-2])',
  DD: '(0[1-9]|[12]\\d|3[01])', D: '([1-9]|[12]\\d|3[01])',
  MMM: '([A-Za-zА-Яа-яЁё.]+)', MMMM: '([A-Za-zА-Яа-яЁё.]+)', Q: 'Q?([1-4])',
}
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface DateRuleResult { value: Date | null; matched: boolean; reason?: string }

export function parseDateByRule(input: DataValue, rule: DateParseRule): DateRuleResult {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return { value: new Date(input), matched: true }
  const text = String(input ?? '').trim()
  if (!text) return { value: null, matched: false, reason: 'Пустое значение' }
  const tokens: Token[] = []
  let pattern = '', cursor = 0
  for (const match of rule.format.matchAll(TOKENS)) {
    pattern += escapeRegex(rule.format.slice(cursor, match.index))
    const token = match[0] as Token
    tokens.push(token); pattern += TOKEN_PATTERN[token]; cursor = (match.index ?? 0) + token.length
  }
  pattern += escapeRegex(rule.format.slice(cursor))
  if (!tokens.some((token) => token === 'YY' || token === 'YYYY')) return { value: null, matched: false, reason: 'В маске отсутствует год' }
  const match = text.match(new RegExp(`^${pattern}$`, 'iu'))
  if (!match) return { value: null, matched: false, reason: 'Не соответствует маске' }

  let year = 0, month = 1, day = 1
  tokens.forEach((token, index) => {
    const part = match[index + 1]
    if (token === 'YYYY') year = Number(part)
    if (token === 'YY') { const short = Number(part); year = short < rule.twoDigitYearPivot ? 2000 + short : 1900 + short }
    if (token === 'M' || token === 'MM') month = Number(part)
    if (token === 'MMM' || token === 'MMMM') month = MONTHS[part.toLowerCase().replace(/\.$/, '')] ?? 0
    if (token === 'D' || token === 'DD') day = Number(part)
    if (token === 'Q') month = (Number(part) - 1) * 3 + 1
  })
  const value = new Date(year, month - 1, day)
  if (!year || !month || value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return { value: null, matched: false, reason: 'Такой даты не существует' }
  return { value, matched: true }
}

export function applyDateRule(table: DataTable, column: string, rule: DateParseRule): DataTable {
  const rawRows = table.rawRows ?? table.rows.map((row) => ({ ...row }))
  let converted = 0, invalid = 0
  const rows = table.rows.map((row, index) => {
    const source = rawRows[index]?.[column]
    if (source == null || source === '') return { ...row, [column]: null }
    const result = parseDateByRule(source, rule)
    if (result.matched) { converted++; return { ...row, [column]: result.value } }
    invalid++
    // An automatic missing-value marker remains missing, but a valid raw value
    // can still be recovered by a more precise manual mask above.
    if (row[column] == null && !table.dateRules?.[column]) return { ...row, [column]: null }
    return { ...row, [column]: rule.invalid === 'null' ? null : source }
  })
  const profile = inferTimeProfile(rawRows.map((row) => row[column]), rows.map((row) => row[column]))
  const timeProfiles = { ...(table.timeProfiles ?? {}) }
  if (profile) timeProfiles[column] = profile
  else delete timeProfiles[column]
  const observationFlags = table.observationFlags ? { ...table.observationFlags } : undefined
  if (observationFlags?.[column]) {
    const values = { ...observationFlags[column] }
    rows.forEach((row, index) => { if (row[column] instanceof Date) delete values[index] })
    if (Object.keys(values).length) observationFlags[column] = values
    else delete observationFlags[column]
  }
  return {
    ...table, rows, rawRows,
    normalizations: { ...table.normalizations, [column]: { kind: 'date', format: rule.format, confidence: Math.round(converted / Math.max(converted + invalid, 1) * 100), converted, ambiguous: invalid } },
    timeProfiles,
    observationFlags,
    dateRules: { ...table.dateRules, [column]: rule },
  }
}
