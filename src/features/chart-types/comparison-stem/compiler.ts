import { describeChange, changeColor, formatChange } from '../../../core/changeSemantics'
import type { ChartConfig, ChartKind, DataTable } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { ChartElement, ElementId } from '../../../entities/chart/model/ChartElement'
import type { CartesianPointScene, ComparisonStemConnectorScene, ComparisonStemSeriesScene, LayerId, NativeComparisonStemChartScene } from '../../../entities/chart/model/ChartScene'
import { compileNativeBarScene } from '../bar/compiler'
import { orderedBounds } from '../../../core/chartScale'

export const NATIVE_COMPARISON_STEM_KINDS = ['lollipop', 'horizontal-lollipop', 'dumbbell'] as const
export type NativeComparisonStemKind = typeof NATIVE_COMPARISON_STEM_KINDS[number]
export const isNativeComparisonStemKind = (kind: ChartKind): kind is NativeComparisonStemKind => (NATIVE_COMPARISON_STEM_KINDS as readonly ChartKind[]).includes(kind)

const pointFromBar = (mark: ReturnType<typeof compileNativeBarScene>['plot']['series'][number]['marks'][number], config: ChartConfig, seriesName: string, color: string, visible: boolean, position: CartesianPointScene['label']['position']): CartesianPointScene => {
  const seriesStyle = config.seriesStyles[seriesName]
  return {
    type: 'point', id: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, legacyKey: mark.legacyKey,
    category: mark.category, categoryIndex: mark.categoryIndex, value: mark.value, displayCategory: mark.displayCategory, displayValue: mark.displayValue,
    marker: { visible: true, shape: seriesStyle?.markerShape ?? 'circle', size: seriesStyle?.markerSize ?? 12, fill: seriesStyle?.markerFill ?? mark.style.color ?? color, stroke: seriesStyle?.markerBorder ?? color, strokeWidth: seriesStyle?.markerBorderWidth ?? 1 },
    label: { visible: mark.value != null && (config.elementStyles[mark.legacyKey]?.showLabel ?? visible), text: config.elementStyles[mark.legacyKey]?.label || mark.label.text, style: config.elementStyles[mark.legacyKey]?.valueText ?? config.valueText, position },
  }
}

const layerId = (ids: ElementId[]) => `layer:comparison:${ids.join('|')}` as LayerId

