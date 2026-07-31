import type { Rect, Size } from './geometry'
import { insetRect } from './geometry'
import { applyReservations, type LayoutReservation } from './reservations'
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
}

export function resolveFrame({ canvas, spacing, reservations = [] }: FrameLayoutInput): ResolvedFrame {
  const canvasRect = { x: 0, y: 0, width: canvas.width, height: canvas.height }
  const content = insetRect(canvasRect, spacing.canvasInsets)
  return { canvas: canvasRect, content, plot: applyReservations(content, reservations), reservations }
}
