import { chartRegistry } from '../core/chartRegistry'
import { createDefaultChartConfig } from '../entities/chart/model/defaultChartConfig'
import { mapDemoTables, marimekkoDemoTable, sankeyDemoTable } from '../core/demoData'
import { isMapChart, mapPresetForKind } from '../features/chart-types/map/catalog'
import { isDistributionChart, isBarChart, isAreaChart } from '../core/chartKinds'
import { fontCatalog } from '../core/textFonts'
import { applyCanvasTheme } from '../core/chartTextStyle'
import type { ChartConfig, ChartKind, DataTable } from '../core/types'

export interface AuditSetting { name: string; values: Array<string | number | boolean>; number: boolean; string: boolean; controls: Array<{ min?: number; max?: number }> }
export interface AuditCase { id: string; fields: string[]; patch: Partial<ChartConfig>; export?: boolean }
const dates = Array.from({ length: 6 }, (_, index) => new Date(Date.UTC(2025, index, 1)))
const table: DataTable = { name: 'Аудит графиков', columns: ['Категория', 'Дата', 'X', 'Значение', 'Другой', 'Нижняя', 'Верхняя', 'Размер', 'Группа', 'Подпись'], rows: Array.from({ length: 18 }, (_, index) => ({ Категория: `Категория ${index % 6 + 1}`, Дата: dates[index % 6], X: index + 1, Значение: 12 + index % 6 * 7 + index % 3, Другой: 8 + index % 6 * 3, Нижняя: 3 + index % 6 * 2, Верхняя: 25 + index % 6 * 9, Размер: 4 + index % 6 * 4, Группа: `Группа ${index % 2 + 1}`, Подпись: `Наблюдение ${index + 1}` })) }
const timed = (kind: ChartKind) => /line|area|bump|slope|spline/.test(kind)
export function auditFixture(kind: ChartKind): { table: DataTable; config: ChartConfig } {
  const plugin = chartRegistry.find((plugin) => plugin.id === kind)!
  const xField = timed(kind) ? 'Дата' : kind === 'scatter' || kind === 'bubble' || kind === 'connected-scatter' ? 'X' : 'Категория'
  let data = table
  const config: ChartConfig = { ...createDefaultChartConfig(), ...plugin.defaultConfig, kind, canvasWidth: 800, canvasHeight: 600, autoFitCanvas: false, xField, yField: 'Значение', yFields: ['Значение', 'Другой'], seriesField: '', aggregation: 'sum', title: 'Аудит графика', subtitle: 'Проверка настроек и геометрии', note: 'Примечание к графику', source: 'Источник: контрольные данные', xAxisTitle: 'Категории', yAxisTitle: 'Значения', showValues: true, showXAxisTitle: true, showYAxisTitle: true, showLegend: plugin.capabilities.guides.includes('legend'), showDirectLabels: false, dumbbellStartField: 'Другой', dumbbellEndField: 'Значение', rangeLowerField: 'Нижняя', rangeUpperField: 'Верхняя', intervalGroups: [{ main: 'Значение', lower: 'Нижняя', upper: 'Верхняя' }], scatterSizeField: 'Размер', scatterColorField: 'Группа', scatterLabelField: 'Подпись', distributionLabelField: 'Подпись', distributionGroupField: 'Группа', distributionOrientation: 'horizontal', distributionViolinSplitFirst: 'Группа 1', distributionViolinSplitSecond: 'Группа 2', treemapSubcategoryField: 'Группа', butterflyLeftFields: ['Значение'], butterflyRightFields: ['Другой'], indexBaseXValue: `date:${dates[0].toISOString()}`, slopeXValues: [`date:${dates[0].toISOString()}`, `date:${dates[5].toISOString()}`] }
  if (kind === 'seasonal-line') data = { ...table, rows: table.rows.map((row, index) => ({ ...row, Дата: new Date(Date.UTC(index < 9 ? 2024 : 2025, index % 6, 1)) })) }
  if (isMapChart(kind)) { data = mapDemoTables[mapPresetForKind(kind)]; Object.assign(config, { xField: 'Территория', yField: 'Значение', yFields: ['Значение'], showLegend: false, showXAxisTitle: false, showYAxisTitle: false, showDirectLabels: false, heatmapShowScale: true }) }
  if (kind === 'marimekko') { data = marimekkoDemoTable; Object.assign(config, { xField: 'Рынок', yField: 'Альфа', yFields: ['Альфа', 'Бета', 'Гамма', 'Другие'], showXAxisTitle: false, showYAxisTitle: false }) }
  if (kind === 'sankey') { data = sankeyDemoTable; Object.assign(config, { xField: data.columns[0], sankeyTargetField: data.columns[1], yField: data.columns[2], yFields: [data.columns[2]], showXAxisTitle: false, showYAxisTitle: false, showLegend: false }) }
  if (kind === 'pie' || kind === 'donut' || kind === 'waffle') config.yFields = ['Значение']
  return { table: data, config }
}

