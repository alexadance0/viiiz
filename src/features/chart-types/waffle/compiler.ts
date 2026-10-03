import type { ChartConfig, DataTable } from '../../../core/types'
import type { NativeWaffleChartScene } from '../../../entities/chart/model/ChartScene'
import { validateNativePieMapping, compileCompositionScene } from '../pie/compiler'

export function validateNativeWaffleMapping(table: DataTable, config: ChartConfig) {
  const result = validateNativePieMapping(table, config)
  if (config.waffleCellValue !== undefined) {
    if (!Number.isFinite(config.waffleCellValue) || config.waffleCellValue <= 0) result.errors.push({ field: 'waffleCellValue', message: 'Цена квадрата должна быть положительным числом.' })
    else if (result.ok) {
      const total = compileCompositionScene(table, config).plot.total
      if (total / config.waffleCellValue > 10000) result.errors.push({ field: 'waffleCellValue', message: 'В сетке может быть до 10 000 квадратов. Увеличьте цену квадрата.' })
      if (total / config.waffleCellValue < .5) result.errors.push({ field: 'waffleCellValue', message: 'Цена квадрата слишком велика для этих данных.' })
    }
  }
  return { ok: !result.errors.length, errors: result.errors }
}

export function compileNativeWaffleScene(table: DataTable, config: ChartConfig): NativeWaffleChartScene {
  config = { ...config, waffleFillDirection: config.waffleFillDirection ?? 'top', showLegend: config.showValues && config.waffleLabelPosition === 'legend', legendPosition: 'top' }
  const scene = compileCompositionScene(table, { ...config, pieLabelPosition: 'outside' })
  if (config.waffleShowValues === false) scene.plot.slices.forEach((slice) => { slice.label.text = config.elementStyles[slice.legacyKey]?.label ?? (config.pieShowNames !== false ? slice.name : '') })
  const columns = Math.min(100, Math.max(1, Math.round(config.waffleColumns ?? 10)))
  let rows = Math.min(100, Math.max(1, Math.round(config.waffleRows ?? 10)))
  const unit = config.waffleCellValue
  if (unit !== undefined && (!Number.isFinite(unit) || unit <= 0)) throw new Error('Цена квадрата должна быть положительным числом.')
  const quotas = scene.plot.slices.map((slice) => unit ? slice.value / unit : slice.percent / 100 * columns * rows)
  const cellCount = unit ? Math.round(quotas.reduce((sum, value) => sum + value, 0)) : columns * rows
  if (unit && (cellCount < 1 || cellCount > 10000)) throw new Error('Измените цену квадрата: сетка должна содержать от 1 до 10 000 квадратов.')
  if (unit) rows = Math.max(1, Math.ceil(cellCount / columns))
  const counts = quotas.map(Math.floor)
  const remaining = cellCount - counts.reduce((sum, count) => sum + count, 0)
  // Largest remainders keep the grid complete without systematically favoring its last category.
  quotas.map((quota, index) => ({ index, remainder: quota - counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, remaining).forEach(({ index }) => counts[index]++)
  return { ...scene, compatibilityConfig: config, plot: { kind: 'waffle', slices: scene.plot.slices, total: scene.plot.total, columns, rows, counts, gap: Math.min(16, Math.max(0, config.waffleGap ?? 4)), radius: Math.min(50, Math.max(0, config.waffleRadius ?? 0)) / 100 } }
}
