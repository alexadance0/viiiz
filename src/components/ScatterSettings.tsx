import type { ChartConfig } from '../core/types'
import type { DataTable } from '../core/types'
import { getSeriesColor } from '../core/chartRegistry'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import './ScatterSettings.css'

interface Props {
  config: ChartConfig
  columns: string[]
  numericColumns: string[]
  table: DataTable
  onChange(config: ChartConfig): void
}

const lineTypes = <><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></>

export function ScatterSettings({ config, columns, numericColumns, table, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const patchSeries = (name: string, values: Partial<ChartConfig['seriesStyles'][string]>) => patch({ seriesStyles: { ...config.seriesStyles, [name]: { ...config.seriesStyles[name], ...values } } })
  const yFields = config.yFields.length ? config.yFields : [config.yField]
  const colorGroups = config.scatterColorField ? [...new Set(table.rows.map((row) => String(row[config.scatterColorField!] ?? 'Без категории')))] : ['']
  const scatterSeries = yFields.flatMap((field) => colorGroups.map((group) => config.scatterColorField ? (yFields.length === 1 ? group : `${field} · ${group}`) : field))
  const optionalNumber = (key: 'scatterXReference' | 'scatterYReference', value: number | null | undefined) =>
    <input type="number" value={value ?? ''} placeholder="Не задано" onChange={(event) => patch({ [key]: event.target.value === '' ? null : Number(event.target.value) })}/>

  return <details className="settings-group scatter-settings" open>
    <summary>Точки и зависимости</summary>
    <div>
      <p className="scatter-settings__intro">Кодируйте дополнительное измерение размером или цветом, подписывайте важные объекты и добавляйте ориентиры.</p>
      <fieldset><legend>Точки</legend>
        {config.kind === 'bubble' ? <><label>Размер по данным<select value={config.scatterSizeField ?? ''} onChange={(event) => patch({ scatterSizeField: event.target.value })}><option value="">Выберите показатель…</option>{numericColumns.filter((column) => column !== config.xField && !config.yFields.includes(column)).map((column) => <option key={column}>{column}</option>)}</select></label><div className="settings-pair"><label>Минимум, px<NumberInput min="2" max="80" value={config.scatterSizeMin ?? 6} onValueChange={(value) => patch({ scatterSizeMin: value })}/></label><label>Максимум, px<NumberInput min="4" max="120" value={config.scatterSizeMax ?? 42} onValueChange={(value) => patch({ scatterSizeMax: value })}/></label></div><label className="check"><input type="checkbox" checked={config.scatterSizeLegend !== false} onChange={(event) => patch({ scatterSizeLegend: event.target.checked })}/>Легенда размеров</label>{config.scatterSizeLegend !== false && <><label>Заголовок легенды<input value={config.scatterSizeLegendTitle ?? ''} placeholder={config.scatterSizeField || 'Размер'} onChange={(event) => patch({ scatterSizeLegendTitle: event.target.value })}/></label><label>Положение легенды<select value={config.scatterSizeLegendPosition ?? 'top-left'} onChange={(event) => patch({ scatterSizeLegendPosition: event.target.value as ChartConfig['scatterSizeLegendPosition'] })}><option value="top-left">Сверху слева</option><option value="top-right">Сверху справа</option><option value="bottom-left">Снизу слева</option><option value="bottom-right">Снизу справа</option></select></label></>}</> : <label>Диаметр точек, px<NumberInput min="2" max="80" value={config.scatterPointSize ?? 10} onValueChange={(value) => patch({ scatterPointSize: value })}/></label>}
        <label>Группировать цветом<select value={config.scatterColorField ?? ''} onChange={(event) => patch({ scatterColorField: event.target.value })}><option value="">Один цвет / ряды</option>{columns.filter((column) => column !== config.xField && !config.yFields.includes(column)).map((column) => <option key={column}>{column}</option>)}</select></label>
        <div className="settings-pair"><label>Прозрачность, %<NumberInput min="5" max="100" value={Math.round((config.scatterOpacity ?? .78) * 100)} onValueChange={(value) => patch({ scatterOpacity: value / 100 })}/></label><label>Рамка, px<NumberInput min="0" max="8" step="0.5" value={config.scatterBorderWidth ?? 1} onValueChange={(value) => patch({ scatterBorderWidth: value })}/></label></div>
        <label className="check"><input type="checkbox" checked={config.scatterHollow ?? false} onChange={(event) => patch({ scatterHollow: event.target.checked })}/>Полые маркеры</label>
      </fieldset>
      <fieldset><legend>Подписи точек</legend>
        <label>Текст из столбца<select value={config.scatterLabelField ?? ''} onChange={(event) => patch({ scatterLabelField: event.target.value })}><option value="">Значение Y</option>{columns.map((column) => <option key={column}>{column}</option>)}</select></label>
        <div className="settings-pair settings-pair--toggle"><label className="check"><input type="checkbox" checked={config.scatterShowLabels ?? false} onChange={(event) => patch({ scatterShowLabels: event.target.checked })}/>Показывать</label><label>Положение<select value={config.scatterLabelPosition ?? 'right'} onChange={(event) => patch({ scatterLabelPosition: event.target.value as ChartConfig['scatterLabelPosition'] })}><option value="top">Сверху</option><option value="right">Справа</option><option value="bottom">Снизу</option><option value="left">Слева</option></select></label></div>
      </fieldset>
      <fieldset><legend>Линии сравнения и квадранты</legend>
        <div className="settings-pair"><label>Значение X{optionalNumber('scatterXReference', config.scatterXReference)}</label><label>Значение Y{optionalNumber('scatterYReference', config.scatterYReference)}</label></div>
        <div className="settings-pair"><label>Цвет<ColorControl value={config.scatterReferenceColor ?? '#8a8791'} onChange={(scatterReferenceColor) => patch({ scatterReferenceColor })}/></label><label>Тип<select value={config.scatterReferenceType ?? 'dashed'} onChange={(event) => patch({ scatterReferenceType: event.target.value as ChartConfig['scatterReferenceType'] })}>{lineTypes}</select></label></div>
        <label>Толщина, px<NumberInput min="0.5" max="8" step="0.5" value={config.scatterReferenceWidth ?? 1.5} onValueChange={(value) => patch({ scatterReferenceWidth: value })}/></label>
        <label className="check"><input type="checkbox" checked={config.scatterQuadrants ?? false} onChange={(event) => patch({ scatterQuadrants: event.target.checked })}/>Подсветить квадранты</label>
        {config.scatterQuadrants && <div className="quadrant-colors" aria-label="Цвета квадрантов">{(config.scatterQuadrantColors ?? ['#dfeee8','#e7eef8','#f8e5e3','#f2eadb']).map((color, index) => <label key={index}><span>{['↖','↗','↘','↙'][index]}</span><ColorControl compact value={color} onChange={(next) => { const colors = [...(config.scatterQuadrantColors ?? ['#dfeee8','#e7eef8','#f8e5e3','#f2eadb'])] as [string,string,string,string]; colors[index] = next; patch({ scatterQuadrantColors: colors }) }}/></label>)}</div>}
        {config.scatterQuadrants && <div className="quadrant-labels">{(config.scatterQuadrantLabels ?? ['', '', '', '']).map((label, index) => <label key={index}>{['Сверху слева','Сверху справа','Снизу справа','Снизу слева'][index]}<input value={label} placeholder="Без подписи" onChange={(event) => { const labels = [...(config.scatterQuadrantLabels ?? ['', '', '', ''])] as [string,string,string,string]; labels[index] = event.target.value; patch({ scatterQuadrantLabels: labels }) }}/></label>)}</div>}
        <label className="check"><input type="checkbox" checked={config.scatterDiagonal ?? false} onChange={(event) => patch({ scatterDiagonal: event.target.checked })}/>Диагональ равенства X = Y</label>
        {config.scatterDiagonal && <div className="settings-pair"><label>Цвет диагонали<ColorControl value={config.scatterDiagonalColor ?? '#8a8791'} onChange={(scatterDiagonalColor) => patch({ scatterDiagonalColor })}/></label><label>Тип<select value={config.scatterDiagonalType ?? 'dashed'} onChange={(event) => patch({ scatterDiagonalType: event.target.value as ChartConfig['scatterDiagonalType'] })}>{lineTypes}</select></label></div>}
      </fieldset>
      <fieldset><legend>Заголовки осей</legend><label>Расположение<select value={config.axisTitleMode ?? 'standard'} onChange={(event) => patch({ axisTitleMode: event.target.value as ChartConfig['axisTitleMode'] })}><option value="standard">Классическое</option><option value="editorial">Редакционное — у краёв со стрелками</option></select></label></fieldset>
      <fieldset><legend>Линейный тренд</legend>
        <label className="check"><input type="checkbox" checked={config.scatterTrendline ?? false} onChange={(event) => patch({ scatterTrendline: event.target.checked })}/>Показать линию тренда</label>
        {config.scatterTrendline && <><div className="settings-pair"><label>Цвет<ColorControl value={config.scatterTrendColor ?? '#77727f'} onChange={(scatterTrendColor) => patch({ scatterTrendColor })}/></label><label>Тип<select value={config.scatterTrendType ?? 'dashed'} onChange={(event) => patch({ scatterTrendType: event.target.value as ChartConfig['scatterTrendType'] })}>{lineTypes}</select></label></div><label>Толщина, px<NumberInput min="0.5" max="8" step="0.5" value={config.scatterTrendWidth ?? 2} onValueChange={(value) => patch({ scatterTrendWidth: value })}/></label><label className="check"><input type="checkbox" checked={config.scatterTrendBand ?? false} onChange={(event) => patch({ scatterTrendBand: event.target.checked })}/>Доверительная полоса 95%</label>{config.scatterTrendBand && <label>Прозрачность полосы, %<NumberInput min="2" max="60" value={Math.round((config.scatterTrendBandOpacity ?? .12) * 100)} onValueChange={(value) => patch({ scatterTrendBandOpacity: value / 100 })}/></label>}</>}
        {scatterSeries.length > 1 && <div className="scatter-series-trends">{scatterSeries.map((name, index) => { const style = config.seriesStyles[name] ?? {}; const color = style.color ?? getSeriesColor(config, name, index); return <div key={name} className="scatter-series-trend"><strong><i style={{ background: color }}/>{name}</strong><div className="settings-pair"><label>Цвет ряда<ColorControl value={color} onChange={(nextColor) => patchSeries(name, { color: nextColor })}/></label><label>Размер, px<NumberInput min="2" max="80" value={style.markerSize ?? config.scatterPointSize ?? 10} onValueChange={(markerSize) => patchSeries(name, { markerSize })}/></label></div><label className="check"><input type="checkbox" checked={style.scatterTrendline ?? false} onChange={(event) => patchSeries(name, { scatterTrendline: event.target.checked })}/>Тренд ряда</label>{style.scatterTrendline && <><label className="check"><input type="checkbox" checked={style.scatterTrendBand ?? false} onChange={(event) => patchSeries(name, { scatterTrendBand: event.target.checked })}/>Интервал</label><div className="settings-pair"><label>Цвет тренда<ColorControl value={style.scatterTrendColor ?? color} onChange={(scatterTrendColor) => patchSeries(name, { scatterTrendColor })}/></label><label>Тип<select value={style.scatterTrendType ?? config.scatterTrendType ?? 'dashed'} onChange={(event) => patchSeries(name, { scatterTrendType: event.target.value as ChartConfig['scatterTrendType'] })}>{lineTypes}</select></label></div></>}</div> })}</div>}
      </fieldset>
    </div>
  </details>
}
