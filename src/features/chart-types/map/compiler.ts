import russia from './data/russia.json'
import usa from './data/usa.json'
import europe from './data/europe.json'
import world from './data/world.json'
import { isTileMapChart, matchMapRows, mapPresetForKind, mapRegions } from './catalog'
import { tileGeometry, tileGrid } from './tiles'
import type { ChartConfig, DataTable } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { aggregateDatumId, markElementId, seriesId } from '../../../entities/chart/model/ChartElement'
import type { NativeMapChartScene, MapRegionScene } from '../../../entities/chart/model/ChartScene'
import { compileNativeHeatmapScene } from '../heatmap/compiler'

export function validateMapMapping(table: DataTable, config: ChartConfig) {
  const errors: Array<{ field: string; message: string }> = []
  const preset = mapPresetForKind(config.kind)
  const matches = matchMapRows(table, config.xField, preset).matched
  if (!table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку с названиями или кодами территорий.' })
  if (!table.columns.includes(config.yField) || !table.rows.some((row) => typeof row[config.yField] === 'number' && Number.isFinite(row[config.yField]))) errors.push({ field: 'yField', message: 'Выберите числовой показатель для окраски карты.' })
  if (table.columns.includes(config.xField) && !matches.length) errors.push({ field: 'xField', message: 'Нет строк для отдельных территорий выбранной карты. Используйте названия или коды регионов; общие итоги не окрашивают регионы.' })
  if (config.aggregation === 'none') {
    const ids = matches.flatMap(({ row, region }) => region && typeof row[config.yField] === 'number' && Number.isFinite(row[config.yField]) ? [region.id] : [])
    if (new Set(ids).size < ids.length) errors.push({ field: 'aggregation', message: 'Для повторяющихся территорий выберите способ агрегации.' })
  }
  return { ok: !errors.length, errors }
}

export function compileNativeMapScene(table: DataTable, config: ChartConfig): NativeMapChartScene {
  const preset = mapPresetForKind(config.kind)
  const tiled = isTileMapChart(config.kind)
  const geometry: { width: number; height: number; regions: Record<string, { polygons: number[][][][]; center: number[]; area: number }> } = tiled ? tileGeometry(preset, config.mapTileGap) : { russia, usa, europe, world }[preset]
  const definitions = mapRegions(preset)
  const matches = matchMapRows(table, config.xField, preset)
  const matched = matches.matched.map(({ row, region }) => ({ region: region!.id, value: row[config.yField] }))
  // Reuse the heatmap's aggregation, missing colors, overrides-independent domain and scale guide.
  const matrix = compileNativeHeatmapScene({ name: table.name, columns: ['region', 'value'], rows: matched }, { ...config, kind: 'heatmap', xField: 'region', yField: 'value', yFields: ['value'], seriesField: '', missingMode: 'gap', valueMode: 'absolute', xAxisMin: '', xAxisMax: '', categoryOrder: undefined, seriesOrder: undefined, elementStyles: {}, categoryLabelOverrides: {}, showValues: false })
  const cells = new Map(matrix.plot.rows[0]?.cells.map((cell) => [matrix.plot.categories[cell.columnIndex].value, cell]) ?? [])
  const sid = seriesId('map', config.yField)
  const regions: MapRegionScene[] = definitions.map((region) => {
    const cell = cells.get(region.id), datumId = aggregateDatumId(region.id, config.yField), legacyKey = `${config.yField}\u001f${tiled ? 'tilemap' : 'map'}:${preset}:${region.id}`, override = config.elementStyles[legacyKey]
    const shape = geometry.regions[region.id]
    const name = override?.label || region.name, value = cell?.value ?? null
    const showName = override?.showName ?? config.mapShowNames ?? tiled
    const showValue = override?.showValue ?? (config.showValues || (override?.showLabel === true && !showName))
    const labelText = (showName || showValue || override?.showLabel === true) ? override?.label || [showName ? config.mapLabelFormat === 'name' ? name : tiled ? tileGrid(preset)[region.id].label : region.id.replace(/^(RU|US)-/, '') : '', showValue ? cell?.displayValue ?? config.heatmapMissingLabel ?? '—' : ''].filter(Boolean).join('\n') : ''
    return { id: markElementId(sid, datumId), datumId, seriesId: sid, legacyKey, regionId: region.id, name: region.name, value, displayCategory: region.name, displayValue: cell?.displayValue ?? config.heatmapMissingLabel ?? 'Нет данных', displayLabel: name, color: override?.color ?? cell?.color ?? config.heatmapMissingColor ?? '#e8e7eb', disputed: region.disputed, polygons: shape.polygons, center: shape.center as [number, number], area: shape.area, label: { visible: override?.showLabel !== false && Boolean(labelText), explicit: override?.showLabel === true || override?.showName === true || override?.showValue === true, text: labelText, style: override?.valueText ?? config.valueText } }
  })
  return { document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, frameElements: matrix.frameElements, guides: matrix.guides, elements: regions.map((region) => ({ id: region.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: sid, datumId: region.datumId, legacyKey: region.legacyKey })), plot: { kind: 'map', preset, regions, width: geometry.width, height: geometry.height, unmatched: matches.unmatched, colorDomain: matrix.plot.colorDomain } }
}
