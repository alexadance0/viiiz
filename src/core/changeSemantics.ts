import { formatChartNumber } from './numberFormat'
import type { ChartConfig } from './types'

export type ChangeDirection = 'increase' | 'decrease' | 'neutral'
export type ChangeFormat = 'absolute' | 'percent'

export interface ChangeDescriptor {
  start: number
  end: number
  delta: number
  direction: ChangeDirection
  percent: number | null
}

const directionEpsilon = (start: number, end: number) => Math.max(1, Math.abs(start), Math.abs(end)) * 1e-9

export function describeChange(start: number, end: number): ChangeDescriptor {
  const delta = end - start
  const epsilon = directionEpsilon(start, end)
  return { start, end, delta, direction: delta > epsilon ? 'increase' : delta < -epsilon ? 'decrease' : 'neutral', percent: Math.abs(start) <= epsilon ? null : delta / Math.abs(start) * 100 }
}

const signed = (value: number, text: string) => value > 0 ? `+${text}` : value < 0 ? `−${text.replace(/^[-−]/, '')}` : text.replace(/^[-−]/, '')

export function formatChange(change: ChangeDescriptor, format: ChangeFormat, config: ChartConfig, percentDecimals = 0) {
  if (format === 'percent') {
    if (change.percent == null) return 'н/д'
    const text = formatChartNumber(Math.abs(change.percent), { ...config, valueMode: 'absolute', numberOperation: 'none', numberFactor: 1, numberDecimals: percentDecimals, valueLabelAffixesLinked: false, valueLabelPrefix: '', valueLabelSuffix: '', numberPrefix: '', numberSuffix: '' })
    return `${signed(change.percent, text)}%`
  }
  return signed(change.delta, formatChartNumber(Math.abs(change.delta), config))
}

export function changeColor(change: ChangeDescriptor, increase: string, decrease: string, neutral: string) {
  return change.direction === 'increase' ? increase : change.direction === 'decrease' ? decrease : neutral
}
