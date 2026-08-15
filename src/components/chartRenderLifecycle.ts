export type ChartRenderStatus = 'loading-modules' | 'loading-fonts' | 'compiling' | 'rendering' | 'post-processing' | 'settled' | 'error'

export interface ChartRenderLifecycle {
  revision: number
  settledRevision: number
  status: ChartRenderStatus
}

export const initialChartRenderLifecycle = (): ChartRenderLifecycle => ({ revision: 0, settledRevision: 0, status: 'loading-modules' })

export const beginChartRender = (current: ChartRenderLifecycle, status: ChartRenderStatus = 'compiling'): ChartRenderLifecycle => ({
  ...current,
  revision: current.revision + 1,
  status,
})

export const advanceChartRender = (current: ChartRenderLifecycle, revision: number, status: ChartRenderStatus): ChartRenderLifecycle =>
  current.revision === revision && current.status !== 'error' ? { ...current, status } : current

export const settleChartRender = (current: ChartRenderLifecycle, revision: number): ChartRenderLifecycle =>
  current.revision === revision && current.status !== 'error' ? { revision, settledRevision: revision, status: 'settled' } : current

export const failChartRender = (current: ChartRenderLifecycle, revision: number): ChartRenderLifecycle =>
  current.revision === revision ? { ...current, status: 'error' } : current
