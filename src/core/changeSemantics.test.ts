import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../entities/chart/model/defaultChartConfig'
import type { ChartConfig } from './types'
import { changeColor, describeChange, formatChange } from './changeSemantics'

describe('shared change semantics', () => {
  const config = createDefaultChartConfig()

  it('classifies increase, decrease, neutral, and floating-point noise deterministically', () => {
    expect(describeChange(10, 15)).toMatchObject({ delta: 5, direction: 'increase', percent: 50 })
    expect(describeChange(10, 5)).toMatchObject({ delta: -5, direction: 'decrease', percent: -50 })
    expect(describeChange(10, 10)).toMatchObject({ delta: 0, direction: 'neutral', percent: 0 })
    expect(describeChange(1, 1 + 1e-12).direction).toBe('neutral')
    expect(describeChange(0, 5).percent).toBeNull()
  })

  it('formats signed absolute and percent changes without mutating global number settings', () => {
    const localized: ChartConfig = { ...config, numberLocale: 'en-US', numberDecimals: 1, numberPrefix: '$', numberSuffix: 'm' }
    const before = structuredClone(localized)
    expect(formatChange(describeChange(10, 15), 'absolute', localized)).toBe('+$5.0m')
    expect(formatChange(describeChange(10, 5), 'absolute', localized)).toBe('−$5.0m')
    expect(formatChange(describeChange(10, 15), 'percent', localized, 1)).toBe('+50.0%')
    expect(formatChange(describeChange(0, 5), 'percent', localized, 1)).toBe('н/д')
    expect(localized).toEqual(before)
  })

  it('maps semantic directions to caller-owned colors', () => {
    expect(changeColor(describeChange(1, 2), 'green', 'red', 'gray')).toBe('green')
    expect(changeColor(describeChange(2, 1), 'green', 'red', 'gray')).toBe('red')
    expect(changeColor(describeChange(1, 1), 'green', 'red', 'gray')).toBe('gray')
  })
})
