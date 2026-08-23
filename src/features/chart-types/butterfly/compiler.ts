import { niceNumericScale } from '../../../core/chartScale'
import { formatChartNumber } from '../../../core/numberFormat'
import type { ChartConfig, DataTable } from '../../../core/types'
import type { ButterflySeriesScene, NativeButterflyChartScene } from '../../../entities/chart/model/ChartScene'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import { compileNativeBarScene } from '../bar/compiler'

export function butterflyFields(config: ChartConfig) {
  const left = config.butterflyLeftFields?.length ? config.butterflyLeftFields : config.yFields.slice(0, 1)
  const right = config.butterflyRightFields?.length ? config.butterflyRightFields : config.yFields.slice(1, 2)
  return { left, right, all: [...left, ...right] }
}

export function validateNativeButterflyMapping(table: DataTable, config: ChartConfig) {
  const { left, right, all } = butterflyFields(config)
  const numeric = (field: string) => table.columns.includes(field) && table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field]))
  const valid = Boolean(config.xField && table.columns.includes(config.xField) && left.length && right.length && new Set(all).size === all.length && all.every(numeric))
  return { ok: valid, errors: valid ? [] : [{ field: 'yFields', message: 'Для Butterfly выберите хотя бы по одному разному числовому показателю с каждой стороны.' }] }
}

export function compileNativeButterflyScene(table: DataTable, sourceConfig: ChartConfig): NativeButterflyChartScene {
  if (sourceConfig.kind !== 'butterfly') throw new Error(`Native Butterfly compiler cannot compile ${sourceConfig.kind}.`)
  const fields = butterflyFields(sourceConfig)
  const config = { ...sourceConfig, yField: fields.all[0] ?? sourceConfig.yField, yFields: fields.all, seriesField: '', barCategorySort: 'none' as const, barOrientation: 'horizontal' as const, showDirectLabels: false }
  const base = compileNativeBarScene(table, { ...config, kind: 'horizontal-bar' })
  const categoryPlacement = config.butterflyCategoryPosition ?? 'center'
  const categoryAxis = { ...base.plot.categoryAxis, placement: categoryPlacement === 'center' ? { kind: 'internal' as const, anchor: 'center' as const } : { kind: 'side' as const, side: categoryPlacement } }
  const leftSet = new Set(fields.left)
  const running = new Map<string, number[]>()
  const series: ButterflySeriesScene[] = base.plot.series.map((source) => {
    const side = leftSet.has(source.name) ? 'left' as const : 'right' as const
    const starts = running.get(side) ?? Array(base.plot.categories.length).fill(0)
    const marks = source.marks.map((mark, index) => {
      const value = mark.value == null ? null : Math.abs(mark.value)
      const stackStart = starts[index]
      const stackEnd = stackStart + (value ?? 0)
      starts[index] = stackEnd
      return { ...mark, value, displayValue: value == null ? 'пропуск' : formatChartNumber(value, config), side, stackStart, stackEnd }
    })
    running.set(side, starts)
    return { ...source, side, marks }
  })
  const extent = Math.max(0, ...[...running.values()].flat())
  const automatic = niceNumericScale([-extent, extent], true)
  const absoluteMax = Math.max(Math.abs(config.yAxisMin ?? automatic.min), Math.abs(config.yAxisMax ?? automatic.max))
  const valueDomain = { min: -absoluteMax, max: absoluteMax, step: config.yAxisStep ?? automatic.step }
  return { ...base, document: chartDocumentFromLegacy(table, sourceConfig), compatibilityConfig: config, plot: { kind: 'butterfly', categoryPlacement, categories: base.plot.categories, categoryAxis, valueAxis: base.plot.valueAxis, valueDomain, barWidth: config.barWidth ?? 68, seriesGap: config.barSeriesGap ?? 30, series } }
}
