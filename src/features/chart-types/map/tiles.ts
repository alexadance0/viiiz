import grids from './data/tile-grids.json'
import type { MapPreset } from './catalog'

export const tileGrid = (preset: MapPreset): Record<string, { column: number; row: number; label: string }> => grids[preset]

export function tileGeometry(preset: MapPreset, requestedGap = 4) {
  const grid = tileGrid(preset), gap = Math.max(0, Math.min(30, Number.isFinite(requestedGap) ? requestedGap : 4))
  const size = 100 - gap, inset = gap / 2
  const regions = Object.fromEntries(Object.entries(grid).map(([id, tile]) => {
    const x = tile.column * 100 + inset, y = tile.row * 100 + inset
    return [id, { polygons: [[[[x, y], [x + size, y], [x + size, y + size], [x, y + size]]]], center: [x + size / 2, y + size / 2], area: size * size }]
  }))
  return { width: (Math.max(...Object.values(grid).map((tile) => tile.column)) + 1) * 100, height: (Math.max(...Object.values(grid).map((tile) => tile.row)) + 1) * 100, regions }
}
