import type { Dispatch, SetStateAction } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import type { ChartConfig } from '../../../core/types'
import { NumberInput, OptionalNumberInput } from '../../../components/NumberInput'
import { SettingsCheckbox } from '../../../components/SettingsCheckbox'
import { getChartPlugin } from '../../../core/chartRegistry'
import { resizeMultiples, type Multiples } from '../model/multiples'
import './Multiples.css'

interface Props {
  config: ChartConfig
  scope?: 'setup' | 'graphs' | 'composition'
  selected: number | null
  onChange: Dispatch<SetStateAction<Multiples>>
  onSelect(index: number | null): void
  onAdd(index: number): void
}

export function MultiplesControls({ config, selected, onChange, onSelect, onAdd, scope = 'setup' }: Props) {
  const grid = config.multiples!
  const patch = (values: Partial<Multiples>) => onChange((current) => ({ ...current, ...values }))
  const count = grid.panels.filter(Boolean).length
  const move = (from: number, to: number) => {
    const panels = [...grid.panels]
    ;[panels[from], panels[to]] = [panels[to], panels[from]]
    onChange({ ...grid, panels }); onSelect(to)
  }
  const duplicate = (index: number) => {
    const target = grid.panels.findIndex((panel) => !panel)
    const panels = [...grid.panels]
    const destination = target < 0 ? panels.length : target
    panels[destination] = { id: crypto.randomUUID(), config: structuredClone(grid.panels[index]!.config) }
    onChange(resizeMultiples({ ...grid, panels }, grid.columns, grid.rows)); onSelect(destination)
  }
  return <section className="multiples-controls">
    {scope === 'setup' && <button className={`multiples-overview ${selected === null ? 'active' : ''}`} onClick={() => onSelect(null)} aria-pressed={selected === null}>Вся композиция <span>{count} графиков</span></button>}
    {scope === 'setup' && <details className="multiples-layout" open>
      <summary>Сетка графиков</summary>
      <div className="multiples-presets" aria-label="Раскладка графиков">{[[3, 1], [1, 3], [2, 2], [3, 2], [2, 3], [4, 2]].map(([columns, rows]) => <button key={`${columns}-${rows}`} aria-label={`${columns} ${columns === 1 ? 'колонка' : columns < 5 ? 'колонки' : 'колонок'}, ${rows} ${rows === 1 ? 'ряд' : 'ряда'}`} aria-pressed={grid.columns === columns && grid.rows === rows} onClick={() => onChange(resizeMultiples(grid, columns, rows))}><span className="multiples-mini-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>{Array.from({ length: columns * rows }, (_, index) => <i key={index}/>)}</span><small>{columns} × {rows}</small></button>)}</div>
      <div className="multiples-dimensions"><label>Колонки<NumberInput min={1} max={4} value={grid.columns} onValueChange={(columns) => onChange(resizeMultiples(grid, columns, grid.rows))}/></label><label>Ряды<NumberInput min={1} max={Math.max(6, grid.rows)} value={grid.rows} onValueChange={(rows) => onChange(resizeMultiples(grid, grid.columns, rows))}/></label><label>Интервал, px<NumberInput min={0} max={80} value={grid.gap} onValueChange={(gap) => patch({ gap: Math.max(0, Math.min(80, gap)) })}/></label></div>
      <SettingsCheckbox isSelected={grid.equalCategorySpacing ?? false} onChange={(equalCategorySpacing) => patch({ equalCategorySpacing })}>Одинаковая высота столбцов и интервалы</SettingsCheckbox>
      {grid.equalCategorySpacing && <p className="multiples-layout-hint">Для горизонтальных столбцов: больше категорий — выше ряд. Заголовки и шкалы учитываются отдельно. В ряду с несколькими графиками высота определяется по наибольшему числу категорий; остальные типы сохраняют обычную высоту.</p>}
      <p className="multiples-layout-hint" role="status">{grid.columns} кол. · {grid.rows} ряд. · {grid.panels.length - count} свободных мест. Графики сохраняются при смене сетки.</p>
    </details>}
    {scope !== 'graphs' && <details className="multiples-layout multiples-shared">
      <summary>Общие шкалы и категории</summary>
      <div>
        <SettingsCheckbox isSelected={grid.sharedValueScale ?? false} onChange={(sharedValueScale) => patch({ sharedValueScale })}>Общая шкала значений</SettingsCheckbox>
        {grid.sharedValueScale && <><p>Один диапазон для сопоставимых показателей. Для горизонтальных столбцов это горизонтальная числовая ось.</p><div className="multiples-dimensions"><label>Минимум<OptionalNumberInput value={grid.valueMin} onValueChange={(valueMin) => patch({ valueMin })}/></label><label>Максимум<OptionalNumberInput value={grid.valueMax} onValueChange={(valueMax) => patch({ valueMax })}/></label><label>Шаг<OptionalNumberInput min={0} value={grid.valueStep} onValueChange={(valueStep) => patch({ valueStep: valueStep != null && valueStep > 0 ? valueStep : null })}/></label></div><small>Пустые поля — диапазон по данным всех панелей. Разные единицы и типы шкал объединяются отдельно.</small></>}
        <SettingsCheckbox isSelected={grid.sharedXScale ?? false} onChange={(sharedXScale) => patch({ sharedXScale })}>Общий период / диапазон X</SettingsCheckbox>
        {grid.sharedXScale && <small>Для линий синхронизируется период, для точечных графиков — числовая ось X.</small>}
        {(grid.sharedValueScale || grid.sharedXScale) && <><label>Подписи общих шкал<select value={grid.sharedScaleLabels ?? 'all'} onChange={(event) => patch({ sharedScaleLabels: event.target.value as Multiples['sharedScaleLabels'] })}><option value="all">У каждой панели</option><option value="left">Только слева</option><option value="bottom">Только снизу</option></select></label><small>{grid.sharedScaleLabels === 'left' ? 'Подписи вертикальной шкалы значений остаются у первого графика каждого ряда. Горизонтальные шкалы сохраняются.' : grid.sharedScaleLabels === 'bottom' ? 'Подписи общих горизонтальных шкал остаются у нижнего графика каждой колонки. Вертикальные шкалы сохраняются.' : 'Подписи отображаются согласно настройкам каждого графика. Сетка и диапазоны сохраняются во всех панелях.'}</small></>}
        <SettingsCheckbox isSelected={grid.sharedCategoryLabels ?? false} onChange={(sharedCategoryLabels) => patch({ sharedCategoryLabels })}>Общие подписи категорий</SettingsCheckbox>
        {grid.sharedCategoryLabels && <small>Для горизонтальных графиков с одним полем категорий: подписи слева от сетки, порядок — как у первого графика в каждом ряду.</small>}
      </div>
    </details>}
    {scope !== 'composition' && <><div className="multiples-panel-list" aria-label="Графики композиции">{grid.panels.map((panel, index) => panel && <div key={panel.id} className={selected === index ? 'selected' : ''}>
      <button className="multiples-panel-name" aria-pressed={selected === index} onClick={() => onSelect(index)}><span>{String(index + 1).padStart(2, '0')}</span><span><strong>{panel.config.title || `График ${index + 1}`}</strong><small>{getChartPlugin(panel.config.kind).label}</small></span></button>
      <div className="multiples-panel-actions"><button aria-label={`Переместить график ${index + 1} назад`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={14}/></button><button aria-label={`Переместить график ${index + 1} вперёд`} disabled={index === grid.panels.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={14}/></button><button aria-label={`Дублировать график ${index + 1}`} onClick={() => duplicate(index)}><Copy size={14}/></button><button aria-label={`Удалить график ${index + 1}`} onClick={() => { onChange({ ...grid, panels: grid.panels.map((item, position) => position === index ? null : item) }); if (selected === index) onSelect(null) }}><Trash2 size={14}/></button></div>
    </div>)}</div>
    <button className="multiples-add button" onClick={() => onAdd(grid.panels.findIndex((panel) => !panel) < 0 ? grid.panels.length : grid.panels.findIndex((panel) => !panel))}><Plus size={15}/>Добавить график</button></>}
  </section>
}
