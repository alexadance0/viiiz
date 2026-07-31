import type { ChartConfig } from '../core/types'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'
import { TextStyleEditor } from './TextStyleEditor'

export function TreemapSettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const positions = [
    ['top-left', 'Сверху слева'], ['top-center', 'Сверху по центру'], ['top-right', 'Сверху справа'],
    ['center-left', 'По центру слева'], ['center', 'По центру'], ['center-right', 'По центру справа'],
    ['bottom-left', 'Снизу слева'], ['bottom-center', 'Снизу по центру'], ['bottom-right', 'Снизу справа'],
  ] as const
  return <details className="settings-group" open>
    <summary>Компоновка Treemap</summary>
    <div>
      <label>Промежуток между блоками внутри категории, px<NumberInput min="0" max="16" value={config.treemapGap ?? 2} onValueChange={(treemapGap) => patch({ treemapGap })}/></label>
      {!!config.treemapSubcategoryField && <label>Промежуток между категориями, px<NumberInput min="0" max="24" value={config.treemapGroupGap ?? 5} onValueChange={(treemapGroupGap) => patch({ treemapGroupGap })}/></label>}
      {!!config.treemapSubcategoryField && <fieldset className="treemap-label-settings">
        <legend>Общие категории</legend>
        <SettingsCheckbox isSelected={config.treemapShowGroupLabels ?? true} onChange={(treemapShowGroupLabels) => patch({ treemapShowGroupLabels, ...(!treemapShowGroupLabels ? { treemapShowGroupValues: false } : {}) })}>Показывать название категории</SettingsCheckbox>
        <SettingsCheckbox isSelected={config.treemapShowGroupValues ?? config.showValues} onChange={(treemapShowGroupValues) => patch({ treemapShowGroupValues })}>Показывать итог категории</SettingsCheckbox>
        <label>Положение подписи<select value={config.treemapGroupLabelPosition ?? 'top-left'} onChange={(event) => patch({ treemapGroupLabelPosition: event.target.value as NonNullable<ChartConfig['treemapGroupLabelPosition']> })}>{positions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <TextStyleEditor label="Текст общих категорий" value={config.treemapGroupText ?? config.valueText} customFonts={config.customFonts} onChange={(treemapGroupText) => patch({ treemapGroupText })}/>
      </fieldset>}
      <fieldset className="treemap-label-settings">
        <legend>{config.treemapSubcategoryField ? 'Блоки' : 'Категории'}</legend>
        <SettingsCheckbox isSelected={config.treemapShowLeafLabels ?? true} onChange={(treemapShowLeafLabels) => patch({ treemapShowLeafLabels, ...(!treemapShowLeafLabels ? { treemapShowLeafValues: false } : {}) })}>Показывать название блока</SettingsCheckbox>
        <SettingsCheckbox isSelected={config.treemapShowLeafValues ?? config.showValues} onChange={(treemapShowLeafValues) => patch({ treemapShowLeafValues })}>Показывать значение блока</SettingsCheckbox>
        <label>Положение подписи<select value={config.treemapLabelPosition ?? 'bottom-right'} onChange={(event) => patch({ treemapLabelPosition: event.target.value as NonNullable<ChartConfig['treemapLabelPosition']> })}>{positions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <TextStyleEditor label="Текст блоков" value={config.treemapLeafText ?? config.valueText} customFonts={config.customFonts} onChange={(treemapLeafText) => patch({ treemapLeafText })}/>
      </fieldset>
      <SettingsCheckbox isSelected={config.valueLabelAutoContrast ?? true} onChange={(valueLabelAutoContrast) => patch({ valueLabelAutoContrast })}>Автоматический контраст текста</SettingsCheckbox>
      {(config.treemapGroupOrder?.length || Object.keys(config.treemapLeafOrder ?? {}).length > 0) && <button type="button" className="button" onClick={() => patch({ treemapGroupOrder: undefined, treemapLeafOrder: undefined })}>Вернуть порядок по значениям</button>}
      <small>Русские слова переносятся по слогам. Чтобы изменить компоновку, выберите категорию или блок и перетащите его: свободная область внизу справа перемещает элемент в конец.</small>
    </div>
  </details>
}
