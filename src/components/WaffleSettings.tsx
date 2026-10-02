import { useState } from 'react'
import type { ChartConfig, ChartElementSelection } from '../core/types'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'
import { TextStyleEditor } from './TextStyleEditor'

export function WaffleSettings({ config, valueLabels, onChange }: { config: ChartConfig; valueLabels: ChartElementSelection[]; onChange(config: ChartConfig): void }) {
  const [categoryKey, setCategoryKey] = useState('')
  const category = valueLabels.find((item) => item.key === categoryKey) ?? valueLabels[0]
  const labelStyle = category ? config.elementStyles[category.key] : undefined
  const patchLabel = (label: string) => category && onChange({ ...config, elementStyles: { ...config.elementStyles, [category.key]: { ...labelStyle, label: label || undefined, showLabel: true } } })
  const descriptionStyle = config.waffleDescriptionText ?? { ...config.valueText, size: Math.max(6, Math.round(config.valueText.size * .85)), weight: 400 }
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <details className="settings-group" open><summary>Сетка и подписи</summary><div>
    <label>Столбцов<NumberInput min="1" max="30" value={config.waffleColumns ?? 10} onValueChange={(waffleColumns) => patch({ waffleColumns })}/></label>
    <label>Рядов<NumberInput min="1" max="30" value={config.waffleRows ?? 10} onValueChange={(waffleRows) => patch({ waffleRows })}/></label>
    <label>Промежуток, px<NumberInput min="0" max="16" value={config.waffleGap ?? 4} onValueChange={(waffleGap) => patch({ waffleGap })}/></label>
    <label>Скругление, %<NumberInput min="0" max="50" value={config.waffleRadius ?? 0} onValueChange={(waffleRadius) => patch({ waffleRadius })}/></label>
    <label>Направление заполнения<select value={config.waffleFillDirection ?? 'bottom'} onChange={(event) => patch({ waffleFillDirection: event.target.value as ChartConfig['waffleFillDirection'] })}><option value="bottom">Снизу вверх</option><option value="top">Сверху вниз</option></select></label>
    <p className="settings-help">Вся сетка — 100% суммы. Число квадратов округляется; подписи показывают точные доли.</p>
    <SettingsCheckbox isSelected={config.showValues} onChange={(showValues) => patch({ showValues })}>Показывать подписи категорий</SettingsCheckbox>
    {config.showValues && <>
      <label>Расположение подписей<select value={config.waffleLabelPosition ?? 'right'} onChange={(event) => { const waffleLabelPosition = event.target.value as ChartConfig['waffleLabelPosition']; patch({ waffleLabelPosition, waffleLabelColor: config.waffleLabelColor ?? (waffleLabelPosition === 'inside' ? 'auto' : 'text'), ...(waffleLabelPosition === 'legend' ? { showLegend: true, legendPosition: 'top' as const } : {}) }) }}><option value="right">Текстовые блоки справа</option><option value="inside">Внутри цветных областей</option><option value="legend">Только легенда сверху</option></select></label>
      <label>Цвет подписей<select value={config.waffleLabelColor ?? 'text'} onChange={(event) => patch({ waffleLabelColor: event.target.value as ChartConfig['waffleLabelColor'] })}><option value="text">Из стиля текста</option><option value="category">Как у категории</option><option value="auto">Контрастный автоматически</option></select></label>
      {(config.waffleLabelPosition ?? 'right') === 'inside' && <SettingsCheckbox isSelected={config.waffleLabelBackground !== false} onChange={(waffleLabelBackground) => patch({ waffleLabelBackground })}>Подложка по силуэту букв</SettingsCheckbox>}
      <SettingsCheckbox isSelected={config.waffleShowValues !== false} onChange={(waffleShowValues) => patch({ waffleShowValues })}>Значение в подписи</SettingsCheckbox>
      <SettingsCheckbox isSelected={config.pieShowNames !== false} onChange={(pieShowNames) => patch({ pieShowNames })}>Название категории в подписи</SettingsCheckbox>
      <label>Значения в подписях<select value={config.pieValueFormat ?? 'percent'} onChange={(event) => patch({ pieValueFormat: event.target.value as ChartConfig['pieValueFormat'] })}><option value="percent">Доля от суммы, %</option><option value="absolute">Абсолютное значение</option><option value="both">Значение и доля, %</option></select></label>
      <TextStyleEditor label="Стиль заголовков и значений" value={config.valueText} customFonts={config.customFonts} onChange={(valueText) => patch({ valueText })}/>
      {(config.waffleLabelPosition ?? 'right') !== 'legend' && <>
        <TextStyleEditor label="Стиль пояснений" value={descriptionStyle} customFonts={config.customFonts} onChange={(waffleDescriptionText) => patch({ waffleDescriptionText })}/>
        {category && <>
          <label>Категория для подписи<select value={category.key} onChange={(event) => setCategoryKey(event.target.value)}>{valueLabels.map((item) => <option key={item.key} value={item.key}>{item.category}</option>)}</select></label>
          <label>Текст подписи<textarea rows={3} value={labelStyle?.label ?? ''} placeholder={`${category.category}\n${category.value}`} onChange={(event) => patchLabel(event.target.value)}/></label>
          <label>Пояснение<textarea rows={3} value={config.seriesStyles[category.seriesName]?.legendNote ?? ''} placeholder="Например, что входит в эту категорию. Enter — новая строка." onChange={(event) => patch({ seriesStyles: { ...config.seriesStyles, [category.seriesName]: { ...config.seriesStyles[category.seriesName], legendNote: event.target.value } } })}/></label>
        </>}
      </>}
    </>}
  </div></details>
}
