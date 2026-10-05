import { formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { NativeXYChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import { axisReservation, categoryLabelRotation, type AxisSpec } from '../../chart-layout/axisLayout'
import { resolveFrame } from '../../chart-layout/frameLayout'
import type { Rect } from '../../chart-layout/geometry'
import { guideReservation } from '../../chart-layout/guides/types'
import type { LayoutReservation, ResolvedReservation } from '../../chart-layout/reservations'
import { layoutText, plainTextDocument } from '../../chart-layout/textLayout'
import { numericTicks } from '../../chart-layout/axisTicks'
import { sideLegendWidth } from '../../chart-layout/legendLayout'
import { formatNativeXYDateTick } from './compiler'

const lineHeight = (style: AxisSpec['labels']['style']) => Math.round(style.size * style.lineHeight / 100)
const railRect = (plot: Rect, side: 'top' | 'right' | 'bottom' | 'left'): Rect => side === 'top'
  ? { x: plot.x, y: plot.y, width: plot.width, height: 0 }
  : side === 'bottom' ? { x: plot.x, y: plot.y + plot.height, width: plot.width, height: 0 }
    : side === 'left' ? { x: plot.x, y: plot.y, width: 0, height: plot.height }
      : { x: plot.x + plot.width, y: plot.y, width: 0, height: plot.height }

function measureAxis(scene: NativeXYChartScene, source: AxisSpec, estimatedPlot: Rect): AxisSpec {
  const config = scene.compatibilityConfig
  const scale = source.channel === 'x' ? scene.plot.xScale : scene.plot.yScale
  const minimum = scale.minimum ?? scale.automaticDomain.minimum, maximum = scale.maximum ?? scale.automaticDomain.maximum
  const values = scale.calendarTicks?.map((tick) => tick.value) ?? numericTicks(minimum, maximum, scale.step)
  const labels = values.map((value, index) => source.channel === 'x'
    ? scale.calendarTicks ? scale.calendarTicks[index].label : scale.type === 'time' ? formatNativeXYDateTick(new Date(value), scale.timeProfile, scale.dateLabelFormat, index === 0) : formatXAxisNumber(value, config)
    : formatYAxisNumber(value, config))
  const slots = values.map((value, index) => Math.min(index ? value - values[index - 1] : Infinity, index + 1 < values.length ? values[index + 1] - value : Infinity) / Math.max(1, maximum - minimum) * estimatedPlot.width)
  const rotation = source.orientation !== 'horizontal' ? 0 : scale.calendarTicks ? typeof config.xAxisLabelRotate === 'number' && config.xAxisLabelRotate > 0 ? config.xAxisLabelRotate : categoryLabelRotation(labels, source.labels.style, slots, 'auto') ? 45 : 0 : source.labels.rotation ?? 0
  const layouts = labels.map((label) => layoutText({ document: plainTextDocument(label, source.labels.style), maxWidth: estimatedPlot.width, rotation }))
  const size = Math.ceil(Math.max(0, ...layouts.map((layout) => source.orientation === 'horizontal' ? layout.rotatedSize.height : layout.rotatedSize.width)))
  const title = source.title && { ...source.title, size: Math.ceil(layoutText({ document: plainTextDocument(source.title.text, source.title.style), maxWidth: Math.max(1, source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height), rotation: source.orientation === 'vertical' ? 90 : 0 }).rotatedSize[source.orientation === 'horizontal' ? 'height' : 'width']) }
  return { ...source, labels: { ...source.labels, size }, title }
}

export type ResolvedXYScene = NativeXYChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }

export function resolveNativeXYScene(scene: NativeXYChartScene): ResolvedXYScene {
  const initial = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition })
  const xAxis = measureAxis(scene, scene.plot.xAxis, initial.plot), yAxis = measureAxis(scene, scene.plot.yAxis, initial.plot)
  const reservations: LayoutReservation[] = []
  const header = scene.frameElements.filter((item) => item.role === 'title' || item.role === 'subtitle')
  if (header.length) reservations.push({ id: 'frame:header', side: 'top', size: header.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: initial.content.width }).size.height + (index ? scene.document.composition.titleSubtitle : 0), 0), gap: scene.document.composition.headerPlot, mode: 'outside', priority: 10 })
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source')
  if (footer.length) reservations.push({ id: 'frame:footer', side: 'bottom', size: footer.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: initial.content.width }).size.height + (index ? scene.document.composition.noteSource : 0), 0), gap: scene.document.composition.plotFooter, mode: 'outside', priority: 10 })
  const legend = scene.guides.find((guide) => guide.kind === 'categorical-legend')
  if (legend?.visible) {
    const widths = legend.items.filter((item) => item.visible).map((item) => measureTextWidth(item.label, scene.compatibilityConfig.legendText.size, scene.compatibilityConfig.legendText.fontFamily, scene.compatibilityConfig.legendText.weight) + 38)
    if (widths.length) {
      const horizontal = legend.position === 'top' || legend.position === 'bottom'
      let rows = 1, occupied = 0
      if (horizontal) widths.forEach((width) => { if (occupied && occupied + width > initial.content.width) { rows++; occupied = width } else occupied += width })
      const size = horizontal ? rows * lineHeight(scene.compatibilityConfig.legendText) + (rows - 1) * 7 : sideLegendWidth(legend.items.filter((item) => item.visible).map((item) => item.label), scene.compatibilityConfig.legendText, initial.content)
      const reservation = guideReservation(legend, size, scene.document.composition.legendPlot, 20)
      if (reservation) reservations.push(reservation)
    }
  }
  const xReservation = axisReservation(xAxis, 50), yReservation = axisReservation(yAxis, 50)
  if (xReservation) reservations.push(xReservation)
  if (yReservation) reservations.push(yReservation)
  if (yAxis.labels.visible) reservations.push({ id: 'axis:y-edge-top', side: 'top', size: Math.ceil(lineHeight(yAxis.labels.style) / 2), gap: 0, mode: 'outside', priority: 55 })
  const frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition, reservations })
  const reservationGeometry = Object.fromEntries(frame.resolvedReservations.map(({ reservation, bounds }) => [reservation.id, bounds]))
  const axes = {
    x: reservationGeometry['axis:x'] ?? railRect(frame.plot, xAxis.placement.kind === 'side' ? xAxis.placement.side : 'bottom'),
    y: reservationGeometry['axis:y'] ?? railRect(frame.plot, yAxis.placement.kind === 'side' ? yAxis.placement.side : 'left'),
  }
  const guideGeometry: Record<string, Rect> = {}
  const sizeGuide = scene.guides.find((guide) => guide.kind === 'size-scale' && guide.visible)
  if (sizeGuide?.kind === 'size-scale') {
    const maxDiameter = Math.max(...sizeGuide.items.map((item) => item.diameter), 0)
    const valueWidth = Math.max(...sizeGuide.items.map((item) => measureTextWidth(item.label, sizeGuide.style.size, sizeGuide.style.fontFamily, 600)), 0)
    const titleWidth = measureTextWidth(sizeGuide.title, sizeGuide.style.size, sizeGuide.style.fontFamily, 600)
    const width = Math.ceil(Math.max(titleWidth, maxDiameter + 20 + valueWidth)), height = Math.round(lineHeight(sizeGuide.style) + 10 + maxDiameter + 8)
    guideGeometry[sizeGuide.id] = {
      x: sizeGuide.position.endsWith('right') ? frame.plot.x + frame.plot.width - width - 6 : frame.plot.x + 6,
      y: sizeGuide.position.startsWith('bottom') ? frame.plot.y + frame.plot.height - height - 6 : frame.plot.y + 6,
      width, height,
    }
  }
  return { ...scene, plot: { ...scene.plot, xAxis, yAxis }, resolvedReservations: frame.resolvedReservations, geometry: { canvas: frame.canvas, content: frame.content, plot: frame.plot, reservations: reservationGeometry, axes, elements: {}, guides: guideGeometry } }
}
