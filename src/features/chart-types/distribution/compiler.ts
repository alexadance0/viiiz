import { niceNumericScale } from '../../../core/chartScale'
import { seriesLegendItemId } from '../../../core/legend'
import { formatChartNumber } from '../../../core/numberFormat'
import { getSeriesColor } from '../../../core/seriesColor'
import type { ChartConfig, DataTable } from '../../../core/types'
import { aggregateDatumId, markElementId, rawDatumId, seriesId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { DistributionBarcodeMarkScene, DistributionCountMarkScene, DistributionGroupId, DistributionGroupScene, DistributionLaneId, DistributionLaneScene, DistributionMarkerStyle, DistributionObservationScene, NativeDistributionChartScene } from '../../../entities/chart/model/ChartScene'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import type { GuideSpec } from '../../chart-layout/guides/types'
import { distributionStatistics } from './statistics'

export const NATIVE_DISTRIBUTION_KINDS = ['strip-plot', 'jitter-plot', 'beeswarm', 'counts-plot', 'barcode-plot'] as const
export type NativeDistributionKind = typeof NATIVE_DISTRIBUTION_KINDS[number]
export const isNativeDistributionKind = (kind: ChartConfig['kind']): kind is NativeDistributionKind => NATIVE_DISTRIBUTION_KINDS.includes(kind as NativeDistributionKind)
export const legacyDistributionElementKey = (series: string, category: unknown) => `${series}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`
const groupId = (value: string) => `distribution-group:${encodeURIComponent(value)}` as DistributionGroupId
const laneId = (value: string) => `distribution-lane:${encodeURIComponent(value)}` as DistributionLaneId
const variant = (kind: NativeDistributionKind) => ({ 'strip-plot': 'strip', 'jitter-plot': 'jitter', beeswarm: 'beeswarm', 'counts-plot': 'counts', 'barcode-plot': 'barcode' } as const)[kind]
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
  const fieldOrder = new Map((config.seriesOrder ?? []).map((field, index) => [field, index]))
  const fields = config.yFields.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  const selectedFields = [...(fields.length ? fields : [config.yField])].filter(Boolean).sort((left, right) => (fieldOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (fieldOrder.get(right) ?? Number.MAX_SAFE_INTEGER))
  const groupField = config.distributionGroupField
  const discovered = groupField ? [...new Set(table.rows.flatMap((row) => selectedFields.some((field) => typeof row[field] === 'number' && Number.isFinite(row[field])) ? [String(row[groupField] ?? 'Без категории')] : []))] : []
  const configured = config.distributionCategoryOrder ?? []
  const ordered = [...configured.filter((category) => discovered.includes(category)), ...discovered.filter((category) => !configured.includes(category))]
  const visible = ordered.filter((category) => config.distributionCategoryStyles?.[category]?.visible !== false)
  const categories: Array<string | null> = groupField ? (visible.length ? visible : ordered.slice(0, 1)) : [null]
  const categoryLabel = (category: string | null) => category == null ? '' : config.distributionCategoryStyles?.[category]?.label?.trim() || category
  const layoutMode = groupField ? config.distributionLayoutMode ?? 'measures' : 'measures'
  const laneKeys = layoutMode === 'measures' ? selectedFields : categories.map((category) => String(category))
  const laneLabels = layoutMode === 'measures' ? selectedFields : categories.map(categoryLabel)
  const lanes: DistributionLaneScene[] = laneKeys.map((key, index) => ({ id: laneId(`${layoutMode}:${key}`), index, label: laneLabels[index], groupIds: [] }))
  const pointSize = config.distributionPointSize ?? 9, pointOpacity = clamp01(config.distributionPointOpacity ?? .4)
  const defaultLabelPosition = config.distributionLabelPosition ?? ((config.distributionOrientation ?? 'horizontal') === 'horizontal' ? 'right' : 'top')
  const groups: DistributionGroupScene[] = selectedFields.flatMap((field, fieldIndex) => categories.flatMap((category, categoryIndex) => {
    const name = layoutMode === 'measures' ? groupField ? categoryLabel(category) : field : field
    const semanticKey = `${field}\u001f${category == null ? 'none' : `string:${category}`}`
    const id = groupId(semanticKey), color = layoutMode === 'measures' && groupField ? config.distributionCategoryStyles?.[String(category)]?.color ?? getSeriesColor(config, String(category), categoryIndex) : getSeriesColor(config, field, fieldIndex)
    const observations = table.rows.flatMap((row, sourceRowIndex): DistributionObservationScene[] => {
      const value = row[field]
      if ((groupField && String(row[groupField] ?? 'Без категории') !== category) || typeof value !== 'number' || !Number.isFinite(value)) return []
      const datumId = rawDatumId(sourceRowIndex, field), legacyKey = legacyDistributionElementKey(name, `row:${sourceRowIndex}:${field}`), override = config.elementStyles[legacyKey]
      const displayLabel = config.distributionLabelField ? String(row[config.distributionLabelField] ?? '') : formatChartNumber(value, config)
      const marker: DistributionMarkerStyle = { shape: override?.markerShape ?? 'circle', size: override?.markerSize ?? pointSize, fill: override?.markerFill ?? override?.color ?? color, stroke: override?.markerBorder ?? override?.color ?? color, strokeWidth: override?.markerBorderWidth ?? 0, opacity: clamp01(override?.fillOpacity ?? pointOpacity) }
      return [{ id: markElementId(seriesId(`distribution:${field}`, category ?? ''), datumId), datumId, groupId: id, legacyKey, value, sourceRowIndex, sourceField: field, displayValue: formatChartNumber(value, config), displayLabel, displayCategory: displayLabel || (groupField ? categoryLabel(category) : field), marker, label: { visible: override?.showLabel ?? config.distributionShowLabels ?? false, text: override?.label || displayLabel, position: override?.labelPosition ?? defaultLabelPosition, style: override?.valueText ?? config.valueText } }]
    }).sort((left, right) => left.value - right.value)
    const laneIndex = layoutMode === 'measures' ? fieldIndex : categoryIndex
    const result: DistributionGroupScene = { id, field, categoryKey: category ?? undefined, categoryLabel: category == null ? undefined : categoryLabel(category), sourceSeriesName: name, seriesKey: layoutMode === 'measures' ? String(category ?? field) : field, displayName: groupField ? `${categoryLabel(category)} · ${field}` : field, color, laneId: lanes[laneIndex].id, subgroupIndex: layoutMode === 'measures' ? categoryIndex : fieldIndex, subgroupCount: layoutMode === 'measures' ? categories.length : selectedFields.length, observations, summary: distributionStatistics(observations) }
    return observations.length ? [result] : []
  }))
  groups.forEach((group) => lanes.find((lane) => lane.id === group.laneId)?.groupIds.push(group.id))
  const values = groups.flatMap((group) => group.observations.map((observation) => observation.value)), scale = niceNumericScale(values)
  const fullGrid = config.showHorizontalGrid && config.showVerticalGrid, singlePadding = lanes.length === 1 ? 1 : .5
  const laneDomain = { min: fullGrid ? -1 : -singlePadding, max: fullGrid ? lanes.length : lanes.length - 1 + singlePadding, interval: fullGrid ? 1 : .5 }
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
  const layers = config.kind === 'counts-plot' ? [{ kind: 'counts' as const, groups: countGroups }] : config.kind === 'barcode-plot' ? [{ kind: 'barcodes' as const, groups: barcodeGroups }] : [{ kind: 'observations' as const, groups: observationGroups }]
  layers.push({ kind: 'summaries', marks: summaryMarks } as never)
  const uniqueLegendGroups = [...new Map(groups.map((group) => [group.sourceSeriesName, group])).values()]
  const guides: GuideSpec[] = [{ id: 'legend', kind: 'categorical-legend', visible: Boolean(groupField && config.showLegend), coordinateSpace: 'content', position: config.legendPosition ?? 'top', items: uniqueLegendGroups.map((group) => ({ id: seriesLegendItemId(seriesId(`distribution:${group.field}`, group.categoryKey ?? '')), label: config.seriesStyles[group.sourceSeriesName]?.legendLabel?.trim() || group.sourceSeriesName, visible: config.seriesStyles[group.sourceSeriesName]?.showLegendItem ?? true, color: group.color, marker: { kind: 'point' }, target: { kind: 'series', seriesId: seriesId(`distribution:${group.field}`, group.categoryKey ?? '') } })) }]
  const activeMarks = config.kind === 'counts-plot' ? countGroups.flatMap((entry) => entry.marks) : config.kind === 'barcode-plot' ? barcodeGroups.flatMap((entry) => entry.marks) : groups.flatMap((group) => group.observations)
  const elements: ChartElement[] = activeMarks.map((mark) => ({ id: mark.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: seriesId(`distribution:${groups.find((group) => group.id === mark.groupId)?.field ?? ''}`, groups.find((group) => group.id === mark.groupId)?.categoryKey ?? ''), datumId: mark.datumId, legacyKey: mark.legacyKey }))
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const).filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false)).map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { migrationMode: 'native', document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides, frameElements, plot: { kind: 'distribution', variant: variant(config.kind), orientation, layoutMode, valueAxis, laneAxis, valueDomain: { min: config.yAxisMin ?? scale.min, max: config.yAxisMax ?? scale.max, step: config.yAxisStep ?? scale.step }, laneDomain, widthRatio: Math.min(.9, Math.max(.15, (config.distributionWidth ?? 72) / 100)), jitterAmount: config.distributionJitter ?? .32, lanes, groups, layers, grid: { valueVisible: orientation === 'horizontal' ? config.showVerticalGrid : config.showHorizontalGrid, laneVisible: orientation === 'horizontal' ? config.showHorizontalGrid : config.showVerticalGrid, color: config.gridColor, width: config.gridWidth, type: config.gridType } } }
}
