import { niceNumericScale } from '../../../core/chartScale'
import { formatChartNumber } from '../../../core/numberFormat'
import type { ChartConfig, DataTable } from '../../../core/types'
import { markElementId, syntheticDatumId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { NativeWaterfallChartScene, WaterfallMarkScene } from '../../../entities/chart/model/ChartScene'
import { compileNativeBarScene, legacyBarElementKey } from '../bar/compiler'
import { formatWaterfallChange, waterfallSteps, waterfallValueLabel } from './transform'

export const legacyWaterfallBuilderGuard = () => { throw new Error('Legacy Waterfall builder was removed; use the native Waterfall compiler.') }

export function compileNativeWaterfallScene(table: DataTable, sourceConfig: ChartConfig): NativeWaterfallChartScene {
  if (sourceConfig.kind !== 'waterfall') throw new Error(`Native Waterfall compiler cannot compile ${sourceConfig.kind}.`)
  const field = sourceConfig.yFields[0] ?? sourceConfig.yField
  const config = { ...sourceConfig, yField: field, yFields: [field], seriesField: '', barCategorySort: 'none' as const, showLegend: false, showDirectLabels: false }
  const base = compileNativeBarScene(table, { ...config, kind: 'bar' })
  const source = base.plot.series[0]!
  const { steps, total } = waterfallSteps(source.marks.map((mark) => mark.value))
  const showTotal = config.waterfallShowTotal ?? true
  const totalLabel = config.waterfallTotalLabel?.trim() || 'Итого'
  const marks: WaterfallMarkScene[] = steps.map((step, index) => {
    const mark = source.marks[index]
    const override = config.elementStyles[mark.legacyKey]
    const color = override?.color ?? ((step.delta ?? 0) >= 0 ? config.waterfallIncreaseColor ?? '#36a476' : config.waterfallDecreaseColor ?? '#db5a5a')
    return { ...mark, value: step.delta, start: step.start, end: step.end, total: false, displayChange: step.delta == null ? 'пропуск' : formatWaterfallChange(step.delta, config), displayCumulative: formatChartNumber(step.end, config), displayValue: step.delta == null ? 'пропуск' : waterfallValueLabel(step.delta, step.end, false, config), style: { ...mark.style, color, borderColor: override?.borderColor ?? config.barBorderColor ?? color }, label: { ...mark.label, position: override?.waterfallLabelPosition ?? mark.label.position, text: override?.label || (step.delta == null ? '' : waterfallValueLabel(step.delta, step.end, false, config)) } }
  })
  if (showTotal) {
    const datumId = syntheticDatumId('waterfall-total', field), id = markElementId(source.id, datumId), legacyKey = legacyBarElementKey(source.name, totalLabel)
    const override = config.elementStyles[legacyKey], color = override?.color ?? config.waterfallTotalColor ?? '#6956e8'
    marks.push({ ...source.marks[0], id, datumId, seriesId: source.id, legacyKey, category: totalLabel, categoryIndex: marks.length, value: total, start: 0, end: total, total: true, displayCategory: totalLabel, displayChange: formatWaterfallChange(total, config), displayCumulative: formatChartNumber(total, config), displayValue: formatChartNumber(total, config), style: { ...source.marks[0]?.style, color, opacity: override?.fillOpacity ?? config.barFillOpacity ?? 1, borderColor: override?.borderColor ?? config.barBorderColor ?? color, borderWidth: override?.borderWidth ?? config.barBorderWidth ?? 0, borderRadius: config.barBorderRadius ?? 0, width: override?.barWidth }, label: { ...source.marks[0]?.label, visible: (override?.showLabel ?? config.showValues) && (config.waterfallShowTotalValue ?? true), text: override?.label || formatChartNumber(total, config), style: override?.valueText ?? config.valueText, position: override?.waterfallLabelPosition ?? config.valueLabelPosition ?? 'auto', autoContrast: config.valueLabelAutoContrast ?? true } })
  }
  const categories = marks.map((mark, index) => index < base.plot.categories.length ? base.plot.categories[index] : { id: mark.datumId, value: totalLabel, coordinate: `total:${field}`, label: totalLabel })
  const automatic = niceNumericScale(marks.flatMap((mark) => [mark.start, mark.end]), true)
  const valueDomain = { min: config.yAxisMin ?? automatic.min, max: config.yAxisMax ?? automatic.max, step: config.yAxisStep ?? automatic.step }
  const connectors = marks.slice(0, -1).map((mark, index) => ({ id: `waterfall-connector:${mark.id}`, fromId: mark.id, toId: marks[index + 1].id, value: mark.end, color: config.waterfallConnectorColor ?? '#8a8791' }))
  const elements: ChartElement[] = [...marks.map((mark): ChartElement => ({ id: mark.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: mark.seriesId, datumId: mark.datumId, legacyKey: mark.legacyKey })), ...categories.map((category): ChartElement => ({ id: `category-label:${category.id}`, role: 'category-label', coordinateSpace: 'canvas', selectable: true, axisId: 'category', datumId: category.id, text: category.label }))]
  return { ...base, document: chartDocumentFromLegacy(table, sourceConfig), compatibilityConfig: config, elements, guides: [], plot: { kind: 'waterfall', categories, categoryAxis: base.plot.categoryAxis, valueAxis: base.plot.valueAxis, valueDomain, barWidth: config.barWidth ?? 68, marks, connectors } }
}
