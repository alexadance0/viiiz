import type { ChartConfig } from './types'

// Annotations live above the plot and do not change its data or layout.
export const samePlotConfig = (left: ChartConfig, right: ChartConfig) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...keys].every((key) => key === 'annotations' || key === 'decorations' || Object.is(left[key as keyof ChartConfig], right[key as keyof ChartConfig]))
}
