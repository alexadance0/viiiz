import type { ChartConfig, ChartElementSelection, ChartSeriesSelection } from '../core/types'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { BarBorderFields } from './BarAppearanceSettings'

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
  const borderColor = values.borderColor ?? inherited.borderColor ?? config.barBorderColor ?? fillColor
  return <fieldset className="bar-selection-fields"><legend>Столбцы</legend><label>Заливка<ColorControl value={fillColor} code={values.color ?? color ?? (element && inherited.color ? 'Из стиля ряда' : 'Из палитры')} onChange={(color) => change({ color })}/></label><label>Прозрачность заливки, %<NumberInput min="0" max="100" step="5" value={Math.round((values.fillOpacity ?? inherited.fillOpacity ?? config.barFillOpacity ?? 1) * 100)} onValueChange={(value) => change({ fillOpacity: value / 100 })}/></label><BarBorderFields width={values.borderWidth ?? inherited.borderWidth ?? config.barBorderWidth ?? 0} color={borderColor} inherited={!values.borderColor && !inherited.borderColor && !config.barBorderColor} onWidth={(borderWidth) => change({ borderWidth })} onColor={(borderColor) => change({ borderColor })}/>{config.kind !== 'marimekko' && <label>Ширина, %<NumberInput min="10" max="200" step="5" value={values.barWidth ?? inherited.barWidth ?? 100} onValueChange={(barWidth) => change({ barWidth })}/><small>{element ? '100% — стандартная ширина столбца этого ряда.' : '100% — автоматическая ширина ряда.'}</small></label>}</fieldset>
}
