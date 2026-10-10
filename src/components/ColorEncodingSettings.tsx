import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ChartConfig, DataTable } from '../core/types'
import { categoryColorValue, colorCategories, colorRowGroups, createColorEncoding, defaultColorThresholds, intervalPalette } from '../core/colorEncoding'
import { isMapChart, mapPresetForKind, matchMapRows } from '../features/chart-types/map/catalog'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'
import { TextStyleEditor } from './TextStyleEditor'
import { chartPalettes } from '../core/colorPalettes'
import './ColorEncodingSettings.css'

export function ColorEncodingSettings({ table, config, onChange }: { table: DataTable; config: ChartConfig; onChange(config: ChartConfig): void }) {
  const map = isMapChart(config.kind), encoding = config.colorEncoding
  const [draft, setDraft] = useState((encoding?.thresholds ?? []).join('; ')), [error, setError] = useState('')
  useEffect(() => { setDraft((encoding?.thresholds ?? []).join('; ')); setError('') }, [encoding?.thresholds])
  const patch = (values: Partial<NonNullable<ChartConfig['colorEncoding']>>) => encoding && onChange({ ...config, colorEncoding: { ...encoding, ...values } })
  const categories = useMemo(() => encoding?.mode === 'categories' ? colorCategories(table, config) : [], [table, config, encoding])
  const model = createColorEncoding(table, config)
  const numericColumns = table.columns.filter((column) => table.rows.some((row) => typeof row[column] === 'number' && Number.isFinite(row[column])))
  const conflicts = useMemo(() => {
    if (encoding?.mode !== 'categories') return 0
    let groups = [...colorRowGroups(table, config).values()]
    if (map) {
      const byRegion = new Map<string, DataTable['rows']>()
      for (const { region, row } of matchMapRows(table, config.xField, mapPresetForKind(config.kind)).matched) { const rows = byRegion.get(region!.id) ?? []; rows.push(row); byRegion.set(region!.id, rows) }
      groups = [...byRegion.values()]
    }
    return groups.filter((rows) => new Set(rows.map((row) => categoryColorValue(row[encoding.field ?? '']))).size > 1).length
  }, [table, config, encoding, map])
  const mode = (value: string) => {
    if (!value) { onChange({ ...config, colorEncoding: undefined }); return }
    const field = value === 'categories' ? table.columns.find((column) => column !== config.xField && !numericColumns.includes(column)) ?? table.columns.find((column) => column !== config.xField) ?? config.xField : config.yField
    const next: ChartConfig = { ...config, showLegend: value !== 'single', showDirectLabels: value === 'single' ? config.showDirectLabels : false, colorEncoding: { mode: value as NonNullable<ChartConfig['colorEncoding']>['mode'], field, missingPattern: 'diagonal', missingLabel: 'Нет данных', missingColor: config.heatmapMissingColor ?? '#e8e7eb', ...(value === 'bins' ? { thresholds: defaultColorThresholds(table, field) } : {}) } }
    if (value === 'categories') next.colorEncoding!.categories = colorCategories(table, next)
    onChange(next)
  }
  const move = (index: number, direction: number) => {
    const next = [...categories], target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    patch({ categories: next })
  }
  const saveThresholds = () => {
    const values = draft.split(';').map((value) => Number(value.trim().replace(',', '.')))
    if (!draft.trim() || values.length > 12 || values.some((value) => !Number.isFinite(value)) || values.some((value, i) => i > 0 && value <= values[i - 1])) { setError('Укажите до 12 границ по возрастанию, разделённых точкой с запятой.'); return }
    setError(''); patch({ thresholds: values })
  }
  return <details className="settings-group color-encoding-settings" open><summary>Окраска по данным</summary><div>
    <label>Способ окраски<select value={encoding?.mode ?? ''} onChange={(event) => mode(event.target.value)}><option value="">{map ? 'Числовой градиент' : 'По рядам'}</option><option value="single">Один цвет</option><option value="categories">По категориям</option><option value="bins">Числовые интервалы</option></select></label>
    {encoding?.mode === 'single' && <label>Общий цвет<ColorControl value={config.color} swatches={config.palette} onChange={(color) => onChange({ ...config, color })}/></label>}
    {encoding && encoding.mode !== 'single' && <>
      <label>Палитра окраски<select value={chartPalettes.some((palette) => palette.id === config.paletteName) ? config.paletteName : ''} onChange={(event) => {
        const palette = chartPalettes.find((item) => item.id === event.target.value)
        if (!palette) return
        onChange({ ...config, paletteName: palette.id, palette: [...palette.colors], color: palette.colors[0], paletteReversed: false, colorEncoding: { ...encoding, ...(encoding.mode === 'categories' ? { categories: categories.map((entry, i) => ({ ...entry, color: palette.colors[i % palette.colors.length] })) } : { binColors: intervalPalette(palette.colors, model.bins.length) }) } })
      }}><option value="">Текущая / своя палитра</option>{chartPalettes.map((palette) => <option key={palette.id} value={palette.id}>{palette.label}</option>)}</select></label>
      <label>{encoding.mode === 'categories' ? 'Категория цвета' : 'Показатель для цвета'}<select value={encoding.field ?? ''} onChange={(event) => {
        const next: ChartConfig = { ...config, colorEncoding: { ...encoding, field: event.target.value || undefined, categories: undefined, ...(encoding.mode === 'bins' ? { thresholds: defaultColorThresholds(table, event.target.value || config.yField) } : {}) } }
        if (encoding.mode === 'categories') next.colorEncoding!.categories = colorCategories(table, next)
        onChange(next)
      }}><option value="">{encoding.mode === 'categories' ? 'Выберите столбец' : 'Значение элемента'}</option>{(encoding.mode === 'categories' ? table.columns : numericColumns).map((column) => <option key={column}>{column}</option>)}</select></label>
      {encoding.mode === 'categories' ? <>
        <p className="settings-note">Цвет задаёт категорию; числовой показатель остаётся значением элемента. Порядок ниже задаёт порядок легенды.</p>
        {conflicts > 0 && <p className="color-encoding-warning" role="alert">У {conflicts} объектов разные категории в объединяемых строках. Они отмечены как «Несколько категорий». Исправьте категории в таблице.</p>}
        <div className="color-category-list">{categories.map((entry, index) => <div className="color-category-row" key={entry.value}>
          <ColorControl compact title={`Цвет категории ${entry.value}`} value={entry.color} swatches={config.palette} onChange={(color) => patch({ categories: categories.map((item) => item.value === entry.value ? { ...item, color } : item) })}/>
          <label><span>{entry.value}</span><input aria-label={`Подпись категории ${entry.value}`} value={entry.label ?? entry.value} onChange={(event) => patch({ categories: categories.map((item) => item.value === entry.value ? { ...item, label: event.target.value } : item) })}/></label>
          <button type="button" disabled={!index} aria-label={`Поднять категорию ${entry.value}`} onClick={() => move(index, -1)}><ArrowUp size={14}/></button><button type="button" disabled={index === categories.length - 1} aria-label={`Опустить категорию ${entry.value}`} onClick={() => move(index, 1)}><ArrowDown size={14}/></button>
        </div>)}</div>
      </> : <>
        <label>Границы интервалов<input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={saveThresholds} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveThresholds() } }}/></label>
        <p className="settings-note">Например: 2; 4; 6. Граница относится к следующему интервалу. Первый и последний интервалы открыты.</p>{error && <p className="color-encoding-warning" role="alert">{error}</p>}
        <div className="color-category-list">{Array.from({ length: model.thresholds.length + 1 }, (_, index) => {
          const encoded = model.bins[index]
          return <div className="color-bin-row" key={index}><ColorControl compact title={`Цвет интервала ${index + 1}`} value={encoded.color} swatches={config.palette} onChange={(color) => { const colors = model.bins.map((bin) => bin.color); colors[index] = color; patch({ binColors: colors }) }}/><input aria-label={`Подпись интервала ${index + 1}`} value={encoding.binLabels?.[index] ?? ''} placeholder={encoded.label} onChange={(event) => { const labels = [...(encoding.binLabels ?? [])]; labels[index] = event.target.value; patch({ binLabels: labels }) }}/></div>
        })}</div>
      </>}
      <SettingsCheckbox isSelected={config.showLegend} onChange={(showLegend) => onChange({ ...config, showLegend })}>{encoding.mode === 'bins' ? 'Показывать цветовую шкалу' : 'Показывать легенду окраски'}</SettingsCheckbox>
      {config.showLegend && <label>{encoding.mode === 'bins' ? 'Положение цветовой шкалы' : 'Положение легенды окраски'}<select value={config.legendPosition ?? 'top'} onChange={(event) => onChange({ ...config, legendPosition: event.target.value as ChartConfig['legendPosition'] })}><option value="top">Сверху</option><option value="bottom">Снизу</option><option value="left">Слева</option><option value="right">Справа</option></select></label>}
      {config.showLegend && <TextStyleEditor label={encoding.mode === 'bins' ? 'Текст цветовой шкалы' : 'Текст легенды окраски'} value={config.legendText} customFonts={config.customFonts} onChange={(legendText) => onChange({ ...config, legendText })}/>}
      <label>Цвет отсутствующих данных<ColorControl value={encoding.missingColor ?? '#e8e7eb'} swatches={config.palette} onChange={(missingColor) => patch({ missingColor })}/></label>
      <label>Подпись отсутствующих данных<input value={encoding.missingLabel ?? 'Нет данных'} onChange={(event) => patch({ missingLabel: event.target.value })}/></label>
      <label>Оформление отсутствующих данных<select value={encoding.missingPattern ?? 'none'} onChange={(event) => patch({ missingPattern: event.target.value as 'none' | 'diagonal' })}><option value="none">Сплошная заливка</option><option value="diagonal">Диагональная штриховка</option></select></label>
    </>}
  </div></details>
}
