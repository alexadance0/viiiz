import type { MarkerShape, MarkerStyle } from '../core/types'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'

interface Props {
  value: MarkerStyle & { fillOpacity?: number }
  lineColor: string
  onChange(values: Partial<MarkerStyle & { fillOpacity?: number }>): void
  individual?: boolean
  alwaysVisible?: boolean
}

export function MarkerSettings({ value, lineColor, onChange, individual = false, alwaysVisible = false }: Props) {
  const shown = alwaysVisible || individual || (value.showMarker ?? false)
  const fill = value.markerFill ?? '#ffffff'
  const border = value.markerBorder ?? lineColor
  return <div className="marker-settings">
    {!alwaysVisible && !individual && <label className="check"><input type="checkbox" checked={shown} onChange={(event) => onChange({ showMarker: event.target.checked })}/>Показывать маркеры</label>}
    {shown && <>
      <label>Форма<select value={value.markerShape ?? 'circle'} onChange={(event) => onChange({ markerShape: event.target.value as MarkerShape })}><option value="circle">Круг</option><option value="rect">Квадрат</option><option value="roundRect">Скруглённый квадрат</option><option value="triangle">Треугольник</option><option value="diamond">Ромб</option></select></label>
      <label>Размер, px<NumberInput min="2" max="40" value={value.markerSize ?? 8} onValueChange={(markerSize) => onChange({ markerSize })}/></label>
      <label>Заливка<ColorControl value={fill} onChange={(markerFill) => onChange({ markerFill })}/></label>
      <label>Рамка<ColorControl value={border} onChange={(markerBorder) => onChange({ markerBorder })}/></label>
      <label>Толщина рамки, px<NumberInput min="0" max="10" step="0.5" value={value.markerBorderWidth ?? 2} onValueChange={(markerBorderWidth) => onChange({ markerBorderWidth })}/></label>
      <label>Прозрачность, %<NumberInput min="5" max="100" value={Math.round((value.fillOpacity ?? 1) * 100)} onValueChange={(fillOpacity) => onChange({ fillOpacity: fillOpacity / 100 })}/></label>
    </>}
  </div>
}
