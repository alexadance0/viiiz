import { formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { ChartTextStyle } from '../../../core/types'
import type { NativeSlopeChartScene, ResolvedSceneGeometry, ResolvedSlopeGeometry } from '../../../entities/chart/model/ChartScene'
import { axisReservation, type AxisSpec } from '../../chart-layout/axisLayout'
import { resolveFrame } from '../../chart-layout/frameLayout'
import type { Rect } from '../../chart-layout/geometry'
import type { LayoutReservation, ResolvedReservation } from '../../chart-layout/reservations'
import { layoutText, plainTextDocument } from '../../chart-layout/textLayout'

const lineHeight = (style: ChartTextStyle) => Math.round(style.size * style.lineHeight / 100)
const tickPosition = (value: number, min: number, max: number) => Math.abs(value - min) < 1e-9 ? 'first' as const : Math.abs(value - max) < 1e-9 ? 'last' as const : 'middle' as const

export const slopeGuideValues = (scene: NativeSlopeChartScene) => {
  if (scene.compatibilityConfig.yAxisScaleType === 'log') return []
  const { min, max, step } = scene.plot.valueDomain
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) return []
  return Array.from({ length: Math.min(50, Math.round((max - min) / step) + 1) }, (_, index) => min + index * step)
}

function measuredCategoryAxis(scene: NativeSlopeChartScene, available: Rect): AxisSpec {
  const source = scene.plot.categoryAxis
  const maxWidth = Math.max(1, available.width / 2)
  const layouts = scene.plot.positions.map((position) => layoutText({ document: plainTextDocument(position.label, source.labels.style), maxWidth, rotation: source.labels.rotation, wrap: scene.compatibilityConfig.xAxisLabelOverflow === 'wrap' }))
  const size = Math.ceil(Math.max(0, ...layouts.map((layout) => layout.rotatedSize.height)))
  const title = source.title && { ...source.title, size: Math.ceil(layoutText({ document: plainTextDocument(source.title.text, source.title.style), maxWidth: available.width }).size.height) }
  return { ...source, labels: { ...source.labels, size }, title }
}

function measuredValueAxis(scene: NativeSlopeChartScene): AxisSpec {
  const source = scene.plot.valueAxis
  const title = source.title && { ...source.title, size: lineHeight(source.title.style) * Math.max(1, source.title.text.split('\n').length) }
  return { ...source, title }
}

function frameReservations(scene: NativeSlopeChartScene, content: Rect): LayoutReservation[] {
  const reservations: LayoutReservation[] = []
  const header = scene.frameElements.filter((item) => item.role === 'title' || item.role === 'subtitle')
  if (header.length) {
    const height = header.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: content.width }).size.height + (index ? scene.document.composition.titleSubtitle : 0), 0)
    reservations.push({ id: 'frame:header', side: 'top', size: height, gap: scene.document.composition.headerPlot, mode: 'outside', priority: 10 })
  }
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source')
  if (footer.length) {
    const height = footer.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: content.width }).size.height + (index ? scene.document.composition.noteSource : 0), 0)
    reservations.push({ id: 'frame:footer', side: 'bottom', size: height, gap: scene.document.composition.plotFooter, mode: 'outside', priority: 10 })
  }
  return reservations
}

export type ResolvedSlopeScene = NativeSlopeChartScene & {
  geometry: ResolvedSceneGeometry
  slopeGeometry: ResolvedSlopeGeometry
  resolvedReservations: ResolvedReservation[]
}

