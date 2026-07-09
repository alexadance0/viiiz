import type { ChartConfig, ChartElementSelection } from '../core/types'
import { StyleTransferActions } from './StyleTransferActions'
import { TextStyleEditor } from './TextStyleEditor'

interface Props {
  config: ChartConfig
  element: ChartElementSelection
  canPaste: boolean
  onCopy(): void
  onPaste(): void
  onChange(values: Partial<ChartConfig['elementStyles'][string]>): void
  onClose(): void
}

export function ValueLabelSelectionControls({ config, element, canPaste, onCopy, onPaste, onChange, onClose }: Props) {
  const override = config.elementStyles[element.key]
  return <section className="element-editor value-label-editor"><header><div><span>Выбрана подпись значения</span><strong>{override?.label || element.value}</strong><small>{element.seriesName} · {element.category}</small></div><button onClick={onClose}>×</button></header><div>
    <TextStyleEditor label="Стиль этой подписи" value={override?.valueText ?? config.valueText} customFonts={config.customFonts} onChange={(valueText) => onChange({ valueText, showLabel: true })} align/>
    <label>Текст подписи<input className="text-input" value={override?.label ?? ''} onChange={(event) => onChange({ label: event.target.value, showLabel: true })} placeholder={element.value}/></label>
    <StyleTransferActions canPaste={canPaste} onCopy={onCopy} onPaste={onPaste}/>
    <button className="reset-element" onClick={() => onChange({ valueText: undefined, label: undefined })}>Вернуть общий стиль подписи</button>
  </div></section>
}
