import type { CSSProperties, Dispatch, SetStateAction, ReactNode } from 'react'
import { ChartDataMapping } from '../../../components/ChartDataMapping'
import { loadEchartsForKind } from '../../../components/echarts/loadEchartsForKind'
import { chartRegistry } from '../../../core/chartRegistry'
import type { ChartConfig, ChartKind, DataTable } from '../../../core/types'
import { ChartTypeIcon } from './ChartTypeIcon'

const categories = [
  { id: 'composition', label: 'Состав', hint: 'Показать доли от целого', accent: '#e56b45' },
  { id: 'comparison', label: 'Сравнение', hint: 'Сопоставить значения', accent: '#1677a6' },
  { id: 'bar-horizontal', label: 'Линейчатые', hint: 'Сравнить категории по горизонтали', accent: '#18aeda' },
  { id: 'trend', label: 'Динамика', hint: 'Изменения во времени', accent: '#36a476' },
  { id: 'smoothing', label: 'Сглаживание', hint: 'Отделить тренд от колебаний', accent: '#e4a52c' },
  { id: 'area', label: 'Области', hint: 'Показать объём и структуру', accent: '#e033ab' },
  { id: 'relationship', label: 'Связи', hint: 'Найти зависимости', accent: '#4568e1' },
  { id: 'distribution', label: 'Распределения', hint: 'Показать форму и разброс данных', accent: '#db5a5a' },
  { id: 'heatmap', label: 'Тепловые карты', hint: 'Показать интенсивность цветом', accent: '#e4a52c' },
  { id: 'geography', label: 'Карты', hint: 'Сравнить территории по цвету', accent: '#1677a6' },
  { id: 'hierarchy', label: 'Иерархия', hint: 'Показать категории и подкатегории площадью', accent: '#36a476' },
] as const

const descriptions: Record<ChartKind, string> = {
  'map-russia': 'Регионы России, включая заявленные новые регионы',
  'map-usa': '50 штатов и округ Колумбия',
  'map-europe': 'Сравнить страны Европы',
  bump: 'Проследить изменение мест в рейтинге',
  sankey: 'Показать потоки между категориями',
  waffle: 'Доли от целого в сетке квадратов',
  pie: 'Сравнить доли в целом',
  donut: 'Показать состав кольцом',
  bar: 'Сравнить величины по категориям',
  'stacked-bar': 'Показать состав каждого столбца',
  'normalized-stacked-bar': 'Сравнить доли внутри категорий',
  waterfall: 'Разложить итог на изменения',
  'horizontal-bar': 'Сравнить категории с длинными названиями',
  butterfly: 'Сопоставить две стороны',
  'horizontal-stacked-bar': 'Показать состав горизонтальных рядов',
  'horizontal-normalized-stacked-bar': 'Сравнить доли по горизонтали',
  lollipop: 'Сделать сравнение легче столбцов',
  'horizontal-lollipop': 'Компактно сравнить длинный список',
  dumbbell: 'Показать разницу между двумя значениями',
  line: 'Показать изменение во времени',
  spline: 'Показать плавную динамику',
  'step-line': 'Показать дискретные изменения',
  'indexed-line': 'Сравнить относительную динамику',
  'seasonal-line': 'Сопоставить одинаковые периоды',
  slope: 'Сравнить позиции в двух моментах',
  'range-line': 'Показать границы диапазона',
  'step-range-line': 'Показать ступенчатый интервал',
  'confidence-line': 'Показать линию и неопределённость',
  'moving-average-line': 'Выделить тренд на линии',
  'moving-average-scatter': 'Выделить тренд среди точек',
  area: 'Подчеркнуть объём во времени',
  'stacked-area': 'Показать вклад частей в общий объём',
  'normalized-stacked-area': 'Сравнить изменение долей',
  scatter: 'Найти связь между показателями',
  bubble: 'Добавить третью величину размером',
  boxplot: 'Сравнить медиану и разброс',
  violinplot: 'Показать форму распределения',
  raincloud: 'Совместить плотность, сводку и точки',
  histogram: 'Показать частоты по интервалам',
  'kde-plot': 'Показать сглаженную плотность',
  ridgeline: 'Сравнить несколько распределений',
  beeswarm: 'Показать все точки без наложения',
  'strip-plot': 'Показать наблюдения по группам',
  'jitter-plot': 'Развести совпадающие наблюдения',
  'counts-plot': 'Показать частоту повторений точками',
  'barcode-plot': 'Показать каждое наблюдение штрихом',
  heatmap: 'Найти закономерности по интенсивности',
  treemap: 'Сравнить части и уровни по площади',
}

interface Props {
  header?: ReactNode
  table: DataTable
  numericColumns: string[]
  config: ChartConfig
  onChange: Dispatch<SetStateAction<ChartConfig>>
  onToggleField(field: string): void
  onChooseChart(kind: ChartKind): void
}

export function ChartTypePicker({ header, table, numericColumns, config, onChange, onToggleField, onChooseChart }: Props) {
  return <aside className="chart-picker">
    {header}
    <div className="panel-title"><h2>Тип графика</h2><p>Выберите способ показать данные</p></div>
    <ChartDataMapping table={table} numericColumns={numericColumns} config={config} onChange={onChange} onToggleField={onToggleField}/>
    {categories.map((category) => {
      const headingId = `chart-category-${category.id}`
      return <section className="chart-category" aria-labelledby={headingId} style={{ '--category-accent': category.accent } as CSSProperties} key={category.id}>
        <header className="chart-category-heading"><h3 id={headingId}>{category.label}</h3><p>{category.hint}</p></header>
        <div className="chart-choice-grid">{chartRegistry.filter((plugin) => plugin.category === category.id).map((plugin) => {
          const descriptionId = `chart-${plugin.id}-description`
          return <button key={plugin.id} className={config.kind === plugin.id ? 'active' : ''} aria-label={plugin.label} aria-describedby={descriptionId} aria-pressed={config.kind === plugin.id} onPointerEnter={() => { void loadEchartsForKind(plugin.id) }} onFocus={() => { void loadEchartsForKind(plugin.id) }} onClick={() => onChooseChart(plugin.id)}><ChartTypeIcon kind={plugin.id}/><b>{plugin.label}</b><small id={descriptionId} className="chart-choice-description">{descriptions[plugin.id]}</small></button>
        })}</div>
      </section>
    })}
  </aside>
}
