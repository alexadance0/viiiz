type Point = [number, number]
type Polygon = number[][][]

// Signed distance to every ring: holes and concave shores reduce the available space.
export function polygonDistance([x, y]: Point, polygon: Polygon) {
  let inside = false, minimum = Infinity
  for (const ring of polygon) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i]
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
    const dx = bx - ax, dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
    minimum = Math.min(minimum, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2)
  }
  return (inside ? 1 : -1) * Math.sqrt(minimum)
}

const area = (ring: number[][]) => Math.abs(ring.reduce((sum, p, i) => {
  const next = ring[(i + 1) % ring.length]
  return sum + p[0] * next[1] - next[0] * p[1]
}, 0)) / 2

const cache = new WeakMap<number[][][][], { center: Point; radius: number; polygon: Polygon }>()

export function interiorAnchor(polygons: number[][][][]) {
  const cached = cache.get(polygons)
  if (cached) return cached
  const polygon = polygons.reduce((best, item) => area(item[0]) > area(best[0]) ? item : best)
  const xs = polygon[0].map((p) => p[0]), ys = polygon[0].map((p) => p[1])
  const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX, height = Math.max(...ys) - minY
  const cell = (x: number, y: number, half: number) => {
    const distance = polygonDistance([x, y], polygon)
    return { x, y, half, distance, potential: distance + half * Math.SQRT2 }
  }
  let best = cell(minX + width / 2, minY + height / 2, 0)
  const queue = [cell(best.x, best.y, Math.max(width, height) / 2)]
  while (queue.length) {
    const current = queue.pop()!
    if (current.distance > best.distance) best = current
    if (current.potential <= best.distance + .5) continue
    const half = current.half / 2
    for (const dx of [-half, half]) for (const dy of [-half, half]) {
      const next = cell(current.x + dx, current.y + dy, half)
      if (next.potential <= best.distance + .5) continue
      // Highest possible clearance first; binary insertion avoids a custom heap.
      let low = 0, high = queue.length
      while (low < high) {
        const middle = (low + high) >>> 1
        if (queue[middle].potential < next.potential) low = middle + 1
        else high = middle
      }
      queue.splice(low, 0, next)
    }
  }
  const result = { center: [best.x, best.y] as Point, radius: Math.max(0, best.distance), polygon }
  cache.set(polygons, result)
  return result
}

// All four corners must be inside, and no shore or hole may cross the text box.
export function rectangleInsidePolygon(center: Point, width: number, height: number, polygon: Polygon) {
  const left = center[0] - width / 2, right = center[0] + width / 2
  const top = center[1] - height / 2, bottom = center[1] + height / 2
  if ([[left, top], [right, top], [right, bottom], [left, bottom]].some((p) => polygonDistance(p as Point, polygon) <= 0)) return false
  for (const ring of polygon) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i]
    let enter = 0, leave = 1
    for (const [p, q] of [[ax - bx, ax - left], [bx - ax, right - ax], [ay - by, ay - top], [by - ay, bottom - ay]]) {
      if (!p) { if (q < 0) { enter = 2; break } }
      else if (p < 0) enter = Math.max(enter, q / p)
      else leave = Math.min(leave, q / p)
    }
    if (enter < leave) return false
  }
  return true
}
