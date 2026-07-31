import type { ChartConfig, ChartElementSelection, ChartSeriesSelection } from '../core/types'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'

interface Props {
  config: ChartConfig
  element: ChartElementSelection | null
  series: ChartSeriesSelection | null
  color?: string
  onElementChange(values: Partial<ChartConfig['elementStyles'][string]>): void
  onSeriesChange(values: Partial<ChartConfig['seriesStyles'][string]>): void
}

export function BarSelectionControls({ config, element, series, color, onElementChange, onSeriesChange }: Props) {
  if (!element && !series) return null
  const values = element ? config.elementStyles[element.key] ?? {} : config.seriesStyles[series!.name] ?? {}
  const change = element ? onElementChange : onSeriesChange
  const seriesName = element?.seriesName ?? series!.name
  const inherited = config.seriesStyles[seriesName] ?? {}
  const fillColor = values.color ?? color ?? inherited.color ?? series?.color ?? config.color
  const borderColor = values.borderColor ?? inherited.borderColor ?? fillColor
  return <section className="element-editor bar-selection-editor"><div><div className="selection-subtitle">Столбцы</div><label>Заливка<ColorControl value={fillColor} code={values.color ?? color ?? (element && inherited.color ? 'Из стиля ряда' : 'Из палитры')} onChange={(color) => change({ color })}/></label><label>Прозрачность заливки, %<NumberInput min="0" max="100" step="5" value={Math.round((values.fillOpacity ?? inherited.fillOpacity ?? config.barFillOpacity ?? 1) * 100)} onValueChange={(value) => change({ fillOpacity: value / 100 })}/></label><label>Цвет рамки<ColorControl value={borderColor} code={values.borderColor ?? (element && inherited.borderColor ? 'Из стиля ряда' : 'Как заливка')} onChange={(borderColor) => change({ borderColor })}/></label><label>Толщина рамки, px<NumberInput min="0" max="12" step="0.5" value={values.borderWidth ?? inherited.borderWidth ?? config.barBorderWidth ?? 0} onValueChange={(borderWidth) => change({ borderWidth })}/></label><label>Ширина, %<NumberInput min="10" max="200" step="5" value={values.barWidth ?? inherited.barWidth ?? 100} onValueChange={(barWidth) => change({ barWidth })}/><small>{element ? '100% — стандартная ширина столбца этого ряда.' : '100% — автоматическая ширина ряда.'}</small></label></div></section>
}
