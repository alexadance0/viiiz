export interface HistogramBin {
  index: number
  start: number
  end: number
  center: number
  count: number
}

export interface FrequencyDomain {
  minimum: number
  maximum: number
}

export function histogramDomain(rawMinimum: number, rawMaximum: number, requestedMinimum?: number, requestedMaximum?: number): FrequencyDomain {
  const automaticMinimum = rawMinimum === rawMaximum ? rawMinimum - .5 : rawMinimum
  const automaticMaximum = rawMinimum === rawMaximum ? rawMaximum + .5 : rawMaximum
  const minimum = requestedMinimum ?? automaticMinimum, maximum = requestedMaximum ?? automaticMaximum
  const fallbackSpan = Math.max(1, automaticMaximum - automaticMinimum)
  if (minimum === maximum) return { minimum: minimum - .5, maximum: maximum + .5 }
  if (minimum > maximum && requestedMinimum == null) return { minimum: maximum - fallbackSpan, maximum }
  if (minimum > maximum && requestedMaximum == null) return { minimum, maximum: minimum + fallbackSpan }
  return { minimum, maximum }
}

export function histogramBins(values: number[], domain: FrequencyDomain, requestedCount = 12): HistogramBin[] {
  const count = Math.min(80, Math.max(3, Math.round(requestedCount)))
  const width = (domain.maximum - domain.minimum) / count
  return Array.from({ length: count }, (_, index) => {
    const start = domain.minimum + index * width, end = index === count - 1 ? domain.maximum : start + width
    return { index, start, end, center: (start + end) / 2, count: values.filter((value) => value >= start && (index === count - 1 ? value <= end : value < end)).length }
  })
}

export interface KdePoint { value: number; density: number }

export function kdeDensity(values: number[], domain: FrequencyDomain, bandwidthRatio: number, globalSpan: number, sampleCount = 121) {
  const bandwidth = Math.max((values.at(-1)! - values[0]) * bandwidthRatio, globalSpan / 1000)
  const normalizer = Math.sqrt(2 * Math.PI)
  const points = Array.from({ length: sampleCount }, (_, index): KdePoint => {
    const value = domain.minimum + (domain.maximum - domain.minimum) * index / (sampleCount - 1)
    const density = values.reduce((sum, current) => sum + Math.exp(-.5 * ((value - current) / bandwidth) ** 2), 0) / (values.length * bandwidth * normalizer)
    return { value, density }
  })
  points[0].density = 0
  points[points.length - 1].density = 0
  return { bandwidth, points }
}
