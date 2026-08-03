export function normalizeMovingAverageWindow(value: number | undefined) {
  return Math.max(2, Math.round(value ?? 12))
}

export function movingAverage(values: Array<number | null>, requestedWindow: number): Array<number | null> {
  const window = normalizeMovingAverageWindow(requestedWindow)
  return values.map((_, index) => {
    const start = index - window + 1
    if (start < 0) return null
    let sum = 0
    for (let cursor = start; cursor <= index; cursor += 1) {
      const value = values[cursor]
      if (value == null || !Number.isFinite(value)) return null
      sum += value
    }
    return sum / window
  })
}
