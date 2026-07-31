import type { ChartConfig } from '../core/types'
import { NumberInput, OptionalNumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'

interface Props { config: ChartConfig; onChange(config: ChartConfig): void }

export function HeatmapSettings({ config, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <><details className="settings-group" open><summary>Цветовая шкала</summary><div>
    <label>Тип шкалы<select value={config.heatmapScaleMode ?? 'diverging'} onChange={(event) => patch({ heatmapScaleMode: event.target.value as ChartConfig['heatmapScaleMode'] })}><option value="diverging">Расходящаяся — ниже / середина / выше</option><option value="sequential">Последовательная — от меньшего к большему</option></select></label>
    <label>{config.heatmapScaleMode === 'sequential' ? 'Минимальные значения' : 'Значения ниже середины'}<ColorControl value={config.heatmapLowColor ?? '#2c6aa8'} onChange={(heatmapLowColor) => patch({ heatmapLowColor })}/></label>
    {(config.heatmapScaleMode ?? 'diverging') === 'diverging' && <><label>Цвет середины<ColorControl value={config.heatmapMidColor ?? '#f5f5f2'} onChange={(heatmapMidColor) => patch({ heatmapMidColor })}/></label><label>Среднее значение шкалы<NumberInput value={config.heatmapMidpoint ?? 0} onValueChange={(heatmapMidpoint) => patch({ heatmapMidpoint })}/></label></>}
    <label>{config.heatmapScaleMode === 'sequential' ? 'Максимальные значения' : 'Значения выше середины'}<ColorControl value={config.heatmapHighColor ?? '#c83e4d'} onChange={(heatmapHighColor) => patch({ heatmapHighColor })}/></label>
    <SettingsCheckbox isSelected={config.heatmapShowScale ?? true} onChange={(heatmapShowScale) => patch({ heatmapShowScale })}>Показывать цветовую шкалу</SettingsCheckbox>
    {(config.heatmapShowScale ?? true) && <label>Положение шкалы<select value={config.heatmapScalePosition ?? 'right'} onChange={(event) => patch({ heatmapScalePosition: event.target.value as ChartConfig['heatmapScalePosition'] })}><option value="right">Справа</option><option value="left">Слева</option><option value="top">Сверху</option><option value="bottom">Снизу</option></select></label>}
    <div className="fred-grid"><label>Нижняя граница<OptionalNumberInput value={config.heatmapScaleMin} onValueChange={(heatmapScaleMin) => patch({ heatmapScaleMin })}/></label><label>Верхняя граница<OptionalNumberInput value={config.heatmapScaleMax} onValueChange={(heatmapScaleMax) => patch({ heatmapScaleMax })}/></label></div>
    <small className="settings-note">Пустые границы рассчитываются автоматически по данным.</small>
    <label>Промежуток между ячейками, px<NumberInput min="0" max="12" value={config.heatmapCellGap ?? 1} onValueChange={(heatmapCellGap) => patch({ heatmapCellGap })}/></label>
    <small className="settings-note">Подписи внутри ячеек включаются в разделе «Подписи значений».</small>
  </div></details><details className="settings-group"><summary>Ряды и пропуски</summary><div>
    <label>Сортировка рядов<select value={config.heatmapRowSort ?? 'none'} onChange={(event) => patch({ heatmapRowSort: event.target.value as ChartConfig['heatmapRowSort'] })}><option value="none">Исходный порядок</option><option value="average">По среднему</option><option value="min">По минимуму</option><option value="max">По максимуму</option><option value="last">По последнему значению</option></select></label>
    {(config.heatmapRowSort ?? 'none') !== 'none' && <label>Направление<select value={config.heatmapRowSortDirection ?? 'descending'} onChange={(event) => patch({ heatmapRowSortDirection: event.target.value as ChartConfig['heatmapRowSortDirection'] })}><option value="descending">От большего к меньшему</option><option value="ascending">От меньшего к большему</option></select></label>}
    <label>Цвет пропущенных значений<ColorControl value={config.heatmapMissingColor ?? '#e8e7eb'} onChange={(heatmapMissingColor) => patch({ heatmapMissingColor })}/></label>
    <label>Подпись пропуска<input value={config.heatmapMissingLabel ?? '—'} maxLength={12} onChange={(event) => patch({ heatmapMissingLabel: event.target.value })}/></label>
  </div></details></>
}
