import { describe, expect, it } from 'vitest'
import { advanceChartRender, beginChartRender, failChartRender, initialChartRenderLifecycle, settleChartRender } from './chartRenderLifecycle'

describe('chart render lifecycle', () => {
  it('lets only the current successful revision settle', () => {
    const first = beginChartRender(initialChartRenderLifecycle())
    const second = beginChartRender(first)
    expect(settleChartRender(second, first.revision)).toBe(second)
    expect(settleChartRender(second, second.revision)).toEqual({ revision: 2, settledRevision: 2, status: 'settled' })
  })

  it('does not settle an errored revision or let stale work change its status', () => {
    const rendering = advanceChartRender(beginChartRender(initialChartRenderLifecycle()), 1, 'rendering')
    const failed = failChartRender(rendering, 1)
    expect(settleChartRender(failed, 1)).toBe(failed)
    expect(advanceChartRender(failed, 1, 'post-processing')).toBe(failed)
  })
})
