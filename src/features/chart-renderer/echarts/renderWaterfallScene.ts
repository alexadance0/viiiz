import type { ChartTextStyle } from '../../../core/types'
import type { ResolvedWaterfallScene } from '../../chart-types/waterfall/layout'
import { renderNativeBarScene } from './renderBarScene'

const textStyle = (style: ChartTextStyle) => ({ fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100), align: style.align })
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const contrast = (color: string) => { const match = color.match(/^#([\da-f]{6})$/i); if (!match) return '#fff'; const rgb = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16)); return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150 ? '#202027' : '#fff' }

export function renderWaterfallScene(scene: ResolvedWaterfallScene): Record<string, unknown> {
  const sourceSeries = { id: scene.plot.marks[0]?.seriesId ?? 'waterfall', name: scene.compatibilityConfig.yFields[0] ?? scene.compatibilityConfig.yField, color: '', visible: true, marks: scene.plot.marks }
  const base = renderNativeBarScene({ ...scene, plot: { kind: 'bar', categoryPlacement: 'band', orientation: 'vertical', stacking: 'none', categories: scene.plot.categories, categoryAxis: scene.plot.categoryAxis, valueAxis: scene.plot.valueAxis, valueDomain: scene.plot.valueDomain, barWidth: scene.plot.barWidth, seriesGap: 0, series: [sourceSeries] } })
  const info = (mark: typeof scene.plot.marks[number]) => ({ elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: sourceSeries.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color })
  const barData = scene.plot.marks.map((mark) => ({ value: [mark.categoryIndex, mark.end], ...info(mark), displayChange: mark.displayChange, displayCumulative: mark.displayCumulative, waterfallTotal: mark.total, itemStyle: { opacity: mark.style.opacity } }))
  const bars = { id: 'native-waterfall', name: sourceSeries.name, type: 'custom', coordinateSystem: 'cartesian2d', triggerEvent: true, silent: false, clip: false, z: 40, data: barData, renderItem: (params: { dataIndex: number }) => {
    const mark = scene.plot.marks[params.dataIndex], geometry = mark && scene.waterfallGeometry.marks[mark.id]
    if (!mark || !geometry) return null
    const meta = info(mark)
    return { type: 'group', silent: false, info: meta, children: [{ type: 'rect', silent: false, info: meta, shape: { ...geometry.rect, r: mark.style.borderRadius }, style: { fill: mark.style.color, opacity: barData[params.dataIndex].itemStyle.opacity, stroke: mark.style.borderColor, lineWidth: mark.style.borderWidth } }, ...(geometry.label ? [{ type: 'text', silent: false, info: { ...meta, selectionTarget: 'value-label' }, style: { x: geometry.label.x, y: geometry.label.y, text: mark.label.text, ...textStyle(mark.label.style), fill: geometry.label.inside && mark.label.autoContrast ? contrast(mark.style.color) : mark.label.style.color, align: geometry.label.align, verticalAlign: geometry.label.verticalAlign } }] : [])] }
  } }
  const connectors = scene.plot.connectors.map((connector) => ({ id: connector.id, type: 'line', silent: true, z: 35, shape: scene.waterfallGeometry.connectors[connector.id], style: { stroke: connector.color, lineWidth: 1, lineDash: [4, 3] } }))
  const xAxis = base.xAxis as { axisLabel?: Record<string, unknown>; axisTick?: Record<string, unknown> }
  const originalInterval = xAxis.axisLabel?.interval
  const visibleCategory = (index: number) => {
    if (index === scene.plot.categories.length - 1) return true
    return typeof originalInterval === 'function' ? Boolean((originalInterval as (index: number) => boolean)(index)) : index % (Number(originalInterval ?? 0) + 1) === 0
  }
  xAxis.axisLabel = { ...xAxis.axisLabel, interval: visibleCategory, showMaxLabel: true }
  xAxis.axisTick = { ...xAxis.axisTick, interval: visibleCategory }
  const nativeSelectionHits = scene.plot.marks.flatMap((mark) => {
    const geometry = scene.waterfallGeometry.marks[mark.id]
    if (!geometry) return []
    const meta = info(mark), hits: Array<{ rect: { x: number; y: number; width: number; height: number }; info: typeof meta & { selectionTarget?: 'value-label' } }> = [{ rect: geometry.rect, info: meta }]
    if (geometry.label) {
      const top = geometry.label.verticalAlign === 'top' ? geometry.label.y : geometry.label.verticalAlign === 'bottom' ? geometry.label.y - geometry.label.height : geometry.label.y - geometry.label.height / 2
      hits.push({ rect: { x: geometry.label.x - geometry.label.width / 2, y: top, width: geometry.label.width, height: geometry.label.height }, info: { ...meta, selectionTarget: 'value-label' } })
    }
    return hits
  })
  return { ...base, nativeSelectionHits, xAxis, legend: { show: false }, tooltip: { trigger: 'item', formatter: (input: unknown) => { const item = input as { data?: { displayCategory?: string; displayChange?: string; displayCumulative?: string; waterfallTotal?: boolean }; marker?: string }; return item.data?.waterfallTotal ? `<b>${escapeHtml(item.data.displayCategory)}</b><br/>${item.marker ?? ''}${escapeHtml(sourceSeries.name)}: <b>${escapeHtml(item.data.displayCumulative)}</b>` : `<b>${escapeHtml(item.data?.displayCategory)}</b><br/>${item.marker ?? ''}Изменение: <b>${escapeHtml(item.data?.displayChange)}</b><br/>После шага: <b>${escapeHtml(item.data?.displayCumulative)}</b>` } }, series: [bars], graphic: [...((base.graphic as unknown[]) ?? []), ...connectors] }
}
