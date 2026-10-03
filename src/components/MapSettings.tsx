import type { ChartConfig } from '../core/types'
import { HeatmapSettings } from './HeatmapSettings'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'

export function MapSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <><details className="settings-group map-settings"><summary>Территории и подписи</summary><div>
    <SettingsCheckbox isSelected={config.mapShowNames ?? false} onChange={(mapShowNames) => patch({ mapShowNames })}>Подписывать территории</SettingsCheckbox>
    {config.mapShowNames && <label>Названия на карте<select value={config.mapLabelFormat ?? 'code'} onChange={(event) => patch({ mapLabelFormat: event.target.value as ChartConfig['mapLabelFormat'] })}><option value="code">Краткие коды</option><option value="name">Полные названия</option></select></label>}
    <small className="settings-note">Название и значение доступны при наведении. Подписи размещаются внутри контура. Для маленьких территорий выбранная подпись показывается с выноской; сами территории отмечены точками.</small>
    <label>Цвет границ<ColorControl value={config.mapBorderColor ?? '#ffffff'} onChange={(mapBorderColor) => patch({ mapBorderColor })}/></label>
    <label>Толщина границ, px<NumberInput min="0" max="5" step="0.2" value={config.mapBorderWidth ?? .8} onValueChange={(mapBorderWidth) => patch({ mapBorderWidth })}/></label>
    {config.kind === 'map-usa' && <small className="settings-note">Аляска и Гавайи показаны отдельными вставками в изменённом масштабе.</small>}
    {config.kind === 'map-europe' && <small className="settings-note">Россия показана до 60° восточной долготы. В набор включены Турция, Кипр и страны Южного Кавказа.</small>}
  </div></details><HeatmapSettings config={config} onChange={onChange}/></>
}
