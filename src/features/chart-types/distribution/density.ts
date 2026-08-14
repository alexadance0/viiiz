import type { DistributionDensityProfile } from '../../../entities/chart/model/ChartScene'
export type { DistributionDensityProfile } from '../../../entities/chart/model/ChartScene'

const kernel = (sample: number, values: readonly number[], bandwidth: number) => values.reduce((sum, value) => sum + Math.exp(-.5 * ((sample - value) / bandwidth) ** 2), 0)

export function distributionDensity(values: readonly number[], bandwidthRatio: number, globalRawSpan: number, statistics: { q1: number; median: number; q3: number }): DistributionDensityProfile {
  const sorted = [...values].sort((a, b) => a - b), minimumValue = sorted[0] ?? 0, maximumValue = sorted.at(-1) ?? minimumValue
  const bandwidth = Math.max((maximumValue - minimumValue) * bandwidthRatio, Math.max(globalRawSpan, 1e-9) / 1000)
  const minimum = minimumValue - bandwidth * 1.75, maximum = maximumValue + bandwidth * 1.75
  const raw = Array.from({ length: 81 }, (_, index) => { const value = minimum + (maximum - minimum) * index / 80; return { value, density: kernel(value, sorted, bandwidth) } })
  const peak = Math.max(1, ...raw.map(({ density }) => density))
  const samples = raw.map(({ value, density }, index) => ({ value, density: index === 0 || index === raw.length - 1 ? 0 : density, relativeDensity: index === 0 || index === raw.length - 1 ? 0 : density / peak }))
  return { bandwidth, minimum, maximum, samples, peak, statisticDensity: { q1: kernel(statistics.q1, sorted, bandwidth) / peak, median: kernel(statistics.median, sorted, bandwidth) / peak, q3: kernel(statistics.q3, sorted, bandwidth) / peak } }
}
