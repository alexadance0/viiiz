import { describe, expect, it } from 'vitest'
import { denseValueLabelStride, showDenseValueLabel, valueLabelBoxPlacement } from './chartLabels'

describe('chart label layout', () => {
  it('thins dense vertical labels while preserving the last category', () => {
    const stride = denseValueLabelStride(false, 12, 34, 18, true)
    expect(stride).toBe(5)
    expect([...Array(11).keys()].filter((index) => showDenseValueLabel(index, 11, stride))).toEqual([5, 10])
  })

  it('keeps every label when overlap hiding is disabled', () => {
    const stride = denseValueLabelStride(false, 12, 34, 18, false)
    expect(stride).toBe(1)
    expect([...Array(4).keys()].every((index) => showDenseValueLabel(index, 4, stride))).toBe(true)
  })

  it('uses the shared cartesian placement for a horizontal inside label', () => {
    expect(valueLabelBoxPlacement({
      horizontal: true,
      configured: 'inside-top',
      absorption: false,
      baseline: 100,
      value: 220,
      category: 40,
      width: 50,
      height: 20,
      padding: 8,
      insidePosition: 'end',
      outsidePosition: 'end',
    })).toEqual({ x: 167, y: 30 })
  })
})
