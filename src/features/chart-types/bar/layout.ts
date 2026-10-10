import { formatXAxisNumber, formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { CartesianAreaPlotScene, CartesianBarPlotScene, CartesianIntervalPlotScene, CartesianLinePlotScene, CartesianSmoothingPlotScene, ComparisonStemPlotScene, NativeChartScene, ResolvedScene } from '../../../entities/chart/model/ChartScene'
import { axisReservation, categoryAxisFraction, categoryLabelRotation, type AxisSpec } from '../../chart-layout/axisLayout'
import { fitCalendarAxis } from '../../../core/chartDateAxis'
import { resolveFrame } from '../../chart-layout/frameLayout'
import type { Rect } from '../../chart-layout/geometry'
import { colorScaleReservation } from '../../chart-layout/guides/colorScale'
import { guideReservation } from '../../chart-layout/guides/types'
import type { LayoutReservation } from '../../chart-layout/reservations'
import { layoutText, plainTextDocument } from '../../chart-layout/textLayout'
import { numericTicks } from '../../chart-layout/axisTicks'
import { sideLegendWidth } from '../../chart-layout/legendLayout'

type NativeCartesianScene = NativeChartScene & { plot: CartesianBarPlotScene | ComparisonStemPlotScene | CartesianLinePlotScene | CartesianAreaPlotScene | CartesianSmoothingPlotScene | CartesianIntervalPlotScene }
const lineHeight = (style: AxisSpec['labels']['style']) => Math.round(style.size * style.lineHeight / 100)
const orientation = (scene: NativeCartesianScene) => scene.plot.kind === 'bar' || scene.plot.kind === 'comparison-stem' ? scene.plot.orientation : 'vertical'
const railRect = (plot: Rect, side: 'top' | 'right' | 'bottom' | 'left'): Rect => side === 'top'
  ? { x: plot.x, y: plot.y, width: plot.width, height: 0 }
  : side === 'bottom' ? { x: plot.x, y: plot.y + plot.height, width: plot.width, height: 0 }
    : side === 'left' ? { x: plot.x, y: plot.y, width: 0, height: plot.height }
      : { x: plot.x + plot.width, y: plot.y, width: 0, height: plot.height }

function measuredAxis(scene: NativeCartesianScene, source: AxisSpec, estimatedPlot: Rect): AxisSpec {
  const config = scene.compatibilityConfig
  if (source.channel === 'category') {
    const dateAxis = source.timeScale ? fitCalendarAxis(source.timeScale, config, source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height, source.orientation) : undefined
    const calendarTicks = source.calendarTicks
    if (dateAxis || calendarTicks) {
      const labels = (dateAxis?.ticks ?? calendarTicks!).map((tick) => tick.label)
      const length = source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height
      const rotation = source.orientation !== 'horizontal' ? 0
        : Object.keys(config.categoryLabelOverrides?.x ?? {}).length && config.xAxisLabelOverflow === 'wrap'
          ? categoryLabelRotation(labels, source.labels.style, labels.map(() => length / Math.max(1, labels.length) - 8), config.xAxisLabelRotate)
          : typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0
      const size = Math.ceil(Math.max(0, ...labels.map((label) => layoutText({ document: plainTextDocument(label, source.labels.style), maxWidth: estimatedPlot.width, rotation }).rotatedSize[source.orientation === 'horizontal' ? 'height' : 'width'])))
      const title = source.title && { ...source.title, size: Math.ceil(layoutText({ document: plainTextDocument(source.title.text, source.title.style), maxWidth: length, rotation: source.orientation === 'vertical' ? 90 : 0 }).rotatedSize[source.orientation === 'horizontal' ? 'height' : 'width']) }
      return { ...source, timeScale: dateAxis, labels: { ...source.labels, size, rotation }, title }
    }
    const slot = (source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height) / Math.max(1, scene.plot.categories.length)
    const naturalWidth = Math.max(0, ...scene.plot.categories.flatMap((category) => category.label.split('\n').map((line) => measureTextWidth(line, source.labels.style.size, source.labels.style.fontFamily, source.labels.style.weight))))
    const dateCategories = scene.plot.categories.some((category) => category.value instanceof Date)
    const requestedStride = Math.max(1, Math.round(config.xAxisStep ?? 1))
    const displayed = scene.plot.categories.flatMap((category, index) => {
      if (!category.label) return []
      const interval = 'categoryLabelPlan' in scene.plot ? scene.plot.categoryLabelPlan.interval : undefined
      return typeof interval === 'function' && !interval(index) || typeof interval === 'number' && index % (interval + 1) !== 0 ? [] : [index]
    })
    const dateSlots = new Map(displayed.map((index, ordinal) => {
      const previous = ordinal ? index - displayed[ordinal - 1] : Infinity
      const next = ordinal + 1 < displayed.length ? displayed[ordinal + 1] - index : Infinity
      const gap = Math.min(previous, next)
      return [index, Number.isFinite(gap) ? slot * gap : estimatedPlot.width]
    }))
    const slots = scene.plot.categories.map((category, index) => ('span' in category && category.span ? (source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height) * (category.span.end - category.span.start) / 100 : dateCategories ? dateSlots.get(index) ?? estimatedPlot.width : slot * requestedStride) - 8)
    const rotation = source.orientation !== 'horizontal' ? 0
      : dateCategories && (config.xAxisLabelRotate == null || config.xAxisLabelRotate === 'auto')
        ? categoryLabelRotation(scene.plot.categories.map((category, index) => dateSlots.has(index) ? category.label : ''), source.labels.style, slots, 'auto') ? 45 : 0
        : categoryLabelRotation(scene.plot.categories.map((category, index) => 'span' in category && slots[index] < lineHeight(source.labels.style) ? '' : category.label), source.labels.style, slots, config.xAxisLabelRotate)
    const constrained = config.xAxisLabelOverflow === 'wrap' || config.xAxisLabelOverflow === 'truncate'
    const wordWidth = Math.max(0, ...scene.plot.categories.flatMap((category) => category.label.split(/\s+/).map((word) => measureTextWidth(word, source.labels.style.size, source.labels.style.fontFamily, source.labels.style.weight))))
    const sideWidth = Math.max(20, wordWidth + 4, Math.min(naturalWidth + 4, estimatedPlot.width * .32))
    const maxWidth = !constrained || rotation ? Math.max(naturalWidth + 4, 1)
      : source.orientation === 'vertical' ? sideWidth : Math.max(20, slot - 8)
    const layouts = scene.plot.categories.map((category, index) => {
      const span = scene.plot.kind === 'bar' && source.orientation === 'horizontal' ? scene.plot.categories[index].span : undefined
      const width = span && config.xAxisLabelOverflow === 'wrap' ? Math.max(1, estimatedPlot.width * (span.end - span.start) / 100 - 8) : maxWidth
      const label = span && estimatedPlot.width * (span.end - span.start) / 100 - 8 < lineHeight(source.labels.style) ? '' : category.label
      const layout = layoutText({ document: plainTextDocument(label, source.labels.style), maxWidth: width, rotation, wrap: config.xAxisLabelOverflow === 'wrap' && !rotation, breakWords: false })
      return span && !rotation ? { ...layout, rotatedSize: { ...layout.rotatedSize, height: Math.min(layout.rotatedSize.height, lineHeight(source.labels.style) * 3) } } : layout
    })
    const size = source.orientation === 'vertical' && constrained ? maxWidth : Math.ceil(Math.max(0, ...layouts.map((layout) => source.orientation === 'horizontal' ? layout.rotatedSize.height : layout.rotatedSize.width)))
    const title = source.title && { ...source.title, size: Math.ceil(layoutText({ document: plainTextDocument(source.title.text, source.title.style), maxWidth: Math.max(1, source.orientation === 'horizontal' ? estimatedPlot.width : estimatedPlot.height), rotation: source.orientation === 'vertical' ? 90 : 0 }).rotatedSize[source.orientation === 'horizontal' ? 'height' : 'width']) }
    return { ...source, labels: { ...source.labels, size, rotation }, title }
  }
  const formatter = orientation(scene) === 'horizontal' && !(config.kind === 'marimekko' && scene.plot.kind === 'bar' && scene.plot.stacking === 'normalized') ? formatXAxisNumber : formatYAxisNumber
  const labels = numericTicks(scene.plot.valueDomain.min, scene.plot.valueDomain.max, scene.plot.valueDomain.step).map((value) => formatter(value, config))
  const size = source.orientation === 'horizontal'
    ? lineHeight(source.labels.style)
    : Math.ceil(Math.max(0, ...labels.map((label) => measureTextWidth(label, source.labels.style.size, source.labels.style.fontFamily, source.labels.style.weight))))
  const title = source.title && { ...source.title, size: lineHeight(source.title.style) * Math.max(1, source.title.text.split('\n').length) }
  return { ...source, labels: { ...source.labels, size }, title }
}

export function resolveNativeCartesianScene(sourceScene: NativeChartScene, extraReservations: LayoutReservation[] = []): ResolvedScene & NativeCartesianScene {
  if (sourceScene.plot.kind === 'slope') throw new Error('Slope requires its dedicated layout.')
  const scene = sourceScene as NativeCartesianScene
  const config = scene.compatibilityConfig
  const initial = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition })
  let categoryAxis = measuredAxis(scene, scene.plot.categoryAxis, initial.plot)
  let valueAxis = measuredAxis(scene, scene.plot.valueAxis, initial.plot)
  const directGuide = scene.guides.find((guide) => guide.kind === 'direct-series')
  if (orientation(scene) === 'horizontal' && directGuide?.visible && valueAxis.placement.kind === 'side' && valueAxis.placement.side === 'top') {
    const directHeight = Math.max(...directGuide.items.filter((item) => item.visible).map((item) => lineHeight(item.style)))
    valueAxis = { ...valueAxis, labels: { ...valueAxis.labels, gap: valueAxis.labels.gap + directHeight + scene.document.composition.directLabelPlot } }
  }
  const reservations: LayoutReservation[] = [...extraReservations]
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
    if (guide.kind === 'color-scale') {
      const reservation = colorScaleReservation(guide, config, initial.content.width)
      if (reservation) reservations.push(reservation)
    } else if (guide.kind === 'categorical-legend') {
      const side = guide.position
      const itemWidths = guide.items.filter((item) => item.visible).map((item) => measureTextWidth(item.label, config.legendText.size, config.legendText.fontFamily, config.legendText.weight) + 38)
      if (!itemWidths.length) continue
      const available = side === 'top' || side === 'bottom' ? initial.content.width : initial.content.height
      let rows = 1, occupied = 0
      itemWidths.forEach((width) => { if (occupied && occupied + width > available) { rows += 1; occupied = width } else occupied += width })
      const size = side === 'top' || side === 'bottom' ? rows * lineHeight(config.legendText) + (rows - 1) * 7 : sideLegendWidth(guide.items.filter((item) => item.visible).map((item) => item.label), config.legendText, initial.content)
      const reservation = guideReservation(guide, size, scene.document.composition.legendPlot, 20)
      if (reservation) reservations.push(reservation)
    } else if (guide.kind === 'direct-series') {
      const items = guide.items.filter((item) => item.visible)
      if (!items.length) continue
      if (orientation(scene) === 'horizontal') {
        const availableWidth = Math.max(40, initial.content.width / items.length - 12)
        const height = Math.max(...items.map((item) => {
          return layoutText({ document: plainTextDocument(`${item.label}${item.note ? `\n${item.note}` : ''}`, item.style), maxWidth: availableWidth, wrap: true }).size.height
        }))
        reservations.push({ id: `guide:${guide.id}`, side: 'top', size: Math.ceil(height), gap: scene.document.composition.directLabelPlot, mode: 'outside', priority: 60 })
      } else {
        const width = Math.min(initial.content.width * .32, Math.max(config.kind === 'bump' ? 120 : 80, ...items.flatMap((item) => [item.label, item.note ?? ''].flatMap((text) => text.split('\n').map((line) => measureTextWidth(line, item.style.size, item.style.fontFamily, item.style.weight))))) + scene.document.composition.directLabelPlot)
        const reservation = guideReservation(guide, width, 0, 30)
        if (reservation) reservations.push(reservation)
      }
    }
  }
  const categoryReservation = axisReservation(categoryAxis, 50)
  const valueReservation = axisReservation(valueAxis, 50)
  if (categoryReservation) reservations.push(categoryReservation)
  if (valueReservation) reservations.push(valueReservation)
  if (orientation(scene) === 'vertical' && valueAxis.labels.visible) {
    reservations.push({ id: 'axis:value-edge-top', side: 'top', size: Math.ceil(lineHeight(valueAxis.labels.style) / 2), gap: 0, mode: 'outside', priority: 55 })
  }
  if (orientation(scene) === 'horizontal' && valueAxis.labels.visible) {
    const formatter = config.kind === 'marimekko' && scene.plot.kind === 'bar' && scene.plot.stacking === 'normalized' || scene.plot.kind === 'area' && scene.plot.stacking === 'normalized' ? formatYAxisNumber : formatXAxisNumber
    const edge = Math.ceil(Math.max(...[scene.plot.valueDomain.min, scene.plot.valueDomain.max].map((value) => measureTextWidth(formatter(value, config), valueAxis.labels.style.size, valueAxis.labels.style.fontFamily, valueAxis.labels.style.weight))) / 2) + 10
    const categorySide = categoryAxis.placement.kind === 'side' ? categoryAxis.placement.side : undefined
    if (categorySide !== 'left') reservations.push({ id: 'axis:value-edge-left', side: 'left', size: edge, gap: 0, mode: 'outside', priority: 55 })
    if (categorySide !== 'right') reservations.push({ id: 'axis:value-edge-right', side: 'right', size: edge, gap: 0, mode: 'outside', priority: 55 })
  }
  if (scene.plot.kind === 'bar' && config.kind !== 'butterfly' && config.kind !== 'marimekko' && (config.barValueLabelAbsorption || scene.plot.orientation === 'horizontal' && scene.plot.stacking === 'normalized') && scene.plot.series.some((series) => series.marks.some((mark) => mark.label.visible)) && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
    const values = scene.plot.series.flatMap((series) => series.marks.map((mark) => mark.value))
    const amount = (scene.plot.orientation === 'horizontal' ? Math.max(0, ...scene.plot.series.flatMap((series) => series.marks.filter((mark) => mark.label.visible).map((mark) => measureTextWidth(mark.label.text, mark.label.style.size, mark.label.style.fontFamily, mark.label.style.weight)))) : lineHeight(config.valueText)) + 8
    const positiveSide = scene.plot.orientation === 'horizontal' ? 'right' : 'top'
    const negativeSide = scene.plot.orientation === 'horizontal' ? 'left' : 'bottom'
    if (values.some((value) => value != null && value >= 0)) reservations.push({ id: 'value-labels:positive', side: positiveSide, size: amount, gap: 0, mode: 'outside', priority: 60 })
    if (values.some((value) => value != null && value < 0) && !(scene.plot.orientation === 'horizontal' && categoryAxis.placement.kind === 'side' && categoryAxis.placement.side === negativeSide)) reservations.push({ id: 'value-labels:negative', side: negativeSide, size: amount, gap: 0, mode: 'outside', priority: 60 })
  }
  if (scene.plot.kind === 'comparison-stem' && config.showValues) {
    const amount = lineHeight(config.valueText) + 8
    if (scene.plot.orientation === 'horizontal') {
      const categorySide = categoryAxis.placement.kind === 'side' ? categoryAxis.placement.side : undefined
      if (categorySide !== 'left') reservations.push({ id: 'value-labels:left', side: 'left', size: amount, gap: 0, mode: 'outside', priority: 60 })
      if (categorySide !== 'right') reservations.push({ id: 'value-labels:right', side: 'right', size: amount, gap: 0, mode: 'outside', priority: 60 })
    } else {
      reservations.push({ id: 'value-labels:top', side: 'top', size: amount, gap: 0, mode: 'outside', priority: 60 })
      if (scene.plot.variant === 'dumbbell' || scene.plot.variant === 'arrow') reservations.push({ id: 'value-labels:bottom', side: 'bottom', size: amount, gap: 0, mode: 'outside', priority: 60 })
    }
  } else if (scene.plot.kind !== 'bar' && config.showValues && !(config.valueLabelPosition ?? '').startsWith('inside-')) {
    const side = config.valueLabelPosition === 'bottom' ? 'bottom' : 'top'
    reservations.push({ id: `value-labels:${side}`, side, size: lineHeight(config.valueText) + 8, gap: 0, mode: 'outside', priority: 60 })
  }
  let frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition, reservations })
  // Rotation and wrapping depend on the space left after guides and axes.
  for (let pass = 0; (categoryAxis.orientation === 'horizontal' || categoryAxis.timeScale) && pass < 2; pass += 1) {
    categoryAxis = measuredAxis(scene, scene.plot.categoryAxis, frame.plot)
    const revised = axisReservation(categoryAxis, 50)
    const index = reservations.findIndex((item) => item.id === 'axis:category')
    if (index >= 0 && revised) reservations[index] = revised
    frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition, reservations })
  }
  const reservationGeometry = Object.fromEntries(frame.resolvedReservations.map(({ reservation, bounds }) => [reservation.id, bounds]))
  const axes = {
    category: reservationGeometry['axis:category'] ?? railRect(frame.plot, categoryAxis.placement.kind === 'side' ? categoryAxis.placement.side : 'bottom'),
    value: reservationGeometry['axis:value'] ?? railRect(frame.plot, valueAxis.placement.kind === 'side' ? valueAxis.placement.side : 'left'),
  }
  const elements: Record<string, Rect> = {}
  const categoryRail = axes.category
  scene.plot.categories.forEach((category, index) => {
    if (categoryAxis.timeScale) {
      const fraction = categoryAxisFraction(scene.plot.categories, categoryAxis, index)
      const size = layoutText({ document: plainTextDocument(category.label, categoryAxis.labels.style), maxWidth: frame.content.width, rotation: categoryAxis.labels.rotation }).rotatedSize
      const center = orientation(scene) === 'vertical' ? frame.plot.x + fraction * frame.plot.width : frame.plot.y + ((config.categoryAxisInverse ?? true) ? fraction : 1 - fraction) * frame.plot.height
      elements[`category-label:${category.id}`] = orientation(scene) === 'vertical'
        ? { x: center - size.width / 2, y: categoryRail.y, width: size.width, height: categoryRail.height }
        : { x: categoryRail.x, y: center - size.height / 2, width: categoryRail.width, height: size.height }
      return
    }
    if (orientation(scene) === 'vertical') {
      if (scene.plot.categoryPlacement === 'point') {
        const dateAxis = 'dateAxis' in scene.plot ? scene.plot.dateAxis : undefined
        const center = frame.plot.x + (scene.plot.categories.length === 1 ? frame.plot.width / 2 : dateAxis ? frame.plot.width * (Number(category.value) - dateAxis.min) / Math.max(1, dateAxis.max - dateAxis.min) : frame.plot.width * index / (scene.plot.categories.length - 1))
        const width = Math.min(frame.content.width, Math.ceil(layoutText({ document: plainTextDocument(category.label, categoryAxis.labels.style), maxWidth: frame.content.width, rotation: categoryAxis.labels.rotation }).rotatedSize.width))
        const x = Math.max(frame.content.x, Math.min(center - width / 2, frame.content.x + frame.content.width - width))
        elements[`category-label:${category.id}`] = { x, y: categoryRail.y, width, height: categoryRail.height }
        return
      }
      const width = frame.plot.width / Math.max(1, scene.plot.categories.length)
      const span = scene.plot.kind === 'bar' ? scene.plot.categories[index].span : undefined
      elements[`category-label:${category.id}`] = { x: frame.plot.x + (span ? span.start / 100 * frame.plot.width : index * width), y: categoryRail.y, width: span ? (span.end - span.start) / 100 * frame.plot.width : width, height: categoryRail.height }
    } else {
      const height = frame.plot.height / Math.max(1, scene.plot.categories.length)
      const span = scene.plot.kind === 'bar' ? scene.plot.categories[index].span : undefined
      const start = span ? (config.categoryAxisInverse ?? true) ? span.start : 100 - span.end : 0
      elements[`category-label:${category.id}`] = { x: categoryRail.x, y: frame.plot.y + (span ? start / 100 * frame.plot.height : index * height), width: categoryRail.width, height: span ? (span.end - span.start) / 100 * frame.plot.height : height }
    }
  })
  return { ...scene, plot: { ...scene.plot, ...('dateAxis' in scene.plot ? { dateAxis: categoryAxis.timeScale } : {}), categoryAxis, valueAxis, ...('categoryLabelPlan' in scene.plot ? { categoryLabelPlan: { ...scene.plot.categoryLabelPlan, rotation: categoryAxis.labels.rotation ?? 0 } } : {}) }, resolvedReservations: frame.resolvedReservations, geometry: { canvas: frame.canvas, content: frame.content, plot: frame.plot, reservations: reservationGeometry, axes, elements, guides: {} } }
}

export const resolveNativeBarScene = resolveNativeCartesianScene