export function compileNativeComparisonStemScene(table: DataTable, sourceConfig: ChartConfig): NativeComparisonStemChartScene {
  if (!isNativeComparisonStemKind(sourceConfig.kind)) throw new Error(`Native comparison/stem compiler cannot compile ${sourceConfig.kind}.`)
  const dumbbell = sourceConfig.kind === 'dumbbell'
  const orientation = dumbbell ? sourceConfig.dumbbellOrientation ?? 'horizontal' : sourceConfig.kind === 'horizontal-lollipop' ? 'horizontal' : 'vertical'
  const fields = dumbbell ? [sourceConfig.dumbbellStartField, sourceConfig.dumbbellEndField].filter((field): field is string => Boolean(field)) : sourceConfig.yFields
  const validDumbbell = !dumbbell || fields.length === 2 && fields[0] !== fields[1]
  const surrogate = {
    ...sourceConfig,
    kind: orientation === 'horizontal' ? 'horizontal-bar' as const : 'bar' as const,
    barOrientation: orientation,
    barValueLabelAbsorption: false,
    ...(dumbbell ? { seriesField: '', yFields: fields, yField: fields[0] ?? sourceConfig.yField } : {}),
    ...(dumbbell ? { seriesOrder: fields, barCategorySort: 'none' as const } : {}),
  }
  const base = compileNativeBarScene(table, surrogate)
  const wanted = validDumbbell ? fields.flatMap((field) => base.plot.series.find((series) => series.name === field) ?? []) : []
  const sourceSeries = dumbbell ? wanted : base.plot.series
  const pairedIndices = dumbbell && wanted.length === 2
    ? base.plot.categories.flatMap((_, index) => wanted.every((series) => series.marks[index]?.value != null) ? [index] : [])
    : base.plot.categories.map((_, index) => index)
  if (dumbbell && wanted.length === 2 && (sourceConfig.dumbbellSort ?? 'none') !== 'none') {
    const sort = sourceConfig.dumbbellSort ?? 'none', direction = sourceConfig.dumbbellSortDirection === 'asc' ? 1 : -1
    pairedIndices.sort((left, right) => {
      const startLeft = wanted[0].marks[left].value!, startRight = wanted[0].marks[right].value!
      const endLeft = wanted[1].marks[left].value!, endRight = wanted[1].marks[right].value!
      const a = sort === 'difference' ? endLeft - startLeft : sort === 'start' ? startLeft : endLeft
      const b = sort === 'difference' ? endRight - startRight : sort === 'start' ? startRight : endRight
      return (a - b) * direction
    })
  }
  const categories = pairedIndices.map((index) => base.plot.categories[index])
  const indexMap = new Map(pairedIndices.map((sourceIndex, index) => [sourceIndex, index]))
  const series: ComparisonStemSeriesScene[] = sourceSeries.map((source, seriesIndex) => {
    const role = dumbbell ? seriesIndex === 0 ? 'start' : 'end' : 'value'
    const color = source.color
    const points = pairedIndices.flatMap((sourceIndex) => {
      const mark = source.marks[sourceIndex]
      if (!mark || mark.value == null) return []
      let position: CartesianPointScene['label']['position'] = orientation === 'horizontal' ? 'right' : 'top'
      if (dumbbell) {
        const other = sourceSeries[seriesIndex === 0 ? 1 : 0]?.marks[sourceIndex]?.value
        const lower = seriesIndex === 0 ? mark.value <= (other ?? mark.value) : mark.value < (other ?? mark.value)
        position = orientation === 'horizontal' ? lower ? 'left' : 'right' : lower ? 'bottom' : 'top'
      }
      const visible = sourceConfig.showValues && (!dumbbell || (role === 'start' ? sourceConfig.dumbbellShowStartValue ?? true : sourceConfig.dumbbellShowEndValue ?? true))
      return [{ ...pointFromBar(mark, sourceConfig, source.name, color, visible, position), categoryIndex: indexMap.get(sourceIndex)! }]
    })
    return { id: source.id, name: source.name, color, visible: true, role, points }
  })
  const values = series.flatMap((item) => item.points.flatMap((point) => point.value != null && point.value > 0 ? [point.value] : []))
  const [configuredMin, configuredMax] = orderedBounds(sourceConfig.yAxisMin, sourceConfig.yAxisMax)
  const logMin = 10 ** Math.floor(Math.log10(values.length ? Math.min(...values) : 1))
  const logMaxBase = 10 ** Math.ceil(Math.log10(values.length ? Math.max(...values) : 10))
  const logDomainMin = configuredMin != null && configuredMin > 0 ? configuredMin : logMin
  const valueDomain = sourceConfig.yAxisScaleType === 'log'
    ? { min: logDomainMin, max: configuredMax != null && configuredMax > logDomainMin ? configuredMax : Math.max(logDomainMin * 10, logMaxBase), step: sourceConfig.yAxisStep ?? base.plot.valueDomain.step }
    : base.plot.valueDomain
  const connectors: ComparisonStemConnectorScene[] = dumbbell && series.length === 2
    ? categories.map((category, categoryIndex) => {
      const first = series[0].points[categoryIndex], second = series[1].points[categoryIndex]
      const descriptor = describeChange(first.value!, second.value!)
      const color = sourceConfig.dumbbellColorByChange
        ? changeColor(descriptor, sourceConfig.dumbbellIncreaseColor ?? '#168a72', sourceConfig.dumbbellDecreaseColor ?? '#db5a5a', sourceConfig.dumbbellNeutralColor ?? '#777580')
        : sourceConfig.dumbbellConnectorColor ?? sourceConfig.gridColor
      const endpointIds = [first.id, second.id]
      return { id: layerId(endpointIds), categoryId: category.id, categoryIndex, endpointIds, fromValue: first.value!, toValue: second.value!, stroke: { color, width: sourceConfig.dumbbellConnectorWidth ?? 3, type: sourceConfig.dumbbellConnectorType ?? 'solid', opacity: sourceConfig.dumbbellConnectorOpacity ?? 1 }, change: { descriptor, visible: Boolean(sourceConfig.dumbbellShowDifference), label: formatChange(descriptor, sourceConfig.dumbbellDifferenceFormat ?? 'absolute', sourceConfig, sourceConfig.dumbbellPercentDecimals ?? 0), position: sourceConfig.dumbbellDifferencePosition ?? 'middle', color: sourceConfig.dumbbellColorByChange ? color : sourceConfig.valueText.color } }
    })
    : series.flatMap((item) => item.points.map((point) => ({ id: layerId([point.id]), categoryId: categories[point.categoryIndex].id, categoryIndex: point.categoryIndex, endpointIds: [point.id], fromValue: sourceConfig.yAxisScaleType === 'log' ? valueDomain.min : 0, toValue: point.value!, stroke: { color: item.color, width: Math.max(1, sourceConfig.seriesStyles[item.name]?.lineWidth ?? 2), type: 'solid', opacity: .72 } })))
  const pointIds = new Set(series.flatMap((item) => item.points.map((point) => point.id)))
  const categoryIds = new Set(categories.map((category) => `category-label:${category.id}`))
  const elements: ChartElement[] = base.elements.filter((element) => element.role === 'mark' ? pointIds.has(element.id) : element.role === 'category-label' ? categoryIds.has(element.id) : 'seriesId' in element && series.some((item) => item.id === element.seriesId))
  return { ...base, document: chartDocumentFromLegacy(table, sourceConfig), compatibilityConfig: sourceConfig, elements, plot: { kind: 'comparison-stem', variant: dumbbell ? 'dumbbell' : 'lollipop', categoryPlacement: 'band', orientation, categories, categoryAxis: base.plot.categoryAxis, valueAxis: base.plot.valueAxis, valueDomain, series, connectors } }
}
