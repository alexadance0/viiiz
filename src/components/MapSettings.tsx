import type { ChartConfig } from '../core/types'
import { HeatmapSettings } from './HeatmapSettings'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'
import { isTileMapChart } from '../features/chart-types/map/catalog'

export function MapSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const tiled = isTileMapChart(config.kind)
  const showNames = config.mapShowNames ?? tiled
  return <><details className="settings-group map-settings"><summary>Территории и подписи</summary><div>
    <SettingsCheckbox isSelected={showNames} onChange={(mapShowNames) => patch({ mapShowNames })}>Подписывать территории</SettingsCheckbox>
    {showNames && <label>Названия на карте<select value={config.mapLabelFormat ?? 'code'} onChange={(event) => patch({ mapLabelFormat: event.target.value as ChartConfig['mapLabelFormat'] })}><option value="code">Краткие коды</option><option value="name">Полные названия</option></select></label>}
    <small className="settings-note">{tiled ? 'Каждая территория занимает одинаковую квадратную плитку. Подписи размещаются в центре. Нажмите на плитку, чтобы отдельно включить её название или значение.' : 'Название и значение доступны при наведении. Подписи размещаются внутри контура. Для маленьких территорий выбранная подпись показывается с выноской.'}</small>
    {tiled && <label>Зазор между плитками, %<NumberInput min="0" max="30" step="1" value={config.mapTileGap ?? 4} onValueChange={(mapTileGap) => patch({ mapTileGap })}/></label>}
    <label>Цвет границ<ColorControl value={config.mapBorderColor ?? '#ffffff'} onChange={(mapBorderColor) => patch({ mapBorderColor })}/></label>
    <label>Толщина границ, px<NumberInput min="0" max="5" step="0.2" value={config.mapBorderWidth ?? .8} onValueChange={(mapBorderWidth) => patch({ mapBorderWidth })}/></label>
    {config.kind === 'map-usa' && <small className="settings-note">Аляска и Гавайи показаны отдельными вставками в изменённом масштабе.</small>}
    {config.kind === 'map-world' && <small className="settings-note">241 страна и территория. Антарктида не показана.</small>}
    {config.kind === 'map-europe' && <small className="settings-note">Европейская часть России показана до Уральских гор и реки Урал. В набор включены Турция, Кипр и страны Южного Кавказа.</small>}
  </div></details>{!config.colorEncoding && <HeatmapSettings config={config} onChange={onChange}/>}</>
}
