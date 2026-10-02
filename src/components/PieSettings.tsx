import type { ChartConfig } from '../core/types'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'
import { TextStyleEditor } from './TextStyleEditor'

export function PieSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <details className="settings-group" open><summary>Секторы и подписи</summary><div>
    {config.kind === 'donut' && <label>Размер отверстия, %<NumberInput min="10" max="85" value={config.pieInnerRadius ?? 55} onValueChange={(pieInnerRadius) => patch({ pieInnerRadius })}/></label>}
    <SettingsCheckbox isSelected={config.showValues} onChange={(showValues) => patch({ showValues })}>Показывать подписи секторов</SettingsCheckbox>
    {config.showValues && <>
      <SettingsCheckbox isSelected={config.pieShowNames !== false} onChange={(pieShowNames) => patch({ pieShowNames })}>Название категории в подписи</SettingsCheckbox>
      <label>Значения в подписях<select value={config.pieValueFormat ?? 'percent'} onChange={(event) => patch({ pieValueFormat: event.target.value as ChartConfig['pieValueFormat'] })}><option value="percent">Доля от суммы, %</option><option value="absolute">Абсолютное значение</option><option value="both">Значение и доля, %</option></select></label>
      <label>Положение подписей<select value={config.pieLabelPosition ?? 'outside'} onChange={(event) => patch({ pieLabelPosition: event.target.value as ChartConfig['pieLabelPosition'] })}><option value="outside">Снаружи с выносками</option><option value="inside">Внутри секторов</option></select></label>
      <TextStyleEditor label="Стиль подписей" value={config.valueText} customFonts={config.customFonts} onChange={(valueText) => patch({ valueText })}/>
    </>}
  </div></details>
}
