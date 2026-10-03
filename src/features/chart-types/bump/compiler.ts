import type { PreparedChartData } from '../../../core/chartData'
import { prepareVisibleChartData } from '../../../core/chartScale'
import { measureTextWidth } from '../../../core/textMetrics'
import { formatChartNumber } from '../../../core/numberFormat'
import type { ChartConfig, DataTable } from '../../../core/types'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { NativeLineChartScene } from '../../../entities/chart/model/ChartScene'
import { compilePreparedPointScene } from '../line/compiler'

// Competition ranking: tied leaders are 1, 1, 3. Missing observations have no rank.
export function rankBumpData(prepared: PreparedChartData, mode: 'rank' | 'value', direction: 'desc' | 'asc'): PreparedChartData {
  const series = prepared.series.map((item) => ({ ...item, data: item.data.map(() => null as number | null) }))
  prepared.categories.forEach((_, index) => {
    const entries = prepared.series.flatMap((item, seriesIndex) => {
      const value = item.data[index]
      return value != null && Number.isFinite(value) ? [{ value, seriesIndex }] : []
    }).sort((a, b) => direction === 'asc' ? a.value - b.value : b.value - a.value)
    let rank = 1
    entries.forEach((entry, position) => {
      if (position && entry.value !== entries[position - 1].value) rank = position + 1
      series[entry.seriesIndex].data[index] = mode === 'rank'
        ? Number.isInteger(entry.value) && entry.value >= 1 ? entry.value : null
        : rank
    })
  })
  return { categories: [...prepared.categories], series }
}

const preparedValues = (table: DataTable, config: ChartConfig) => prepareVisibleChartData(table, { ...config, kind: 'line', valueMode: 'absolute', missingMode: config.missingMode === 'connect' ? 'connect' : 'gap' })

export function validateBumpMapping(table: DataTable, config: ChartConfig) {
  const prepared = preparedValues(table, config)
  const errors: Array<{ field: string; message: string }> = []
  if (prepared.categories.length < 2) errors.push({ field: 'xField', message: 'Для динамики рейтинга нужны минимум два периода.' })
  if (prepared.series.length < 2) errors.push({ field: 'yField', message: 'Выберите минимум два ряда или колонку с участниками рейтинга.' })
  if (config.bumpMode === 'rank' && prepared.series.some((item) => item.data.some((value) => value != null && (!Number.isInteger(value) || value < 1)))) errors.push({ field: 'bumpMode', message: 'Готовые места должны быть целыми числами от 1. Для величин выберите расчёт рейтинга.' })
  return { ok: errors.length === 0, errors }
}

export function compileNativeBumpScene(table: DataTable, config: ChartConfig): NativeLineChartScene {
  const prepared = preparedValues(table, config)
  const ranked = rankBumpData(prepared, config.bumpMode ?? 'value', config.bumpRankDirection ?? 'desc')
  const effective: ChartConfig = {
    ...config, valueMode: 'absolute', missingMode: config.missingMode === 'connect' ? 'connect' : 'gap',
    yAxisScaleType: 'linear', yAxisMin: null, yAxisMax: null, yAxisStep: 1, showZeroLine: false,
    numberDecimals: 0, numberOperation: 'none', numberFactor: 1, numberPrefix: '', numberSuffix: '',
    seriesStyles: Object.fromEntries(prepared.series.map((item) => [item.name, { showMarker: true, ...config.seriesStyles[item.name] }])),
  }
  if (config.showDirectLabels && (config.bumpShowStartLabels ?? true) && config.yAxisPosition === 'left') {
    const labelWidth = Math.max(0, ...prepared.series.map((item) => {
      const style = config.seriesStyles[item.name]
      const text = style?.directLabelText ?? config.directLabelText ?? config.legendText
      return measureTextWidth(style?.legendLabel || item.name, text.size, text.fontFamily, text.weight)
    }))
    effective.yAxisLabelGap = labelWidth + (config.directLabelGap ?? 14) + 12
  }
  const scene = compilePreparedPointScene(table, effective, 'line', ranked, { directSide: 'right' }) as NativeLineChartScene
  scene.document = chartDocumentFromLegacy(table, config)
  scene.plot.valueAxisInverse = true
  const maximum = Math.max(2, ...ranked.series.flatMap((item) => item.data.filter((value): value is number => value != null)))
  scene.plot.valueDomain = { min: 1, max: maximum, step: Math.max(1, Math.ceil((maximum - 1) / 12)) }
  scene.plot.series.forEach((item, seriesIndex) => item.points.forEach((point, index) => {
    const source = prepared.series[seriesIndex].data[index]
    point.displayValue = point.value == null ? 'пропуск' : `${point.value} место${config.bumpMode === 'rank' || source == null ? '' : ` · ${formatChartNumber(source, config)}`}`
  }))
  const direct = scene.guides.find((guide) => guide.kind === 'direct-series')
  if (direct && (config.bumpShowStartLabels ?? true)) scene.guides.push({ ...direct, id: 'bump-start', side: 'left' })
  return scene
}
