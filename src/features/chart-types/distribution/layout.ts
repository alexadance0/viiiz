import { formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { ElementId } from '../../../entities/chart/model/ChartElement'
import type { DistributionBarcodeMarkScene, DistributionCountMarkScene, DistributionGroupId, DistributionObservationScene, NativeDistributionChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import { axisReservation, type AxisSpec } from '../../chart-layout/axisLayout'
import { resolveFrame } from '../../chart-layout/frameLayout'
import type { Rect } from '../../chart-layout/geometry'
import { guideReservation } from '../../chart-layout/guides/types'
import type { LayoutReservation, ResolvedReservation } from '../../chart-layout/reservations'
import { layoutText, plainTextDocument } from '../../chart-layout/textLayout'
import { deterministicDistributionOffset } from './jitter'
import { fitSwarmClouds } from './swarm'

export interface ResolvedDistributionMarkPlacement {
  elementId: ElementId
  groupId: DistributionGroupId
  mark: DistributionObservationScene | DistributionCountMarkScene | DistributionBarcodeMarkScene
  valuePixel: number
  laneCenterPixel: number
  laneCoordinate: number
  crossOffsetPixel: number
  x: number
  y: number
  markerDiameter: number
  line?: { x1: number; y1: number; x2: number; y2: number }
}

export interface ResolvedDistributionSummaryPlacement { id: ElementId; groupId: DistributionGroupId; x1: number; y1: number; x2: number; y2: number; color: string; width: number; cap: 'round' | 'butt' }
export interface ResolvedDistributionLaneGridLine { laneId: string; x1: number; y1: number; x2: number; y2: number; stroke: NativeDistributionChartScene['plot']['grid'] }
export interface ResolvedDistributionGeometry { marks: ResolvedDistributionMarkPlacement[]; summaries: ResolvedDistributionSummaryPlacement[]; laneGrid: ResolvedDistributionLaneGridLine[]; laneBand: number }
export type ResolvedDistributionScene = NativeDistributionChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[]; distributionGeometry: ResolvedDistributionGeometry }

const lineHeight = (style: AxisSpec['labels']['style']) => Math.round(style.size * style.lineHeight / 100)
function measuredAxis(scene: NativeDistributionChartScene, source: AxisSpec, estimated: Rect): AxisSpec {
  const labels = source.channel === 'lane' ? scene.plot.lanes.map((lane) => lane.label) : [scene.plot.valueDomain.min, scene.plot.valueDomain.max].map((value) => formatYAxisNumber(value, scene.compatibilityConfig))
  const rotation = source.orientation === 'horizontal' ? source.labels.rotation ?? 0 : 0
  const layouts = labels.map((label) => layoutText({ document: plainTextDocument(label, source.labels.style), maxWidth: Math.max(1, estimated.width), rotation }))
  const size = Math.ceil(Math.max(0, ...layouts.map((layout) => source.orientation === 'horizontal' ? layout.rotatedSize.height : layout.rotatedSize.width)))
  const title = source.title && { ...source.title, size: Math.ceil(layoutText({ document: plainTextDocument(source.title.text, source.title.style), maxWidth: Math.max(1, source.orientation === 'horizontal' ? estimated.width : estimated.height), rotation: source.orientation === 'vertical' ? 90 : 0 }).rotatedSize[source.orientation === 'horizontal' ? 'height' : 'width']) }
  return { ...source, labels: { ...source.labels, size }, title }
}

function reservations(scene: NativeDistributionChartScene, estimated: ReturnType<typeof resolveFrame>, valueAxis: AxisSpec, laneAxis: AxisSpec) {
  const result: LayoutReservation[] = [], composition = scene.document.composition
  const header = scene.frameElements.filter((item) => item.role === 'title' || item.role === 'subtitle')
  if (header.length) result.push({ id: 'frame:header', side: 'top', size: header.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: estimated.content.width }).size.height + (index ? composition.titleSubtitle : 0), 0), gap: composition.headerPlot, mode: 'outside', priority: 10 })
  const footer = scene.frameElements.filter((item) => item.role === 'note' || item.role === 'source')
  if (footer.length) result.push({ id: 'frame:footer', side: 'bottom', size: footer.reduce((sum, item, index) => sum + layoutText({ document: plainTextDocument(item.text, item.style), maxWidth: estimated.content.width }).size.height + (index ? composition.noteSource : 0), 0), gap: composition.plotFooter, mode: 'outside', priority: 10 })
  const legend = scene.guides.find((guide) => guide.kind === 'categorical-legend')
  if (legend?.visible) {
    const widths = legend.items.filter((item) => item.visible).map((item) => measureTextWidth(item.label, scene.compatibilityConfig.legendText.size, scene.compatibilityConfig.legendText.fontFamily, scene.compatibilityConfig.legendText.weight) + 38)
    if (widths.length) { const horizontal = legend.position === 'top' || legend.position === 'bottom'; let rows = 1, occupied = 0; if (horizontal) widths.forEach((width) => { if (occupied && occupied + width > estimated.content.width) { rows++; occupied = width } else occupied += width }); const size = horizontal ? rows * lineHeight(scene.compatibilityConfig.legendText) + (rows - 1) * 7 : Math.min(estimated.content.width * .28, Math.max(90, ...widths)); const reservation = guideReservation(legend, size, composition.legendPlot, 20); if (reservation) result.push(reservation) }
  }
  for (const item of [valueAxis, laneAxis]) { const reservation = axisReservation(item, 50); if (reservation) result.push(reservation) }
  return result
}

