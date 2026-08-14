import { formatChartNumber } from '../../../core/numberFormat'
import { getSeriesColor } from '../../../core/seriesColor'
import type { ChartConfig, DataTable } from '../../../core/types'
import { markElementId, rawDatumId, seriesId } from '../../../entities/chart/model/ChartElement'
import type { DistributionGroupId, DistributionGroupScene, DistributionLaneId, DistributionLaneScene, DistributionMarkerStyle, DistributionObservationScene } from '../../../entities/chart/model/ChartScene'
import { distributionStatistics } from './statistics'

const groupId = (value: string) => `distribution-group:${encodeURIComponent(value)}` as DistributionGroupId
const laneId = (value: string) => `distribution-lane:${encodeURIComponent(value)}` as DistributionLaneId
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const legacyDistributionElementKey = (series: string, category: unknown) => `${series}\u001f${category instanceof Date ? category.toISOString() : `${typeof category}:${String(category)}`}`

export interface PreparedDistributionData { selectedFields: string[]; groupField?: string; categories: Array<string | null>; lanes: DistributionLaneScene[]; groups: DistributionGroupScene[]; laneLabels: string[]; layoutMode: 'measures' | 'categories'; rawMinimum: number; rawMaximum: number; rawSpan: number }

export function prepareDistributionGroups(table: DataTable, config: ChartConfig): PreparedDistributionData {
  const fieldOrder = new Map((config.seriesOrder ?? []).map((field, index) => [field, index]))
  const fields = config.yFields.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  const selectedFields = [...(fields.length ? fields : [config.yField])].filter(Boolean).sort((a, b) => (fieldOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (fieldOrder.get(b) ?? Number.MAX_SAFE_INTEGER))
  const groupField = config.distributionGroupField, discovered = groupField ? [...new Set(table.rows.flatMap((row) => selectedFields.some((field) => typeof row[field] === 'number' && Number.isFinite(row[field])) ? [String(row[groupField] ?? 'Без категории')] : []))] : []
  const configured = config.distributionCategoryOrder ?? [], ordered = [...configured.filter((item) => discovered.includes(item)), ...discovered.filter((item) => !configured.includes(item))], visible = ordered.filter((item) => config.distributionCategoryStyles?.[item]?.visible !== false)
  const categories: Array<string | null> = groupField ? (visible.length ? visible : ordered.slice(0, 1)) : [null], categoryLabel = (category: string | null) => category == null ? '' : config.distributionCategoryStyles?.[category]?.label?.trim() || category
  const layoutMode = groupField ? config.distributionLayoutMode ?? 'measures' : 'measures', laneLabels = layoutMode === 'measures' ? selectedFields : categories.map(categoryLabel)
  const lanes = (layoutMode === 'measures' ? selectedFields : categories.map(String)).map((key, index): DistributionLaneScene => ({ id: laneId(`${layoutMode}:${key}`), index, label: laneLabels[index], groupIds: [] }))
  const pointSize = config.distributionPointSize ?? 9, pointOpacity = clamp01(config.distributionPointOpacity ?? .4), defaultLabelPosition = config.distributionLabelPosition ?? ((config.distributionOrientation ?? 'horizontal') === 'horizontal' ? 'right' : 'top')
  const groups = selectedFields.flatMap((field, fieldIndex) => categories.flatMap((category, categoryIndex) => {
    const name = layoutMode === 'measures' ? groupField ? categoryLabel(category) : field : field, id = groupId(`${field}\u001f${category == null ? 'none' : `string:${category}`}`), color = layoutMode === 'measures' && groupField ? config.distributionCategoryStyles?.[String(category)]?.color ?? getSeriesColor(config, String(category), categoryIndex) : getSeriesColor(config, field, fieldIndex)
    const observations = table.rows.flatMap((row, sourceRowIndex): DistributionObservationScene[] => { const value = row[field]; if ((groupField && String(row[groupField] ?? 'Без категории') !== category) || typeof value !== 'number' || !Number.isFinite(value)) return []; const datumId = rawDatumId(sourceRowIndex, field), legacyKey = legacyDistributionElementKey(name, `row:${sourceRowIndex}:${field}`), override = config.elementStyles[legacyKey], displayLabel = config.distributionLabelField ? String(row[config.distributionLabelField] ?? '') : formatChartNumber(value, config), rain = config.kind === 'raincloud', marker: DistributionMarkerStyle = { shape: override?.markerShape ?? 'circle', size: override?.markerSize ?? pointSize, fill: override?.markerFill ?? override?.color ?? (rain ? config.canvasBackground ?? '#ffffff' : color), stroke: override?.markerBorder ?? override?.color ?? color, strokeWidth: override?.markerBorderWidth ?? (rain ? 1.25 : 0), opacity: clamp01(override?.fillOpacity ?? pointOpacity) }; return [{ id: markElementId(seriesId(`distribution:${field}`, category ?? ''), datumId), datumId, groupId: id, legacyKey, value, sourceRowIndex, sourceField: field, displayValue: formatChartNumber(value, config), displayLabel, displayCategory: displayLabel || (groupField ? categoryLabel(category) : field), marker, label: { visible: override?.showLabel ?? config.distributionShowLabels ?? false, text: override?.label || displayLabel, position: override?.labelPosition ?? defaultLabelPosition, style: override?.valueText ?? config.valueText } }] }).sort((a, b) => a.value - b.value)
    const laneIndex = layoutMode === 'measures' ? fieldIndex : categoryIndex, group: DistributionGroupScene = { id, field, categoryKey: category ?? undefined, categoryLabel: category == null ? undefined : categoryLabel(category), sourceSeriesName: name, seriesKey: layoutMode === 'measures' ? String(category ?? field) : field, displayName: groupField ? `${categoryLabel(category)} · ${field}` : field, color, laneId: lanes[laneIndex].id, subgroupIndex: layoutMode === 'measures' ? categoryIndex : fieldIndex, subgroupCount: layoutMode === 'measures' ? categories.length : selectedFields.length, observations, summary: distributionStatistics(observations) }
    return observations.length ? [group] : []
  }))
  const values = groups.flatMap((group) => group.observations.map(({ value }) => value)), rawMinimum = Math.min(...values), rawMaximum = Math.max(...values)
  return { selectedFields, groupField, categories, lanes, groups, laneLabels, layoutMode, rawMinimum, rawMaximum, rawSpan: Math.max(1e-9, rawMaximum - rawMinimum) }
}
