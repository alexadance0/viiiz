import type { ChartConfig } from '../../../core/types'

export function waffleCellCoordinates(columns: number, rows: number, direction: ChartConfig['waffleFillDirection'] = 'top', corner: ChartConfig['waffleCorner'] = 'top-left', counts: number[] = [columns * rows]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  if (direction === 'corner') {
    const occupied = new Set<number>()
    let minimumWidth = 1, minimumHeight = 1, target = 0
    for (const count of counts) {
      target += count
      if (!count) continue
      let width = columns, height = rows
      for (let candidate = minimumWidth; candidate <= columns; candidate++) {
        const candidateHeight = Math.max(minimumHeight, Math.ceil(target / candidate))
        if (candidateHeight > rows) continue
        const span = Math.max(candidate, candidateHeight), bestSpan = Math.max(width, height)
        if (span < bestSpan || span === bestSpan && candidate * candidateHeight < width * height) {
          width = candidate
          height = candidateHeight
        }
      }
      // Complete rows first: the remainder stays along one outer edge.
      for (let row = 0; row < height && cells.length < target; row++) {
        for (let column = 0; column < width && cells.length < target; column++) {
          const key = row * columns + column
          if (occupied.has(key)) continue
          occupied.add(key)
          cells.push([column, row])
          minimumWidth = Math.max(minimumWidth, column + 1)
          minimumHeight = Math.max(minimumHeight, row + 1)
        }
      }
    }
    return cells.map(([column, row]) => [corner.endsWith('right') ? columns - column - 1 : column, corner.startsWith('bottom') ? rows - row - 1 : row])
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) cells.push([column, direction === 'bottom' ? rows - row - 1 : row])
  return cells
}

/** Largest rectangle wholly occupied by this category, including corner-filled grids. */
export function waffleLabelArea(columns: number, rows: number, occupied: Array<[number, number]>) {
  const cells = new Set(occupied.map(([column, row]) => row * columns + column)), heights = Array(columns).fill(0) as number[]
  let best = { column: 0, row: 0, width: 0, height: 0 }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) heights[column] = cells.has(row * columns + column) ? heights[column] + 1 : 0
    const stack: number[] = []
    for (let column = 0; column <= columns; column++) {
      const height = column === columns ? 0 : heights[column]
      while (stack.length && heights[stack.at(-1)!] > height) {
        const last = stack.pop()!, start = stack.length ? stack.at(-1)! + 1 : 0, width = column - start
        if (width * heights[last] > best.width * best.height) best = { column: start, row: row - heights[last] + 1, width, height: heights[last] }
      }
      stack.push(column)
    }
  }
  return best
}
