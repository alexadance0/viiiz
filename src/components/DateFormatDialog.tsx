import { useMemo, useState } from 'react'
import { applyDateRule, parseDateByRule } from '../core/dateRule'
import type { DataTable, DateParseRule } from '../core/types'
import { NumberInput } from './NumberInput'

const PRESETS = ['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'YYYY-MM', 'YYYY-Q', 'Q YYYY', 'DD MMMM YYYY']

interface Props { table: DataTable; column: string; onApply(table: DataTable): void; onClose(): void }

export function DateFormatDialog({ table, column, onApply, onClose }: Props) {
  const existing = table.dateRules?.[column]
  const [format, setFormat] = useState(existing?.format ?? table.normalizations?.[column]?.format ?? 'DD.MM.YYYY')
  const [pivot, setPivot] = useState(existing?.twoDigitYearPivot ?? 50)
  const [invalid, setInvalid] = useState<DateParseRule['invalid']>(existing?.invalid ?? 'keep')
  const rule = useMemo<DateParseRule>(() => ({ format: format.trim(), twoDigitYearPivot: pivot, invalid }), [format, pivot, invalid])
  const samples = (table.rawRows ?? table.rows).map((row) => row[column]).filter((value) => value != null && value !== '').slice(0, 8)
  const results = samples.map((source) => ({ source, result: parseDateByRule(source, rule) }))
  const allValues = (table.rawRows ?? table.rows).map((row) => row[column]).filter((value) => value != null && value !== '')
  const matched = allValues.filter((value) => parseDateByRule(value, rule).matched).length

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="date-dialog" role="dialog" aria-modal="true" aria-labelledby="date-dialog-title">
      <header><div><span className="eyebrow">Ручное правило</span><h2 id="date-dialog-title">Формат столбца «{column}»</h2><p>Опишите порядок частей даты. Разделители можно использовать любые.</p></div><button onClick={onClose} aria-label="Закрыть">×</button></header>
      <div className="dialog-body">
        <label className="mask-field">Маска даты<input value={format} onChange={(event) => setFormat(event.target.value.toUpperCase())} placeholder="DD.MM.YYYY"/><small>Токены: <b>D/DD</b> день, <b>M/MM</b> месяц, <b>MMM/MMMM</b> название месяца, <b>YY/YYYY</b> год, <b>Q</b> квартал</small></label>
        <div className="preset-list">{PRESETS.map((preset) => <button className={format === preset ? 'active' : ''} onClick={() => setFormat(preset)} key={preset}>{preset}</button>)}</div>
        <div className="rule-options"><label>Граница двузначного года<div><NumberInput min="1" max="99" value={pivot} onValueChange={(value) => setPivot(Math.min(99, Math.max(1, value)))}/><span><b>00–{String(pivot - 1).padStart(2, '0')}</b> → 2000-е<br/><b>{String(pivot).padStart(2, '0')}–99</b> → 1900-е</span></div></label><label>Если значение не распознано<select value={invalid} onChange={(event) => setInvalid(event.target.value as DateParseRule['invalid'])}><option value="keep">Оставить исходным</option><option value="null">Заменить пропуском</option></select></label></div>
        <div className="rule-score"><div><strong>{matched}</strong><span>распознано</span></div><div><strong>{allValues.length - matched}</strong><span>не распознано</span></div><div><strong>{Math.round(matched / Math.max(allValues.length, 1) * 100)}%</strong><span>уверенность</span></div></div>
        <div className="date-preview"><div className="preview-heading"><strong>Предпросмотр</strong><span>Исходное значение → результат</span></div>{results.map(({ source, result }, index) => <div className={result.matched ? 'preview-row success' : 'preview-row failed'} key={index}><code>{String(source)}</code><span>→</span><b>{result.value ? result.value.toLocaleDateString('ru-RU') : result.reason}</b></div>)}</div>
      </div>
      <footer><button className="button" onClick={onClose}>Отмена</button><button className="button primary" disabled={!format || matched === 0} onClick={() => onApply(applyDateRule(table, column, rule))}>Применить к столбцу</button></footer>
    </section>
  </div>
}
