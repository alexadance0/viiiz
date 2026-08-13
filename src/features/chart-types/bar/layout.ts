import { formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { CartesianAreaPlotScene, CartesianBarPlotScene, CartesianIntervalPlotScene, CartesianLinePlotScene, CartesianSmoothingPlotScene, NativeChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { axisReservation, type AxisSpec } from '../../chart-layout/axisLayout'
import { resolveFrame } from '../../chart-layout/frameLayout'
import type { Rect } from '../../chart-layout/geometry'
import { guideReservation } from '../../chart-layout/guides/types'
import type { LayoutReservation } from '../../chart-layout/reservations'
import { layoutText, plainTextDocument } from '../../chart-layout/textLayout'

type NativeCartesianScene = NativeChartScene & { plot: CartesianBarPlotScene | CartesianLinePlotScene | CartesianAreaPlotScene | CartesianSmoothingPlotScene | CartesianIntervalPlotScene }
const lineHeight = (style: AxisSpec['labels']['style']) => Math.round(style.size * style.lineHeight / 100)
const orientation = (scene: NativeCartesianScene) => scene.plot.kind === 'bar' ? scene.plot.orientation : 'vertical'
const railRect = (plot: Rect, side: 'top' | 'right' | 'bottom' | 'left'): Rect => side === 'top'
  ? { x: plot.x, y: plot.y, width: plot.width, height: 0 }
  : side === 'bottom' ? { x: plot.x, y: plot.y + plot.height, width: plot.width, height: 0 }
    : side === 'left' ? { x: plot.x, y: plot.y, width: 0, height: plot.height }
      : { x: plot.x + plot.width, y: plot.y, width: 0, height: plot.height }

function measuredAxis(scene: NativeCartesianScene, source: AxisSpec, estimatedPlot: Rect): AxisSpec {
  const config = scene.compatibilityConfig
  if (source.channel === 'category') {
    const slot = (source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height) / Math.max(1, scene.plot.categories.length)
    const naturalWidth = Math.max(0, ...scene.plot.categories.flatMap((category) => category.label.split('\n').map((line) => measureTextWidth(line, source.labels.style.size, source.labels.style.fontFamily, source.labels.style.weight))))
    const dateCategories = scene.plot.categories.some((category) => category.value instanceof Date)
    const requestedStride = Math.max(1, Math.round(config.xAxisStep ?? 1))
    const automaticRotation = source.orientation === 'horizontal' && config.xAxisLabelRotate === 'auto'
      ? dateCategories ? config.xAxisStep != null && naturalWidth > slot * requestedStride * 1.08 ? 45 : 0 : naturalWidth > slot * .92 ? 90 : 0
      : 0
    const rotation = source.orientation === 'horizontal' ? typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : automaticRotation : 0
    const maxWidth = config.xAxisLabelOverflow === 'wrap' ? Math.max(20, slot - 8) : Math.max(naturalWidth, 1)
    const layouts = scene.plot.categories.map((category) => layoutText({ document: plainTextDocument(category.label, source.labels.style), maxWidth, rotation, wrap: config.xAxisLabelOverflow === 'wrap' }))
    const size = Math.ceil(Math.max(0, ...layouts.map((layout) => source.orientation === 'horizontal' ? layout.rotatedSize.height : layout.rotatedSize.width)))
    const title = source.title && { ...source.title, size: Math.ceil(layoutText({ document: plainTextDocument(source.title.text, source.title.style), maxWidth: Math.max(1, source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height), rotation: source.orientation === 'vertical' ? 90 : 0 }).rotatedSize[source.orientation === 'horizontal' ? 'height' : 'width']) }
    return { ...source, labels: { ...source.labels, size, rotation }, title }
  }
  const formatter = orientation(scene) === 'horizontal' ? formatXAxisNumber : formatYAxisNumber
  const labels = [scene.plot.valueDomain.min, 0, scene.plot.valueDomain.max].map((value) => formatter(value, config))
  const size = source.orientation === 'horizontal'
    ? lineHeight(source.labels.style)
    : Math.ceil(Math.max(0, ...labels.map((label) => measureTextWidth(label, source.labels.style.size, source.labels.style.fontFamily, source.labels.style.weight))))
  const title = source.title && { ...source.title, size: lineHeight(source.title.style) * Math.max(1, source.title.text.split('\n').length) }
  return { ...source, labels: { ...source.labels, size }, title }
}

export function resolveNativeCartesianScene(sourceScene: NativeChartScene): ResolvedScene & NativeCartesianScene {
  if (sourceScene.plot.kind === 'slope') throw new Error('Slope requires its dedicated layout.')
  const scene = sourceScene as NativeCartesianScene
  const config = scene.compatibilityConfig
  const initial = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition })
  const categoryAxis = measuredAxis(scene, scene.plot.categoryAxis, initial.plot)
  let valueAxis = measuredAxis(scene, scene.plot.valueAxis, initial.plot)
  const directGuide = scene.guides.find((guide) => guide.kind === 'direct-series')
  if (orientation(scene) === 'horizontal' && directGuide?.visible && valueAxis.placement.kind === 'side' && valueAxis.placement.side === 'top') {
    const directHeight = Math.max(...directGuide.items.filter((item) => item.visible).map((item) => lineHeight(item.style)))
    valueAxis = { ...valueAxis, labels: { ...valueAxis.labels, gap: valueAxis.labels.gap + directHeight + scene.document.composition.directLabelPlot } }
  }
  const reservations: LayoutReservation[] = []
  const header = scene.frameElements.filter((item) => item.role === 'title' || item.role === 'subtitle')
  if (header.length) {
    const height = header.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: initial.content.width }).size.height + (index ? scene.document.composition.titleSubtitle : 0), 0)
    reservations.push({ id: 'frame:header', side: 'top', size: height, gap: scene.document.composition.headerPlot, mode: 'outside', priority: 10 })
  }
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source')
  if (footer.length) {
    const height = footer.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: initial.content.width }).size.height + (index ? scene.document.composition.noteSource : 0), 0)
    reservations.push({ id: 'frame:footer', side: 'bottom', size: height, gap: scene.document.composition.plotFooter, mode: 'outside', priority: 10 })
  }
  for (const guide of scene.guides) {
    if (guide.kind === 'categorical-legend') {
      const side = guide.position
      const itemWidths = guide.items.filter((item) => item.visible).map((item) => measureTextWidth(item.label, config.legendText.size, config.legendText.fontFamily, config.legendText.weight) + 38)
      if (!itemWidths.length) continue
      const available = side === 'top' || side === 'bottom' ? initial.content.width : initial.content.height
      let rows = 1, occupied = 0
      itemWidths.forEach((width) => { if (occupied && occupied + width > available) { rows += 1; occupied = width } else occupied += width })
      const size = side === 'top' || side === 'bottom' ? rows * lineHeight(config.legendText) + (rows - 1) * 7 : Math.min(initial.content.width * .28, Math.max(90, ...itemWidths))
      const reservation = guideReservation(guide, size, scene.document.composition.legendPlot, 20)
      if (reservation) reservations.push(reservation)
    } else if (guide.kind === 'direct-series') {
      const items = guide.items.filter((item) => item.visible)
      if (!items.length) continue
      if (orientation(scene) === 'horizontal') {
        const height = Math.max(...items.map((item) => {
          return lineHeight(item.style) + (item.note ? Math.max(8, item.style.size - 2) * 1.25 + 3 : 0)
        }))
        reservations.push({ id: `guide:${guide.id}`, side: 'top', size: Math.ceil(height), gap: scene.document.composition.directLabelPlot, mode: 'outside', priority: 60 })
      } else {
        const width = Math.min(initial.content.width * .32, Math.max(80, ...items.flatMap((item) => [item.label, item.note ?? ''].flatMap((text) => text.split('\n').map((line) => measureTextWidth(line, item.style.size, item.style.fontFamily, item.style.weight))))) + scene.document.composition.directLabelPlot)
        const reservation = guideReservation(guide, width, 0, 30)
        if (reservation) reservations.push(reservation)
      }
    }
  }
  // ECharts measures label margin from the axis line, so ticks that fit inside
  // that margin do not consume another rail of their own.
  const categoryLayoutAxis = categoryAxis.labels.visible && categoryAxis.ticks.visible
    ? { ...categoryAxis, ticks: { ...categoryAxis.ticks, length: Math.max(0, categoryAxis.ticks.length - categoryAxis.labels.gap) } }
    : categoryAxis
  const categoryReservation = axisReservation(categoryLayoutAxis, 50)
  const valueReservation = axisReservation(valueAxis, 50)
  if (categoryReservation) reservations.push(categoryReservation)
  if (valueReservation) reservations.push(valueReservation)
  if (orientation(scene) === 'vertical' && valueAxis.labels.visible && valueAxis.placement.kind === 'side') {
    reservations.push({ id: 'axis:value-label-safety', side: valueAxis.placement.side, size: 2, gap: 0, mode: 'outside', priority: 51 })
  }
  if (orientation(scene) === 'vertical' && categoryAxis.labels.visible) {
    const edgeSize = (label: string) => Math.min(110, Math.ceil(Math.max(measureTextWidth(label, categoryAxis.labels.style.size, categoryAxis.labels.style.fontFamily, categoryAxis.labels.style.weight) / 2, Math.max(0, ...label.split('\n').map((line) => line.length)) * categoryAxis.labels.style.size * .3)) + 14)
    const finalLabel = scene.plot.categories.findLast((category) => Boolean(category.label))?.label ?? ''
    if (scene.plot.categoryPlacement === 'band' && finalLabel) reservations.push({ id: 'axis:category-edge', side: 'right', size: edgeSize(finalLabel), gap: 0, mode: 'outside', priority: 55 })
  }
  if (orientation(scene) === 'vertical' && valueAxis.labels.visible) {
    reservations.push({ id: 'axis:value-edge-top', side: 'top', size: Math.ceil(lineHeight(valueAxis.labels.style) / 2), gap: 0, mode: 'outside', priority: 55 })
  }
  if (orientation(scene) === 'horizontal' && valueAxis.labels.visible) {
    const formatter = scene.plot.kind === 'area' && scene.plot.stacking === 'normalized' ? formatYAxisNumber : formatXAxisNumber
    const edge = Math.ceil(Math.max(...[scene.plot.valueDomain.min, scene.plot.valueDomain.max].map((value) => measureTextWidth(formatter(value, config), valueAxis.labels.style.size, valueAxis.labels.style.fontFamily, valueAxis.labels.style.weight))) / 2) + 10
    reservations.push({ id: 'axis:value-edge-left', side: 'left', size: edge, gap: 0, mode: 'outside', priority: 55 })
    reservations.push({ id: 'axis:value-edge-right', side: 'right', size: edge, gap: 0, mode: 'outside', priority: 55 })
  }
  if (scene.plot.kind === 'bar' && config.showValues && config.barValueLabelAbsorption && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
    const values = scene.plot.series.flatMap((series) => series.marks.map((mark) => mark.value))
    const amount = lineHeight(config.valueText) + 8
    const positiveSide = scene.plot.orientation === 'horizontal' ? 'right' : 'top'
    const negativeSide = scene.plot.orientation === 'horizontal' ? 'left' : 'bottom'
    if (values.some((value) => value != null && value >= 0)) reservations.push({ id: 'value-labels:positive', side: positiveSide, size: amount, gap: 0, mode: 'outside', priority: 60 })
    if (values.some((value) => value != null && value < 0)) reservations.push({ id: 'value-labels:negative', side: negativeSide, size: amount, gap: 0, mode: 'outside', priority: 60 })
  }
  if (scene.plot.kind !== 'bar' && config.showValues && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
    const side = config.valueLabelPosition === 'bottom' ? 'bottom' : 'top'
    reservations.push({ id: `value-labels:${side}`, side, size: lineHeight(config.valueText) + 8, gap: 0, mode: 'outside', priority: 60 })
  }
  const frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition, reservations })
  const reservationGeometry = Object.fromEntries(frame.resolvedReservations.map(({ reservation, bounds }) => [reservation.id, bounds]))
  const axes = {
    category: reservationGeometry['axis:category'] ?? railRect(frame.plot, categoryAxis.placement.kind === 'side' ? categoryAxis.placement.side : 'bottom'),
    value: reservationGeometry['axis:value'] ?? railRect(frame.plot, valueAxis.placement.kind === 'side' ? valueAxis.placement.side : 'left'),
  }
  const elements: Record<string, Rect> = {}
  const categoryRail = axes.category
  scene.plot.categories.forEach((category, index) => {
    if (orientation(scene) === 'vertical') {
      if (scene.plot.categoryPlacement === 'point') {
        const center = frame.plot.x + (scene.plot.categories.length === 1 ? frame.plot.width / 2 : frame.plot.width * index / (scene.plot.categories.length - 1))
        const width = Math.min(frame.content.width, Math.ceil(layoutText({ document: plainTextDocument(category.label, categoryAxis.labels.style), maxWidth: frame.content.width, rotation: categoryAxis.labels.rotation }).rotatedSize.width))
        const x = Math.max(frame.content.x, Math.min(center - width / 2, frame.content.x + frame.content.width - width))
        elements[`category-label:${category.id}`] = { x, y: categoryRail.y, width, height: categoryRail.height }
        return
      }
      const width = frame.plot.width / Math.max(1, scene.plot.categories.length)
      elements[`category-label:${category.id}`] = { x: frame.plot.x + index * width, y: categoryRail.y, width, height: categoryRail.height }
    } else {
      const height = frame.plot.height / Math.max(1, scene.plot.categories.length)
      elements[`category-label:${category.id}`] = { x: categoryRail.x, y: frame.plot.y + index * height, width: categoryRail.width, height }
    }
  })
  return { ...scene, plot: { ...scene.plot, categoryAxis, valueAxis }, resolvedReservations: frame.resolvedReservations, geometry: { canvas: frame.canvas, content: frame.content, plot: frame.plot, reservations: reservationGeometry, axes, elements, guides: {} } }
}

export const resolveNativeBarScene = resolveNativeCartesianScene
