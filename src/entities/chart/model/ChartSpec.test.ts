import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from './defaultChartConfig'
import { chartSpecFromLegacy } from './legacyChartConfigAdapter'

describe('ChartSpec classification', () => {
  const spec = (kind: ReturnType<typeof createDefaultChartConfig>['kind']) => chartSpecFromLegacy({ ...createDefaultChartConfig(), kind })

  it.each([['lollipop', 'lollipop'], ['horizontal-lollipop', 'lollipop'], ['dumbbell', 'dumbbell'], ['range-line', 'interval'], ['confidence-line', 'interval'], ['moving-average-line', 'smoothing']] as const)('%s has semantic family %s', (kind, family) => {
    expect(spec(kind).family).toBe(family)
  })

  it('keeps explicit dumbbell mapping instead of substituting generic y fields', () => {
    const config = { ...createDefaultChartConfig(), kind: 'dumbbell' as const, yFields: ['unrelated'], dumbbellStartField: 'before', dumbbellEndField: 'after', dumbbellOrientation: 'vertical' as const }
    expect(chartSpecFromLegacy(config)).toMatchObject({ family: 'dumbbell', orientation: 'vertical', startField: 'before', endField: 'after' })
  })
})
