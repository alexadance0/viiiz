import type { Dispatch, SetStateAction } from 'react'
import { ChartDataMapping } from '../../../components/ChartDataMapping'
import { loadEchartsForKind } from '../../../components/echarts/loadEchartsForKind'
import { chartRegistry } from '../../../core/chartRegistry'
import type { ChartConfig, ChartKind, DataTable } from '../../../core/types'

const categories = [
  { id: 'comparison', label: 'Сравнение', hint: 'Сопоставить значения' },
  { id: 'bar-horizontal', label: 'Линейчатые', hint: 'Сравнить категории по горизонтали' },
  { id: 'trend', label: 'Динамика', hint: 'Изменения во времени' },
  { id: 'smoothing', label: 'Сглаживание', hint: 'Отделить тренд от колебаний' },
  { id: 'area', label: 'Области', hint: 'Показать объём и структуру' },
  { id: 'relationship', label: 'Связи', hint: 'Найти зависимости' },
  { id: 'distribution', label: 'Распределения', hint: 'Показать форму и разброс данных' },
  { id: 'heatmap', label: 'Тепловые карты', hint: 'Показать интенсивность цветом' },
  { id: 'hierarchy', label: 'Иерархия', hint: 'Показать категории и подкатегории площадью' },
] as const

interface Props {
  table: DataTable
  numericColumns: string[]
  config: ChartConfig
  onChange: Dispatch<SetStateAction<ChartConfig>>
  onToggleField(field: string): void
  onChooseChart(kind: ChartKind): void
}

export function ChartTypePicker({ table, numericColumns, config, onChange, onToggleField, onChooseChart }: Props) {
  return <aside className="chart-picker">
    <div className="panel-title"><span className="eyebrow">Шаг 3 из 4</span><h2>Тип графика</h2><p>Выберите способ показать данные</p></div>
    <ChartDataMapping table={table} numericColumns={numericColumns} config={config} onChange={onChange} onToggleField={onToggleField}/>
    {categories.map((category) => <section className="chart-category" key={category.id}><div><strong>{category.label}</strong><small>{category.hint}</small></div><div className="chart-choice-grid">{chartRegistry.filter((plugin) => plugin.category === category.id).map((plugin) => <button key={plugin.id} className={config.kind === plugin.id ? 'active' : ''} onPointerEnter={() => { void loadEchartsForKind(plugin.id) }} onFocus={() => { void loadEchartsForKind(plugin.id) }} onClick={() => onChooseChart(plugin.id)}><span className={`chart-icon ${plugin.id}`}/><b>{plugin.label}</b></button>)}</div></section>)}
  </aside>
}
