import type { Rect } from './geometry'

export interface LayoutReservation {
  id: string
  side: 'top' | 'right' | 'bottom' | 'left'
  size: number
  gap: number
  mode: 'outside' | 'inside' | 'overlay'
  priority: number
}

export interface ResolvedReservation { reservation: LayoutReservation; bounds: Rect }

export function resolveReservations(rect: Rect, reservations: LayoutReservation[]) {
  const resolved = { ...rect }
  const rails: ResolvedReservation[] = []
  for (const reservation of [...reservations].sort((a, b) => a.priority - b.priority)) {
    if (reservation.mode !== 'outside' || reservation.size <= 0) continue
    const amount = reservation.size + reservation.gap
    if (reservation.side === 'top') { rails.push({ reservation, bounds: { x: resolved.x, y: resolved.y, width: resolved.width, height: reservation.size } }); resolved.y += amount; resolved.height -= amount }
    if (reservation.side === 'bottom') { rails.push({ reservation, bounds: { x: resolved.x, y: resolved.y + resolved.height - reservation.size, width: resolved.width, height: reservation.size } }); resolved.height -= amount }
    if (reservation.side === 'left') { rails.push({ reservation, bounds: { x: resolved.x, y: resolved.y, width: reservation.size, height: resolved.height } }); resolved.x += amount; resolved.width -= amount }
    if (reservation.side === 'right') { rails.push({ reservation, bounds: { x: resolved.x + resolved.width - reservation.size, y: resolved.y, width: reservation.size, height: resolved.height } }); resolved.width -= amount }
  }
  resolved.width = Math.max(0, resolved.width)
  resolved.height = Math.max(0, resolved.height)
  return { plot: resolved, reservations: rails }
}

export const applyReservations = (rect: Rect, reservations: LayoutReservation[]) => resolveReservations(rect, reservations).plot
