import type { MarkerShape, MarkerStyle } from '../core/types'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'

interface Props {
  value: MarkerStyle & { fillOpacity?: number }
  lineColor: string
  onChange(values: Partial<MarkerStyle & { fillOpacity?: number }>): void
  individual?: boolean
  alwaysVisible?: boolean
  defaultSize?: number
  defaultVisible?: boolean
  defaultBorderWidth?: number
  showSize?: boolean
}

export function MarkerSettings({ value, lineColor, onChange, individual = false, alwaysVisible = false, defaultSize = 8, defaultVisible = false, defaultBorderWidth = 2, showSize = true }: Props) {
  const shown = alwaysVisible || (value.showMarker ?? defaultVisible)
  const fill = value.markerFill ?? (alwaysVisible ? lineColor : '#ffffff')
  const border = value.markerBorder ?? lineColor
  return <div className="marker-settings">
    {!alwaysVisible && <SettingsCheckbox isSelected={shown} onChange={(showMarker) => onChange({ showMarker })}>{individual ? 'Показывать маркер' : 'Показывать маркеры'}</SettingsCheckbox>}
    {shown && <>
      <label>Форма<select value={value.markerShape ?? 'circle'} onChange={(event) => onChange({ markerShape: event.target.value as MarkerShape })}><option value="circle">Круг</option><option value="rect">Квадрат</option><option value="roundRect">Скруглённый квадрат</option><option value="triangle">Треугольник</option><option value="diamond">Ромб</option></select></label>
      {showSize && <label>Размер, px<NumberInput min="2" max="80" value={value.markerSize ?? defaultSize} onValueChange={(markerSize) => onChange({ markerSize })}/></label>}
      <label>Заливка<ColorControl value={fill} onChange={(markerFill) => onChange({ markerFill })}/></label>
      <label>Рамка<ColorControl value={border} onChange={(markerBorder) => onChange({ markerBorder })}/></label>
      <label>Толщина рамки, px<NumberInput min="0" max="10" step="0.5" value={value.markerBorderWidth ?? defaultBorderWidth} onValueChange={(markerBorderWidth) => onChange({ markerBorderWidth })}/></label>
      <label>Прозрачность, %<NumberInput min="5" max="100" value={Math.round((value.fillOpacity ?? 1) * 100)} onValueChange={(fillOpacity) => onChange({ fillOpacity: fillOpacity / 100 })}/></label>
    </>}
  </div>
}
