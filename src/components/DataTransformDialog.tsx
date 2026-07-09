import { useMemo, useState } from 'react'
import { transformEconomicSeries, type EconomicTransformOptions, type FrequencyAggregation, type UnitTransform } from '../core/economicTransform'
import { addDerivedTimeSeries, fillTimeGaps, type DerivedOptions, type GapFillMethod } from '../core/timeSeriesTransform'
import { findTimeGaps } from '../core/dataQuality'
import type { ColumnType, DataTable, TimeFrequency } from '../core/types'
import { NumberInput } from './NumberInput'
import { DateControl } from './PickerControls'

interface Props { table: DataTable; types: Record<string, ColumnType>; onApply(table: DataTable, label: string): void; onClose(): void }
type Tab = 'transform' | 'fill' | 'smooth'
const units: Array<[UnitTransform, string]> = [
  ['level', 'Без преобразования'], ['change', 'Изменение'], ['change-year', 'Изменение за год'], ['percent-change', 'Изменение, %'],
  ['percent-year', 'Изменение за год, %'], ['annual-rate', 'Среднегодовой темп изменения'], ['continuous-rate', 'Непрерывный темп изменения'],
  ['continuous-annual-rate', 'Непрерывный годовой темп'], ['log', 'Натуральный логарифм'], ['index', 'Индекс (значение = 100 на дату)'],
]
const frequencies: Array<['original' | Exclude<TimeFrequency, 'irregular'>, string]> = [['original', 'Исходная'], ['daily', 'Дневная'], ['weekly', 'Недельная'], ['monthly', 'Месячная'], ['quarterly', 'Квартальная'], ['semiannual', 'Полугодовая'], ['annual', 'Годовая']]
const aggregations: Array<[FrequencyAggregation, string]> = [['average', 'Среднее'], ['sum', 'Сумма'], ['end', 'Последнее значение'], ['start', 'Первое значение'], ['min', 'Минимум'], ['max', 'Максимум']]
const iso = (date?: Date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''
const firstDate = (table: DataTable, field: string) => table.rows.map((row) => row[field]).filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime())).sort((a, b) => a.getTime() - b.getTime())[0]

