import { contrastText } from '../../../core/color'
import { mapFrame, type ResolvedMapScene } from '../../chart-types/map/layout'
import { renderHeatmapScene } from './renderHeatmapScene'
import { nativeGraphicTextStyle } from './renderBarScene'
import { isTileMapChart } from '../../chart-types/map/catalog'

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function renderMapScene(scene: ResolvedMapScene): Record<string, unknown> {
  const base = renderHeatmapScene({ ...mapFrame(scene), geometry: scene.geometry, resolvedReservations: scene.resolvedReservations })
  const config = scene.compatibilityConfig, regions = scene.plot.regions
  const infoFor = (region: typeof regions[number]) => ({ elementId: region.id, datumId: region.datumId, seriesId: region.seriesId, elementKey: region.legacyKey, sourceSeriesName: config.yField, displayCategory: region.name, displayValue: region.displayValue, displayLabel: region.displayLabel, displayColor: region.color })
  const insetLabels = scene.plot.preset !== 'usa' || isTileMapChart(config.kind) ? [] : ['US-AK', 'US-HI'].flatMap((code) => {
    const region = regions.find((item) => item.regionId === code)
    if (!region) return []
    const rect = scene.geometry.map[region.id].rect
    return [{ id: `map-inset:${code}`, type: 'text', silent: true, style: { x: rect.x + rect.width / 2, y: rect.y - 10, text: code === 'US-AK' ? 'Аляска' : 'Гавайи', ...nativeGraphicTextStyle(config.legendText), fontSize: Math.min(14, config.legendText.size), align: 'center', verticalAlign: 'bottom' } }]
  })
  return { ...base, graphic: [...((base.graphic as unknown[]) ?? []), ...insetLabels], xAxis: undefined, yAxis: undefined, legend: { show: false }, tooltip: { trigger: 'item', confine: true, formatter: (params: { dataIndex?: number }) => {
    const region = regions[params.dataIndex ?? -1]
    return region ? `<b>${escapeHtml(region.name)}</b><br/>${escapeHtml(config.yField)}: <b>${escapeHtml(region.displayValue)}</b>` : ''
  } }, series: [{ id: 'native-map', name: config.yField, type: 'custom', coordinateSystem: 'none', triggerEvent: true, z: 5, data: regions.map((region) => ({ value: region.value, ...infoFor(region) })), renderItem: (params: { dataIndex: number }, api: { style(): { opacity?: number; borderWidth?: number } }) => {
    const region = regions[params.dataIndex], geometry = scene.geometry.map[region.id], info = infoFor(region), visual = api.style()
    const stroke = config.mapBorderColor ?? '#ffffff', lineWidth = Math.max(config.mapBorderWidth ?? .8, visual.borderWidth ?? 0)
    const children: unknown[] = [{ type: 'path', z2: geometry.small ? 2 : 0, info, shape: { pathData: geometry.path }, style: { fill: region.color, opacity: visual.opacity ?? 1, stroke, lineWidth, lineDash: region.disputed && !isTileMapChart(config.kind) ? [3, 2] : undefined }, emphasis: { style: { stroke: config.axisLineColor, lineWidth: Math.max(1.5, lineWidth) } } }]
    if (geometry.leader) children.push({ type: 'polyline', z2: 5, silent: true, shape: { points: geometry.leader }, style: { stroke: region.label.style.color, lineWidth: .8, fill: null } })
    if (geometry.label) children.push({ type: 'text', z2: 10, info, style: { x: geometry.label.x + geometry.label.width / 2, y: geometry.label.y + geometry.label.height / 2, text: geometry.labelText ?? region.label.text, ...nativeGraphicTextStyle(region.label.style), fontSize: geometry.labelSize, lineHeight: geometry.labelSize * region.label.style.lineHeight / 100, backgroundColor: geometry.leader ? config.canvasBackground ?? '#ffffff' : undefined, padding: geometry.leader ? 2 : 0, fill: config.valueLabelAutoContrast !== false ? contrastText(geometry.leader ? config.canvasBackground ?? '#ffffff' : region.color) : region.label.style.color, opacity: visual.opacity ?? 1, align: 'center', verticalAlign: 'middle' } })
    return { type: 'group', info, children }
  } }] }
}
