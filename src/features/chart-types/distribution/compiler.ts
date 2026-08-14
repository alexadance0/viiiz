import { niceNumericScale } from '../../../core/chartScale'
import { seriesLegendItemId } from '../../../core/legend'
import { formatChartNumber } from '../../../core/numberFormat'
import type { ChartConfig, DataTable } from '../../../core/types'
import { aggregateDatumId, markElementId, seriesId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { DistributionBarcodeMarkScene, DistributionBoxMarkScene, DistributionCountMarkScene, DistributionGroupScene, DistributionLayerScene, DistributionObservationScene, LayerId, NativeDistributionChartScene } from '../../../entities/chart/model/ChartScene'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import type { GuideSpec } from '../../chart-layout/guides/types'
import { distributionDensity } from './density'
import { legacyDistributionElementKey, prepareDistributionGroups } from './prepare'
import { resolveDistributionViolinSplitSelection } from './splitSelection'

export const NATIVE_DISTRIBUTION_KINDS = ['strip-plot', 'jitter-plot', 'beeswarm', 'counts-plot', 'barcode-plot', 'boxplot', 'violinplot', 'raincloud', 'ridgeline'] as const
export type NativeDistributionKind = typeof NATIVE_DISTRIBUTION_KINDS[number]
export const isNativeDistributionKind = (kind: ChartConfig['kind']): kind is NativeDistributionKind => NATIVE_DISTRIBUTION_KINDS.includes(kind as NativeDistributionKind)
export { legacyDistributionElementKey } from './prepare'
const variant = (kind: NativeDistributionKind) => ({ 'strip-plot': 'strip', 'jitter-plot': 'jitter', beeswarm: 'beeswarm', 'counts-plot': 'counts', 'barcode-plot': 'barcode', boxplot: 'box', violinplot: 'violin', raincloud: 'raincloud', ridgeline: 'ridgeline' } as const)[kind]
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function validateNativeDistributionMapping(table: DataTable, config: ChartConfig) {
  const fields = config.yFields.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  return fields.length ? { ok: true, errors: [] } : { ok: false, errors: [{ field: 'yFields', message: 'Выберите хотя бы один числовой показатель для распределения.' }] }
}

const axis = (id: 'value' | 'lane', orientation: 'horizontal' | 'vertical', config: ChartConfig, duplicateYAxisTitle: boolean): AxisSpec => {
  const screenX = orientation === 'horizontal'
  const labels = screenX ? config.xAxisLabelText ?? config.axisLabelText : config.yAxisLabelText ?? config.axisLabelText
  const title = screenX ? { visible: config.showXAxisTitle, text: config.xAxisTitle, size: 0, gap: config.xAxisTitleGap, style: config.xAxisTitleText ?? config.axisTitleText } : { visible: duplicateYAxisTitle ? false : config.showYAxisTitle, text: config.yAxisTitle, size: 0, gap: config.yAxisTitleGap, style: config.yAxisTitleText ?? config.axisTitleText }
  return { id, channel: id, orientation, placement: { kind: 'side', side: screenX ? config.xAxisPosition : config.yAxisPosition }, line: { visible: screenX ? config.showXAxisLine : config.showYAxisLine }, ticks: { visible: screenX ? config.showXTicks : config.showYTicks, length: config.tickLength }, labels: { visible: screenX ? config.showXAxisLabels ?? true : config.showYAxisLabels ?? true, size: 0, gap: screenX ? config.xAxisLabelGap ?? 8 : config.yAxisLabelGap ?? 8, rotation: screenX ? typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0 : 0, style: labels }, title }
}

export function compileNativeDistributionScene(table: DataTable, config: ChartConfig): NativeDistributionChartScene {
  if (!isNativeDistributionKind(config.kind)) throw new Error(`Native Distribution compiler cannot compile ${config.kind}.`)
  const prepared = prepareDistributionGroups(table, config)
  const { selectedFields, groupField, categories, lanes, laneLabels, layoutMode } = prepared
  const pointSize = config.distributionPointSize ?? 9, pointOpacity = clamp01(config.distributionPointOpacity ?? .4)
  const defaultLabelPosition = config.distributionLabelPosition ?? ((config.distributionOrientation ?? 'horizontal') === 'horizontal' ? 'right' : 'top')
  const allGroups = prepared.groups
  const split = resolveDistributionViolinSplitSelection(layoutMode, categories.filter((item): item is string => item != null), selectedFields, config.distributionViolinSplitFirst, config.distributionViolinSplitSecond)
  const splitSelection = new Set([split.first, split.second].filter(Boolean))
  const groups = allGroups.filter((group) => config.kind !== 'violinplot' || config.distributionViolinMode !== 'split' || splitSelection.size < 2 || splitSelection.has(group.seriesKey))
  groups.forEach((group) => lanes.find((lane) => lane.id === group.laneId)?.groupIds.push(group.id))
  const values = groups.flatMap((group) => group.observations.map((observation) => observation.value)), rawSpan = prepared.rawSpan
  const densityProfiles = new Map(groups.map((group) => [group.id, distributionDensity(group.observations.map(({ value }) => value), config.distributionBandwidth ?? .14, rawSpan, group.summary)]))
  const densityTailValues = config.kind === 'violinplot' || config.kind === 'raincloud' || config.kind === 'ridgeline' ? [...densityProfiles.values()].flatMap((profile) => [profile.minimum, profile.maximum]) : []
  const scale = niceNumericScale([...values, ...densityTailValues])
  const fullGrid = config.showHorizontalGrid && config.showVerticalGrid, singlePadding = lanes.length === 1 ? 1 : .5
  const ridgeExtent = Math.min(1.6, Math.max(.15, (config.distributionWidth ?? 72) / 100) * (1 + (config.distributionRidgelineOverlap ?? 35) / 100))
  const horizontal = (config.distributionOrientation ?? 'horizontal') === 'horizontal'
  const laneDomain = { min: config.kind === 'ridgeline' && horizontal ? -Math.ceil(ridgeExtent) : fullGrid ? -1 : -singlePadding, max: config.kind === 'ridgeline' && !horizontal ? lanes.length - 1 + Math.ceil(ridgeExtent) : fullGrid ? lanes.length : lanes.length - 1 + singlePadding, interval: fullGrid ? 1 : .5 }
  const orientation = config.distributionOrientation ?? 'horizontal'
  const duplicateYAxisTitle = orientation === 'horizontal' && laneLabels.some((label) => label.trim() === config.yAxisTitle.trim())
  const valueAxis = axis('value', orientation === 'horizontal' ? 'horizontal' : 'vertical', config, duplicateYAxisTitle)
  const laneAxis = axis('lane', orientation === 'horizontal' ? 'vertical' : 'horizontal', config, duplicateYAxisTitle)
  const observationGroups = groups.map((group) => ({ groupId: group.id, marks: group.observations }))
  const countGroups = groups.map((group) => ({ groupId: group.id, marks: [...group.observations.reduce((map, observation) => map.set(observation.value, [...(map.get(observation.value) ?? []), observation]), new Map<number, DistributionObservationScene[]>())].map(([value, sources]): DistributionCountMarkScene => {
    const legacyKey = legacyDistributionElementKey(group.sourceSeriesName, `count:${value}`), override = config.elementStyles[legacyKey], datumId = aggregateDatumId(group.id, `count:${value}`), size = pointSize * Math.sqrt(sources.length)
    return { id: markElementId(seriesId(`distribution:${group.field}`, group.categoryKey ?? ''), datumId), datumId, groupId: group.id, legacyKey, value, count: sources.length, sourceDatumIds: sources.map((item) => item.datumId), displayValue: formatChartNumber(value, config), displayCategory: group.displayName, displayLabel: formatChartNumber(value, config), marker: { shape: 'circle', size, fill: override?.color ?? group.color, stroke: override?.color ?? group.color, strokeWidth: 0, opacity: clamp01(override?.fillOpacity ?? pointOpacity) }, label: { visible: override?.showLabel ?? config.distributionShowLabels ?? false, text: override?.label || formatChartNumber(value, config), position: override?.labelPosition ?? defaultLabelPosition, style: override?.valueText ?? config.valueText } }
  }) }))
  const barcodeGroups = groups.map((group) => ({
    groupId: group.id,
    marks: group.observations.map((observation): DistributionBarcodeMarkScene => {
      const override = config.elementStyles[observation.legacyKey]
      return { id: observation.id, datumId: observation.datumId, groupId: group.id, legacyKey: observation.legacyKey, value: observation.value, displayValue: observation.displayValue, displayCategory: observation.displayCategory, displayLabel: observation.displayLabel, stroke: { color: override?.color ?? override?.markerFill ?? group.color, width: override?.lineWidth ?? config.distributionTickWidth ?? 2, opacity: clamp01(override?.fillOpacity ?? pointOpacity) }, label: observation.label }
    }),
  }))
  const summaryMarks = groups.map((group) => { const primary = config.seriesStyles[group.sourceSeriesName], fallback = config.seriesStyles[group.seriesKey], statistic = config.distributionSummaryStatistic === 'mean' ? 'mean' as const : 'median' as const; return { id: `summary:${group.id}`, groupId: group.id, value: group.summary[statistic], visible: config.distributionShowMedian ?? true, statistic, color: primary?.distributionSummaryColor ?? fallback?.distributionSummaryColor ?? group.color, width: primary?.distributionSummaryWidth ?? fallback?.distributionSummaryWidth ?? config.distributionSummaryWidth ?? 3, lengthRatio: (primary?.distributionSummaryLength ?? fallback?.distributionSummaryLength ?? config.distributionSummaryLength ?? 100) / 100 } })
  const summaryStyle = (group: DistributionGroupScene) => { const primary = config.seriesStyles[group.sourceSeriesName], fallback = config.seriesStyles[group.seriesKey]; return { color: primary?.distributionSummaryColor ?? fallback?.distributionSummaryColor ?? group.color, width: primary?.distributionSummaryWidth ?? fallback?.distributionSummaryWidth ?? config.distributionSummaryWidth ?? 3, lengthRatio: (primary?.distributionSummaryLength ?? fallback?.distributionSummaryLength ?? config.distributionSummaryLength ?? 100) / 100 } }
  const tooltip = (group: DistributionGroupScene) => ({ group: group.displayName, count: group.summary.count, median: formatChartNumber(group.summary.median, config), mean: formatChartNumber(group.summary.mean, config), quartiles: `${formatChartNumber(group.summary.q1, config)}–${formatChartNumber(group.summary.q3, config)}` })
  const boxMarks: DistributionBoxMarkScene[] = groups.map((group) => { const style = summaryStyle(group); return { id: `layer:${group.id}:box` as LayerId, groupId: group.id, minimumInlier: group.summary.minimumInlier, q1: group.summary.q1, median: group.summary.median, q3: group.summary.q3, maximumInlier: group.summary.maximumInlier, boxStyle: { fillColor: group.color, fillOpacity: .42, strokeColor: group.color, strokeWidth: 1.5 }, whiskerStyle: { color: group.color, width: 1.5 }, medianStyle: { ...style, visible: config.distributionShowMedian ?? true }, tooltip: tooltip(group) } })
  const densityGroups = groups.map((group) => { const style = summaryStyle(group), splitSide = group.seriesKey === split.first ? 'half-first' : 'half-second'; return { id: `layer:${group.id}:density` as LayerId, groupId: group.id, mode: config.kind === 'ridgeline' ? 'ridge' as const : config.kind === 'raincloud' ? 'half-first' as const : config.distributionViolinMode === 'split' ? splitSide as 'half-first' | 'half-second' : config.distributionViolinMode === 'half' ? `half-${config.distributionViolinHalfSide ?? 'second'}` as 'half-first' | 'half-second' : 'full' as const, profile: densityProfiles.get(group.id)!, fill: { color: group.color, opacity: config.distributionDensityFillOpacity ?? .2 }, outline: { color: group.color, width: config.kind === 'ridgeline' ? config.seriesStyles[group.sourceSeriesName]?.lineWidth ?? config.seriesStyles[group.seriesKey]?.lineWidth ?? 2 : 1.25 }, widthRatio: config.kind === 'ridgeline' ? ridgeExtent : Math.min(.9, Math.max(.15, (config.distributionWidth ?? 72) / 100)), summary: { mode: config.kind === 'ridgeline' ? 'ridge' as const : config.distributionViolinSummaryMode ?? 'box', showWhiskers: config.kind !== 'ridgeline' && (config.distributionViolinShowWhiskers ?? true), showMedian: config.distributionShowMedian ?? true, style, boxFill: config.canvasBackground ?? '#ffffff', boxThickness: Math.max(config.kind === 'raincloud' ? 12 : 6, pointSize * (config.kind === 'raincloud' ? 1.45 : 1)) }, tooltip: tooltip(group) } })
  const shown = (group: DistributionGroupScene) => group.observations.filter((observation) => config.elementStyles[observation.legacyKey]?.showLabel || (config.kind === 'boxplot' ? config.distributionShowAllPoints || ((config.distributionShowOutliers ?? true) && group.summary.outlierDatumIds.includes(observation.datumId)) : (config.kind === 'violinplot' || config.kind === 'raincloud') && (config.distributionShowPoints ?? true)))
  const shapeObservationGroups = groups.map((group) => ({ groupId: group.id, marks: shown(group) }))
  const layers: DistributionLayerScene[] = config.kind === 'counts-plot' ? [{ kind: 'counts', groups: countGroups }] : config.kind === 'barcode-plot' ? [{ kind: 'barcodes', groups: barcodeGroups }] : config.kind === 'boxplot' ? [{ kind: 'boxes', marks: boxMarks }, { kind: 'observations', groups: shapeObservationGroups }] : config.kind === 'violinplot' || config.kind === 'raincloud' || config.kind === 'ridgeline' ? [{ kind: 'density', groups: densityGroups }, ...(config.kind === 'ridgeline' ? [] : [{ kind: 'observations' as const, groups: shapeObservationGroups }])] : [{ kind: 'observations', groups: observationGroups }]
  if (!['boxplot', 'violinplot', 'raincloud', 'ridgeline'].includes(config.kind)) layers.push({ kind: 'summaries', marks: summaryMarks } as never)
  const uniqueLegendGroups = [...new Map(groups.map((group) => [group.sourceSeriesName, group])).values()]
  const guides: GuideSpec[] = [{ id: 'legend', kind: 'categorical-legend', visible: Boolean(groupField && config.showLegend), coordinateSpace: 'content', position: config.legendPosition ?? 'top', items: uniqueLegendGroups.map((group) => ({ id: seriesLegendItemId(seriesId(`distribution:${group.field}`, group.categoryKey ?? '')), label: config.seriesStyles[group.sourceSeriesName]?.legendLabel?.trim() || group.sourceSeriesName, visible: config.seriesStyles[group.sourceSeriesName]?.showLegendItem ?? true, color: group.color, marker: { kind: 'point' }, target: { kind: 'series', seriesId: seriesId(`distribution:${group.field}`, group.categoryKey ?? '') } })) }]
  const activeMarks = config.kind === 'counts-plot' ? countGroups.flatMap((entry) => entry.marks) : config.kind === 'barcode-plot' ? barcodeGroups.flatMap((entry) => entry.marks) : groups.flatMap((group) => group.observations)
  const elements: ChartElement[] = activeMarks.map((mark) => ({ id: mark.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: seriesId(`distribution:${groups.find((group) => group.id === mark.groupId)?.field ?? ''}`, groups.find((group) => group.id === mark.groupId)?.categoryKey ?? ''), datumId: mark.datumId, legacyKey: mark.legacyKey }))
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const).filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false)).map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { migrationMode: 'native', document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides, frameElements, plot: { kind: 'distribution', variant: variant(config.kind), orientation, layoutMode, valueAxis, laneAxis, valueDomain: { min: config.yAxisMin ?? scale.min, max: config.yAxisMax ?? scale.max, step: config.yAxisStep ?? scale.step }, laneDomain, widthRatio: Math.min(.9, Math.max(.15, (config.distributionWidth ?? 72) / 100)), jitterAmount: config.distributionJitter ?? .32, lanes, groups, layers, grid: { valueVisible: orientation === 'horizontal' ? config.showVerticalGrid : config.showHorizontalGrid, laneVisible: orientation === 'horizontal' ? config.showHorizontalGrid : config.showVerticalGrid, color: config.gridColor, width: config.gridWidth, type: config.gridType } } }
}