export function DataTransformDialog({ table, types, onApply, onClose }: Props) {
  const dates = table.columns.filter((field) => types[field] === 'date')
  const numeric = table.columns.filter((field) => types[field] === 'number')
  const [tab, setTab] = useState<Tab>('transform')
  const [timeColumn, setTimeColumn] = useState(dates[0] ?? '')
  const [valueColumn, setValueColumn] = useState(numeric[0] ?? '')
  const [unitsValue, setUnitsValue] = useState<UnitTransform>('level')
  const [frequency, setFrequency] = useState<EconomicTransformOptions['frequency']>('original')
  const [aggregation, setAggregation] = useState<FrequencyAggregation>('average')
  const [indexDate, setIndexDate] = useState(iso(firstDate(table, dates[0] ?? '')))
  const [fillMethod, setFillMethod] = useState<GapFillMethod>('linear')
  const [smoothMethod, setSmoothMethod] = useState<DerivedOptions['method']>('moving-average')
  const [window, setWindow] = useState(3)
  const [name, setName] = useState(`${numeric[0] ?? 'value'}_smooth`)
  const [error, setError] = useState('')
  const profile = table.timeProfiles?.[timeColumn]
  const gapInfo = useMemo(() => profile ? findTimeGaps(table, timeColumn, profile, types) : { count: 0, examples: [] }, [table, timeColumn, profile, types])
  const chooseTimeColumn = (field: string) => { setTimeColumn(field); setIndexDate(iso(firstDate(table, field))) }
  const apply = () => {
    setError('')
    try {
      if (tab === 'transform') {
        onApply(transformEconomicSeries(table, { timeColumn, valueColumn, units: unitsValue, frequency, aggregation, indexDate }), `Преобразован ряд «${valueColumn}»`)
      } else if (tab === 'fill') {
        const result = fillTimeGaps(table, types, { timeColumn, valueColumn, method: fillMethod })
        onApply(result.table, `Добавлено ${result.inserted} периодов, заполнено ${result.filled}`)
      } else {
        const result = addDerivedTimeSeries(table, types, { timeColumn, valueColumn, method: smoothMethod, window, name: name.trim() })
        onApply(result, smoothMethod === 'moving-average' ? `Добавлено скользящее среднее «${name}»` : `Добавлен сезонно скорректированный ряд «${name}»`)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось преобразовать ряд') }
  }
  const disabled = !dates.length || !numeric.length || (tab === 'fill' && gapInfo.count === 0) || (tab === 'smooth' && !name.trim())

  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="date-dialog fred-dialog" role="dialog" aria-modal="true">
    <header><div><span className="eyebrow">Временной ряд</span><h2>Настроить данные</h2><p>Преобразования, пропуски и сглаживание — в одном месте</p></div><button onClick={onClose}>×</button></header>
    <div className="series-tabs fred-tabs"><TabButton tab="transform" active={tab} onClick={setTab}>Единицы и частота</TabButton><TabButton tab="fill" active={tab} onClick={setTab}>Заполнить пропуски</TabButton><TabButton tab="smooth" active={tab} onClick={setTab}>Сглаживание</TabButton></div>
    <div className="dialog-body fred-body">
      {!dates.length || !numeric.length ? <div className="series-error">Нужны как минимум один столбец с датой и один числовой столбец.</div> : <>
        <div className="fred-grid"><Field label="Период"><select value={timeColumn} onChange={(event) => chooseTimeColumn(event.target.value)}>{dates.map((field) => <option key={field}>{field}</option>)}</select></Field><Field label="Показатель"><select value={valueColumn} onChange={(event) => { setValueColumn(event.target.value); setName(`${event.target.value}_smooth`) }}>{numeric.map((field) => <option key={field}>{field}</option>)}</select></Field></div>
        {tab === 'transform' && <><section className="fred-section"><Field label="Единицы"><select value={unitsValue} onChange={(event) => setUnitsValue(event.target.value as UnitTransform)}>{units.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>{unitsValue === 'index' && <Field label="Базовая дата (индекс = 100)"><DateControl label="Базовая дата индекса" value={indexDate} onChange={setIndexDate}/></Field>}</section><section className="fred-section"><div className="fred-grid"><Field label="Изменить частоту"><select value={frequency} onChange={(event) => setFrequency(event.target.value as EconomicTransformOptions['frequency'])}>{frequencies.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Метод агрегации"><select value={aggregation} onChange={(event) => setAggregation(event.target.value as FrequencyAggregation)}>{aggregations.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field></div><p className="fred-note">Метод используется, когда несколько наблюдений попадают в один новый период.</p></section></>}
        {tab === 'fill' && <section className="fred-section"><div className="gap-summary"><div><strong>{gapInfo.count}</strong><span>пропущенных периодов</span></div><p>{gapInfo.examples.length ? gapInfo.examples.join(' · ') : 'Разрывов временной шкалы не найдено'}</p></div><div className="method-list"><Method active={fillMethod === 'linear'} onClick={() => setFillMethod('linear')} title="Линейная интерполяция" text="Равномерно распределяет изменение между соседними значениями."/><Method active={fillMethod === 'forward'} onClick={() => setFillMethod('forward')} title="Предыдущее значение" text="Переносит последнее известное значение вперёд."/><Method active={fillMethod === 'seasonal'} onClick={() => setFillMethod('seasonal')} title="Аналогичный сезон" text="Берёт значение того же периода прошлого цикла."/><Method active={fillMethod === 'empty'} onClick={() => setFillMethod('empty')} title="Только создать периоды" text="Добавляет строки, оставляя значения пустыми."/></div></section>}
        {tab === 'smooth' && <section className="fred-section"><div className="method-list smooth-methods"><Method active={smoothMethod === 'moving-average'} onClick={() => setSmoothMethod('moving-average')} title="Скользящее среднее" text="Сглаживает краткосрочный шум."/><Method active={smoothMethod === 'seasonal-additive'} onClick={() => setSmoothMethod('seasonal-additive')} title="Аддитивная декомпозиция" text="Для колебаний постоянной величины."/><Method active={smoothMethod === 'seasonal-multiplicative'} onClick={() => setSmoothMethod('seasonal-multiplicative')} title="Мультипликативная декомпозиция" text="Для колебаний, растущих вместе с уровнем."/></div>{smoothMethod === 'moving-average' && <Field label="Размер окна"><NumberInput min="2" max="99" value={window} onValueChange={(value) => setWindow(Math.max(2, value))}/></Field>}<Field label="Название нового столбца"><input value={name} onChange={(event) => setName(event.target.value)}/></Field>{smoothMethod !== 'moving-average' && <div className="method-warning">Это базовая классическая декомпозиция. Для официальной сезонной корректировки нужны X-13ARIMA-SEATS или TRAMO/SEATS.</div>}</section>}
      </>}{error && <div className="series-error">⚠ {error}</div>}
    </div><footer><button className="button" onClick={onClose}>Отмена</button><button className="button primary" disabled={disabled} onClick={apply}>{tab === 'fill' ? 'Заполнить периоды' : tab === 'smooth' ? 'Создать столбец' : 'Применить'}</button></footer>
  </section></div>
}

function TabButton({ tab, active, onClick, children }: { tab: Tab; active: Tab; onClick(tab: Tab): void; children: React.ReactNode }) { return <button className={tab === active ? 'active' : ''} onClick={() => onClick(tab)}>{children}</button> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="transform-field"><span>{label}</span>{children}</label> }
function Method({ active, onClick, title, text }: { active: boolean; onClick(): void; title: string; text: string }) { return <button className={active ? 'active' : ''} onClick={onClick}><span>{active ? '●' : '○'}</span><div><strong>{title}</strong><small>{text}</small></div></button> }