function applicable(field: string, kind: ChartKind): boolean {
  const plugin = chartRegistry.find((plugin) => plugin.id === kind)!
  if (/^(?:kind|preferredDataSelection|multiples|customFonts|minimumPlotInsets|xField|yField|seriesField|.*Field$|.*Order$)/.test(field)) return false
  if (/^map/.test(field)) return isMapChart(kind)
  if (/^heatmap/.test(field)) return isMapChart(kind) || kind === 'heatmap'
  if (/^waffle/.test(field)) return kind === 'waffle'
  if (/^pie/.test(field)) return kind === 'pie' || kind === 'donut'
  if (/^sankey/.test(field)) return kind === 'sankey'
  if (/^treemap/.test(field)) return kind === 'treemap'
  if (/^distribution/.test(field)) return isDistributionChart(kind)
  if (/^scatter/.test(field)) return kind === 'scatter' || kind === 'bubble' || kind === 'connected-scatter'
  if (/^slope/.test(field)) return kind === 'slope'
  if (/^bump/.test(field)) return kind === 'bump'
  if (/^dumbbell/.test(field)) return kind === 'dumbbell' || kind === 'arrow-plot' || kind === 'dot-plot' && field === 'dumbbellOrientation'
  if (/^butterfly/.test(field)) return kind === 'butterfly'
  if (/^waterfall/.test(field)) return kind === 'waterfall'
  if (/^bar/.test(field)) return isBarChart(kind)
  if (/^area/.test(field)) return isAreaChart(kind)
  if (/^interval|^range/.test(field)) return kind.includes('range') || kind === 'confidence-line'
  if (/^seasonal/.test(field)) return kind === 'seasonal-line'
  if (/^index/.test(field)) return kind === 'indexed-line'
  if (/^movingAverage/.test(field)) return kind.startsWith('moving-average')
  if (/^marker/.test(field)) return Boolean(plugin.capabilities.markers)
  if (/^direct|^showDirect/.test(field)) return Boolean(plugin.settings.features.directLabels)
  if (/^legend|^showLegend/.test(field)) return plugin.capabilities.guides.includes('legend') || kind === 'waffle'
  if (/^(?:xAxis|yAxis|axis|date|show[XY]|showZero|tick|categoryAxis)/.test(field)) return plugin.settings.sections.includes('axes')
  return true
}

