import type { ChartConfig } from '../core/types'
import { ColorControl } from './PickerControls'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'

export function BarBorderFields({ width, color, inherited, onWidth, onColor }: { width: number; color: string; inherited: boolean; onWidth(width: number): void; onColor(color: string): void }) {
  return <>
    <SettingsCheckbox isSelected={width > 0} onChange={(shown) => onWidth(shown ? 1 : 0)}>Рамка столбцов</SettingsCheckbox>
    {width > 0 && <><label>Толщина рамки, px<NumberInput min="0" max="12" step="0.5" value={width} onValueChange={onWidth}/></label><label>Цвет рамки<ColorControl value={color} code={inherited ? 'Как заливка' : color} onChange={onColor}/></label></>}
  </>
}

export function BarAppearanceSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <details className="settings-group bar-appearance-settings"><summary>Заливка и рамка</summary><div>
    <label>Прозрачность заливки, %<NumberInput min="0" max="100" value={Math.round((config.barFillOpacity ?? 1) * 100)} onValueChange={(value) => patch({ barFillOpacity: value / 100 })}/></label>
    <BarBorderFields width={config.barBorderWidth ?? 0} color={config.barBorderColor ?? config.color} inherited={!config.barBorderColor} onWidth={(barBorderWidth) => patch({ barBorderWidth })} onColor={(barBorderColor) => patch({ barBorderColor })}/>
    {config.barBorderColor && <button type="button" className="reset-element" onClick={() => patch({ barBorderColor: undefined })}>Цвет рамки как у заливки</button>}
    <small className="settings-note">Индивидуальные настройки рядов и столбцов имеют приоритет.</small>
  </div></details>
}
