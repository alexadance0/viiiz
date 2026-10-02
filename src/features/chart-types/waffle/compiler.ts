import type { ChartConfig, DataTable } from '../../../core/types'
import type { NativeWaffleChartScene } from '../../../entities/chart/model/ChartScene'
import { compileCompositionScene } from '../pie/compiler'

export function compileNativeWaffleScene(table: DataTable, config: ChartConfig): NativeWaffleChartScene {
  const scene = compileCompositionScene(table, { ...config, pieLabelPosition: 'outside' })
  if (config.waffleShowValues === false) scene.plot.slices.forEach((slice) => { slice.label.text = config.elementStyles[slice.legacyKey]?.label ?? (config.pieShowNames !== false ? slice.name : '') })
  const columns = Math.min(30, Math.max(1, Math.round(config.waffleColumns ?? 10)))
  const rows = Math.min(30, Math.max(1, Math.round(config.waffleRows ?? 10)))
  const quotas = scene.plot.slices.map((slice) => slice.percent / 100 * columns * rows)
  const counts = quotas.map(Math.floor)
  const remaining = columns * rows - counts.reduce((sum, count) => sum + count, 0)
  // Largest remainders keep the grid complete without systematically favoring its last category.
  quotas.map((quota, index) => ({ index, remainder: quota - counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, remaining).forEach(({ index }) => counts[index]++)
  return { ...scene, compatibilityConfig: config, plot: { kind: 'waffle', slices: scene.plot.slices, total: scene.plot.total, columns, rows, counts, gap: Math.min(16, Math.max(0, config.waffleGap ?? 4)), radius: Math.min(50, Math.max(0, config.waffleRadius ?? 0)) / 100 } }
}