export function auditCases(kind: ChartKind, settings: AuditSetting[] = []): AuditCase[] {
  const fixture = auditFixture(kind), base = fixture.config, plugin = chartRegistry.find((plugin) => plugin.id === kind)!
  const cases: AuditCase[] = [{ id: 'default', fields: [], patch: {}, export: true }]
  const add = (id: string, patch: Partial<ChartConfig>, exportFile = false) => cases.push({ id, fields: Object.keys(patch).filter((field) => JSON.stringify(patch[field as keyof ChartConfig]) !== JSON.stringify(base[field as keyof ChartConfig])), patch, export: exportFile })
  for (const field of settings) {
    if (!applicable(field.name, kind)) continue
    for (const value of field.values) add(`${field.name}=${String(value)}`, { [field.name]: value })
    if (field.number) {
      const control = field.controls.find((control) => control.min != null || control.max != null)
      const current = (base as unknown as Record<string, unknown>)[field.name]
      const values = control ? [control.min ?? 1, control.max ?? 24] : typeof current === 'number' ? [Math.max(0, current / 2), Math.max(1, current * 1.5)] : /Opacity|Curvature/.test(field.name) ? [.2, .8] : /Gap|Margin|Insets/.test(field.name) ? [0, 48] : /Min|Max|Midpoint|Reference/.test(field.name) ? [0, 80] : /Decimals/.test(field.name) ? [0, 3] : /Radius/.test(field.name) ? [0, 12] : /Width|Size|Length|Count|Columns|Rows|Window/.test(field.name) ? [2, 24] : [1, 12]
      for (const value of [...new Set(values)]) add(`${field.name}=${value}`, { [field.name]: value })
    }
    if (field.string && /Color$|^color$|Background$/.test(field.name)) add(`${field.name}=color`, { [field.name]: '#74204f' })
    if (field.name.endsWith('Text') && !field.name.endsWith('Html')) {
      const style = (base as unknown as Record<string, ChartConfig['valueText']>)[field.name] ?? base.valueText
      for (const align of ['left', 'center', 'right'] as const) add(`${field.name}:${align}`, { [field.name]: { ...style, size: 24, weight: 700, italic: true, lineHeight: 160, align, color: '#74204f' } })
      for (const size of [8, 12, 36, 64]) add(`${field.name}:size=${size}`, { [field.name]: { ...style, size } })
      for (const weight of [400, 500, 600, 700]) add(`${field.name}:weight=${weight}`, { [field.name]: { ...style, weight } })
      for (const lineHeight of [100, 120, 160, 200]) add(`${field.name}:lineHeight=${lineHeight}`, { [field.name]: { ...style, lineHeight } })
      for (const font of fontCatalog) add(`${field.name}:font=${font.family}`, { [field.name]: { ...style, fontFamily: font.value } })
    }
  }
  for (const xAxisPosition of ['top', 'bottom'] as const) for (const yAxisPosition of ['left', 'right'] as const) for (const legendPosition of ['top', 'bottom', 'left', 'right'] as const) {
    add(`axes-${xAxisPosition}-${yAxisPosition}-legend-${legendPosition}`, { xAxisPosition, yAxisPosition, legendPosition, showLegend: true, showXAxisTitle: true, showYAxisTitle: true, xAxisTitleGap: 24, yAxisTitleGap: 24, legendPlotGap: 24 })
  }
  add('combined-narrow-wrap', { canvasWidth: 480, canvasHeight: 640, legendPosition: 'right', xAxisPosition: 'top', yAxisPosition: 'right', xAxisLabelOverflow: 'wrap', xAxisLabelRotate: 0, canvasMarginLeft: 40, canvasMarginRight: 40, canvasMarginTop: 40, canvasMarginBottom: 40, title: 'Длинный заголовок графика с переносами и подробным пояснением', subtitle: 'Сравнение категорий и рядов при узком холсте', titleText: { ...base.titleText, size: 30, lineHeight: 130 }, showValues: true }, true)
  add('combined-rich-text', { title: 'Заголовок с выделением\nВторая строка', titleHtml: '<p><b>Заголовок</b> с <span style="color:#74204f;font-size:32px">выделением</span></p><p><i>Вторая строка</i></p>', subtitleHtml: '<p>Подзаголовок с <u>подчёркиванием</u></p>', sourceHtml: '<p>Источник: <b>контрольные данные</b></p>', noteHtml: '<p>Примечание с <span style="font-size:22px">разным размером</span></p>', legendPosition: 'bottom', xAxisPosition: 'top', yAxisPosition: 'right', noteText: { ...base.noteText, size: 18, lineHeight: 150 }, showValues: true }, true)
  add('combined-direct-and-dark', { ...applyCanvasTheme(base, 'dark'), showDirectLabels: true, showDirectLabelLines: true, showLegend: false, showValues: true }, true)
  add('combined-large-text-spacing', { canvasWidth: 1000, canvasHeight: 750, canvasMarginLeft: 64, canvasMarginRight: 64, titleSubtitleGap: 24, headerPlotGap: 40, legendPlotGap: 28, plotFooterGap: 36, noteSourceGap: 18, xAxisLabelRotate: 45, xAxisLabelOverflow: 'truncate', yAxisPosition: 'right', legendPosition: 'left', legendText: { ...base.legendText, size: 24, lineHeight: 150 }, valueText: { ...base.valueText, size: 24, lineHeight: 150 }, showValues: true }, true)
  add('structured-overrides', { palette: ['#0072b2', '#e69f00', '#009e73'], seriesOrder: [...base.yFields].reverse(), categoryLabelOverrides: { x: { '0:Категория 1': 'Перенос\nподписи' } }, seriesStyles: Object.fromEntries(base.yFields.map((name) => [name, { color: '#74204f', fillOpacity: .7, lineWidth: 3, legendLabel: `${name}\nПеренос в легенде`, legendNote: 'Пояснение', valueText: { ...base.valueText, size: 20 } }])) })
  add('annotation-combination', { annotations: [{ id: 'audit-annotation', x: 90, y: 90, width: 180, fontFamily: base.valueText.fontFamily, fontSize: 16, backgroundColor: '#ffffff', borderColor: '#202027', textAlign: 'center', fragments: [{ id: 'audit-fragment', text: 'Пояснение\nк графику', color: '#74204f', bold: true, italic: false }] }], decorations: [{ id: 'audit-arrow', type: 'arrow', x: 150, y: 180, width: 160, height: 100, color: '#74204f', opacity: .8, lineWidth: 2, lineType: 'dashed', endArrow: true }] })
  add('text-affixes-and-newlines', { title: 'Длинный заголовок\nЯвный перенос', subtitle: 'Подзаголовок\nВторая строка', note: 'Примечание\nВторая строка', source: 'Источник:\nКонтрольные данные', numberPrefix: '≈ ', numberSuffix: ' тыс.', xAxisNumberPrefix: 'X: ', xAxisNumberSuffix: ' единиц', valueLabelPrefix: 'Значение: ', valueLabelSuffix: ' ед.', numberZeroLabel: 'нет', xAxisStartLabel: 'Начало\nнаблюдений', xAxisEndLabel: 'Конец\nнаблюдений', xAxisTitle: 'Категории\nнаблюдений', yAxisTitle: 'Измеренные\nзначения' })
  add('layout-insets-and-category-order', { minimumPlotInsets: { top: 180, right: 80, bottom: 140, left: 140 }, categoryOrder: ['Категория 6', 'Категория 1', 'Категория 3'], paletteName: 'custom', paletteGradientColors: ['#0072b2', '#ffffff', '#e69f00'], elementStyles: {}, legendItemOverrides: { 'Значение': { label: 'Изменённая\nподпись', visible: false } } })
  if (plugin.settings.sections.includes('axes')) add('explicit-x-window', { xAxisMin: timed(kind) ? '2025-02-01' : '2', xAxisMax: timed(kind) ? '2025-05-01' : '12', dateAxisAnchor: '2025-01-15' })
  if (kind === 'waterfall') add('waterfall-custom-totals', { waterfallTotalLabel: 'Итого\nза период', waterfallPositivePrefix: '+', waterfallNegativePrefix: '−' })
  if (isBarChart(kind)) add('bar-sort-reference', { barCategorySortSeries: 'Другой' })
  if (kind === 'heatmap' || isMapChart(kind)) add('heatmap-missing-text', { heatmapMissingLabel: 'Нет\nданных', heatmapYField: 'Группа' })
  if (kind === 'waffle') add('waffle-unit-text', { waffleUnitLabel: 'Единица\nизмерения' })
  if (kind === 'scatter' || kind === 'bubble' || kind === 'connected-scatter') add('scatter-quadrant-text', { scatterSizeLegendTitle: 'Размер\nнаблюдения', scatterQuadrantColors: ['#0072b2', '#e69f00', '#009e73', '#74204f'], scatterQuadrantLabels: ['Левый верхний\nсектор', 'Правый верхний', 'Левый нижний', 'Правый нижний'] })
  if (isDistributionChart(kind)) add('distribution-category-overrides', { distributionCategoryOrder: ['Категория 6', 'Категория 1'], distributionCategoryStyles: { 'Категория 1': { color: '#74204f', label: 'Изменённая\nкатегория' }, 'Категория 2': { visible: false } }, distributionViolinSplitFirst: 'Группа 2', distributionViolinSplitSecond: 'Группа 1' })
  if (kind === 'seasonal-line') add('seasonal-accent', { seasonalAccentYears: ['2024'] })
  if (kind === 'indexed-line') add('index-base-change', { indexBaseXValue: `date:${dates[1].toISOString()}` })
  if (kind === 'slope') add('slope-period-change', { slopeXValues: [`date:${dates[1].toISOString()}`, `date:${dates[4].toISOString()}`] })
  if (kind === 'treemap') add('treemap-order-and-hide', { treemapGroupOrder: ['Категория 6', 'Категория 1'], treemapLeafOrder: { 'Категория 1': ['Группа 2', 'Группа 1'] }, treemapHiddenCategories: ['Категория 2'] })
  return cases
}

export const browserAuditCases = (kind: ChartKind) => auditCases(kind).filter((scenario) => scenario.export || scenario.id.startsWith('axes-'))
