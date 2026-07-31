import { describe, expect, it } from 'vitest'
import { distributionVisualDefaults, usesHorizontalAxes } from './chartKinds'

describe('physical chart orientation', () => {
  it('covers dedicated horizontal kinds and configurable orientations', () => {
    expect(usesHorizontalAxes({ kind: 'horizontal-bar' })).toBe(true)
    expect(usesHorizontalAxes({ kind: 'butterfly' })).toBe(true)
    expect(usesHorizontalAxes({ kind: 'horizontal-lollipop' })).toBe(true)
    expect(usesHorizontalAxes({ kind: 'bar', barOrientation: 'horizontal' })).toBe(true)
    expect(usesHorizontalAxes({ kind: 'bar', barOrientation: 'vertical' })).toBe(false)
    expect(usesHorizontalAxes({ kind: 'dumbbell', dumbbellOrientation: 'horizontal' })).toBe(true)
    expect(usesHorizontalAxes({ kind: 'dumbbell', dumbbellOrientation: 'vertical' })).toBe(false)
    expect(usesHorizontalAxes({ kind: 'violinplot', distributionOrientation: 'horizontal' })).toBe(true)
    expect(usesHorizontalAxes({ kind: 'boxplot', distributionOrientation: 'vertical' })).toBe(false)
  })
})

describe('distribution visual defaults', () => {
  it('uses geometry suited to each distribution mark', () => {
    expect(distributionVisualDefaults('boxplot')).toMatchObject({ distributionWidth: 48, distributionPointSize: 8 })
    expect(distributionVisualDefaults('raincloud')).toMatchObject({ distributionWidth: 82, distributionPointSize: 7, distributionRaincloudPointMode: 'overlay' })
    expect(distributionVisualDefaults('barcode-plot')).toMatchObject({ distributionWidth: 56, distributionSummaryLength: 100 })
  })
})
