import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from './defaultChartConfig'
import { chartSpecFromLegacy } from './legacyChartConfigAdapter'

describe('ChartSpec classification', () => {
  const spec = (kind: ReturnType<typeof createDefaultChartConfig>['kind']) => chartSpecFromLegacy({ ...createDefaultChartConfig(), kind })

  it.each([['lollipop', 'lollipop'], ['horizontal-lollipop', 'lollipop'], ['dumbbell', 'dumbbell'], ['range-line', 'interval'], ['confidence-line', 'interval'], ['moving-average-line', 'smoothing']] as const)('%s has semantic family %s', (kind, family) => {
    expect(spec(kind).family).toBe(family)
  })
})
