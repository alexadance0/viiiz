import { measureTextWidth } from '../../core/textMetrics'
import type { ChartTextStyle } from '../../core/types'

export function numericTicks(minimum: number, maximum: number, step?: number, limit = 256) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return []
  if (!(step && Number.isFinite(step) && step > 0)) return minimum === maximum ? [minimum] : [minimum, maximum]
  const values = [minimum]
  const epsilon = step * 1e-9
  let value = Math.ceil((minimum - epsilon) / step) * step
  while (value <= maximum + epsilon && values.length < limit) {
    const normalized = Number(value.toPrecision(14))
    if (normalized > minimum + epsilon && normalized < maximum - epsilon) values.push(normalized)
    value += step
  }
  if (maximum > minimum && values.at(-1) !== maximum) values.push(maximum)
  return values
}

export function widestNumericTick(values: number[], formatter: (value: number) => string, style: ChartTextStyle) {
  return Math.ceil(Math.max(0, ...values.map((value) => measureTextWidth(formatter(value), style.size, style.fontFamily, style.weight))))
}
