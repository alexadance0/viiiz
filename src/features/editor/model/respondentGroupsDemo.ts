import type { ChartConfig, DataTable } from '../../../core/types'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { applyChartTextStyle } from '../../../core/chartTextStyle'
import { createPanelConfig } from './multiples'

const groups = [
  { title: 'Все респонденты', categories: ['Все респонденты'], values: [64] },
  { title: 'По полу', categories: ['Мужчины', 'Женщины'], values: [67, 61] },
  { title: 'По возрасту', categories: ['18–24 года', '25–34 года', '35–44 года', '45–60 лет'], values: [85, 63, 52, 52] },
  { title: 'По образованию', categories: ['Среднее общее', 'Среднее проф.', 'Высшее'], values: [78, 66, 53] },
]

// Repeated categories use the existing average aggregation: all panels share one table.
export const respondentGroupsDemoTable: DataTable = {
  name: 'Демо · группы респондентов · условные данные',
  columns: groups.flatMap(({ title }) => [title, `Доля · ${title}`, `Остаток · ${title}`]),
  rows: Array.from({ length: 4 }, (_, row) => Object.fromEntries(groups.flatMap(({ title, categories, values }) => {
    const index = row % categories.length
    return [[title, categories[index]], [`Доля · ${title}`, values[index]], [`Остаток · ${title}`, 100 - values[index]]]
  }))),
}

export function createRespondentGroupsDemoConfig(): ChartConfig {
  const base = applyChartTextStyle(createDefaultChartConfig(), { color: '#ffffff' })
  const config: ChartConfig = {
    ...base, kind: 'horizontal-stacked-bar', barOrientation: 'horizontal',
    canvasPreset: 'custom', canvasWidth: 1000, canvasHeight: 1280, canvasBackground: '#202027',
    canvasMarginTop: 48, canvasMarginRight: 48, canvasMarginBottom: 40, canvasMarginLeft: 48,
    title: 'Как различаются ответы\nразных групп респондентов',
    subtitle: 'Пример композиции · условные данные, %',
    note: 'Числа придуманы для демонстрации редактора и не описывают результаты опроса.',
    source: 'Демо: общая шкала и одинаковый шаг категорий',
    subtitleText: { ...base.subtitleText, size: 25 },
    noteText: { ...base.noteText, size: 19, color: '#d4d4d4' },
    sourceText: { ...base.sourceText, size: 17, color: '#d4d4d4' },
    headerPlotGap: 32, plotFooterGap: 32,
  }
  config.multiples = {
    columns: 1, rows: 4, gap: 18, equalCategorySpacing: true,
    sharedValueScale: true, valueMin: 0, valueMax: 100, valueStep: 25, sharedScaleLabels: 'bottom',
    panels: groups.map(({ title }, index) => {
      const value = `Доля · ${title}`, remainder = `Остаток · ${title}`
      return { id: `respondent-group-${index}`, config: {
        ...createPanelConfig(config, title),
        xField: title, yField: value, yFields: [value, remainder],
        preferredDataSelection: { xField: title, yFields: [value, remainder], seriesField: '' },
        aggregation: 'average', valueMode: 'absolute', numberSuffix: '%', numberDecimals: 0,
        xAxisNumberSuffix: '%', xAxisAffixScope: 'edges',
        showTitle: index !== 0, showXAxisTitle: false, showYAxisTitle: false,
        showXAxisLine: false, showYAxisLine: false, showXTicks: false, showYTicks: false,
        showHorizontalGrid: false, showVerticalGrid: true, gridColor: '#777580', gridWidth: 1,
        barWidth: 88, showValues: false, showLegend: false,
        titleText: { ...config.titleText, size: 25 },
        xAxisLabelText: { ...config.axisLabelText, size: 21, weight: 600 },
        yAxisLabelText: { ...config.axisLabelText, size: 20 },
        seriesStyles: { [value]: { color: '#db5a5a' }, [remainder]: { color: '#55515e' } },
        canvasMarginLeft: 0, canvasMarginRight: 0,
      } }
    }),
  }
  return config
}
