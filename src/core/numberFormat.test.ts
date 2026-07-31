import { describe, expect, it } from 'vitest'
import { formatChartNumber, formatXAxisNumber, formatYAxisNumber } from './numberFormat'
import type { ChartConfig } from './types'

const config = (values: Partial<ChartConfig> = {}) => ({ valueMode: 'absolute', ...values }) as ChartConfig

describe('chart number formatting', () => {
  it('formats locale, scale, precision and affixes consistently', () => {
    const numberConfig = config({ numberLocale: 'ru-RU', numberOperation: 'divide', numberFactor: 1000000, numberDecimals: 1, numberPrefix: '≈', numberSuffix: ' млн' })
    expect(formatYAxisNumber(1234567.89, numberConfig)).toBe('≈1,2 млн')
    expect(formatChartNumber(1234567.89, numberConfig)).toBe('≈1,2 млн')
  })

  it('supports a custom multiplication factor', () => {
    expect(formatChartNumber(2.5, config({ numberOperation: 'multiply', numberFactor: 100, numberDecimals: 0 }))).toBe('250')
  })

  it('adds a percent suffix for percent mode and supports a custom zero label', () => {
    expect(formatChartNumber(25, config({ valueMode: 'percent', numberDecimals: 0 }))).toBe('25%')
    expect(formatChartNumber(0, config({ numberZeroLabel: '—' }))).toBe('—')
  })

  it('does not append the Y percent marker to numeric X-axis labels', () => {
    expect(formatXAxisNumber(25, config({ valueMode: 'percent', numberDecimals: 0, numberOperation: 'multiply', numberFactor: 100, numberPrefix: 'Y:', xAxisNumberPrefix: 'X:', xAxisNumberSuffix: ' лет' }))).toBe('X:25 лет')
  })

  it('supports independent value-label affixes', () => {
    const numberConfig = config({ numberPrefix: '₽', numberSuffix: ' тыс.', valueLabelAffixesLinked: false, valueLabelPrefix: '≈', valueLabelSuffix: ' на графике' })
    expect(formatYAxisNumber(12, numberConfig)).toBe('₽12 тыс.')
    expect(formatChartNumber(12, numberConfig)).toBe('≈12 на графике')
  })

  it('can limit axis affixes to either edge or both edges', () => {
    const numberConfig = config({ numberPrefix: 'Y:', numberSuffix: ' ед.', yAxisAffixScope: 'last', xAxisNumberSuffix: ' лет', xAxisAffixScope: 'edges' })
    expect(formatYAxisNumber(0, numberConfig, 'first')).toBe('0')
    expect(formatYAxisNumber(50, numberConfig, 'middle')).toBe('50')
    expect(formatYAxisNumber(100, numberConfig, 'last')).toBe('Y:100 ед.')
    expect(formatXAxisNumber(1, numberConfig, 'first')).toBe('1 лет')
    expect(formatXAxisNumber(5, numberConfig, 'middle')).toBe('5')
    expect(formatXAxisNumber(11, numberConfig, 'last')).toBe('11 лет')
  })
})