export function resolveNativeSlopeScene(scene: NativeSlopeChartScene): ResolvedSlopeScene {
  const initial = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition })
  const categoryAxis = measuredCategoryAxis(scene, initial.plot)
  const valueAxis = measuredValueAxis(scene)
  const reservations = frameReservations(scene, initial.content)
  const categoryReservation = axisReservation(categoryAxis, 50)
  const valueReservation = axisReservation(valueAxis, 50)
  if (categoryReservation) reservations.push(categoryReservation)
  if (valueReservation) reservations.push(valueReservation)

  const labels = scene.plot.endpointLabels.items
  const leftWidth = Math.ceil(Math.max(0, ...labels.filter((item) => item.side === 'left').map((item) => measureTextWidth(item.valueText ?? '', item.style.size, item.style.fontFamily, item.style.weight))))
  const rightWidth = Math.ceil(Math.max(0, ...labels.filter((item) => item.side === 'right').map((item) => measureTextWidth([item.valueText, item.seriesText].filter(Boolean).join(' '), item.style.size, item.style.fontFamily, item.style.weight))))
  const valueStyle = scene.plot.valueAxis.labels.style
  const scaleWidth = scene.plot.guides.internalValueLabels ? Math.ceil(Math.max(0, ...slopeGuideValues(scene).map((value) => measureTextWidth(formatYAxisNumber(value, scene.compatibilityConfig, tickPosition(value, scene.plot.valueDomain.min, scene.plot.valueDomain.max)), valueStyle.size, valueStyle.fontFamily, valueStyle.weight)))) : 0
  if (scaleWidth) reservations.push({ id: 'slope:value-scale-labels', side: 'left', size: scaleWidth, gap: scene.plot.valueAxis.labels.gap, mode: 'outside', priority: 60 })
  if (leftWidth) reservations.push({ id: 'slope:endpoint-left', side: 'left', size: leftWidth, gap: scene.plot.endpointLabels.distance, mode: 'outside', priority: 61 })
  if (rightWidth) reservations.push({ id: 'slope:endpoint-right', side: 'right', size: rightWidth, gap: scene.plot.endpointLabels.distance, mode: 'outside', priority: 61 })

  const frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition, reservations })
  const plot = frame.plot
  const firstX = plot.x + plot.width / 4, lastX = plot.x + plot.width * 3 / 4
  const scaleGap = scaleWidth ? scene.plot.valueAxis.labels.gap : 0
  const extension = Math.max(0, Math.min(80, plot.width * .16, firstX - frame.content.x - scaleWidth - scaleGap, frame.content.x + frame.content.width - lastX))
  const guideLeft = firstX - extension, guideRight = lastX + extension
  const axisY = categoryAxis.placement.kind === 'side' && categoryAxis.placement.side === 'top' ? plot.y : plot.y + plot.height
  const leftEndpointLabelRail = leftWidth ? { x: firstX - scene.plot.endpointLabels.distance - leftWidth, y: plot.y, width: leftWidth, height: plot.height } : undefined
  const rightEndpointLabelRail = rightWidth ? { x: lastX + scene.plot.endpointLabels.distance, y: plot.y, width: rightWidth, height: plot.height } : undefined
  const valueScaleLabelRail = scaleWidth ? { x: guideLeft - scaleGap - scaleWidth, y: plot.y, width: scaleWidth, height: plot.height } : undefined
  const pointValues = new Map(scene.plot.series.flatMap((series) => series.points.map((point) => [point.id, point.value] as const)))
  const valueY = (value: number) => {
    const { min, max } = scene.plot.valueDomain
    const ratio = scene.compatibilityConfig.yAxisScaleType === 'log'
      ? (Math.log(value) - Math.log(min)) / Math.max(Number.EPSILON, Math.log(max) - Math.log(min))
      : (value - min) / Math.max(Number.EPSILON, max - min)
    return plot.y + plot.height * (1 - ratio)
  }
  const endpointLabelOffsets: ResolvedSlopeGeometry['endpointLabelOffsets'] = {}
  for (const side of ['left', 'right'] as const) {
    const entries = labels.flatMap((item) => {
      const value = pointValues.get(item.pointId)
      return value == null || !Number.isFinite(value) || scene.compatibilityConfig.yAxisScaleType === 'log' && value <= 0 ? [] : [{ item, desired: valueY(value), height: lineHeight(item.style) }]
    }).filter(({ item }) => item.side === side).sort((left, right) => left.desired - right.desired)
    entries.forEach((entry, index) => { entry.desired = Math.max(plot.y + entry.height / 2, index ? entries[index - 1].desired + Math.max(entry.height, entries[index - 1].height) + 2 : entry.desired) })
    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index], maximum = index === entries.length - 1 ? plot.y + plot.height - entry.height / 2 : entries[index + 1].desired - Math.max(entry.height, entries[index + 1].height) - 2
      entry.desired = Math.min(entry.desired, maximum)
    }
    for (const entry of entries) endpointLabelOffsets[entry.item.id] = entry.desired - valueY(pointValues.get(entry.item.pointId)!)
  }
  const reservationGeometry = Object.fromEntries(frame.resolvedReservations.map(({ reservation, bounds }) => [reservation.id, bounds]))
  const rail = (side: 'top' | 'right' | 'bottom' | 'left'): Rect => side === 'top' ? { x: plot.x, y: plot.y, width: plot.width, height: 0 } : side === 'bottom' ? { x: plot.x, y: plot.y + plot.height, width: plot.width, height: 0 } : side === 'left' ? { x: plot.x, y: plot.y, width: 0, height: plot.height } : { x: plot.x + plot.width, y: plot.y, width: 0, height: plot.height }
  const axes = {
    category: reservationGeometry['axis:category'] ?? rail(categoryAxis.placement.kind === 'side' ? categoryAxis.placement.side : 'bottom'),
    value: reservationGeometry['axis:value'] ?? rail(valueAxis.placement.kind === 'side' ? valueAxis.placement.side : 'left'),
  }
  const elements: Record<string, Rect> = {}
  scene.plot.positions.forEach((position, index) => {
    const width = Math.min(frame.content.width / 2, Math.ceil(layoutText({ document: plainTextDocument(position.label, categoryAxis.labels.style), maxWidth: frame.content.width / 2, rotation: categoryAxis.labels.rotation }).rotatedSize.width))
    const center = index ? lastX : firstX
    elements[`category-label:${position.id}`] = { x: center - width / 2, y: axes.category.y, width, height: axes.category.height }
  })
  return {
    ...scene, plot: { ...scene.plot, categoryAxis, valueAxis }, resolvedReservations: frame.resolvedReservations,
    geometry: { canvas: frame.canvas, content: frame.content, plot, reservations: reservationGeometry, axes, elements },
    slopeGeometry: { firstX, lastX, guideLeft, guideRight, axisY, leftEndpointLabelRail, rightEndpointLabelRail, valueScaleLabelRail, endpointLabelOffsets },
  }
}
