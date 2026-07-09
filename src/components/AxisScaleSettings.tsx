import { useEffect, useState } from 'react'
import type { ChartConfig, DateLabelFormat, TimeFrequency } from '../core/types'
import { ColorControl, DateControl } from './PickerControls'

interface Props { config: ChartConfig; xKind: 'date' | 'number' | 'other'; frequency?: TimeFrequency; onChange(config: ChartConfig): void }
const years: Array<[DateLabelFormat, string]> = [['year-full', 'Только годы: 2015, 2016'], ['year-first-full', "Только годы: 2015, '16"], ['year-short', "Только годы: '15, '16"]]
const halves: Array<[DateLabelFormat, string]> = [['half-only', 'H1, H2'], ['half-year-en', 'H1 2015'], ['year-half-en', '2015 H1']]
const quarters: Array<[DateLabelFormat, string]> = [['quarter-context-en', 'Q1–Q4, год под Q1'], ['quarter-context-ru', 'К1–К4, год под К1'], ['quarter-only', 'Q1, Q2'], ['quarter-year-en', 'Q1 2015'], ['year-quarter-en', '2015 Q1'], ['quarter-year', 'К1 2015'], ['year-quarter', '2015 · К1']]
const months: Array<[DateLabelFormat, string]> = [['month-context-ru', 'Месяцы, год под январём'], ['month-context-en', 'Months, year under Jan'], ['month-full-ru', 'январь, февраль'], ['month-only-ru', 'янв., февр.'], ['month-number', '01, 02'], ['month-year', 'январь 2015'], ['month-short-year', "янв. '15"], ['month-number-year', '01.2015'], ['year-month', '2015-01'], ['month-only-en', 'Jan, Feb'], ['month-en-year', 'Jan 2015'], ['year-month-en', '2015 Jan']]
const weeks: Array<[DateLabelFormat, string]> = [['week-context-en', 'W01–W53, год под W01'], ['week-context-ru', 'Недели, год под первой'], ['week-only', 'W01, W02'], ['week-year-en', 'W01 2015'], ['year-week-en', '2015-W01'], ['week-year', 'Нед. 1 · 2015']]
const days: Array<[DateLabelFormat, string]> = [['day-context-month-ru', 'Дни, месяц под первым числом'], ['day-context-month-en', 'Days, month under day 1'], ['day-month-year', '01.01.2015'], ['date-dmy-slash', '01/04/2015'], ['date-mdy-slash', '04/01/2015'], ['iso', '2015-04-01'], ['date-dmy-en', '01 Apr 2015'], ['date-mdy-en', 'Apr 01, 2015'], ['day-month', '01.04']]
const formats: Record<TimeFrequency, Array<[DateLabelFormat, string]>> = {
  annual: years,
  semiannual: [...halves, ...years],
  quarterly: [...quarters, ...halves, ...years],
  monthly: [...months, ...quarters, ...halves, ...years],
  weekly: [...days, ...weeks, ...months, ...quarters, ...halves, ...years],
  daily: [...days, ...weeks, ...months, ...quarters, ...halves, ...years],
  irregular: [...days, ...weeks, ...months, ...quarters, ...halves, ...years],
}
const formatGroups = [
  ['day', 'Дни и полные даты'], ['week', 'Недели'], ['month', 'Месяцы'], ['quarter', 'Кварталы'], ['half', 'Полугодия'], ['year', 'Годы'],
] as const
type FormatGroup = typeof formatGroups[number][0]
const formatGroup = (format: DateLabelFormat): FormatGroup => format.includes('week') ? 'week' : format.includes('month') ? 'month' : format.includes('quarter') ? 'quarter' : format.includes('half') ? 'half' : format.includes('year') && !format.startsWith('day-') && !format.startsWith('date-') ? 'year' : 'day'
const shortcuts: Record<TimeFrequency, Array<[DateLabelFormat, string]>> = {
  daily: [['day-context-month-ru', 'Дни'], ['week-context-ru', 'Недели'], ['month-context-ru', 'Месяцы'], ['year-first-full', 'Годы']],
  weekly: [['week-context-ru', 'Недели'], ['month-context-ru', 'Месяцы'], ['quarter-context-ru', 'Кварталы'], ['year-first-full', 'Годы']],
  monthly: [['month-context-ru', 'Месяцы'], ['quarter-context-ru', 'Кварталы'], ['year-first-full', 'Годы']],
  quarterly: [['quarter-context-ru', 'Кварталы'], ['year-first-full', 'Годы']],
  semiannual: [['half-year-en', 'Полугодия'], ['year-first-full', 'Годы']],
  annual: [['year-full', 'Годы']],
  irregular: [['day-context-month-ru', 'Дни'], ['month-context-ru', 'Месяцы'], ['year-first-full', 'Годы']],
}
const shortcutPreview: Partial<Record<DateLabelFormat, string>> = {
  'day-context-month-ru': '1\nапр.', 'week-context-ru': 'Нед. 1\n2025', 'month-context-ru': 'янв.\n2025',
  'quarter-context-ru': 'К1\n2025', 'half-year-en': 'H1 2025', 'year-first-full': "2025 · ’26", 'year-full': '2025',
}
function OptionalNumber({ value, min, disabled, onChange }: { value?: number | null; min?: number; disabled?: boolean; onChange(value: number | null): void }) {
  const [draft, setDraft] = useState(value == null || !Number.isFinite(value) ? '' : String(value))
  useEffect(() => { setDraft(value == null || !Number.isFinite(value) ? '' : String(value)) }, [value])
  return <input type="number" min={min} disabled={disabled} value={draft} placeholder="Авто" onChange={(event) => {
    const next = event.target.value
    setDraft(next)
    if (next === '') { onChange(null); return }
    const parsed = Number(next)
    if (Number.isFinite(parsed) && (min == null || parsed >= min)) onChange(parsed)
  }} onBlur={() => {
    const parsed = Number(draft)
    if (draft !== '' && Number.isFinite(parsed) && (min == null || parsed >= min)) setDraft(String(parsed))
    else setDraft(value == null || !Number.isFinite(value) ? '' : String(value))
  }}/>
}
export function AxisScaleSettings({ config, xKind, frequency = 'irregular', onChange }: Props) {
  const set = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const selectedFormat = config.dateLabelFormat ?? 'auto'
  const availableFormats = formats[frequency].filter(([value]) => value !== 'auto')
  return <details className="settings-group axis-scale-settings"><summary>Шкалы и подписи осей</summary><div>
    {xKind !== 'other' && <><strong>Ось X</strong>{xKind === 'date' ? <div className="date-range-control"><div className="date-range-title"><span>Диапазон данных</span>{(config.xAxisMin || config.xAxisMax) && <button type="button" onClick={() => set({ xAxisMin: '', xAxisMax: '' })}>Сбросить</button>}</div><div className="date-range-grid"><label><span>От</span><DateControl label="Дата начала диапазона" value={config.xAxisMin ?? ''} max={config.xAxisMax || undefined} onChange={(xAxisMin) => set({ xAxisMin })}/></label><i aria-hidden="true">→</i><label><span>До</span><DateControl label="Дата конца диапазона" value={config.xAxisMax ?? ''} min={config.xAxisMin || undefined} onChange={(xAxisMax) => set({ xAxisMax })}/></label></div><small>Пустые поля используют весь доступный период.</small></div> : <div className="fred-grid"><label>Минимум<input type="number" value={config.xAxisMin ?? ''} placeholder="Авто" onChange={(event) => set({ xAxisMin: event.target.value })}/></label><label>Максимум<input type="number" value={config.xAxisMax ?? ''} placeholder="Авто" onChange={(event) => set({ xAxisMax: event.target.value })}/></label></div>}{xKind === 'date' ? <><label>Единица интервала<select value={config.dateAxisStepUnit ?? 'auto'} onChange={(event) => set({ dateAxisStepUnit: event.target.value as ChartConfig['dateAxisStepUnit'], xAxisStep: event.target.value === 'auto' ? null : config.xAxisStep ?? 1 })}><option value="auto">Автоматически по формату</option><option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="quarter">Квартал</option><option value="half">Полугодие</option><option value="year">Год</option></select></label><label>Показывать каждый N-й период<OptionalNumber min={1} value={config.xAxisStep} onChange={(value) => set({ xAxisStep: value == null ? null : Math.max(1, Math.round(value)) })}/><small>Например: «Год» и 2 — показывать каждый второй год.</small></label></> : <label>Шаг шкалы<OptionalNumber min={1} value={config.xAxisStep} onChange={(value) => set({ xAxisStep: value == null ? null : Math.max(1, value) })}/><small>Пустое поле — автоматический шаг.</small></label>}</>}
    {xKind === 'date' && <div className="date-axis-format">
      <div className="date-format-heading"><strong>Подписи дат</strong><small>Частота данных: {frequency === 'daily' ? 'дни' : frequency === 'weekly' ? 'недели' : frequency === 'monthly' ? 'месяцы' : frequency === 'quarterly' ? 'кварталы' : frequency === 'semiannual' ? 'полугодия' : frequency === 'annual' ? 'годы' : 'нерегулярная'}</small></div>
      <div className="date-format-shortcuts"><button type="button" className={selectedFormat === 'auto' ? 'active' : ''} aria-pressed={selectedFormat === 'auto'} onClick={() => set({ dateLabelFormat: 'auto' })}><span className="date-format-icon">A</span><span><strong>Авто</strong><small>По данным</small></span></button>{shortcuts[frequency].map(([value, label]) => <button type="button" className={selectedFormat === value ? 'active' : ''} aria-pressed={selectedFormat === value} onClick={() => set({ dateLabelFormat: value })} key={value}><span className="date-format-icon">{shortcutPreview[value]?.split('\n')[0] ?? 'Aa'}</span><span><strong>{label}</strong><small>{shortcutPreview[value]?.replace('\n', ' / ') ?? 'Формат периода'}</small></span></button>)}</div>
      <label>Точный формат<select value={selectedFormat} onChange={(event) => set({ dateLabelFormat: event.target.value as DateLabelFormat })}><option value="auto">Автоматически для этих данных</option>{formatGroups.map(([group, label]) => { const options = availableFormats.filter(([value]) => formatGroup(value) === group); return options.length ? <optgroup label={label} key={group}>{options.map(([value, optionLabel]) => <option value={value} key={value}>{optionLabel}</option>)}</optgroup> : null })}</select></label>
      <div className="date-anchor-control"><div><span>Начать подписи с</span><small>Точка отсчёта выбранного шага</small></div><div className="date-anchor-input"><DateControl label="Начать подписи с" value={config.dateAxisAnchor ?? ''} min={config.xAxisMin || undefined} max={config.xAxisMax || undefined} onChange={(dateAxisAnchor) => set({ dateAxisAnchor: dateAxisAnchor || undefined })}/></div><p>Если дата не задана, отсчёт начинается с первого значения ряда.</p></div>
    </div>}
    <div className="settings-divider"/><strong>Размещение подписей X</strong><div className="fred-grid"><label>Поворот, °<select value={config.xAxisLabelRotate ?? 0} onChange={(event) => set({ xAxisLabelRotate: Number(event.target.value) })}>{[0, 30, 45, 60, 90].map((value) => <option value={value} key={value}>{value}°</option>)}</select></label><label>Длинный текст<select value={config.xAxisLabelOverflow ?? 'auto'} onChange={(event) => set({ xAxisLabelOverflow: event.target.value as ChartConfig['xAxisLabelOverflow'] })}><option value="auto">Автоматически</option><option value="wrap">Переносить</option><option value="truncate">Сокращать</option></select></label></div>
    <div className="settings-divider"/><strong>Ось Y</strong><div className="fred-grid"><label>Минимум<OptionalNumber disabled={config.yAxisScaleType === 'log'} value={config.yAxisMin} onChange={(value) => set({ yAxisMin: value })}/></label><label>Максимум<OptionalNumber disabled={config.yAxisScaleType === 'log'} value={config.yAxisMax} onChange={(value) => set({ yAxisMax: value })}/></label></div><label>Шаг шкалы<OptionalNumber disabled={config.yAxisScaleType === 'log'} min={0} value={config.yAxisStep} onChange={(value) => set({ yAxisStep: value != null && value > 0 ? value : null })}/><small>{config.yAxisScaleType === 'log' ? 'Диапазон и деления рассчитываются автоматически по положительным значениям.' : 'Пустые поля — красивый диапазон и шаг по данным.'}</small></label>
    <label>Тип шкалы<select value={config.yAxisScaleType ?? 'linear'} onChange={(event) => set({ yAxisScaleType: event.target.value as ChartConfig['yAxisScaleType'], ...(event.target.value === 'log' ? { yAxisMin: null, yAxisStep: null, showZeroLine: false } : {}) })}><option value="linear">Линейная</option><option value="log">Логарифмическая</option></select></label>
    <label className="check"><input type="checkbox" disabled={config.yAxisScaleType === 'log'} checked={config.showZeroLine ?? false} onChange={(event) => set({ showZeroLine: event.target.checked })}/>Выделить нулевую линию</label>
    {(config.showZeroLine ?? false) && <><div className="fred-grid"><label>Цвет нулевой линии<ColorControl value={config.zeroLineColor ?? '#8a8791'} onChange={(zeroLineColor) => set({ zeroLineColor })}/></label><label>Толщина<OptionalNumber min={0.5} value={config.zeroLineWidth ?? 1} onChange={(value) => set({ zeroLineWidth: value ?? 1 })}/></label></div><label>Тип нулевой линии<select value={config.zeroLineType ?? 'solid'} onChange={(event) => set({ zeroLineType: event.target.value as ChartConfig['zeroLineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label></>}
    <button type="button" className="reset-element" onClick={() => set({ xAxisMin: '', xAxisMax: '', xAxisStep: null, dateAxisStepUnit: 'auto', dateAxisAnchor: undefined, yAxisMin: null, yAxisMax: null, yAxisStep: null })}>Автоматический диапазон</button>
  </div></details>
}
