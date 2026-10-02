import type { ChartConfig } from '../core/types'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'
import { TextStyleEditor } from './TextStyleEditor'

export function WaffleSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <details className="settings-group" open><summary>Сетка и подписи</summary><div>
    <label>Столбцов<NumberInput min="1" max="30" value={config.waffleColumns ?? 10} onValueChange={(waffleColumns) => patch({ waffleColumns })}/></label>
    <label>Рядов<NumberInput min="1" max="30" value={config.waffleRows ?? 10} onValueChange={(waffleRows) => patch({ waffleRows })}/></label>
    <label>Промежуток, px<NumberInput min="0" max="16" value={config.waffleGap ?? 4} onValueChange={(waffleGap) => patch({ waffleGap })}/></label>
    <label>Скругление, %<NumberInput min="0" max="50" value={config.waffleRadius ?? 0} onValueChange={(waffleRadius) => patch({ waffleRadius })}/></label>
    <p className="settings-help">Вся сетка — 100% суммы. Число квадратов округляется; подписи показывают точные доли.</p>
    <SettingsCheckbox isSelected={config.showValues} onChange={(showValues) => patch({ showValues })}>Показывать подписи категорий</SettingsCheckbox>
    {config.showValues && <>
      <SettingsCheckbox isSelected={config.pieShowNames !== false} onChange={(pieShowNames) => patch({ pieShowNames })}>Название категории в подписи</SettingsCheckbox>
      <label>Значения в подписях<select value={config.pieValueFormat ?? 'percent'} onChange={(event) => patch({ pieValueFormat: event.target.value as ChartConfig['pieValueFormat'] })}><option value="percent">Доля от суммы, %</option><option value="absolute">Абсолютное значение</option><option value="both">Значение и доля, %</option></select></label>
      <TextStyleEditor label="Стиль подписей" value={config.valueText} customFonts={config.customFonts} onChange={(valueText) => patch({ valueText })}/>
    </>}
  </div></details>
}
