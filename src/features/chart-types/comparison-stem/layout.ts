import { denseValueLabelStride, showDenseValueLabel } from '../../../core/chartLabels'
import { measureTextWidth } from '../../../core/textMetrics'
import type { NativeComparisonStemChartScene, ResolvedComparisonStemGeometry, ResolvedSceneGeometry } from '../../../entities/chart/model/ChartScene'
import type { ResolvedReservation } from '../../chart-layout/reservations'
import { resolveNativeCartesianScene } from '../bar/layout'

export type ResolvedComparisonStemScene = NativeComparisonStemChartScene & {
  geometry: ResolvedSceneGeometry
  comparisonGeometry: ResolvedComparisonStemGeometry
  resolvedReservations: ResolvedReservation[]
}

const valueRatio = (value: number, minimum: number, maximum: number, logarithmic: boolean) => {
  if (logarithmic) {
    const safeMinimum = Math.max(Number.MIN_VALUE, minimum), safeMaximum = Math.max(safeMinimum * 10, maximum)
    return (Math.log(Math.max(safeMinimum, value)) - Math.log(safeMinimum)) / (Math.log(safeMaximum) - Math.log(safeMinimum))
  }
  return (value - minimum) / Math.max(Number.EPSILON, maximum - minimum)
}

export function resolveNativeComparisonStemScene(sourceScene: NativeComparisonStemChartScene): ResolvedComparisonStemScene {
  if (sourceScene.plot.kind !== 'comparison-stem') throw new Error('Comparison/stem layout requires a comparison/stem scene.')
  const scene = resolveNativeCartesianScene(sourceScene) as NativeComparisonStemChartScene & { geometry: ResolvedSceneGeometry; resolvedReservations: ResolvedReservation[] }
  const plot = scene.geometry.plot, horizontal = scene.plot.orientation === 'horizontal'
  const count = Math.max(1, scene.plot.categories.length), band = (horizontal ? plot.height : plot.width) / count
  const inverseCategory = horizontal && (scene.compatibilityConfig.categoryAxisInverse ?? true)
  const categoryCoordinate = (index: number) => horizontal
    ? plot.y + (inverseCategory ? index + .5 : count - index - .5) * band
    : plot.x + (index + .5) * band
  const valueCoordinate = (value: number) => {
    if (scene.compatibilityConfig.yAxisScaleType === 'log' && value <= 0) return undefined
    const ratio = valueRatio(value, scene.plot.valueDomain.min, scene.plot.valueDomain.max, scene.compatibilityConfig.yAxisScaleType === 'log')
    return horizontal ? plot.x + ratio * plot.width : plot.y + (1 - ratio) * plot.height
  }
  const points: ResolvedComparisonStemGeometry['points'] = {}
  scene.plot.series.forEach((series) => {
    const visiblePoints = series.points.filter((point) => point.value != null && point.label.visible)
    const width = Math.max(0, ...visiblePoints.map((point) => measureTextWidth(point.label.text, point.label.style.size, point.label.style.fontFamily, point.label.style.weight)))
    const height = Math.max(0, ...visiblePoints.map((point) => Math.round(point.label.style.size * point.label.style.lineHeight / 100)))
    const stride = scene.plot.variant === 'lollipop' ? denseValueLabelStride(horizontal, band, width, height, scene.compatibilityConfig.valueLabelHideOverlap ?? false) : 1
    series.points.forEach((point) => {
      if (point.value == null) return
      const value = valueCoordinate(point.value)
      if (value == null) return
      const x = horizontal ? value : categoryCoordinate(point.categoryIndex)
      const y = horizontal ? categoryCoordinate(point.categoryIndex) : value
      const distance = 7, labelVisible = point.label.visible && showDenseValueLabel(point.categoryIndex, scene.plot.categories.length, stride)
      const label = point.label.position === 'left' ? { x: x - distance, y, align: 'right' as const, verticalAlign: 'middle' as const, visible: labelVisible }
        : point.label.position === 'right' ? { x: x + distance, y, align: 'left' as const, verticalAlign: 'middle' as const, visible: labelVisible }
          : point.label.position === 'bottom' ? { x, y: y + distance, align: 'center' as const, verticalAlign: 'top' as const, visible: labelVisible }
            : { x, y: y - distance, align: 'center' as const, verticalAlign: 'bottom' as const, visible: labelVisible }
      points[point.id] = { x, y, label }
      const half = point.marker.size / 2
      scene.geometry.elements[point.id] = { x: x - half, y: y - half, width: point.marker.size, height: point.marker.size }
    })
  })
  const connectors: ResolvedComparisonStemGeometry['connectors'] = {}
  scene.plot.connectors.forEach((connector) => {
    const category = categoryCoordinate(connector.categoryIndex)
    const from = valueCoordinate(connector.fromValue), to = valueCoordinate(connector.toValue)
    if (from == null || to == null) return
    const x1 = horizontal ? from : category, y1 = horizontal ? category : from
    const x2 = horizontal ? to : category, y2 = horizontal ? category : to
    let changeLabel: { x: number; y: number; align: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom' } | undefined
    if (connector.change?.visible) {
      const offset = scene.compatibilityConfig.valueText.size / 2 + (horizontal ? 6 : 8), position = connector.change.position
      if (horizontal) changeLabel = position === 'start'
        ? { x: Math.min(x1, x2) - offset, y: (y1 + y2) / 2, align: 'right', verticalAlign: 'middle' }
        : position === 'end' ? { x: Math.max(x1, x2) + offset, y: (y1 + y2) / 2, align: 'left', verticalAlign: 'middle' }
          : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - offset, align: 'center', verticalAlign: 'middle' }
      else changeLabel = position === 'start'
        ? { x: (x1 + x2) / 2, y: Math.min(y1, y2) - 8, align: 'center', verticalAlign: 'bottom' }
        : position === 'end' ? { x: (x1 + x2) / 2, y: Math.max(y1, y2) + 8, align: 'center', verticalAlign: 'top' }
          : { x: (x1 + x2) / 2 + offset, y: (y1 + y2) / 2, align: 'left', verticalAlign: 'middle' }
    }
    connectors[connector.id] = { x1, y1, x2, y2, changeLabel }
  })
  const directLabels: ResolvedComparisonStemGeometry['directLabels'] = {}
  const directGuide = scene.guides.find((guide) => guide.kind === 'direct-series')
  const directCandidates = directGuide?.visible ? directGuide.items.filter((item) => item.visible).flatMap((item) => {
    const series = scene.plot.series.find((candidate) => candidate.id === item.seriesId)
    const point = series?.points.findLast((candidate) => candidate.value != null && Boolean(points[candidate.id])), resolved = point && points[point.id]
    if (!point || !resolved) return []
    const distance = scene.compatibilityConfig.directLabelGap ?? 14
    const lineHeight = Math.round(item.style.size * item.style.lineHeight / 100), noteHeight = item.note ? Math.max(8, item.style.size - 2) * 1.25 + 3 : 0
    const width = Math.max(...[item.label, item.note ?? ''].flatMap((text) => text.split('\n').map((line) => measureTextWidth(line, item.style.size, item.style.fontFamily, item.style.weight))))
    const initial = horizontal
      ? { x: resolved.x, y: resolved.y - distance, align: 'center' as const, verticalAlign: 'bottom' as const, collision: 'shift-x' as const }
      : scene.compatibilityConfig.yAxisPosition === 'right'
        ? { x: resolved.x - distance, y: resolved.y, align: 'right' as const, verticalAlign: 'middle' as const, collision: 'shift-y' as const }
        : { x: resolved.x + distance, y: resolved.y, align: 'left' as const, verticalAlign: 'middle' as const, collision: 'shift-y' as const }
    return [{ item, point, resolved, initial, width, height: lineHeight + noteHeight, lineHeight }]
  }) : []
  directCandidates.sort((left, right) => horizontal ? left.initial.x - right.initial.x : left.initial.y - right.initial.y)
  const minimum = horizontal ? plot.x : plot.y, maximum = horizontal ? plot.x + plot.width : plot.y + plot.height
  const halves = directCandidates.map((candidate) => (horizontal ? candidate.width : candidate.height) / 2)
  const positions = directCandidates.map((candidate, index) => Math.max(minimum + halves[index], horizontal ? candidate.initial.x : candidate.initial.y))
  for (let index = 1; index < positions.length; index += 1) positions[index] = Math.max(positions[index], positions[index - 1] + halves[index - 1] + halves[index] + 4)
  if (positions.length) positions[positions.length - 1] = Math.min(positions[positions.length - 1], maximum - halves[halves.length - 1])
  for (let index = positions.length - 2; index >= 0; index -= 1) positions[index] = Math.min(positions[index], positions[index + 1] - halves[index + 1] - halves[index] - 4)
  directCandidates.forEach((candidate, index) => {
    const natural = horizontal ? candidate.initial.x : candidate.initial.y
    const adjusted = positions[index]
    const x = horizontal ? adjusted : candidate.initial.x, y = horizontal ? candidate.initial.y : adjusted
    const displacement = adjusted - natural
    const leader = candidate.item.leaderLine || Math.abs(displacement) > .5 ? { points: [[candidate.resolved.x, candidate.resolved.y] as [number, number], [x, y] as [number, number]] } : undefined
    directLabels[candidate.item.seriesId] = { pointId: candidate.point.id, anchorX: candidate.resolved.x, anchorY: candidate.resolved.y, x, y, width: candidate.width, height: candidate.height, noteY: candidate.item.note ? y + candidate.lineHeight / 2 + 3 : undefined, align: candidate.initial.align, verticalAlign: candidate.initial.verticalAlign, collision: candidate.initial.collision, displacement, leader }
  })
  const requestedStep = Math.max(1, Math.round(scene.compatibilityConfig.xAxisStep ?? 1))
  const categoryGridLines = !horizontal && scene.compatibilityConfig.showVerticalGrid
    ? scene.plot.categories.flatMap((category, index) => category.label && index % requestedStep === 0 ? [{ x1: categoryCoordinate(index), y1: plot.y, x2: categoryCoordinate(index), y2: plot.y + plot.height }] : [])
    : []
  return { ...scene, comparisonGeometry: { points, connectors, directLabels, categoryGridLines } }
}
