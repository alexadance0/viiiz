import type { ChartConfig } from '../core/types'
import type { DataTable } from '../core/types'
import { getSeriesColor } from '../core/chartRegistry'
import { NumberInput, OptionalNumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'
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
  const automaticLabelField = columns.find((column) => column !== config.xField && !yFields.includes(column) && column !== config.scatterSizeField && column !== config.scatterColorField && table.rows.some((row) => typeof row[column] === 'string' && String(row[column]).trim()))
  const validRows = table.rows.filter((row) => {
    const x = row[config.xField]
    return ((typeof x === 'number' && Number.isFinite(x)) || (x instanceof Date && !Number.isNaN(x.getTime()))) && yFields.some((field) => typeof row[field] === 'number' && Number.isFinite(row[field] as number))
  })
  const colorGroups = config.scatterColorField ? [...new Set(validRows.map((row) => String(row[config.scatterColorField!] ?? 'Без категории')))] : ['']
  const quadrantsReady = Number.isFinite(config.scatterXReference) && Number.isFinite(config.scatterYReference)
  const categoryColumns = columns.filter((column) => column !== config.xField && !yFields.includes(column) && column !== config.scatterSizeField)
  const scatterSeries = yFields.flatMap((field, fieldIndex) => colorGroups.map((group, groupIndex) => ({
    name: config.scatterColorField ? (yFields.length === 1 ? group : `${field} · ${group}`) : field,
    colorKey: config.scatterColorField ? group : field,
    colorIndex: config.scatterColorField ? groupIndex : fieldIndex,
  })))
  return <details className="settings-group scatter-settings" open>
    <summary>Точки и зависимости</summary>
    <div>
      <p className="scatter-settings__intro">Кодируйте дополнительное измерение размером или цветом, подписывайте важные объекты и добавляйте ориентиры.</p>
      <fieldset><legend>Точки</legend>
        {config.kind === 'bubble' ? <>
          <label>Размер по данным<select value={config.scatterSizeField ?? ''} onChange={(event) => patch({ scatterSizeField: event.target.value })}><option value="">Выберите показатель…</option>{numericColumns.filter((column) => column !== config.xField && !config.yFields.includes(column)).map((column) => <option key={column}>{column}</option>)}</select></label>
          <div className="settings-pair"><label>Минимум, px<NumberInput min="2" max="80" value={config.scatterSizeMin ?? 6} onValueChange={(value) => patch({ scatterSizeMin: value })}/></label><label>Максимум, px<NumberInput min="4" max="120" value={config.scatterSizeMax ?? 42} onValueChange={(value) => patch({ scatterSizeMax: value })}/></label></div>
        </> : <label>Диаметр точек, px<NumberInput min="2" max="80" value={config.scatterPointSize ?? 10} onValueChange={(value) => patch({ scatterPointSize: value })}/></label>}
        <label>Категория цвета<select value={config.scatterColorField ?? ''} onChange={(event) => { const scatterColorField = event.target.value || undefined; patch({ scatterColorField, ...(scatterColorField ? { showLegend: true } : {}) }) }}><option value="">Один цвет / ряды</option>{categoryColumns.map((column) => <option key={column}>{column}</option>)}</select></label>
        {config.scatterColorField && <div className="scatter-category-colors"><span>Цвета категорий</span>{colorGroups.map((group, index) => { const color = config.seriesStyles[group]?.color ?? getSeriesColor(config, group, index); return <div className="scatter-category-color" key={group}><strong><i style={{ background: color }}/>{group}</strong><ColorControl compact title={`Цвет категории ${group}`} value={color} onChange={(nextColor) => patchSeries(group, { color: nextColor })}/></div> })}</div>}
        <div className="settings-pair"><label>Прозрачность, %<NumberInput min="5" max="100" value={Math.round((config.scatterOpacity ?? .78) * 100)} onValueChange={(value) => patch({ scatterOpacity: value / 100 })}/></label><label>Рамка, px<NumberInput min="0" max="8" step="0.5" value={config.scatterBorderWidth ?? 1} onValueChange={(value) => patch({ scatterBorderWidth: value })}/></label></div>
        <SettingsCheckbox isSelected={config.scatterHollow ?? false} onChange={(scatterHollow) => patch({ scatterHollow })}>Полые маркеры</SettingsCheckbox>
      </fieldset>
      <fieldset><legend>Подписи точек</legend>
        <label>Текст подписи<select value={config.scatterLabelField ?? ''} onChange={(event) => patch({ scatterLabelField: event.target.value })}><option value="">{automaticLabelField ? `Авто: ${automaticLabelField}` : 'Значение Y'}</option>{columns.map((column) => <option key={column}>{column}</option>)}</select></label>
        <div className="settings-pair settings-pair--toggle"><SettingsCheckbox isSelected={config.scatterShowLabels ?? false} onChange={(scatterShowLabels) => patch({ scatterShowLabels })}>Показывать</SettingsCheckbox><label>Положение<select value={config.scatterLabelPosition ?? 'right'} onChange={(event) => patch({ scatterLabelPosition: event.target.value as ChartConfig['scatterLabelPosition'] })}><option value="top">Сверху</option><option value="right">Справа</option><option value="bottom">Снизу</option><option value="left">Слева</option></select></label></div>
      </fieldset>
      <fieldset><legend>Линии сравнения и квадранты</legend>
        <div className="settings-pair"><label>Значение X<OptionalNumberInput value={config.scatterXReference} placeholder="Не задано" onValueChange={(scatterXReference) => patch({ scatterXReference })}/></label><label>Значение Y<OptionalNumberInput value={config.scatterYReference} placeholder="Не задано" onValueChange={(scatterYReference) => patch({ scatterYReference })}/></label></div>
        <div className="settings-pair"><label>Цвет<ColorControl value={config.scatterReferenceColor ?? '#8a8791'} onChange={(scatterReferenceColor) => patch({ scatterReferenceColor })}/></label><label>Тип<select value={config.scatterReferenceType ?? 'dashed'} onChange={(event) => patch({ scatterReferenceType: event.target.value as ChartConfig['scatterReferenceType'] })}>{lineTypes}</select></label></div>
        <label>Толщина, px<NumberInput min="0.5" max="8" step="0.5" value={config.scatterReferenceWidth ?? 1.5} onValueChange={(value) => patch({ scatterReferenceWidth: value })}/></label>
        <SettingsCheckbox isSelected={quadrantsReady && (config.scatterQuadrants ?? false)} isDisabled={!quadrantsReady} onChange={(scatterQuadrants) => patch({ scatterQuadrants })}>Подсветить квадранты</SettingsCheckbox>
        {!quadrantsReady && <p className="scatter-settings__intro">Чтобы включить квадранты, задайте оба значения — X и Y.</p>}
        {quadrantsReady && config.scatterQuadrants && <div className="quadrant-colors" aria-label="Цвета квадрантов">{(config.scatterQuadrantColors ?? ['#dfeee8','#e7eef8','#f8e5e3','#f2eadb']).map((color, index) => <label key={index}><span>{['↖','↗','↘','↙'][index]}</span><ColorControl compact value={color} onChange={(next) => { const colors = [...(config.scatterQuadrantColors ?? ['#dfeee8','#e7eef8','#f8e5e3','#f2eadb'])] as [string,string,string,string]; colors[index] = next; patch({ scatterQuadrantColors: colors }) }}/></label>)}</div>}
        {quadrantsReady && config.scatterQuadrants && <div className="quadrant-labels">{(config.scatterQuadrantLabels ?? ['', '', '', '']).map((label, index) => <label key={index}>{['Сверху слева','Сверху справа','Снизу справа','Снизу слева'][index]}<input value={label} placeholder="Без подписи" onChange={(event) => { const labels = [...(config.scatterQuadrantLabels ?? ['', '', '', ''])] as [string,string,string,string]; labels[index] = event.target.value; patch({ scatterQuadrantLabels: labels }) }}/></label>)}</div>}
        <SettingsCheckbox isSelected={config.scatterDiagonal ?? false} onChange={(scatterDiagonal) => patch({ scatterDiagonal })}>Диагональ равенства X = Y</SettingsCheckbox>
        {config.scatterDiagonal && <div className="settings-pair"><label>Цвет диагонали<ColorControl value={config.scatterDiagonalColor ?? '#8a8791'} onChange={(scatterDiagonalColor) => patch({ scatterDiagonalColor })}/></label><label>Тип<select value={config.scatterDiagonalType ?? 'dashed'} onChange={(event) => patch({ scatterDiagonalType: event.target.value as ChartConfig['scatterDiagonalType'] })}>{lineTypes}</select></label></div>}
      </fieldset>
      <fieldset><legend>Линейный тренд</legend>
        <SettingsCheckbox isSelected={config.scatterTrendline ?? false} onChange={(scatterTrendline) => patch({ scatterTrendline })}>Показать линию тренда</SettingsCheckbox>
        {config.scatterTrendline && <><div className="settings-pair"><label>Цвет<ColorControl value={config.scatterTrendColor ?? '#77727f'} onChange={(scatterTrendColor) => patch({ scatterTrendColor })}/></label><label>Тип<select value={config.scatterTrendType ?? 'dashed'} onChange={(event) => patch({ scatterTrendType: event.target.value as ChartConfig['scatterTrendType'] })}>{lineTypes}</select></label></div><label>Толщина, px<NumberInput min="0.5" max="8" step="0.5" value={config.scatterTrendWidth ?? 2} onValueChange={(value) => patch({ scatterTrendWidth: value })}/></label><SettingsCheckbox isSelected={config.scatterTrendBand ?? false} onChange={(scatterTrendBand) => patch({ scatterTrendBand })}>Доверительная полоса 95%</SettingsCheckbox>{config.scatterTrendBand && <label>Прозрачность полосы, %<NumberInput min="2" max="60" value={Math.round((config.scatterTrendBandOpacity ?? .12) * 100)} onValueChange={(value) => patch({ scatterTrendBandOpacity: value / 100 })}/></label>}</>}
        {scatterSeries.length > 1 && <div className="scatter-series-trends">{scatterSeries.map(({ name, colorKey, colorIndex }) => { const style = config.seriesStyles[name] ?? {}; const color = style.color ?? getSeriesColor(config, colorKey, colorIndex); return <div key={name} className="scatter-series-trend"><strong><i style={{ background: color }}/>{name}</strong><div className="settings-pair"><label>Цвет ряда<ColorControl value={color} onChange={(nextColor) => patchSeries(name, { color: nextColor })}/></label><label>Размер, px<NumberInput min="2" max="80" value={style.markerSize ?? config.scatterPointSize ?? 10} onValueChange={(markerSize) => patchSeries(name, { markerSize })}/></label></div><SettingsCheckbox isSelected={style.scatterTrendline ?? false} onChange={(scatterTrendline) => patchSeries(name, { scatterTrendline })}>Тренд ряда</SettingsCheckbox>{style.scatterTrendline && <><SettingsCheckbox isSelected={style.scatterTrendBand ?? false} onChange={(scatterTrendBand) => patchSeries(name, { scatterTrendBand })}>Интервал</SettingsCheckbox><div className="settings-pair"><label>Цвет тренда<ColorControl value={style.scatterTrendColor ?? color} onChange={(scatterTrendColor) => patchSeries(name, { scatterTrendColor })}/></label><label>Тип<select value={style.scatterTrendType ?? config.scatterTrendType ?? 'dashed'} onChange={(event) => patchSeries(name, { scatterTrendType: event.target.value as ChartConfig['scatterTrendType'] })}>{lineTypes}</select></label></div></>}</div> })}</div>}
      </fieldset>
    </div>
  </details>
}
