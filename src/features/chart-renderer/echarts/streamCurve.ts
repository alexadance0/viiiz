// Monotone cubic Hermite tangents: retain every sample without overshooting.
export function monotoneTangents(x: number[], y: number[]): number[] {
  const widths = x.slice(1).map((value, i) => value - x[i])
  const secants = widths.map((width, i) => width > 0 ? (y[i + 1] - y[i]) / width : 0)
  return y.map((_, i) => {
    if (!i) return secants[0] ?? 0
    if (i === y.length - 1) return secants[i - 1] ?? 0
    const before = secants[i - 1], after = secants[i]
    if (before * after <= 0) return 0
    const first = 2 * widths[i] + widths[i - 1], second = widths[i] + 2 * widths[i - 1]
    return (first + second) / (first / before + second / after)
  })
}

export function streamBoundaryTangents(x: number[], bands: Array<Array<{ lower: number; upper: number }>>): number[][] {
  if (!bands.length) return []
  const boundaries = [monotoneTangents(x, bands[0].map((band) => band.lower))]
  // Interpolate nonnegative thicknesses, then accumulate shared boundaries.
  // This keeps adjacent ribbons joined and prevents thin ribbons crossing.
  for (const layer of bands) {
    const thickness = monotoneTangents(x, layer.map((band) => band.upper - band.lower))
    boundaries.push(thickness.map((slope, i) => slope + boundaries.at(-1)![i]))
  }
  return boundaries
}
