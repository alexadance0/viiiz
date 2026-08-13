import { isBarChart } from './chartKinds'
import type { ChartConfig } from './types'

const FALLBACK_PALETTE = ['#6956e8', '#168a72', '#e56b45', '#d0a52b', '#3f8fba', '#a45ca4', '#6f9d45', '#c64f70']

export function getSeriesColor(config: ChartConfig, name: string, index: number) {
  const palette = config.palette?.length ? config.palette : [config.color, ...FALLBACK_PALETTE.slice(1)]
  return config.seriesStyles[name]?.color
    ?? (config.kind === 'seasonal-line' ? config.seasonalAccentYears?.includes(name) ? config.color : config.seasonalMutedColor ?? '#d9d7df' : undefined)
    ?? (isBarChart(config.kind) ? config.barFillColor : undefined)
    ?? palette[index % palette.length]
}
