import type { Rect } from '../../chart-layout/geometry'

type Cubic = [number, number, number, number]
export interface StreamLabelSegment { left: number; right: number; top: Cubic; bottom: Cubic }

function cubicRange([p0, p1, p2, p3]: Cubic, from: number, to: number) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 3 * p0 - 6 * p1 + 3 * p2, c = 3 * (p1 - p0)
  const at = (t: number) => ((a * t + b) * t + c) * t + p0
  const positions = [from, to]
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) positions.push(-c / (2 * b))
  } else {
    const discriminant = b * b - 3 * a * c
    if (discriminant >= 0) positions.push((-b - Math.sqrt(discriminant)) / (3 * a), (-b + Math.sqrt(discriminant)) / (3 * a))
  }
  const values = positions.filter((t) => t >= from && t <= to).map(at)
  return { min: Math.min(...values), max: Math.max(...values) }
}

// Intersect the ribbon across the entire text box, including cubic extrema.
export function placeStreamLabel(segments: StreamLabelSegment[], width: number, height: number, plot: Rect, allowOverflow = false) {
  const padding = 4, halfWidth = width / 2 + padding
  const left = Math.max(plot.x, segments[0]?.left ?? Infinity) + halfWidth
  const right = Math.min(plot.x + plot.width, segments.at(-1)?.right ?? -Infinity) - halfWidth
  let best: { x: number; y: number; clearance: number; overflow?: boolean } | undefined
  let fallback: typeof best
  if (width <= 0 || height <= 0 || left > right) return best
  const steps = Math.max(2, Math.ceil((right - left) / 8) * 2)
  for (let step = 0; step <= steps; step++) {
    const x = left + (right - left) * step / steps
    let top = plot.y, bottom = plot.y + plot.height
    for (const segment of segments) {
      if (segment.right < x - halfWidth || segment.left > x + halfWidth) continue
      const from = Math.max(0, (x - halfWidth - segment.left) / (segment.right - segment.left))
      const to = Math.min(1, (x + halfWidth - segment.left) / (segment.right - segment.left))
      top = Math.max(top, cubicRange(segment.top, from, to).max)
      bottom = Math.min(bottom, cubicRange(segment.bottom, from, to).min)
    }
    const clearance = bottom - top - height - padding * 2
    if (clearance >= 0 && (!best || clearance > best.clearance + .01 || Math.abs(clearance - best.clearance) <= .01 && Math.abs(x - (left + right) / 2) < Math.abs(best.x - (left + right) / 2))) best = { x, y: (top + bottom) / 2, clearance }
    if (allowOverflow && clearance < 0) {
      const segment = segments.find((segment) => segment.left <= x && segment.right >= x)
      if (!segment) continue
      const t = (x - segment.left) / (segment.right - segment.left)
      const centerTop = cubicRange(segment.top, t, t).min, centerBottom = cubicRange(segment.bottom, t, t).min
      const y = (centerTop + centerBottom) / 2
      if (centerBottom - centerTop > .5 && y - height / 2 >= plot.y + padding && y + height / 2 <= plot.y + plot.height - padding && (!fallback || clearance > fallback.clearance)) fallback = { x, y, clearance, overflow: true }
    }
  }
  return best ?? fallback
}
