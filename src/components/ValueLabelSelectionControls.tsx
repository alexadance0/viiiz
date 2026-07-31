import type { ChartConfig, ChartElementSelection } from '../core/types'
import { isDistributionChart } from '../core/chartKinds'
import { StyleTransferActions } from './StyleTransferActions'
import { TextStyleEditor } from './TextStyleEditor'
import { SettingsCheckbox } from './SettingsCheckbox'
import { ColorControl } from './PickerControls'

interface Props {
  config: ChartConfig
  element: ChartElementSelection
  canPaste: boolean
  onCopy(): void
  onPaste(): void
  onChange(values: Partial<ChartConfig['elementStyles'][string]>): void
  onClose(): void
  color?: string
  swatches?: string[]
  onReset?(): void
}

interface FieldsProps {
  config: ChartConfig
  element: ChartElementSelection
  onChange(values: Partial<ChartConfig['elementStyles'][string]>): void
}

export function ValueLabelFields({ config, element, onChange }: FieldsProps) {
  const override = config.elementStyles[element.key]
  const treemap = config.kind === 'treemap'
  const waterfall = config.kind === 'waterfall'
  const treemapGroup = treemap && element.key.startsWith('treemap-group:')
  const pointChart = config.kind === 'scatter' || config.kind === 'bubble' || isDistributionChart(config.kind)
  const globallyVisible = config.kind === 'scatter' || config.kind === 'bubble' ? config.scatterShowLabels ?? config.showValues : pointChart ? config.distributionShowLabels ?? false : config.showValues
  const globalPosition = config.kind === 'scatter' || config.kind === 'bubble' ? config.scatterLabelPosition ?? 'right' : config.distributionLabelPosition ?? ((config.distributionOrientation ?? 'horizontal') === 'horizontal' ? 'right' : 'top')
  return <>
    {treemap ? <>
      <SettingsCheckbox isSelected={override?.showName ?? (treemapGroup ? config.treemapShowGroupLabels ?? true : config.treemapShowLeafLabels ?? true)} onChange={(showName) => onChange({ showName, ...(!showName ? { showValue: false } : {}) })}>Показывать название</SettingsCheckbox>
      <SettingsCheckbox isSelected={override?.showValue ?? (treemapGroup ? config.treemapShowGroupValues ?? config.showValues : config.treemapShowLeafValues ?? config.showValues)} onChange={(showValue) => onChange({ showValue })}>Показывать значение</SettingsCheckbox>
    </> : <SettingsCheckbox isSelected={override?.showLabel ?? globallyVisible} onChange={(showLabel) => onChange({ showLabel })}>Показывать подпись</SettingsCheckbox>}
    <TextStyleEditor label="Стиль этой подписи" value={override?.valueText ?? (treemap ? treemapGroup ? config.treemapGroupText ?? config.valueText : config.treemapLeafText ?? config.valueText : config.valueText)} customFonts={config.customFonts} onChange={(valueText) => onChange({ valueText, showLabel: true })} align={!pointChart && !waterfall}/>
    <label>Текст подписи<input className="text-input" value={override?.label ?? ''} onChange={(event) => onChange({ label: event.target.value, showLabel: true, ...(treemap ? { showName: true } : {}) })} placeholder={element.label ?? element.value}/></label>
    {waterfall && <label>Положение<select value={override?.waterfallLabelPosition ?? config.valueLabelPosition ?? 'auto'} onChange={(event) => onChange({ waterfallLabelPosition: event.target.value as NonNullable<ChartConfig['valueLabelPosition']>, showLabel: true })}><option value="auto">Автоматически</option><option value="top">Снаружи у нового итога</option><option value="inside-top">Внутри у нового итога</option><option value="inside-center">Внутри по центру</option><option value="inside-bottom">Внутри у предыдущего итога</option><option value="bottom">Снаружи у предыдущего итога</option></select></label>}
    {pointChart && <label>Положение<select value={override?.labelPosition ?? globalPosition} onChange={(event) => onChange({ labelPosition: event.target.value as NonNullable<ChartConfig['elementStyles'][string]['labelPosition']>, showLabel: true })}><option value="top">Сверху</option><option value="right">Справа</option><option value="bottom">Снизу</option><option value="left">Слева</option></select></label>}
    {treemap && <label>Положение<select value={override?.treemapLabelPosition ?? (treemapGroup ? config.treemapGroupLabelPosition ?? 'top-left' : config.treemapLabelPosition ?? 'bottom-right')} onChange={(event) => onChange({ treemapLabelPosition: event.target.value as NonNullable<ChartConfig['treemapLabelPosition']> })}>
      <option value="top-left">Сверху слева</option><option value="top-center">Сверху по центру</option><option value="top-right">Сверху справа</option>
      <option value="center-left">По центру слева</option><option value="center">По центру</option><option value="center-right">По центру справа</option>
      <option value="bottom-left">Снизу слева</option><option value="bottom-center">Снизу по центру</option><option value="bottom-right">Снизу справа</option>
    </select></label>}
    {treemap && <SettingsCheckbox isSelected={override?.labelAutoContrast ?? config.valueLabelAutoContrast ?? true} onChange={(labelAutoContrast) => onChange({ labelAutoContrast })}>Автоматический контраст</SettingsCheckbox>}
  </>
}

export function ValueLabelSelectionControls({ config, element, canPaste, onCopy, onPaste, onChange, onClose, color, swatches, onReset }: Props) {
  const override = config.elementStyles[element.key]
  const treemap = config.kind === 'treemap'
  const treemapGroup = treemap && element.key.startsWith('treemap-group:')
  return <section className="element-editor value-label-editor"><header><div><span>{treemap ? treemapGroup ? 'Выбрана общая категория' : 'Выбран блок' : 'Выбрана подпись значения'}</span><strong>{override?.label || element.label || element.value}</strong><small>{element.seriesName} · {element.category}</small></div><button onClick={onClose}>×</button></header><div>
    {treemap && color && <label>{treemapGroup ? 'Цвет категории' : 'Цвет блока'}<ColorControl value={color} swatches={swatches} onChange={(next) => onChange({ color: next })}/></label>}
    <ValueLabelFields config={config} element={element} onChange={onChange}/>
    <StyleTransferActions canPaste={canPaste} onCopy={onCopy} onPaste={onPaste}/>
    <button className="reset-element" onClick={onReset ?? (() => onChange({ valueText: undefined, label: undefined, labelPosition: undefined, waterfallLabelPosition: undefined, treemapLabelPosition: undefined, showLabel: undefined, showName: undefined, showValue: undefined, labelAutoContrast: undefined }))}>{treemap ? 'Сбросить настройки элемента' : 'Вернуть общие настройки подписи'}</button>
  </div></section>
}
