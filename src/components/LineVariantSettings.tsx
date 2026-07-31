import type { ChartConfig, DataTable } from '../core/types'
import { NumberInput } from './NumberInput'
import { ColorControl } from './PickerControls'
import { SettingsCheckbox } from './SettingsCheckbox'
import { chartDataValueKey } from '../core/chartData'

interface Props { config: ChartConfig; numericColumns?: string[]; table: DataTable; onChange(config: ChartConfig): void }

export function LineVariantSettings({ config, numericColumns = config.yFields, table, onChange }: Props) {
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  if (config.kind === 'moving-average-line' || config.kind === 'moving-average-scatter') return <details className="settings-group line-variant-settings"><summary>Скользящее среднее</summary><div>
    <label>Период сглаживания<NumberInput min="2" max="365" value={config.movingAverageWindow ?? 12} onValueChange={(movingAverageWindow) => patch({ movingAverageWindow: Math.max(2, Math.round(movingAverageWindow)) })}/></label>
    <label>Прозрачность исходных данных, %<NumberInput min="5" max="80" value={Math.round((config.movingAverageRawOpacity ?? .22) * 100)} onValueChange={(value) => patch({ movingAverageRawOpacity: value / 100 })}/></label>
    <small className="settings-note">Среднее рассчитывается отдельно для каждого выбранного ряда по предыдущим N наблюдениям.</small>
  </div></details>
  if (config.kind === 'indexed-line') {
    const positions = [...new Map(table.rows.map((row) => [chartDataValueKey(row[config.xField]), row[config.xField]])).entries()].sort(([, left], [, right]) => left instanceof Date && right instanceof Date ? left.getTime() - right.getTime() : typeof left === 'number' && typeof right === 'number' ? left - right : 0)
    return <details className="settings-group line-variant-settings"><summary>Индекс к дате</summary><div>
      <label>Базовая дата (= 100)<select value={config.indexBaseXValue ?? ''} onChange={(event) => patch({ indexBaseXValue: event.target.value })}><option value="">Выберите дату…</option>{positions.map(([key, value]) => <option value={key} key={key}>{value instanceof Date ? value.toLocaleDateString('ru-RU') : String(value ?? '')}</option>)}</select></label>
      <small className="settings-note">Каждый ряд делится на своё значение в выбранную дату и умножается на 100.</small>
    </div></details>
  }
  if (config.kind === 'seasonal-line') {
    const years = [...new Set(table.rows.flatMap((row) => row[config.xField] instanceof Date ? [String((row[config.xField] as Date).getFullYear())] : []))].sort()
    const accents = config.seasonalAccentYears ?? years.slice(-1)
    const toggleYear = (year: string) => patch({ seasonalAccentYears: accents.includes(year) ? accents.filter((item) => item !== year) : [...accents, year] })
    return <details className="settings-group line-variant-settings"><summary>Сравнение по годам</summary><div>
      <strong>Цветовые акценты</strong>
      {years.map((year) => <SettingsCheckbox key={year} isSelected={accents.includes(year)} onChange={() => toggleYear(year)}>{year}</SettingsCheckbox>)}
      <label>Цвет остальных лет<ColorControl value={config.seasonalMutedColor ?? '#d9d7df'} onChange={(seasonalMutedColor) => patch({ seasonalMutedColor })}/></label>
      <label>Прозрачность остальных лет, %<NumberInput min="10" max="100" value={Math.round((config.seasonalMutedOpacity ?? .45) * 100)} onValueChange={(value) => patch({ seasonalMutedOpacity: value / 100 })}/></label>
      <small className="settings-note">Цвет акцентных лет задаётся основной палитрой или индивидуально после выбора линии.</small>
    </div></details>
  }
  if (config.kind === 'slope') return <details className="settings-group line-variant-settings"><summary>Наклонный график</summary><div>
    <SettingsCheckbox isSelected={config.slopeShowValues ?? true} onChange={(slopeShowValues) => patch({ slopeShowValues })}>Подписывать значения</SettingsCheckbox>
    <SettingsCheckbox isSelected={config.slopeShowSeriesNames ?? true} onChange={(slopeShowSeriesNames) => patch({ slopeShowSeriesNames })}>Подписывать названия рядов справа</SettingsCheckbox>
    <SettingsCheckbox isSelected={config.slopeShowYAxis ?? false} onChange={(slopeShowYAxis) => patch({ slopeShowYAxis, ...(slopeShowYAxis ? { showHorizontalGrid: true } : {}) })}>Показывать подписи шкалы Y</SettingsCheckbox>
    <small className="settings-note">Значения показываются у обеих точек ряда. Их формат и шрифт настраиваются в разделе «Подписи значений».</small>
  </div></details>
  if (config.kind === 'dumbbell') return <details className="settings-group line-variant-settings"><summary>Гантельная диаграмма</summary><div>
    <label>Начальное значение<select value={config.dumbbellStartField ?? ''} onChange={(event) => { const dumbbellStartField = event.target.value || undefined; patch({ dumbbellStartField, yFields: [dumbbellStartField, config.dumbbellEndField].filter((field): field is string => Boolean(field)), yField: dumbbellStartField ?? config.yField }) }}><option value="">Выберите показатель…</option>{numericColumns.map((column) => <option key={column}>{column}</option>)}</select></label>
    <label>Конечное значение<select value={config.dumbbellEndField ?? ''} onChange={(event) => { const dumbbellEndField = event.target.value || undefined; patch({ dumbbellEndField, yFields: [config.dumbbellStartField, dumbbellEndField].filter((field): field is string => Boolean(field)) }) }}><option value="">Выберите показатель…</option>{numericColumns.map((column) => <option key={column}>{column}</option>)}</select></label>
    {config.dumbbellStartField === config.dumbbellEndField && config.dumbbellStartField && <small className="settings-note interval-error">Выберите два разных показателя.</small>}
    <label>Ориентация<select value={config.dumbbellOrientation ?? 'horizontal'} onChange={(event) => patch({ dumbbellOrientation: event.target.value as NonNullable<ChartConfig['dumbbellOrientation']> })}><option value="horizontal">Горизонтальная</option><option value="vertical">Вертикальная</option></select></label>
    <strong>Подписи точек</strong>
    <SettingsCheckbox isSelected={config.showValues && (config.dumbbellShowStartValue ?? true)} onChange={(dumbbellShowStartValue) => patch({ showValues: true, dumbbellShowStartValue })}>Начальное значение</SettingsCheckbox>
    <SettingsCheckbox isSelected={config.showValues && (config.dumbbellShowEndValue ?? true)} onChange={(dumbbellShowEndValue) => patch({ showValues: true, dumbbellShowEndValue })}>Конечное значение</SettingsCheckbox>
    <SettingsCheckbox isSelected={config.dumbbellShowDifference ?? false} onChange={(dumbbellShowDifference) => patch({ dumbbellShowDifference })}>Показывать изменение между точками</SettingsCheckbox>
    {(config.dumbbellShowDifference ?? false) && <><label>Формат изменения<select value={config.dumbbellDifferenceFormat ?? 'absolute'} onChange={(event) => patch({ dumbbellDifferenceFormat: event.target.value as ChartConfig['dumbbellDifferenceFormat'] })}><option value="absolute">Абсолютное значение</option><option value="percent">Процентное изменение</option></select></label>{(config.dumbbellDifferenceFormat ?? 'absolute') === 'percent' && <label>Знаков после запятой<NumberInput min="0" max="6" value={config.dumbbellPercentDecimals ?? 0} onValueChange={(dumbbellPercentDecimals) => patch({ dumbbellPercentDecimals: Math.round(dumbbellPercentDecimals) })}/></label>}<label>Расположение подписи<select value={config.dumbbellDifferencePosition ?? 'middle'} onChange={(event) => patch({ dumbbellDifferencePosition: event.target.value as ChartConfig['dumbbellDifferencePosition'] })}><option value="start">{config.dumbbellOrientation === 'vertical' ? 'Выше точек' : 'Слева от точек'}</option><option value="middle">Между точками</option><option value="end">{config.dumbbellOrientation === 'vertical' ? 'Ниже точек' : 'Справа от точек'}</option></select></label></>}
    <label>Сортировка<select value={config.dumbbellSort ?? 'none'} onChange={(event) => patch({ dumbbellSort: event.target.value as ChartConfig['dumbbellSort'] })}><option value="none">Как в данных</option><option value="difference">По изменению</option><option value="start">По начальному значению</option><option value="end">По конечному значению</option></select></label>
    {(config.dumbbellSort ?? 'none') !== 'none' && <label>Направление<select value={config.dumbbellSortDirection ?? 'desc'} onChange={(event) => patch({ dumbbellSortDirection: event.target.value as ChartConfig['dumbbellSortDirection'] })}><option value="desc">По убыванию</option><option value="asc">По возрастанию</option></select></label>}
    <strong>Соединитель</strong>
    <label>Цвет<ColorControl value={config.dumbbellConnectorColor ?? config.gridColor} onChange={(dumbbellConnectorColor) => patch({ dumbbellConnectorColor })}/></label>
    <div className="fred-grid"><label>Толщина, px<NumberInput min="0.5" max="12" step="0.5" value={config.dumbbellConnectorWidth ?? 3} onValueChange={(dumbbellConnectorWidth) => patch({ dumbbellConnectorWidth })}/></label><label>Прозрачность, %<NumberInput min="5" max="100" value={Math.round((config.dumbbellConnectorOpacity ?? 1) * 100)} onValueChange={(value) => patch({ dumbbellConnectorOpacity: value / 100 })}/></label></div>
    <label>Тип линии<select value={config.dumbbellConnectorType ?? 'solid'} onChange={(event) => patch({ dumbbellConnectorType: event.target.value as ChartConfig['dumbbellConnectorType'] })}><option value="solid">Сплошная</option><option value="dashed">Пунктирная</option><option value="dotted">Точечная</option></select></label>
    <SettingsCheckbox isSelected={config.dumbbellColorByChange ?? false} onChange={(dumbbellColorByChange) => patch({ dumbbellColorByChange })}>Цвет по направлению изменения</SettingsCheckbox>
    {(config.dumbbellColorByChange ?? false) && <><label>Рост<ColorControl value={config.dumbbellIncreaseColor ?? '#168a72'} onChange={(dumbbellIncreaseColor) => patch({ dumbbellIncreaseColor })}/></label><label>Падение<ColorControl value={config.dumbbellDecreaseColor ?? '#db5a5a'} onChange={(dumbbellDecreaseColor) => patch({ dumbbellDecreaseColor })}/></label><label>Без изменения<ColorControl value={config.dumbbellNeutralColor ?? '#777580'} onChange={(dumbbellNeutralColor) => patch({ dumbbellNeutralColor })}/></label></>}
  </div></details>
  if (config.kind === 'step-line') return <details className="settings-group" open><summary>Специальная линия</summary><div><label>Переход между значениями<select value={config.stepPosition ?? 'end'} onChange={(event) => patch({ stepPosition: event.target.value as ChartConfig['stepPosition'] })}><option value="end">После значения</option><option value="start">До значения</option></select></label><small className="settings-note">Определяет, к какой точке относится горизонтальный участок ступени.</small></div></details>
  if (config.kind === 'range-line' || config.kind === 'step-range-line' || config.kind === 'confidence-line') {
    const confidence = config.kind === 'confidence-line'
    const stepped = config.kind === 'step-range-line'
    const autoGroups = config.yFields.slice(0, Math.floor(config.yFields.length / 3) * 3).reduce<NonNullable<ChartConfig['intervalGroups']>>((groups, field, index, fields) => {
      if (index % 3 === 0 && fields[index + 1] && fields[index + 2]) groups.push({ main: field, lower: fields[index + 1], upper: fields[index + 2] })
      return groups
    }, [])
    const groups = config.intervalGroups?.length ? config.intervalGroups : autoGroups
    const options = numericColumns.length ? numericColumns : config.yFields
    const invalidRows = (group: NonNullable<ChartConfig['intervalGroups']>[number]) => table.rows.filter((row) => {
      const main = row[group.main], lower = row[group.lower], upper = row[group.upper]
      return typeof main === 'number' && typeof lower === 'number' && typeof upper === 'number' && !(lower <= main && main <= upper)
    }).length
    const setGroups = (intervalGroups: NonNullable<ChartConfig['intervalGroups']>) => patch({ intervalGroups, yFields: [...new Set(intervalGroups.flatMap((group) => [group.main, group.lower, group.upper]))], yField: intervalGroups[0]?.main ?? config.yField })
    const updateGroup = (index: number, values: Partial<NonNullable<ChartConfig['intervalGroups']>[number]>) => setGroups(groups.map((group, groupIndex) => groupIndex === index ? { ...group, ...values } : group))
    const addGroup = () => {
      const used = new Set(groups.flatMap((group) => [group.main, group.lower, group.upper]))
      const next = options.filter((column) => !used.has(column))
      setGroups([...groups, { main: next[0] ?? options[0] ?? config.yField, lower: next[1] ?? options[1] ?? config.yField, upper: next[2] ?? options[2] ?? config.yField }])
    }
    return <details className="settings-group line-variant-settings"><summary>{confidence ? 'Линия с интервалом' : 'Диапазон между линиями'}</summary><div>
      {!confidence && <div className="interval-group">
        <label>Нижняя граница<select value={config.rangeLowerField ?? ''} onChange={(event) => patch({ rangeLowerField: event.target.value || undefined })}><option value="">Выберите показатель…</option>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        <label>Верхняя граница<select value={config.rangeUpperField ?? ''} onChange={(event) => patch({ rangeUpperField: event.target.value || undefined })}><option value="">Выберите показатель…</option>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        {(!config.rangeLowerField || !config.rangeUpperField) && <small className="settings-note">Выберите обе границы — до этого диапазон не строится.</small>}
        {config.rangeLowerField && config.rangeLowerField === config.rangeUpperField && <small className="settings-note interval-error">Границы должны быть разными показателями.</small>}
      </div>}
      {confidence && <div className="interval-group-list">{groups.map((group, index) => <div className="interval-group" key={index}>
        <div className="interval-group-title"><b>Группа {index + 1}</b>{groups.length > 1 && <button type="button" onClick={() => setGroups(groups.filter((_, groupIndex) => groupIndex !== index))}>Удалить</button>}</div>
        <label>Средняя линия<select value={group.main} onChange={(event) => updateGroup(index, { main: event.target.value })}>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        <label>Нижняя граница<select value={group.lower} onChange={(event) => updateGroup(index, { lower: event.target.value })}>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        <label>Верхняя граница<select value={group.upper} onChange={(event) => updateGroup(index, { upper: event.target.value })}>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
        {new Set([group.main, group.lower, group.upper]).size < 3 && <small className="settings-note interval-error">Средняя линия и обе границы должны быть разными показателями.</small>}
        {invalidRows(group) > 0 && <small className="settings-note interval-error">Нарушен порядок lower ≤ main ≤ upper: строк {invalidRows(group)}. Для них интервал не строится.</small>}
        <SettingsCheckbox isSelected={group.showBounds ?? false} onChange={(showBounds) => updateGroup(index, { showBounds })}>Подписывать границы справа</SettingsCheckbox>
      </div>)}
      <button type="button" className="interval-add-group" onClick={addGroup}>Добавить группу</button></div>}
      {stepped && <label>Переход между значениями<select value={config.stepPosition ?? 'end'} onChange={(event) => patch({ stepPosition: event.target.value as ChartConfig['stepPosition'] })}><option value="end">После значения</option><option value="start">До значения</option></select></label>}
      <label>Цвет заливки<select value={config.intervalFillMode ?? 'by-bound'} onChange={(event) => patch({ intervalFillMode: event.target.value as NonNullable<ChartConfig['intervalFillMode']> })}><option value="by-bound">По линии сверху</option><option value="custom">Один выбранный цвет</option></select></label>
      {(config.intervalFillMode ?? 'by-bound') === 'custom' && <label>Свой цвет заливки<ColorControl value={config.intervalFillColor ?? config.color} title="Цвет заливки интервала" onChange={(intervalFillColor) => patch({ intervalFillColor })}/></label>}
      <label>Прозрачность заливки, %<NumberInput min="0" max="80" value={Math.round((config.intervalFillOpacity ?? .18) * 100)} onValueChange={(value) => patch({ intervalFillOpacity: value / 100 })}/></label>
    </div></details>
  }
  return null
}
