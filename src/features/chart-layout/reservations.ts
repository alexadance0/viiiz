import type { Rect } from './geometry'

export interface LayoutReservation {
  side: 'top' | 'right' | 'bottom' | 'left'
  size: number
  gap: number
  mode: 'outside' | 'inside' | 'overlay'
  priority: number
}

export function applyReservations(rect: Rect, reservations: LayoutReservation[]) {
  const resolved = { ...rect }
  for (const reservation of [...reservations].sort((a, b) => a.priority - b.priority)) {
    if (reservation.mode !== 'outside' || reservation.size <= 0) continue
    const amount = reservation.size + reservation.gap
    if (reservation.side === 'top') { resolved.y += amount; resolved.height -= amount }
    if (reservation.side === 'bottom') resolved.height -= amount
    if (reservation.side === 'left') { resolved.x += amount; resolved.width -= amount }
    if (reservation.side === 'right') resolved.width -= amount
  }
  resolved.width = Math.max(0, resolved.width)
  resolved.height = Math.max(0, resolved.height)
  return resolved
}
