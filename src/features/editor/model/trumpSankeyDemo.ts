import type { ChartConfig } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'

export function createTrumpSankeyDemoConfig(): ChartConfig {
  const defaults = createDefaultChartConfig()
  // Branch colors follow the supplied infographic.
  const branches: Array<[string, string[]]> = [
    ['#49b6e9', ['Демократы', 'Другие демократы', 'Чак и Нэнси', 'Хиллари']],
    ['#ff8b75', ['Республиканцы', 'Коркер', 'Другие республиканцы']],
    ['#b9adff', ['СМИ', 'Конкретные издания', '«Фейковые новости»', 'Другие СМИ', 'NYT', 'CNN', 'NBC']],
    ['#bdbdbd', ['Другие', 'Зарубежные деятели', 'Компании', 'Публичные фигуры', 'Знаменитости', 'Спорт', 'Коми', 'Другие публичные фигуры']],
  ]
  return {
    ...defaults, kind: 'sankey',
    xField: 'Откуда', sankeyTargetField: 'Куда', yField: 'Значение', yFields: ['Значение'], seriesField: '', aggregation: 'sum',
    preferredDataSelection: { xField: 'Откуда', yFields: ['Значение'], seriesField: '' },
    title: 'Кого Трамп атаковал в Twitter', subtitle: 'С 20 января по 11 октября · категории адресатов',
    note: 'Адаптация изображения: подкатегории «Другие» дают 32 вместо 28; общий итог — 171 вместо 167.',
    source: 'Источник: предоставленная инфографика',
    canvasPreset: 'custom', canvasWidth: 1000, canvasHeight: 1000,
    showLegend: false, showXAxisTitle: false, showYAxisTitle: false, showValues: true,
    sankeyNodeAlign: 'justify', sankeyNodeGap: 18, sankeyLinkColor: 'target', sankeyLinkOpacity: .8,
    sankeyValueFormat: 'absolute', sankeyLabelPosition: 'outside',
    sankeyCompactLabels: true,
    valueText: { ...defaults.valueText, size: 16 },
    elementStyles: Object.fromEntries([
      ['sankey-node:Атаки в Twitter', { color: '#202027' }],
      ...branches.flatMap(([color, names]) => names.map((name) => [`sankey-node:${name}`, { color }])),
    ]),
  }
}
