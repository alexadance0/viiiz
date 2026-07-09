import { describe, expect, it } from 'vitest'
import { formatChartNumber, formatXAxisNumber } from './numberFormat'
import type { ChartConfig } from './types'

const config = (values: Partial<ChartConfig> = {}) => ({ valueMode: 'absolute', ...values }) as ChartConfig

describe('chart number formatting', () => {
  it('formats locale, scale, precision and affixes consistently', () => {
    expect(formatChartNumber(1234567.89, config({ numberLocale: 'ru-RU', numberOperation: 'divide', numberFactor: 1000000, numberDecimals: 1, numberPrefix: '≈' }))).toBe('1,2')
  })

  it('supports a custom multiplication factor', () => {
    expect(formatChartNumber(2.5, config({ numberOperation: 'multiply', numberFactor: 100, numberDecimals: 0 }))).toBe('250')
  })

  it('adds a percent suffix for percent mode and supports a custom zero label', () => {
    expect(formatChartNumber(25, config({ valueMode: 'percent', numberDecimals: 0 }))).toBe('25%')
    expect(formatChartNumber(0, config({ numberZeroLabel: '—' }))).toBe('—')
  })

  it('does not append the Y percent marker to numeric X-axis labels', () => {
    expect(formatXAxisNumber(25, config({ valueMode: 'percent', numberDecimals: 0 }))).toBe('25')
  })
})
