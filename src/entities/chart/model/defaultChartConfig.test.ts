import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from './defaultChartConfig'

describe('createDefaultChartConfig', () => {
  it('returns an independent configuration', () => {
    const first = createDefaultChartConfig()
    const second = createDefaultChartConfig()
    first.palette?.push('#000000')
    first.paletteGradientColors![0] = '#000000'
    expect(second.palette).not.toContain('#000000')
    expect(second.paletteGradientColors).toEqual(['#3b4cc0', '#f7f7f7', '#b40426'])
    expect(second.kind).toBe('bar')
    expect(second).toMatchObject({ showXAxisTitle: false, showYAxisTitle: false })
    expect(second).toMatchObject({
      barValueLabelAbsorption: false,
      valueLabelHideOverlap: false,
      barValueLabelInsidePosition: 'end',
      barValueLabelOutsidePosition: 'end',
      barValueLabelAbsorptionPadding: 10,
      barCategorySort: 'none',
      barCategorySortSeries: '',
      treemapShowLeafValues: false,
      treemapGroupText: { size: 16 },
      treemapLeafText: { size: 14, weight: 400 },
      treemapHiddenCategories: [],
      treemapValueFormat: 'absolute',
    })
  })
})
