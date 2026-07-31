import type { Rect, Size } from './geometry'
import { insetRect } from './geometry'
import { resolveReservations, type LayoutReservation, type ResolvedReservation } from './reservations'
import type { CompositionSpacing } from './spacing'

export interface FrameLayoutInput {
  canvas: Size
  spacing: CompositionSpacing
  reservations?: LayoutReservation[]
}

export interface ResolvedFrame {
  canvas: Rect
  content: Rect
  plot: Rect
  reservations: LayoutReservation[]
  resolvedReservations: ResolvedReservation[]
}

export function resolveFrame({ canvas, spacing, reservations = [] }: FrameLayoutInput): ResolvedFrame {
  const canvasRect = { x: 0, y: 0, width: canvas.width, height: canvas.height }
  const content = insetRect(canvasRect, spacing.canvasInsets)
  const resolved = resolveReservations(content, reservations)
  return { canvas: canvasRect, content, plot: resolved.plot, reservations, resolvedReservations: resolved.reservations }
}
