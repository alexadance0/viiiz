import { formatYAxisNumber } from '../../../core/numberFormat'
import { measureTextWidth } from '../../../core/textMetrics'
import type { ElementId } from '../../../entities/chart/model/ChartElement'
import type { DistributionBarcodeMarkScene, DistributionBoxMarkScene, DistributionCountMarkScene, DistributionGroupId, DistributionObservationScene, LayerId, NativeDistributionChartScene, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
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
type Line = { x1: number; y1: number; x2: number; y2: number }
export interface ResolvedDistributionBoxShape { layerId: LayerId; groupId: DistributionGroupId; box: Rect; lowerWhisker: Line; upperWhisker: Line; lowerCap: Line; upperCap: Line; median?: Line; mark: DistributionBoxMarkScene }
export interface ResolvedDistributionDensityShape { layerId: LayerId; groupId: DistributionGroupId; polygon: number[][]; outline: number[][]; baseline?: Line; fillColor: string; fillOpacity: number; stroke: { color: string; width: number }; tooltip: { group: string; count: number; median: string; mean: string; quartiles: string } }
export interface ResolvedDistributionDensitySummary { id: string; groupId: DistributionGroupId; lines: Array<Line & { color: string; width: number; dash?: number[] }>; boxes: Array<Rect & { fill: string; opacity: number; stroke: string; strokeWidth: number }> }
export interface ResolvedDistributionGeometry { marks: ResolvedDistributionMarkPlacement[]; summaries: ResolvedDistributionSummaryPlacement[]; boxShapes: ResolvedDistributionBoxShape[]; densityShapes: ResolvedDistributionDensityShape[]; densitySummaries: ResolvedDistributionDensitySummary[]; laneGrid: ResolvedDistributionLaneGridLine[]; laneBand: number }
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
  const splitViolin = scene.plot.variant === 'violin' && scene.plot.layers.find((layer) => layer.kind === 'density')?.groups.some((item) => item.mode === 'half-first') && scene.plot.layers.find((layer) => layer.kind === 'density')?.groups.some((item) => item.mode === 'half-second')
  const groupGeometry = (group: NativeDistributionChartScene['plot']['groups'][number]) => { const grouped = Boolean(scene.compatibilityConfig.distributionGroupField && (scene.plot.variant === 'box' || scene.plot.variant === 'violin' || scene.plot.variant === 'raincloud')) && !splitViolin; const slot = scene.plot.widthRatio / Math.max(1, group.subgroupCount); return { lane: scene.plot.lanes.find((item) => item.id === group.laneId)!.index + (grouped ? (group.subgroupIndex - (group.subgroupCount - 1) / 2) * slot : 0), widthRatio: grouped ? slot * .84 : scene.plot.widthRatio } }
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
    const group = scene.plot.groups.find((item) => item.id === entry.groupId)!, geometry = groupGeometry(group), center = lanePixel(geometry.lane)
    return entry.marks.map((mark, index) => {
      const random = deterministicDistributionOffset(index, groupIndex.get(group.id) ?? 0), density = scene.plot.layers.find((layer) => layer.kind === 'density')?.groups.find((item) => item.groupId === group.id)
      const offset = scene.plot.variant === 'jitter' ? random * scene.plot.jitterAmount * scene.plot.widthRatio * laneBand : scene.plot.variant === 'beeswarm' ? swarmOffsets.get(mark.id) ?? 0 : scene.plot.variant === 'raincloud' ? ((scene.compatibilityConfig.distributionRaincloudPointMode ?? 'overlay') === 'separate' ? .36 + random * .08 : .16 + random * .1) * geometry.widthRatio * laneBand : scene.plot.variant === 'violin' && density?.mode !== 'full' ? (density?.mode === 'half-first' ? -1 : 1) * (.08 + Math.abs(random) * .12) * geometry.widthRatio * laneBand : (scene.plot.variant === 'box' || scene.plot.variant === 'violin') ? random * .1 * geometry.widthRatio * laneBand : 0
      const primary = valuePixel(mark.value), diameter = 'marker' in mark ? mark.marker.size : 0, x = horizontal ? primary : center + offset, y = horizontal ? center + offset : primary
      const placement: ResolvedDistributionMarkPlacement = { elementId: mark.id, groupId: group.id, mark, valuePixel: primary, laneCenterPixel: center, laneCoordinate: geometry.lane + (horizontal ? -offset : offset) / Math.max(Number.EPSILON, laneBand), crossOffsetPixel: offset, x, y, markerDiameter: diameter }
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
  const boxLayer = scene.plot.layers.find((layer) => layer.kind === 'boxes')
  const boxShapes = boxLayer?.marks.map((mark): ResolvedDistributionBoxShape => {
    const group = scene.plot.groups.find((item) => item.id === mark.groupId)!, geometry = groupGeometry(group), center = lanePixel(geometry.lane), thickness = Math.min(56, Math.max(8, laneBand * geometry.widthRatio)), half = thickness / 2, cap = half * .55, medianHalf = half * mark.medianStyle.lengthRatio
    const point = (value: number, cross = center) => horizontal ? [valuePixel(value), cross] : [cross, valuePixel(value)]
    const low = point(mark.minimumInlier), q1 = point(mark.q1), median = point(mark.median), q3 = point(mark.q3), high = point(mark.maximumInlier)
    return { layerId: mark.id, groupId: mark.groupId, mark, lowerWhisker: { x1: low[0], y1: low[1], x2: q1[0], y2: q1[1] }, upperWhisker: { x1: q3[0], y1: q3[1], x2: high[0], y2: high[1] }, lowerCap: horizontal ? { x1: low[0], y1: low[1] - cap, x2: low[0], y2: low[1] + cap } : { x1: low[0] - cap, y1: low[1], x2: low[0] + cap, y2: low[1] }, upperCap: horizontal ? { x1: high[0], y1: high[1] - cap, x2: high[0], y2: high[1] + cap } : { x1: high[0] - cap, y1: high[1], x2: high[0] + cap, y2: high[1] }, box: horizontal ? { x: Math.min(q1[0], q3[0]), y: center - half, width: Math.max(1, Math.abs(q3[0] - q1[0])), height: thickness } : { x: center - half, y: Math.min(q1[1], q3[1]), width: thickness, height: Math.max(1, Math.abs(q1[1] - q3[1])) }, median: mark.medianStyle.visible ? horizontal ? { x1: median[0], y1: center - medianHalf, x2: median[0], y2: center + medianHalf } : { x1: center - medianHalf, y1: median[1], x2: center + medianHalf, y2: median[1] } : undefined }
  }) ?? []
  const densityLayer = scene.plot.layers.find((layer) => layer.kind === 'density')
  const densityShapes: ResolvedDistributionDensityShape[] = [], densitySummaries: ResolvedDistributionDensitySummary[] = []
  densityLayer?.groups.forEach((item) => {
    const group = scene.plot.groups.find((entry) => entry.id === item.groupId)!, geometry = groupGeometry(group), center = lanePixel(geometry.lane), shapeRatio = item.mode === 'ridge' ? item.widthRatio : geometry.widthRatio, thickness = Math.min(scene.plot.variant === 'raincloud' ? 84 : scene.plot.variant === 'violin' ? 88 : Number.POSITIVE_INFINITY, Math.max(8, laneBand * shapeRatio)), half = item.mode === 'ridge' ? thickness : thickness / 2
    const base = item.profile.samples.map((sample) => horizontal ? [valuePixel(sample.value), center] : [center, valuePixel(sample.value)]), first = base.map(([x, y], index) => horizontal ? [x, y - item.profile.samples[index].relativeDensity * half] : [x - item.profile.samples[index].relativeDensity * half, y]), second = [...base].reverse().map(([x, y], reverseIndex) => { const index = base.length - reverseIndex - 1; return horizontal ? [x, y + item.profile.samples[index].relativeDensity * half] : [x + item.profile.samples[index].relativeDensity * half, y] })
    const ridgeFirst = item.mode === 'ridge' && horizontal
    const polygon = item.mode === 'half-first' || ridgeFirst ? [...first, ...[...base].reverse()] : item.mode === 'half-second' || item.mode === 'ridge' ? [...base, ...second] : [...first, ...second]
    const outline = item.mode === 'half-second' || (item.mode === 'ridge' && !horizontal) ? [...second].reverse() : first
    const baseline = item.mode === 'ridge' ? { x1: base[0][0], y1: base[0][1], x2: base.at(-1)![0], y2: base.at(-1)![1] } : undefined
    densityShapes.push({ layerId: item.id, groupId: item.groupId, polygon, outline, baseline, fillColor: item.fill.color, fillOpacity: item.fill.opacity, stroke: item.outline, tooltip: item.tooltip })
    const summaryLane = scene.plot.variant === 'raincloud' ? geometry.lane + geometry.widthRatio * .16 : geometry.lane, cross = lanePixel(summaryLane), side = item.mode === 'ridge' ? horizontal ? -1 : 1 : item.mode === 'half-first' ? -1 : item.mode === 'half-second' ? 1 : 0, s = item.summary.style, lines: ResolvedDistributionDensitySummary['lines'] = [], boxes: ResolvedDistributionDensitySummary['boxes'] = []
    const lineAt = (value: number, relative: number, width: number, dash?: number[]) => { const primary = valuePixel(value), extent = relative * half * s.lengthRatio; lines.push(horizontal ? { x1: primary, y1: cross + (side > 0 ? 0 : -extent), x2: primary, y2: cross + (side < 0 ? 0 : extent), color: s.color, width, dash } : { x1: cross + (side > 0 ? 0 : -extent), y1: primary, x2: cross + (side < 0 ? 0 : extent), y2: primary, color: s.color, width, dash }) }
    if (item.summary.mode === 'ridge') { if (item.summary.showMedian) lineAt(group.summary.median, item.profile.statisticDensity.median, s.width) }
    else {
      if (item.summary.showWhiskers) { const a = valuePixel(group.summary.minimumInlier), b = valuePixel(group.summary.maximumInlier); lines.push(horizontal ? { x1: a, y1: cross, x2: b, y2: cross, color: s.color, width: Math.max(1, s.width * .55) } : { x1: cross, y1: a, x2: cross, y2: b, color: s.color, width: Math.max(1, s.width * .55) }) }
      if (item.summary.mode === 'lines') { lineAt(group.summary.q1, item.profile.statisticDensity.q1, Math.max(1, s.width * .55), [4, 3]); if (item.summary.showMedian) lineAt(group.summary.median, item.profile.statisticDensity.median, s.width); lineAt(group.summary.q3, item.profile.statisticDensity.q3, Math.max(1, s.width * .55), [4, 3]) }
      else { const q1 = valuePixel(group.summary.q1), q3 = valuePixel(group.summary.q3), boxSize = side ? item.summary.boxThickness / 2 : item.summary.boxThickness; boxes.push(horizontal ? { x: Math.min(q1, q3), y: cross + (side < 0 ? -boxSize : side > 0 ? 0 : -boxSize / 2), width: Math.max(1, Math.abs(q3 - q1)), height: boxSize, fill: item.summary.boxFill, opacity: .78, stroke: group.color, strokeWidth: 1.5 } : { x: cross + (side < 0 ? -boxSize : side > 0 ? 0 : -boxSize / 2), y: Math.min(q1, q3), width: boxSize, height: Math.max(1, Math.abs(q1 - q3)), fill: item.summary.boxFill, opacity: .78, stroke: group.color, strokeWidth: 1.5 }); if (item.summary.showMedian) { const p = valuePixel(group.summary.median), length = item.summary.boxThickness * s.lengthRatio / 2; lines.push(horizontal ? { x1: p, y1: cross + (side > 0 ? 0 : -length), x2: p, y2: cross + (side < 0 ? 0 : length), color: s.color, width: s.width } : { x1: cross + (side > 0 ? 0 : -length), y1: p, x2: cross + (side < 0 ? 0 : length), y2: p, color: s.color, width: s.width }) } }
    }
    densitySummaries.push({ id: `summary:${item.id}`, groupId: item.groupId, lines, boxes })
  })
  const laneGrid = scene.plot.grid.laneVisible ? scene.plot.lanes.map((lane): ResolvedDistributionLaneGridLine => { const cross = lanePixel(lane.index); return horizontal ? { laneId: lane.id, x1: frame.plot.x, y1: cross, x2: frame.plot.x + frame.plot.width, y2: cross, stroke: scene.plot.grid } : { laneId: lane.id, x1: cross, y1: frame.plot.y, x2: cross, y2: frame.plot.y + frame.plot.height, stroke: scene.plot.grid } }) : []
  const geometry: ResolvedSceneGeometry = { canvas: frame.canvas, content: frame.content, plot: frame.plot, reservations: reservationGeometry, axes, elements: Object.fromEntries(marks.map((mark) => [mark.elementId, { x: mark.x - mark.markerDiameter / 2, y: mark.y - mark.markerDiameter / 2, width: mark.markerDiameter, height: mark.markerDiameter }])), guides: {} }
  return { ...scene, plot: { ...scene.plot, valueAxis, laneAxis }, geometry, resolvedReservations: frame.resolvedReservations, distributionGeometry: { marks, summaries, boxShapes, densityShapes, densitySummaries, laneGrid, laneBand } }
}
