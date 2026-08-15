import type { ChartTextStyle } from '../../../core/types'
import { formatXAxisNumber } from '../../../core/numberFormat'
import type { ResolvedButterflyScene } from '../../chart-types/butterfly/layout'
import { renderNativeBarScene } from './renderBarScene'

const text = (style: ChartTextStyle) => ({ fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100) })

export function renderButterflyScene(scene: ResolvedButterflyScene): Record<string, unknown> {
  const fake = { ...scene, plot: { kind: 'bar' as const, categoryPlacement: 'band' as const, orientation: 'horizontal' as const, stacking: 'stacked' as const, categories: scene.plot.categories, categoryAxis: scene.plot.categoryAxis, valueAxis: scene.plot.valueAxis, valueDomain: scene.plot.valueDomain, barWidth: scene.plot.barWidth, seriesGap: scene.plot.seriesGap, series: scene.plot.series } }
  const base = renderNativeBarScene(fake)
  const centered = scene.plot.categoryPlacement === 'center'
  const series = scene.plot.series.map((item) => {
    const data = item.marks.map((mark) => ({ value: [mark.stackEnd, mark.categoryIndex], elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color, itemStyle: { opacity: mark.style.opacity } }))
    return { id: item.id, name: item.name, type: 'custom', coordinateSystem: 'cartesian2d', triggerEvent: true, silent: false, xAxisIndex: centered && item.side === 'right' ? 1 : 0, yAxisIndex: centered && item.side === 'right' ? 1 : 0, clip: true, z: 20, data, renderItem: (params: { dataIndex: number }) => {
    const mark = item.marks[params.dataIndex], shape = mark && scene.butterflyGeometry.marks[mark.id]
    if (!mark || !shape) return null
    const info = { elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color }
    const label = scene.butterflyGeometry.labels[mark.id]
    const rect = { type: 'rect', silent: false, info, shape: { ...shape, r: mark.style.borderRadius }, style: { fill: mark.style.color, opacity: data[params.dataIndex].itemStyle.opacity, stroke: mark.style.borderColor, lineWidth: mark.style.borderWidth } }
    return label ? { type: 'group', silent: false, info, children: [rect, { type: 'text', silent: false, info: { ...info, selectionTarget: 'value-label' }, style: { ...label, text: mark.label.text, ...text(mark.label.style), fill: mark.label.style.color } }] } : rect
    } }
  })
  const centerLabels = scene.plot.categoryPlacement === 'center' ? scene.plot.categories.map((category, index) => ({ id: `category-label:${category.id}`, type: 'text', z: 50, style: { x: scene.butterflyGeometry.categories[index].x + scene.butterflyGeometry.categories[index].width / 2, y: scene.butterflyGeometry.categories[index].y + scene.butterflyGeometry.categories[index].height / 2, text: category.label, ...text(scene.plot.categoryAxis.labels.style), align: 'center', verticalAlign: 'middle' }, info: { elementId: `category-label:${category.id}` } })) : []
  const yAxis = base.yAxis as Record<string, unknown>, axisLabel = yAxis.axisLabel as Record<string, unknown> | undefined
  if (centered && axisLabel) yAxis.axisLabel = { ...axisLabel, show: false }
  if (scene.plot.categoryPlacement !== 'center') yAxis.position = scene.plot.categoryPlacement
  const xAxis = base.xAxis as Record<string, unknown>, valueLabel = xAxis.axisLabel as Record<string, unknown> | undefined
  if (valueLabel) xAxis.axisLabel = { ...valueLabel, formatter: (value: number) => formatXAxisNumber(Math.abs(value), scene.compatibilityConfig) }
  const nativeSelectionHits = scene.plot.series.flatMap((item) => item.marks.flatMap((mark) => scene.butterflyGeometry.marks[mark.id] ? [{ rect: scene.butterflyGeometry.marks[mark.id], info: { elementId: mark.id, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color } }] : []))
  if (!centered) return { ...base, nativeSelectionHits, xAxis, yAxis, series, graphic: [...((base.graphic as unknown[]) ?? []), ...centerLabels] }
  const plot = scene.geometry.plot, half = (plot.width - scene.butterflyGeometry.centerGap) / 2, extent = scene.plot.valueDomain.max
  const grids = [{ left: plot.x, top: plot.y, width: half, height: plot.height, containLabel: false }, { left: plot.x + half + scene.butterflyGeometry.centerGap, top: plot.y, width: half, height: plot.height, containLabel: false }]
  const leftAxis = { ...xAxis, gridIndex: 0, min: 0, max: extent, inverse: true }, rightAxis = { ...xAxis, gridIndex: 1, min: 0, max: extent, inverse: false }
  const leftCategory = { ...yAxis, gridIndex: 0, position: 'right', axisLine: { ...((yAxis.axisLine as object) ?? {}), show: false } }, rightCategory = { ...yAxis, gridIndex: 1, position: 'left', axisLine: { ...((yAxis.axisLine as object) ?? {}), show: false } }
  return { ...base, nativeSelectionHits, grid: grids, xAxis: [leftAxis, rightAxis], yAxis: [leftCategory, rightCategory], series, graphic: [...((base.graphic as unknown[]) ?? []), ...centerLabels] }
}
