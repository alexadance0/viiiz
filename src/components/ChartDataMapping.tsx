import type { ChartConfig, DataTable, DataValue } from '../core/types'
import { slopePositionKey } from '../core/chartScale'
import { repeatedChartCategories } from '../core/chartData'
import { isDistributionChart } from '../core/chartKinds'
import { SettingsCheckbox } from './SettingsCheckbox'

interface Props {
  table: DataTable
  numericColumns: string[]
  config: ChartConfig
  onChange(config: ChartConfig): void
  onToggleField(field: string): void
}

const slopePositions = (table: DataTable, field: string) => [...new Map(table.rows.map((row) => [slopePositionKey(row[field]), row[field]])).entries()].sort(([, left], [, right]) => {
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
  return typeof left === 'number' && typeof right === 'number' ? left - right : 0
}) as Array<[string, DataValue]>

const isScatterChart = (kind: ChartConfig['kind']) => kind === 'scatter' || kind === 'bubble'

export function ChartDataMapping({ table, numericColumns, config, onChange, onToggleField }: Props) {
  const options = numericColumns.length ? numericColumns : table.columns
  const patch = (values: Partial<ChartConfig>) => onChange({ ...config, ...values })
  const repeatedCategories = repeatedChartCategories(table, config)
  const categoryColumns = table.columns.filter((column) => column !== config.xField && !config.yFields.includes(column) && column !== config.scatterSizeField)
  const treemapCategories = config.kind === 'treemap' ? [...new Set(table.rows.map((row) => String(row[config.xField] ?? 'Без категории')))] : []
  const hiddenTreemapCategories = new Set(config.treemapHiddenCategories ?? [])
  const visibleTreemapCategories = treemapCategories.filter((category) => !hiddenTreemapCategories.has(category))
  const toggleTreemapCategory = (category: string, visible: boolean) => {
    const hidden = new Set(hiddenTreemapCategories)
    if (visible) hidden.delete(category)
    else hidden.add(category)
    patch({ treemapHiddenCategories: [...hidden] })
  }
  const select = (label: string, value: string | undefined, onValue: (value: string) => void) =>
    <label>{label}<select value={value ?? ''} onChange={(event) => onValue(event.target.value)}><option value="">Выберите показатель…</option>{options.map((column) => <option key={column}>{column}</option>)}</select></label>
  const fieldList = (label: string) => <div className="chart-data-field" role="group" aria-label={label}>
    <span className="chart-data-field-label">{label}</span>
    <div className="y-field-list">{options.map((column) =>
      <SettingsCheckbox className="chart-data-checkbox" isSelected={config.yFields.includes(column)} onChange={() => onToggleField(column)} key={column}>{column}</SettingsCheckbox>
    )}</div>
  </div>

  let measures
  if (config.kind === 'dumbbell') {
    measures = <div className="chart-role-fields">
      <div><strong>Сравнение двух состояний</strong><small>Точки показывают начало и конец, линия — величину изменения.</small></div>
      {select('Начальное значение', config.dumbbellStartField, (dumbbellStartField) => patch({ dumbbellStartField: dumbbellStartField || undefined, yFields: [dumbbellStartField, config.dumbbellEndField].filter((field): field is string => Boolean(field)), yField: dumbbellStartField || config.yField }))}
      {select('Конечное значение', config.dumbbellEndField, (dumbbellEndField) => patch({ dumbbellEndField: dumbbellEndField || undefined, yFields: [config.dumbbellStartField, dumbbellEndField].filter((field): field is string => Boolean(field)) }))}
    </div>
  } else if (config.kind === 'range-line' || config.kind === 'step-range-line') {
    measures = <div className="chart-role-fields">
      <div><strong>Границы диапазона</strong><small>Обе линии остаются видимыми, пространство между ними заполняется.</small></div>
      {select('Нижняя граница', config.rangeLowerField, (rangeLowerField) => patch({ rangeLowerField: rangeLowerField || undefined }))}
      {select('Верхняя граница', config.rangeUpperField, (rangeUpperField) => patch({ rangeUpperField: rangeUpperField || undefined }))}
    </div>
  } else if (config.kind === 'confidence-line') {
    const group = config.intervalGroups?.[0]
    const update = (values: Partial<NonNullable<ChartConfig['intervalGroups']>[number]>) => {
      const next = { main: group?.main ?? '', lower: group?.lower ?? '', upper: group?.upper ?? '', ...values }
      patch({ intervalGroups: [next], yFields: [next.main, next.lower, next.upper].filter(Boolean), yField: next.main || config.yField })
    }
    measures = <div className="chart-role-fields">
      <div><strong>Основная линия и интервал</strong><small>Дополнительные группы можно добавить на шаге оформления.</small></div>
      {select('Основная линия', group?.main, (main) => update({ main }))}
      {select('Нижняя граница', group?.lower, (lower) => update({ lower }))}
      {select('Верхняя граница', group?.upper, (upper) => update({ upper }))}
    </div>
  } else if (config.kind === 'slope') {
    const positions = slopePositions(table, config.xField)
    const selected = config.slopeXValues ?? []
    const formatPosition = (value: typeof positions[number][1]) => value instanceof Date ? value.toLocaleDateString('ru-RU') : String(value ?? 'Пустое значение')
    const togglePosition = (key: string) => {
      const next = selected.includes(key) ? selected.filter((value) => value !== key) : selected.length < 2 ? [...selected, key] : selected
      patch({ slopeXValues: next })
    }
    measures = <>
      <div className="chart-role-fields slope-positions">
        <div><strong>Сравнение двух позиций</strong><small>Выберите начало и конец — на графике останутся только эти две точки.</small></div>
        <div className="slope-position-list" role="group" aria-label="Позиции по оси X">
          {positions.map(([key, value]) => <button type="button" key={key} className={selected.includes(key) ? 'active' : ''} aria-pressed={selected.includes(key)} disabled={!selected.includes(key) && selected.length === 2} onClick={() => togglePosition(key)}><span>{selected.includes(key) ? '✓' : ''}</span>{formatPosition(value)}</button>)}
        </div>
        <small className="slope-position-count">Выбрано: {selected.length} из 2</small>
      </div>
      {fieldList('Ряды данных')}
    </>
  } else if (config.kind === 'waterfall') {
    measures = <div className="chart-role-fields">
      <div><strong>Последовательность изменений</strong><small>Каждое значение прибавляется к предыдущему итогу. В конце появится общий результат.</small></div>
      {select('Изменение', config.yFields[0] ?? config.yField, (yField) => patch({ yField, yFields: [yField], seriesField: '' }))}
    </div>
  } else if (config.kind === 'butterfly') {
    const left = config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1)
    const right = config.butterflyRightFields?.length ? config.butterflyRightFields : config.yFields.slice(1, 2)
    const updateSide = (side: 'left' | 'right', field: string, selected: boolean) => {
      const current = side === 'left' ? left : right
      const next = selected ? [...current, field] : current.filter((item) => item !== field)
      if (!next.length) return
      const other = (side === 'left' ? right : left).filter((item) => item !== field)
      const nextLeft = side === 'left' ? next : other
      const nextRight = side === 'right' ? next : other
      const yFields = [...nextLeft, ...nextRight]
      patch({ butterflyLeftFields: nextLeft, butterflyRightFields: nextRight, yFields, yField: yFields[0], seriesField: '' })
    }
    const sideFields = (label: string, side: 'left' | 'right', selected: string[]) => <div className="chart-data-field" role="group" aria-label={label}>
      <span className="chart-data-field-label">{label} · {selected.length}</span>
      <div className="y-field-list">{options.map((column) =>
        <SettingsCheckbox className="chart-data-checkbox" isSelected={selected.includes(column)} isDisabled={selected.includes(column) && selected.length === 1 || !selected.includes(column) && (side === 'left' ? right : left).includes(column) && (side === 'left' ? right : left).length === 1} onChange={(isSelected) => updateSide(side, column, isSelected)} key={column}>{column}</SettingsCheckbox>
      )}</div>
    </div>
    measures = <div className="chart-role-fields">
      <div><strong>Стороны сравнения</strong><small>Выберите один или несколько рядов для каждой стороны. Несколько рядов складываются внутри категории.</small></div>
      {sideFields('Левая сторона', 'left', left)}
      {sideFields('Правая сторона', 'right', right)}
    </div>
  } else if (config.kind === 'seasonal-line') {
    measures = <div className="chart-role-fields">
      <div><strong>Один показатель по годам</strong><small>Каждый календарный год станет отдельной линией с месяцами по оси X.</small></div>
      {select('Показатель', config.yFields[0] ?? config.yField, (yField) => patch({ yField, yFields: [yField] }))}
    </div>
  } else if (config.kind === 'treemap') {
    measures = <div className="chart-role-fields">
      <div><strong>Размер блоков</strong><small>Площадь каждого блока пропорциональна выбранному положительному значению.</small></div>
      {select('Значение', config.yField, (yField) => patch({ yField, yFields: [yField] }))}
      <label>Как объединять одинаковые ветви<select value={config.aggregation === 'none' ? 'sum' : config.aggregation} onChange={(event) => patch({ aggregation: event.target.value as ChartConfig['aggregation'] })}><option value="sum">Сумма</option><option value="average">Среднее</option><option value="min">Минимум</option><option value="max">Максимум</option><option value="count">Количество строк</option></select></label>
      <label>Подписи значений<select value={config.treemapValueFormat ?? 'absolute'} onChange={(event) => patch({ treemapValueFormat: event.target.value as NonNullable<ChartConfig['treemapValueFormat']> })}><option value="absolute">Абсолютные значения</option><option value="percent">Доля от суммы, %</option></select></label>
    </div>
  } else if (config.kind === 'heatmap') {
    measures = <div className="chart-role-fields">
      <div><strong>Ряды тепловой карты</strong><small>Каждый выбранный числовой столбец станет отдельной горизонтальной строкой.</small></div>
      {fieldList('Показатели')}
    </div>
  } else if (isDistributionChart(config.kind)) {
    measures = <div className="chart-role-fields">
      <div><strong>Распределяемые показатели</strong><small>Выберите profit, orders и другие числовые столбцы — каждый станет отдельным распределением.</small></div>
      {fieldList('Показатели')}
      <label>Разбить цветом по категории<select value={config.distributionGroupField ?? ''} onChange={(event) => {
        const distributionGroupField = event.target.value || undefined
        const categoryLanes = config.kind === 'raincloud' || config.kind === 'ridgeline'
        patch({ distributionGroupField, distributionLayoutMode: distributionGroupField && categoryLanes ? 'categories' : 'measures', ...(distributionGroupField ? { showLegend: !categoryLanes } : {}) })
      }}><option value="">Не разбивать — сравнить показатели</option>{table.columns.filter((column) => !config.yFields.includes(column)).map((column) => <option key={column}>{column}</option>)}</select></label>
      <small>Каждая строка остаётся отдельным наблюдением, без агрегации.</small>
    </div>
  } else {
    measures = fieldList('Показатели')
  }

  return <section className="chart-data-section">
    <div><strong>Данные графика</strong><small>Назначьте столбцам понятные роли</small></div>
    {!isDistributionChart(config.kind) && <label>{config.kind === 'treemap' ? 'Категория' : config.kind === 'dumbbell' ? 'Категории' : 'Период / ось X'}<select value={config.xField} onChange={(event) => { const xField = event.target.value; const positions = slopePositions(table, xField); patch({ xField, ...(config.kind === 'treemap' ? { treemapHiddenCategories: [] } : {}), ...(config.kind === 'slope' ? { slopeXValues: positions.length > 1 ? [positions[0][0], positions.at(-1)![0]] : positions.map(([key]) => key) } : {}), ...(config.kind === 'indexed-line' ? { indexBaseXValue: positions[0]?.[0] } : {}), xAxisTitle: config.xAxisTitle === config.xField ? xField : config.xAxisTitle }) }}>{table.columns.map((column) => <option key={column}>{column}</option>)}</select></label>}
    {config.kind === 'treemap' && !!treemapCategories.length && <div className="chart-data-field" role="group" aria-label="Категории Treemap">
      <span className="chart-data-field-label">Какие категории показывать · {visibleTreemapCategories.length} из {treemapCategories.length}</span>
      <div className="y-field-list">{treemapCategories.map((category) => {
        const visible = !hiddenTreemapCategories.has(category)
        return <SettingsCheckbox className="chart-data-checkbox" isSelected={visible} isDisabled={visible && visibleTreemapCategories.length === 1} onChange={(isVisible) => toggleTreemapCategory(category, isVisible)} key={category}>{category}</SettingsCheckbox>
      })}</div>
    </div>}
    {config.kind === 'treemap' && <div className="chart-role-fields">
      <div><strong>Вложенность</strong><small>Подкатегория необязательна. Без неё будет один уровень блоков.</small></div>
      <label>Подкатегория<select value={config.treemapSubcategoryField ?? ''} onChange={(event) => patch({ treemapSubcategoryField: event.target.value || undefined })}><option value="">Без подкатегорий</option>{table.columns.filter((column) => column !== config.xField && column !== config.yField).map((column) => <option key={column}>{column}</option>)}</select></label>
    </div>}
    {measures}
    {isScatterChart(config.kind) && <div className="chart-role-fields">
      <div><strong>Цвет по категориям</strong><small>Каждая категория получит свой цвет и элемент легенды.</small></div>
      <label>Категория<select value={config.scatterColorField ?? ''} onChange={(event) => { const scatterColorField = event.target.value || undefined; patch({ scatterColorField, ...(scatterColorField ? { showLegend: true } : {}) }) }}><option value="">Не выделять категории</option>{categoryColumns.map((column) => <option key={column}>{column}</option>)}</select></label>
      {!categoryColumns.length && <small>Добавьте текстовый или логический столбец с категориями.</small>}
    </div>}
    {config.kind !== 'treemap' && !!repeatedCategories.length && <div className="chart-aggregation-warning" role="status">
      <div><strong>Для одного X найдено несколько значений</strong><small>Совпадений: {repeatedCategories.length}. Выберите, как объединить их в одну точку.</small></div>
      <label>Способ агрегации<select aria-label="Способ агрегации повторяющихся X" value={config.aggregation} onChange={(event) => patch({ aggregation: event.target.value as ChartConfig['aggregation'] })}><option value="none" disabled>Выберите способ…</option><option value="sum">Сумма</option><option value="average">Среднее</option><option value="min">Минимум</option><option value="max">Максимум</option><option value="count">Количество</option></select></label>
    </div>}
    {config.kind === 'indexed-line' && <div className="chart-role-fields">
      <div><strong>Базовая позиция</strong><small>Значение каждого ряда здесь будет принято за 100.</small></div>
      <label>Дата / период<select value={config.indexBaseXValue ?? ''} onChange={(event) => patch({ indexBaseXValue: event.target.value })}>{slopePositions(table, config.xField).map(([key, value]) => <option value={key} key={key}>{value instanceof Date ? value.toLocaleDateString('ru-RU') : String(value ?? '')}</option>)}</select></label>
    </div>}
    {config.kind === 'bubble' && <div className="chart-role-fields">
      <div><strong>Размер пузырьков</strong><small>Чем больше значение, тем крупнее точка на графике.</small></div>
      {select('Размер точек', config.scatterSizeField, (scatterSizeField) => patch({ scatterSizeField: scatterSizeField || undefined }))}
    </div>}
  </section>
}
