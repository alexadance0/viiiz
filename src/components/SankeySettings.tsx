import type { ChartConfig } from '../core/types'
import { ColorControl } from './PickerControls'
import { NumberInput } from './NumberInput'
import { SettingsCheckbox } from './SettingsCheckbox'
import { TextStyleEditor } from './TextStyleEditor'

export function SankeySettings({ config, onChange }: { config: ChartConfig; onChange(config: ChartConfig): void }) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  return <details className="settings-group" open><summary>Потоки и подписи</summary><div>
    <label>Ширина узлов, px<NumberInput min="1" max="40" value={config.sankeyNodeWidth ?? 10} onValueChange={(sankeyNodeWidth) => patch({ sankeyNodeWidth })}/></label>
    <label>Промежуток между узлами, px<NumberInput min="0" max="100" value={config.sankeyNodeGap ?? 24} onValueChange={(sankeyNodeGap) => patch({ sankeyNodeGap })}/></label>
    <label>Конечные узлы<select value={config.sankeyNodeAlign ?? 'left'} onChange={(event) => patch({ sankeyNodeAlign: event.target.value as ChartConfig['sankeyNodeAlign'] })}><option value="left">На своём этапе</option><option value="justify">На последнем этапе</option></select></label>
    <label>Цвет потоков<select value={config.sankeyLinkColor ?? 'source'} onChange={(event) => patch({ sankeyLinkColor: event.target.value as ChartConfig['sankeyLinkColor'] })}><option value="source">Как у начального узла</option><option value="target">Как у конечного узла</option><option value="single">Единый цвет</option></select></label>
    {config.sankeyLinkColor === 'single' && <label>Единый цвет потоков<ColorControl value={config.color} swatches={config.palette} onChange={(color) => patch({ color })}/></label>}
    <label>Непрозрачность потоков, %<NumberInput min="0" max="100" value={Math.round((config.sankeyLinkOpacity ?? .45) * 100)} onValueChange={(value) => patch({ sankeyLinkOpacity: value / 100 })}/></label>
    <label>Кривизна потоков, %<NumberInput min="0" max="100" value={Math.round((config.sankeyCurvature ?? .5) * 100)} onValueChange={(value) => patch({ sankeyCurvature: value / 100 })}/></label>
    <SettingsCheckbox isSelected={config.sankeyShowNames ?? true} onChange={(sankeyShowNames) => patch({ sankeyShowNames })}>Показывать названия узлов</SettingsCheckbox>
    <SettingsCheckbox isSelected={config.showValues} onChange={(showValues) => patch({ showValues })}>Показывать значения узлов</SettingsCheckbox>
    <label>Значения в подписях<select value={config.sankeyValueFormat ?? 'absolute'} onChange={(event) => patch({ sankeyValueFormat: event.target.value as ChartConfig['sankeyValueFormat'] })}><option value="absolute">Значение</option><option value="percent">Доля от общего потока, %</option><option value="both">Значение и доля, %</option></select></label>
    {config.sankeyValueFormat && config.sankeyValueFormat !== 'absolute' && <label>Основа долей<select value={config.sankeyPercentBase ?? 'total'} onChange={(event) => patch({ sankeyPercentBase: event.target.value as ChartConfig['sankeyPercentBase'] })}><option value="total">Весь начальный поток</option><option value="parent">Поток предыдущих узлов</option></select></label>}
    <small>Общий поток — сумма исходящих связей начальных узлов. На промежуточных этапах он не суммируется повторно. Значение узла — большая из сумм входящих и исходящих потоков.</small>
    <label>Расположение подписей<select value={config.sankeyLabelPosition ?? 'outside'} onChange={(event) => patch({ sankeyLabelPosition: event.target.value as ChartConfig['sankeyLabelPosition'] })}><option value="outside">Снаружи у крайних узлов</option><option value="inside">Внутри потоков</option></select></label>
    <SettingsCheckbox isSelected={config.sankeyCompactLabels ?? false} onChange={(sankeyCompactLabels) => patch({ sankeyCompactLabels })}>Компактные подписи конечных узлов</SettingsCheckbox>
    <SettingsCheckbox isSelected={config.sankeyLabelColorByCategory ?? false} onChange={(sankeyLabelColorByCategory) => patch({ sankeyLabelColorByCategory })}>Цвет подписей как у узлов</SettingsCheckbox>
    <TextStyleEditor label="Стиль подписей" value={config.valueText} customFonts={config.customFonts} onChange={(valueText) => patch({ valueText })}/>
    <small>Нажмите на узел или поток, чтобы изменить его цвет. У узлов можно изменить текст подписи; Enter добавляет перенос строки.</small>
  </div></details>
}
