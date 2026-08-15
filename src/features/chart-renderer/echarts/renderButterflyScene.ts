import type { ChartTextStyle } from '../../../core/types'
import { formatXAxisNumber } from '../../../core/numberFormat'
import type { ResolvedButterflyScene } from '../../chart-types/butterfly/layout'
import { renderNativeBarScene } from './renderBarScene'

const text = (style: ChartTextStyle) => ({ fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight: Math.round(style.size * style.lineHeight / 100) })
const contrast = (color: string) => { const match = color.match(/^#([\da-f]{6})$/i); if (!match) return '#fff'; const rgb = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16)); return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150 ? '#202027' : '#fff' }

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
    return { type: 'rect', silent: false, info, shape: { ...shape, r: mark.style.borderRadius }, style: { fill: mark.style.color, opacity: data[params.dataIndex].itemStyle.opacity, stroke: mark.style.borderColor, lineWidth: mark.style.borderWidth } }
    } }
  })
  const valueLabels = scene.plot.series.flatMap((item) => item.marks.flatMap((mark) => {
    const label = scene.butterflyGeometry.labels[mark.id]
    if (!label) return []
    const info = { elementId: mark.id, datumId: mark.datumId, seriesId: mark.seriesId, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color, selectionTarget: 'value-label' as const }
    return [{ id: `value-label:${mark.id}`, type: 'text', z: 50, cursor: 'pointer', info, style: { x: label.x, y: label.y, text: mark.label.text, ...text(mark.label.style), fill: label.inside && mark.label.autoContrast ? contrast(mark.style.color) : mark.label.style.color, align: label.align, verticalAlign: label.verticalAlign } }]
  }))
  const categoryInfo = (category: typeof scene.plot.categories[number]) => ({ elementId: `category-label:${category.id}`, elementKey: `category-label:y:${category.coordinate}`, sourceSeriesName: '', displayCategory: category.coordinate, displayValue: category.label, selectionTarget: 'category-label' as const, axis: 'y' as const })
  const centerLabels = scene.plot.categoryPlacement === 'center' ? scene.plot.categories.map((category, index) => ({ id: `category-label:${category.id}`, type: 'text', z: 50, cursor: 'pointer', style: { x: scene.butterflyGeometry.categories[index].x + scene.butterflyGeometry.categories[index].width / 2, y: scene.butterflyGeometry.categories[index].y + scene.butterflyGeometry.categories[index].height / 2, text: category.label, ...text(scene.plot.categoryAxis.labels.style), align: 'center', verticalAlign: 'middle' }, info: categoryInfo(category) })) : []
  const yAxis = base.yAxis as Record<string, unknown>, axisLabel = yAxis.axisLabel as Record<string, unknown> | undefined
  if (centered && axisLabel) yAxis.axisLabel = { ...axisLabel, show: false }
  if (scene.plot.categoryPlacement !== 'center') yAxis.position = scene.plot.categoryPlacement
  const xAxis = base.xAxis as Record<string, unknown>, valueLabel = xAxis.axisLabel as Record<string, unknown> | undefined
  if (valueLabel) xAxis.axisLabel = { ...valueLabel, formatter: (value: number) => formatXAxisNumber(Math.abs(value), scene.compatibilityConfig) }
  const markHits = scene.plot.series.flatMap((item) => item.marks.flatMap((mark) => {
    const rect = scene.butterflyGeometry.marks[mark.id], label = scene.butterflyGeometry.labels[mark.id]
    if (!rect) return []
    const info = { elementId: mark.id, elementKey: mark.legacyKey, sourceSeriesName: item.name, displayCategory: mark.displayCategory, displayValue: mark.displayValue, displayColor: mark.style.color }
    const left = label?.align === 'right' ? label.x - label.width : label?.align === 'center' ? label.x - label.width / 2 : label?.x
    return [{ rect, info: { ...info, selectionMode: 'series-first' as const } }, ...(label ? [{ rect: { x: left!, y: label.y - label.height / 2, width: label.width, height: label.height }, info: { ...info, selectionTarget: 'value-label' as const } }] : [])]
  }))
  const categoryHits = scene.plot.categories.flatMap((category, index) => {
    const rect = scene.plot.categoryPlacement === 'center' ? scene.butterflyGeometry.categories[index] : scene.geometry.elements[`category-label:${category.id}`]
    return rect && rect.width > 0 ? [{ rect, info: categoryInfo(category) }] : []
  })
  const nativeSelectionHits = [...markHits, ...categoryHits]
  const nativeCategoryLayouts = scene.plot.categoryPlacement === 'center' ? scene.plot.categories.map((category, index) => { const rect = scene.butterflyGeometry.categories[index]; return { axis: 'y' as const, category: category.coordinate, left: rect.x + 8, top: rect.y, width: Math.max(1, rect.width - 16), size: scene.plot.categoryAxis.labels.style.size, rotation: 0, style: { ...scene.plot.categoryAxis.labels.style, align: 'center' as const } } }) : []
  if (!centered) return { ...base, nativeSelectionHits, nativeCategoryLayouts, xAxis, yAxis, series, graphic: [...((base.graphic as unknown[]) ?? []), ...centerLabels, ...valueLabels] }
  const plot = scene.geometry.plot, half = (plot.width - scene.butterflyGeometry.centerGap) / 2, extent = scene.plot.valueDomain.max
  const grids = [{ left: plot.x, top: plot.y, width: half, height: plot.height, containLabel: false }, { left: plot.x + half + scene.butterflyGeometry.centerGap, top: plot.y, width: half, height: plot.height, containLabel: false }]
  const leftAxis = { ...xAxis, gridIndex: 0, min: 0, max: extent, inverse: true }, rightAxis = { ...xAxis, gridIndex: 1, min: 0, max: extent, inverse: false }
  const leftCategory = { ...yAxis, gridIndex: 0, position: 'right', axisLine: { ...((yAxis.axisLine as object) ?? {}), show: false } }, rightCategory = { ...yAxis, gridIndex: 1, position: 'left', axisLine: { ...((yAxis.axisLine as object) ?? {}), show: false } }
  return { ...base, nativeSelectionHits, nativeCategoryLayouts, grid: grids, xAxis: [leftAxis, rightAxis], yAxis: [leftCategory, rightCategory], series, graphic: [...((base.graphic as unknown[]) ?? []), ...centerLabels, ...valueLabels] }
}