const project = (value: number, min: number, max: number, start: number, length: number, reverse = false) => start + (reverse ? 1 - (value - min) / Math.max(Number.EPSILON, max - min) : (value - min) / Math.max(Number.EPSILON, max - min)) * length

export function resolveNativeDistributionScene(scene: NativeDistributionChartScene): ResolvedDistributionScene {
  const initial = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition })
  const valueAxis = measuredAxis(scene, scene.plot.valueAxis, initial.plot), laneAxis = measuredAxis(scene, scene.plot.laneAxis, initial.plot)
  const frame = resolveFrame({ canvas: scene.document.canvas, spacing: scene.document.composition, reservations: reservations(scene, initial, valueAxis, laneAxis) })
  const reservationGeometry = Object.fromEntries(frame.resolvedReservations.map(({ reservation, bounds }) => [reservation.id, bounds]))
  const axes = { value: reservationGeometry['axis:value'] ?? frame.plot, lane: reservationGeometry['axis:lane'] ?? frame.plot }
  const horizontal = scene.plot.orientation === 'horizontal', { min, max } = scene.plot.valueDomain, laneDomain = scene.plot.laneDomain
  const valuePixel = (value: number) => project(value, min, max, horizontal ? frame.plot.x : frame.plot.y, horizontal ? frame.plot.width : frame.plot.height, !horizontal)
  const lanePixel = (lane: number) => project(lane, laneDomain.min, laneDomain.max, horizontal ? frame.plot.y : frame.plot.x, horizontal ? frame.plot.height : frame.plot.width, horizontal)
  const laneBand = Math.abs(lanePixel(1) - lanePixel(0)), groupIndex = new Map(scene.plot.groups.map((group, index) => [group.id, index]))
  const observationLayer = scene.plot.layers.find((layer) => layer.kind === 'observations'), countsLayer = scene.plot.layers.find((layer) => layer.kind === 'counts'), barcodeLayer = scene.plot.layers.find((layer) => layer.kind === 'barcodes')
  const byLane = new Map(scene.plot.lanes.map((lane) => [lane.id, scene.plot.groups.filter((group) => group.laneId === lane.id).flatMap((group) => group.observations.map((mark) => ({ group, mark })))]))
  const swarmOffsets = new Map<ElementId, number>()
  if (scene.plot.variant === 'beeswarm') {
    const clouds = scene.plot.lanes.map((lane) => (byLane.get(lane.id) ?? []).map(({ mark }) => valuePixel(mark.value)))
    const fitted = fitSwarmClouds(clouds, (scene.compatibilityConfig.distributionPointSize ?? 9) / .9, laneBand * scene.plot.widthRatio / 2)
    scene.plot.lanes.forEach((lane, laneIndex) => (byLane.get(lane.id) ?? []).forEach(({ mark }, index) => swarmOffsets.set(mark.id, fitted.offsets[laneIndex][index])))
  }
  const activeGroups = observationLayer?.groups ?? countsLayer?.groups ?? barcodeLayer?.groups ?? []
  const marks: ResolvedDistributionMarkPlacement[] = activeGroups.flatMap((entry) => {
    const group = scene.plot.groups.find((item) => item.id === entry.groupId)!, lane = scene.plot.lanes.find((item) => item.id === group.laneId)!, center = lanePixel(lane.index)
    return entry.marks.map((mark, index) => {
      const offset = scene.plot.variant === 'jitter' ? deterministicDistributionOffset(index, groupIndex.get(group.id) ?? 0) * scene.plot.jitterAmount * scene.plot.widthRatio * laneBand : scene.plot.variant === 'beeswarm' ? swarmOffsets.get(mark.id) ?? 0 : 0
      const primary = valuePixel(mark.value), diameter = 'marker' in mark ? mark.marker.size : 0, x = horizontal ? primary : center + offset, y = horizontal ? center + offset : primary
      const placement: ResolvedDistributionMarkPlacement = { elementId: mark.id, groupId: group.id, mark, valuePixel: primary, laneCenterPixel: center, laneCoordinate: lane.index + (horizontal ? -offset : offset) / Math.max(Number.EPSILON, laneBand), crossOffsetPixel: offset, x, y, markerDiameter: diameter }
      if ('stroke' in mark) { const half = Math.min(28, Math.max(4, laneBand * scene.plot.widthRatio / 2)); placement.line = horizontal ? { x1: x, y1: y - half, x2: x, y2: y + half } : { x1: x - half, y1: y, x2: x + half, y2: y } }
      return placement
    })
  })
  const summaryLayer = scene.plot.layers.find((layer) => layer.kind === 'summaries')
  const summaries = summaryLayer?.marks.filter((mark) => mark.visible).map((mark): ResolvedDistributionSummaryPlacement => {
    const group = scene.plot.groups.find((item) => item.id === mark.groupId)!, lane = scene.plot.lanes.find((item) => item.id === group.laneId)!, center = lanePixel(lane.index), primary = valuePixel(mark.value)
    const ratio = scene.plot.variant === 'beeswarm' ? .94 : scene.plot.variant === 'jitter' ? .72 : scene.plot.variant === 'counts' ? .42 : .28
    const maximum = scene.plot.variant === 'beeswarm' ? 72 : scene.plot.variant === 'jitter' ? 56 : scene.plot.variant === 'counts' ? 44 : 28
    const baseSize = scene.compatibilityConfig.distributionPointSize ?? 9
    const barcodeHalf = Math.min(28, Math.max(4, laneBand * scene.plot.widthRatio / 2))
    const half = (scene.plot.variant === 'barcode' ? barcodeHalf : Math.min(maximum / 2, Math.max(baseSize * 1.15, laneBand * scene.plot.widthRatio * ratio / 2))) * mark.lengthRatio
    return horizontal ? { ...mark, x1: primary, y1: center - half, x2: primary, y2: center + half, cap: scene.plot.variant === 'barcode' ? 'butt' : 'round' } : { ...mark, x1: center - half, y1: primary, x2: center + half, y2: primary, cap: scene.plot.variant === 'barcode' ? 'butt' : 'round' }
  }) ?? []
  const laneGrid = scene.plot.grid.laneVisible ? scene.plot.lanes.map((lane): ResolvedDistributionLaneGridLine => { const cross = lanePixel(lane.index); return horizontal ? { laneId: lane.id, x1: frame.plot.x, y1: cross, x2: frame.plot.x + frame.plot.width, y2: cross, stroke: scene.plot.grid } : { laneId: lane.id, x1: cross, y1: frame.plot.y, x2: cross, y2: frame.plot.y + frame.plot.height, stroke: scene.plot.grid } }) : []
  const geometry: ResolvedSceneGeometry = { canvas: frame.canvas, content: frame.content, plot: frame.plot, reservations: reservationGeometry, axes, elements: Object.fromEntries(marks.map((mark) => [mark.elementId, { x: mark.x - mark.markerDiameter / 2, y: mark.y - mark.markerDiameter / 2, width: mark.markerDiameter, height: mark.markerDiameter }])), guides: {} }
  return { ...scene, plot: { ...scene.plot, valueAxis, laneAxis }, geometry, resolvedReservations: frame.resolvedReservations, distributionGeometry: { marks, summaries, laneGrid, laneBand } }
}
