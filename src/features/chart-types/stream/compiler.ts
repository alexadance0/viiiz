import type { ChartConfig, DataTable } from '../../../core/types'
import { prepareVisibleChartData, niceNumericScale, orderedBounds } from '../../../core/chartScale'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { NativeAreaChartScene } from '../../../entities/chart/model/ChartScene'
import { compileNativeAreaScene } from '../area/compiler'

export function validateStreamMapping(table: DataTable, config: ChartConfig) {
  const fields = config.yFields.length ? config.yFields : [config.yField]
  const errors: Array<{ field: string; message: string }> = []
  if (table.rows.some((row) => fields.some((field) => row[field] != null && row[field] !== '' && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || Number(row[field]) < 0)))) errors.push({ field: 'yField', message: 'Stream Graph требует конечных неотрицательных значений.' })
  const prepared = prepareVisibleChartData(table, config)
  if (prepared.categories.length < 2) errors.push({ field: 'xField', message: 'Для Stream Graph нужны минимум две позиции по оси X.' })
  if (prepared.categories.some((_, index) => !Number.isFinite(prepared.series.reduce((sum, series) => sum + (series.data[index] ?? 0), 0)))) errors.push({ field: 'yField', message: 'Сумма потоков слишком велика. Уменьшите единицы измерения.' })
  return { ok: !errors.length, errors }
}

export function compileStreamScene(table: DataTable, config: ChartConfig): NativeAreaChartScene {
  const validation = validateStreamMapping(table, config)
  if (!validation.ok) throw new Error(validation.errors[0].message)
  const scene = compileNativeAreaScene(table, { ...config, kind: 'stacked-area', yAxisScaleType: 'linear' })
  let series = scene.plot.series
  if ((config.streamOrder ?? 'inside-out') === 'inside-out' && !config.seriesOrder?.length) {
    const ranked = series.map((item, index) => ({ index, peak: item.points.reduce((peak, point, i, points) => (point.value ?? 0) > (points[peak]?.value ?? 0) ? i : peak, 0), total: item.points.reduce((sum, point) => sum + (point.value ?? 0), 0) })).sort((a, b) => a.peak - b.peak)
    const lower: number[] = [], upper: number[] = []
    let lowerTotal = 0, upperTotal = 0
    for (const item of ranked) {
      if (lowerTotal < upperTotal) { lower.push(item.index); lowerTotal += item.total }
      else { upper.push(item.index); upperTotal += item.total }
    }
    series = [...lower.reverse(), ...upper].map((index) => series[index])
  }
  const values = series.map((item) => item.points.map((point) => point.value ?? 0))
  const totals = scene.plot.categories.map((_, index) => values.reduce((sum, item) => sum + item[index], 0))
  const baseline = totals.map((total) => -total / 2)
  if ((config.streamBaseline ?? 'wiggle') === 'wiggle') {
    // Weighted slope offset, as in d3-shape's stackOffsetWiggle; one pass per column.
    baseline[0] = 0
    for (let column = 1; column < totals.length; column++) {
      let lowerSlope = 0, weightedSlope = 0
      for (const layer of values) {
        const slope = layer[column] - layer[column - 1]
        weightedSlope += (lowerSlope + slope / 2) * (totals[column] ? layer[column] / totals[column] : 0)
        lowerSlope += slope
      }
      baseline[column] = baseline[column - 1] - weightedSlope
    }
    const center = (Math.min(...baseline) + Math.max(...baseline.map((value, index) => value + totals[index]))) / 2
    for (let column = 0; column < baseline.length; column++) baseline[column] -= center
  }
  const accumulated = [...baseline]
  series = series.map((item, index) => ({ ...item, streamBands: values[index].map((value, column) => {
    const lower = accumulated[column]
    accumulated[column] += value
    return { lower, upper: accumulated[column] }
  }) }))
  const automatic = niceNumericScale([...baseline, ...accumulated], false)
  const [minimum, maximum] = orderedBounds(config.yAxisMin, config.yAxisMax)
  return {
    ...scene, document: chartDocumentFromLegacy(table, config), compatibilityConfig: { ...config, yAxisScaleType: 'linear' },
    plot: { ...scene.plot, series, valueDomain: { min: minimum ?? automatic.min, max: maximum ?? automatic.max, step: config.yAxisStep ?? automatic.step } },
  }
}
