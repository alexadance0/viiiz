import { describe, expect, it } from 'vitest'
import { horizontalCategoryLabelPlacement, verticalAxisLabelPlacement } from './axisLabelPlacement'

describe('axis label placement', () => {
  it('aligns numeric and default category labels toward the plot on either side', () => {
    expect(verticalAxisLabelPlacement('left', 84, 8, 6)).toEqual({ align: 'right', margin: 8 })
    expect(verticalAxisLabelPlacement('right', 84, 8, 6)).toEqual({ align: 'left', margin: 8 })
  })

  it('mirrors the outer-edge category alignment without changing the reserved rail', () => {
    expect(verticalAxisLabelPlacement('left', 84, 8, 6, 'outer')).toEqual({ align: 'left', margin: 92 })
    expect(verticalAxisLabelPlacement('right', 84, 8, 6, 'outer')).toEqual({ align: 'right', margin: 92 })
  })

  it('anchors rotated bottom-up labels by the tick-facing edge', () => {
    expect(horizontalCategoryLabelPlacement('bottom', 90)).toEqual({ align: 'right', verticalAlign: 'middle' })
    expect(horizontalCategoryLabelPlacement('top', 90)).toEqual({ align: 'left', verticalAlign: 'middle' })
    expect(horizontalCategoryLabelPlacement('bottom', 0)).toEqual({ align: 'center', verticalAlign: 'top' })
  })
})
