import type { ChartAnnotation, ChartDecoration, DecorationAnchor } from '../core/types'

export interface DecorationPoint { x: number; y: number }
export interface DecorationTarget extends DecorationPoint { key: string; label: string }

export const textAnchorPositions = [
  { x: 0, y: 0, label: 'Слева сверху' }, { x: .5, y: 0, label: 'Сверху' }, { x: 1, y: 0, label: 'Справа сверху' },
  { x: 0, y: .5, label: 'Слева' }, { x: 1, y: .5, label: 'Справа' },
  { x: 0, y: 1, label: 'Слева снизу' }, { x: .5, y: 1, label: 'Снизу' }, { x: 1, y: 1, label: 'Справа снизу' },
] as const

export function textAnchorPoint(annotation: ChartAnnotation, position: DecorationPoint, height: number) {
  return { x: annotation.x + annotation.width * position.x + (position.x * 2 - 1), y: annotation.y + height * position.y + (position.y * 2 - 1) }
}

export function annotationHeight(annotation: ChartAnnotation, measured?: number) {
  return measured ?? annotation.fontSize * 1.35 + 6
}

export interface DecorationSnapTarget extends DecorationTarget { anchor: DecorationAnchor }

export function decorationSnapTargets(annotations: ChartAnnotation[], targets: DecorationTarget[], heights: Record<string, number> = {}): DecorationSnapTarget[] {
  return [...targets.map((target) => ({ ...target, key: `data:${target.key}`, anchor: { elementKey: target.key } })), ...annotations.filter((annotation) => !annotation.hidden).flatMap((annotation) => textAnchorPositions.map((position, index) => ({ ...textAnchorPoint(annotation, position, annotationHeight(annotation, heights[annotation.id])), key: `text:${annotation.id}:${index}`, label: `${annotation.name || 'Текст'} · ${position.label}`, anchor: { annotationId: annotation.id, side: 'auto' as const, position: { x: position.x, y: position.y } } })))]
}

// Radius and distance are measured on screen, so snapping behaves equally at
// every canvas zoom and in small panels.
export function nearestDecorationTarget(point: DecorationPoint, targets: DecorationSnapTarget[], scaleX: number, scaleY: number, radius = 18) {
  let nearest: DecorationSnapTarget | null = null, distance = radius
  for (const target of targets) {
    const next = Math.hypot((target.x - point.x) * scaleX, (target.y - point.y) * scaleY)
    if (next < distance) { nearest = target; distance = next }
  }
  return nearest
}

export function resolveDecoration(decoration: ChartDecoration, annotations: ChartAnnotation[], targets: DecorationTarget[], heights: Record<string, number> = {}): ChartDecoration {
  if (decoration.type === 'area') return decoration
  const resolve = (anchor: DecorationAnchor | undefined, fallback: DecorationPoint, opposite: DecorationPoint) => {
    if (anchor?.elementKey) return targets.find((point) => point.key === anchor.elementKey) ?? fallback
    const annotation = annotations.find((item) => item.id === anchor?.annotationId)
    if (!annotation || !anchor?.annotationId) return fallback
    const height = annotationHeight(annotation, heights[annotation.id])
    const center = { x: annotation.x + annotation.width / 2, y: annotation.y + height / 2 }
    let side = anchor.side
    if (side === 'auto') {
      const dx = opposite.x - center.x, dy = opposite.y - center.y
      side = Math.abs(dx) / annotation.width > Math.abs(dy) / height ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'top' : 'bottom'
    }
    return anchor.position ? textAnchorPoint(annotation, anchor.position, height) : side === 'left' ? { x: annotation.x - 1, y: center.y } : side === 'right' ? { x: annotation.x + annotation.width + 1, y: center.y } : side === 'top' ? { x: center.x, y: annotation.y - 1 } : { x: center.x, y: annotation.y + height + 1 }
  }
  const initialStart = { x: decoration.x, y: decoration.y }, initialEnd = { x: decoration.x + decoration.width, y: decoration.y + decoration.height }
  const end = resolve(decoration.endAnchor, initialEnd, initialStart)
  const start = resolve(decoration.startAnchor, initialStart, end)
  return { ...decoration, x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y }
}

// Control handles are offsets from their endpoints, so attachments can move independently.
export function decorationControls(decoration: ChartDecoration) {
  const { x, y, width, height } = decoration
  const first = decoration.controlPoints?.first, second = decoration.controlPoints?.second
  if (first && second) return { first: { x: x + first.x, y: y + first.y }, second: { x: x + width + second.x, y: y + height + second.y } }
  // Convert the original quadratic curve to a cubic without changing old documents.
  const control = { x: x + width / 2 - height * (decoration.curvature ?? .28), y: y + height / 2 + width * (decoration.curvature ?? .28) }
  return { first: { x: x + (control.x - x) * 2 / 3, y: y + (control.y - y) * 2 / 3 }, second: { x: x + width + (control.x - x - width) * 2 / 3, y: y + height + (control.y - y - height) * 2 / 3 } }
}

export function detachDecorationText(decoration: ChartDecoration, annotationId: string, resolved = decoration): ChartDecoration {
  if (decoration.startAnchor?.annotationId !== annotationId && decoration.endAnchor?.annotationId !== annotationId) return decoration
  return { ...decoration, x: resolved.x, y: resolved.y, width: resolved.width, height: resolved.height, startAnchor: decoration.startAnchor?.annotationId === annotationId ? undefined : decoration.startAnchor, endAnchor: decoration.endAnchor?.annotationId === annotationId ? undefined : decoration.endAnchor }
}
