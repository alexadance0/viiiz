import type { DatumId } from '../../../entities/chart/model/ChartElement'

export interface DistributionSummaryStats {
  count: number
  minimumInlier: number
  q1: number
  median: number
  mean: number
  q3: number
  maximumInlier: number
  outlierDatumIds: DatumId[]
}

export function distributionQuantile(sortedValues: readonly number[], position: number) {
  if (!sortedValues.length) return 0
  const index = (sortedValues.length - 1) * position, lower = Math.floor(index), upper = Math.ceil(index)
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower)
}

export function distributionStatistics(observations: readonly { value: number; datumId: DatumId }[]): DistributionSummaryStats {
  const sorted = [...observations].sort((left, right) => left.value - right.value)
  const values = sorted.map(({ value }) => value)
  const q1 = distributionQuantile(values, .25), median = distributionQuantile(values, .5), q3 = distributionQuantile(values, .75), iqr = q3 - q1
  const lower = q1 - iqr * 1.5, upper = q3 + iqr * 1.5
  const inside = sorted.filter(({ value }) => value >= lower && value <= upper)
  return {
    count: values.length,
    minimumInlier: inside[0]?.value ?? q1,
    q1,
    median,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    q3,
    maximumInlier: inside.at(-1)?.value ?? q3,
    outlierDatumIds: sorted.filter(({ value }) => value < (inside[0]?.value ?? q1) || value > (inside.at(-1)?.value ?? q3)).map(({ datumId }) => datumId),
  }
}
