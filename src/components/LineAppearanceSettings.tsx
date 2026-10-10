import { useState } from 'react'
import type { ChartConfig, ChartSeriesStyle } from '../core/types'
import { getSeriesColor } from '../core/seriesColor'
import { MarkerSettings } from './MarkerSettings'
import { NumberInput } from './NumberInput'

export function LineAppearanceFields({ config, name, color, onChange }: { config: ChartConfig; name: string; color: string; onChange(values: Partial<ChartSeriesStyle>): void }) {
  const style = config.seriesStyles[name] ?? {}
  const connected = config.kind === 'connected-scatter'
  return <>
    <label>Толщина линии, px<NumberInput min="0.5" max="12" step="0.5" value={style.lineWidth ?? (connected ? config.scatterConnectionWidth ?? 2 : config.kind === 'slope' ? 2.5 : 3)} onValueChange={(lineWidth) => onChange({ lineWidth })}/></label>
    <label>Тип линии<select value={style.lineType ?? (connected ? config.scatterConnectionType ?? 'solid' : 'solid')} onChange={(event) => onChange({ lineType: event.target.value as ChartSeriesStyle['lineType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label>
    <MarkerSettings value={connected ? { markerBorderWidth: config.scatterBorderWidth ?? 1, fillOpacity: config.scatterOpacity ?? .78, ...style, ...(config.scatterHollow && !style.markerFill ? { markerFill: 'transparent' } : {}) } : style} lineColor={style.color ?? color} onChange={onChange} defaultVisible={config.kind === 'bump'} alwaysVisible={connected || config.kind === 'slope' || config.kind === 'moving-average-scatter'} defaultSize={connected ? config.scatterPointSize ?? 10 : config.kind === 'slope' ? 11 : config.kind === 'moving-average-scatter' ? 7 : 8}/>
  </>
}

export function LineAppearanceSettings({ config, names, onChange }: { config: ChartConfig; names: string[]; onChange(config: ChartConfig): void }) {
  const [requestedName, setRequestedName] = useState('')
  const name = names.includes(requestedName) ? requestedName : names[0] ?? config.yField
  return <details className="settings-group line-appearance-settings"><summary>Линия и маркеры</summary><div>
    {names.length > 1 && <label>Ряд<select value={name} onChange={(event) => setRequestedName(event.target.value)}>{names.map((name) => <option key={name}>{name}</option>)}</select></label>}
    <LineAppearanceFields config={config} name={name} color={getSeriesColor(config, name, Math.max(0, names.indexOf(name)))} onChange={(values) => onChange({ ...config, seriesStyles: { ...config.seriesStyles, [name]: { ...config.seriesStyles[name], ...values } } })}/>
  </div></details>
}
