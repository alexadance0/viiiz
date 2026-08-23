import { contrastText, mixHexColors } from '../../../core/color'
import { formatChartNumber } from '../../../core/numberFormat'
import type { ChartConfig, DataTable } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { aggregateDatumId, markElementId, seriesId, syntheticDatumId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import type { NativeTreemapChartScene, TreemapNodeScene } from '../../../entities/chart/model/ChartScene'
import { treemapAdaptiveFontSize } from './text'

const paletteFallback = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']
const key = (series: string, category: string) => `${series}\u001fstring:${category}`
const ordered = <T extends { name: string; value: number }>(nodes: T[], order?: string[]) => {
  const fallback = [...nodes].sort((left, right) => right.value - left.value)
  if (!order?.length) return fallback
  const rank = new Map(order.map((name, index) => [name, index]))
  return fallback.sort((left, right) => (rank.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.name) ?? Number.MAX_SAFE_INTEGER))
}
const aggregate = (values: number[], mode: ChartConfig['aggregation']) => mode === 'count' ? values.length : mode === 'average' ? values.reduce((sum, value) => sum + value, 0) / values.length : mode === 'min' ? Math.min(...values) : mode === 'max' ? Math.max(...values) : values.reduce((sum, value) => sum + value, 0)

export function validateNativeTreemapMapping(table: DataTable, config: ChartConfig) {
  const errors: Array<{ field: string; message: string }> = []
  if (!config.xField || !table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку с категориями.' })
  if (config.treemapSubcategoryField && !table.columns.includes(config.treemapSubcategoryField)) errors.push({ field: 'treemapSubcategoryField', message: 'Выберите существующую колонку с подкатегориями.' })
  if (config.treemapSubcategoryField === config.xField) errors.push({ field: 'treemapSubcategoryField', message: 'Категория и подкатегория должны быть разными колонками.' })
  if (!config.yField || !table.columns.includes(config.yField) || !table.rows.some((row) => typeof row[config.yField] === 'number' && Number.isFinite(row[config.yField]) && Number(row[config.yField]) > 0)) errors.push({ field: 'yField', message: 'Выберите числовую колонку, содержащую положительные значения.' })
  return { ok: errors.length === 0, errors }
}

export function compileNativeTreemapScene(table: DataTable, config: ChartConfig): NativeTreemapChartScene {
  if (config.kind !== 'treemap') throw new Error(`Native treemap compiler cannot compile ${config.kind}.`)
  const grouped = new Map<string, Map<string, number[]>>()
  table.rows.forEach((row) => {
    const raw = row[config.yField]
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return
    const group = String(row[config.xField] ?? 'Без категории'), leaf = config.treemapSubcategoryField ? String(row[config.treemapSubcategoryField] ?? 'Без подкатегории') : group
    const leaves = grouped.get(group) ?? new Map<string, number[]>()
    leaves.set(leaf, [...(leaves.get(leaf) ?? []), raw]); grouped.set(group, leaves)
  })
  const hidden = new Set(config.treemapHiddenCategories ?? [])
  const source = [...grouped.entries()].map(([name, leaves], index) => ({ name, leaves, index })).filter(({ name }) => !hidden.has(name))
  const total = source.reduce((sum, group) => sum + [...group.leaves.values()].reduce((part, values) => part + aggregate(values, config.aggregation), 0), 0)
  const format = (value: number) => config.treemapValueFormat === 'percent' ? formatChartNumber(total ? value / total * 100 : 0, { ...config, valueMode: 'percent', numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '', valueLabelAffixesLinked: true }) : formatChartNumber(value, config)
  const palette = config.palette?.length ? config.palette : [config.color, ...paletteFallback.slice(1)]
  const nodes = ordered(source.map(({ name: groupName, leaves, index }): TreemapNodeScene => {
    const legacyKey = `treemap-group:${groupName}`, override = config.elementStyles[legacyKey], groupColor = override?.color ?? config.seriesStyles[groupName]?.color ?? palette[index % palette.length]
    const groupValue = [...leaves.values()].reduce((sum, values) => sum + aggregate(values, config.aggregation), 0)
    const groupSeriesId = seriesId('treemap-group', groupName), groupDatumId = syntheticDatumId('treemap-group', groupName)
    const showGroupName = override?.showLabel === false ? false : override?.showName ?? (config.treemapShowGroupLabels ?? true)
    const showGroupValue = override?.showLabel === false ? false : override?.showValue ?? (config.treemapShowGroupValues ?? ((config.treemapShowGroupLabels ?? true) && config.showValues))
    const groupStyle = override?.valueText ?? config.treemapGroupText ?? config.valueText
    const children = ordered([...leaves.entries()].map(([leafName, values], leafIndex): TreemapNodeScene => {
      const value = aggregate(values, config.aggregation), legacyKey = key(groupName, leafName), leafOverride = config.elementStyles[legacyKey]
      const fill = leafOverride?.color ?? (config.treemapSubcategoryField ? mixHexColors(groupColor, '#ffffff', Math.min(.3, leafIndex * .08)) : groupColor)
      const style = leafOverride?.valueText ?? config.treemapLeafText ?? config.valueText
      const labelsVisible = config.treemapShowLeafLabels ?? true, duplicate = Boolean(config.treemapSubcategoryField && leafName === groupName)
      const showName = leafOverride?.showLabel === false ? false : leafOverride?.showName ?? (labelsVisible && !duplicate)
      const suppressValue = Boolean(config.treemapSubcategoryField && leaves.size === 1 && showGroupValue)
      const showValue = leafOverride?.showLabel === false ? false : leafOverride?.showValue ?? ((config.treemapShowLeafValues ?? (labelsVisible && config.showValues)) && !suppressValue)
      const leafSeriesId = seriesId('treemap-leaf', `${groupName}\u001f${leafName}`), datumId = aggregateDatumId(groupName, leafName)
      return { id: markElementId(leafSeriesId, datumId), datumId, seriesId: leafSeriesId, legacyKey, role: 'leaf', name: leafName, groupName, value, displayCategory: config.treemapSubcategoryField ? `${groupName} · ${leafName}` : groupName, displayValue: format(value), displayLabel: leafOverride?.label || leafName, color: fill, label: { visible: showName || showValue, text: [showName ? leafOverride?.label || leafName : '', showValue ? format(value) : ''].filter(Boolean).join('\n'), style, color: leafOverride?.labelAutoContrast ?? config.valueLabelAutoContrast ?? true ? contrastText(fill) : style.color, position: leafOverride?.treemapLabelPosition ?? config.treemapLabelPosition ?? 'bottom-right', adaptiveSize: treemapAdaptiveFontSize(style.size, value / Math.max(1, total), 6) }, children: [] }
    }), config.treemapLeafOrder?.[groupName])
    if (!config.treemapSubcategoryField) return { ...children[0], color: groupColor }
    return { id: markElementId(groupSeriesId, groupDatumId), datumId: groupDatumId, seriesId: groupSeriesId, legacyKey, role: 'group', name: groupName, groupName, value: groupValue, displayCategory: groupName, displayValue: format(groupValue), displayLabel: override?.label || groupName, color: groupColor, label: { visible: showGroupName || showGroupValue, text: [showGroupName ? override?.label || groupName : '', showGroupValue ? format(groupValue) : ''].filter(Boolean).join('\n'), style: groupStyle, color: override?.labelAutoContrast ?? config.valueLabelAutoContrast ?? true ? contrastText(groupColor) : groupStyle.color, position: override?.treemapLabelPosition ?? config.treemapGroupLabelPosition ?? 'top-left', adaptiveSize: treemapAdaptiveFontSize(groupStyle.size, groupValue / Math.max(1, total), 7) }, children }
  }), config.treemapGroupOrder)
  const all = nodes.flatMap((node) => [node, ...node.children])
  const elements: ChartElement[] = all.map((node) => ({ id: node.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: node.seriesId, datumId: node.datumId, legacyKey: node.legacyKey, text: node.displayLabel }))
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const).filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false)).map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides: [], frameElements, plot: { kind: 'treemap', nodes, total, leafGap: config.treemapGap ?? 2, groupGap: config.treemapGroupGap ?? 5 } }
}
