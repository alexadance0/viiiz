import { continuousDateLabel } from '../../../core/chartDateAxis'
import { axisValue, dateValue, niceNumericScale, orderedBounds } from '../../../core/chartScale'
import { seriesLegendItemId } from '../../../core/legend'
import { formatChartNumber, formatXAxisNumber } from '../../../core/numberFormat'
import { getSeriesColor } from '../../../core/seriesColor'
import { formatTimeValue } from '../../../core/timeFrequency'
import type { ChartConfig, DataTable, DataValue } from '../../../core/types'
import { aggregateDatumId, markElementId, rawDatumId, seriesId, type ChartElement } from '../../../entities/chart/model/ChartElement'
import { chartDocumentFromLegacy } from '../../../entities/chart/model/legacyChartConfigAdapter'
import type { CartesianXYPlotScene, LayerId, NativeXYChartScene, XYPointScene, XYQuadrantLayerScene, XYSeriesScene, XYTrendLayerScene } from '../../../entities/chart/model/ChartScene'
import type { AxisSpec } from '../../chart-layout/axisLayout'
import type { GuideSpec } from '../../chart-layout/guides/types'
import { legacyPointElementKey } from '../line/compiler'
import { inferBubbleSizeField, inferScatterLabelField } from './inference'
import { linearRegression, sampleRegression } from './regression'
import { encodeBubbleDiameter, niceSizeGuideValue, normalizeSizeRange } from './sizeEncoding'

export const isNativeXYKind = (kind: ChartConfig['kind']): kind is 'scatter' | 'bubble' => kind === 'scatter' || kind === 'bubble'
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const layerId = (value: string) => value as LayerId
const axis = (input: AxisSpec) => input
const coordinate = (value: DataValue) => value instanceof Date ? value.getTime() : Number(value)

export function validXYRows(table: DataTable, config: ChartConfig) {
  const yFields = config.yFields.length ? config.yFields : [config.yField]
  return table.rows.flatMap((row, rowIndex) => {
    const x = row[config.xField]
    const validX = typeof x === 'number' && Number.isFinite(x) || x instanceof Date && !Number.isNaN(x.getTime())
    return validX && yFields.some((field) => typeof row[field] === 'number' && Number.isFinite(row[field])) ? [{ row, rowIndex }] : []
  })
}

export function inferNativeXYMapping(table: DataTable) {
  const numeric = table.columns.filter((field) => table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  const date = table.columns.find((field) => table.rows.some((row) => row[field] instanceof Date))
  const xField = date ?? numeric[0] ?? table.columns[0] ?? ''
  const yField = numeric.find((field) => field !== xField) ?? numeric[0] ?? table.columns.find((field) => field !== xField) ?? xField
  return { xField, yField, yFields: yField ? [yField] : [] }
}

export function validateNativeXYMapping(table: DataTable, config: ChartConfig) {
  const errors: Array<{ field: string; message: string }> = []
  if (!config.xField || !table.columns.includes(config.xField)) errors.push({ field: 'xField', message: 'Выберите колонку для оси X.' })
  const numeric = (field?: string) => Boolean(field && table.columns.includes(field) && table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))
  const yFields = config.yFields.length ? config.yFields : [config.yField]
  if (!yFields.some(numeric)) errors.push({ field: 'yField', message: 'Выберите числовую колонку для значения.' })
  if (!table.rows.some((row) => typeof row[config.xField] === 'number' && Number.isFinite(row[config.xField]) || row[config.xField] instanceof Date && !Number.isNaN((row[config.xField] as Date).getTime()))) errors.push({ field: 'xField', message: 'Для этого графика ось X должна быть числовой или датой.' })
  if (config.kind === 'bubble' && !numeric(config.scatterSizeField)) errors.push({ field: 'scatterSizeField', message: 'Выберите числовую колонку для размера пузырька.' })
  return { ok: errors.length === 0, errors }
}

export function compileNativeXYScene(table: DataTable, config: ChartConfig): NativeXYChartScene {
  if (!isNativeXYKind(config.kind)) throw new Error(`Native XY compiler cannot compile ${config.kind}.`)
  const variant = config.kind
  const yFields = (config.yFields.length ? config.yFields : [config.yField]).filter(Boolean)
  const rows = validXYRows(table, config)
  const dateAxis = rows.some(({ row }) => row[config.xField] instanceof Date)
  const xValues = rows.map(({ row }) => coordinate(row[config.xField]))
  const automaticX = niceNumericScale(xValues)
  const automaticDateDomain = { minimum: xValues.length ? Math.min(...xValues) : 0, maximum: xValues.length ? Math.max(...xValues) : 1 }
  const [manualXMin, manualXMax] = orderedBounds(dateAxis ? dateValue(config.xAxisMin) : axisValue(config.xAxisMin), dateAxis ? dateValue(config.xAxisMax) : axisValue(config.xAxisMax))
  const xScale = {
    type: dateAxis ? 'time' as const : 'linear' as const,
    minimum: manualXMin ?? (dateAxis ? undefined : automaticX.min),
    maximum: manualXMax ?? (dateAxis ? undefined : automaticX.max),
    step: dateAxis ? undefined : config.xAxisStep ?? automaticX.step,
    timeProfile: dateAxis ? table.timeProfiles?.[config.xField] : undefined,
    dateLabelFormat: dateAxis ? config.dateLabelFormat : undefined,
    automaticDomain: { minimum: dateAxis ? automaticDateDomain.minimum : automaticX.min, maximum: dateAxis ? automaticDateDomain.maximum : automaticX.max, step: dateAxis ? undefined : automaticX.step },
  }
  const sizeField = variant === 'bubble' ? config.scatterSizeField : undefined
  const sizeValues = sizeField ? rows.flatMap(({ row }) => typeof row[sizeField] === 'number' && Number.isFinite(row[sizeField]) ? [row[sizeField] as number] : []) : []
  const magnitudes = sizeValues.map(Math.abs)
  const minimumMagnitude = magnitudes.length ? Math.min(...magnitudes) : 0
  const maximumMagnitude = magnitudes.length ? Math.max(...magnitudes) : 1
  const sizeRange = normalizeSizeRange(config.scatterSizeMin, config.scatterSizeMax)
  const missingDiameter = config.scatterPointSize ?? 10
  const sizeEncoding = sizeField ? { field: sizeField, domain: { minimumMagnitude, maximumMagnitude }, range: sizeRange, scale: 'sqrt-absolute' as const, missingDiameter } : undefined
  const groups = config.scatterColorField ? [...new Set(rows.map(({ row }) => String(row[config.scatterColorField!] ?? 'Без категории')))] : ['']
  const labelField = config.scatterLabelField || inferScatterLabelField(table, config.xField, yFields, sizeField, config.scatterColorField)
  const globalLabelVisible = config.scatterShowLabels ?? config.showValues
  const series: XYSeriesScene[] = yFields.flatMap((yField, fieldIndex) => groups.map((group, groupIndex) => {
    const name = config.scatterColorField ? yFields.length === 1 ? group : `${yField} · ${group}` : yField
    const style = config.seriesStyles[name]
    const groupStyle = config.scatterColorField ? config.seriesStyles[group] : undefined
    const color = style?.color ?? groupStyle?.color ?? getSeriesColor(config, config.scatterColorField ? group : name, config.scatterColorField ? groupIndex : fieldIndex)
    const id = seriesId(`xy:${yField}`, config.scatterColorField ? group : '')
    const points = rows.flatMap(({ row, rowIndex }): XYPointScene[] => {
      const sourceY = row[yField]
      if (typeof sourceY !== 'number' || !Number.isFinite(sourceY)) return []
      if (config.scatterColorField && String(row[config.scatterColorField] ?? 'Без категории') !== group) return []
      const sourceX = row[config.xField]
      const legacyKey = legacyPointElementKey(name, sourceX)
      const override = config.elementStyles[legacyKey]
      const datumId = config.aggregation === 'none' ? rawDatumId(rowIndex, yField) : aggregateDatumId(`${rowIndex}:${coordinate(sourceX)}`, yField)
      const sizeValue = sizeField && typeof row[sizeField] === 'number' && Number.isFinite(row[sizeField]) ? row[sizeField] as number : undefined
      const seriesSize = style?.markerSize ?? config.scatterPointSize ?? 10
      const size = override?.markerSize ?? (sizeEncoding ? encodeBubbleDiameter(sizeValue, { ...sizeRange, maximumMagnitude, missingDiameter }) : seriesSize)
      const stroke = override?.markerBorder ?? override?.color ?? style?.markerBorder ?? style?.color ?? color
      return [{
        type: 'xy-point', id: markElementId(id, datumId), datumId, seriesId: id, legacyKey,
        x: coordinate(sourceX), y: sourceY, sourceX, sourceY,
        displayX: sourceX instanceof Date ? formatTimeValue(sourceX, table.timeProfiles?.[config.xField], config.dateLabelFormat) : formatXAxisNumber(sourceX, config),
        displayY: formatChartNumber(sourceY, config),
        marker: { shape: override?.markerShape ?? style?.markerShape ?? 'circle', size, fill: config.scatterHollow ? 'transparent' : override?.markerFill ?? override?.color ?? style?.markerFill ?? color, stroke, strokeWidth: override?.markerBorderWidth ?? style?.markerBorderWidth ?? config.scatterBorderWidth ?? 1, opacity: clamp01(override?.fillOpacity ?? style?.fillOpacity ?? config.scatterOpacity ?? .78) },
        label: { visible: override?.showLabel ?? globalLabelVisible, text: override?.label || (labelField ? String(row[labelField] ?? '') : formatChartNumber(sourceY, config)), position: override?.labelPosition ?? config.scatterLabelPosition ?? 'right', style: override?.valueText ?? config.valueText, collision: 'shift-y-hide-overlap' },
        sizeValue, displaySizeValue: sizeValue == null ? undefined : formatChartNumber(sizeValue, config), colorGroup: config.scatterColorField ? group : undefined,
      }]
    })
    return { id, name, yField, colorGroup: config.scatterColorField ? group : undefined, color, visible: true, points }
  }))
  const yValues = series.flatMap((item) => item.points.map((point) => point.y))
  const automaticY = niceNumericScale(yValues)
  const positives = yValues.filter((value) => value > 0)
  const logMin = 10 ** Math.floor(Math.log10(positives.length ? Math.min(...positives) : 1))
  const rawLogMax = 10 ** Math.ceil(Math.log10(positives.length ? Math.max(...positives) : 10))
  const [manualYMin, manualYMax] = orderedBounds(config.yAxisMin, config.yAxisMax)
  const yScale = config.yAxisScaleType === 'log'
    ? { type: 'log' as const, minimum: manualYMin != null && manualYMin > 0 ? manualYMin : logMin, maximum: manualYMax != null && manualYMax > logMin ? manualYMax : Math.max(logMin * 10, rawLogMax), step: undefined, automaticDomain: { minimum: logMin, maximum: Math.max(logMin * 10, rawLogMax) } }
    : { type: 'linear' as const, minimum: manualYMin ?? automaticY.min, maximum: manualYMax ?? automaticY.max, step: config.yAxisStep ?? automaticY.step, automaticDomain: { minimum: automaticY.min, maximum: automaticY.max, step: automaticY.step } }
  const xStyle = config.xAxisLabelText ?? config.axisLabelText, yStyle = config.yAxisLabelText ?? config.axisLabelText
  const xAxis = axis({ id: 'x', channel: 'x', orientation: 'horizontal', placement: { kind: 'side', side: config.xAxisPosition }, line: { visible: config.showXAxisLine }, ticks: { visible: config.showXTicks, length: config.tickLength }, labels: { visible: config.showXAxisLabels ?? true, size: 0, gap: config.xAxisLabelGap ?? 8, rotation: typeof config.xAxisLabelRotate === 'number' ? config.xAxisLabelRotate : 0, style: xStyle }, title: { visible: config.showXAxisTitle, text: config.xAxisTitle, size: 0, gap: config.xAxisTitleGap, style: config.xAxisTitleText ?? config.axisTitleText } })
  const yAxis = axis({ id: 'y', channel: 'y', orientation: 'vertical', placement: { kind: 'side', side: config.yAxisPosition }, line: { visible: config.showYAxisLine }, ticks: { visible: config.showYTicks, length: config.tickLength }, labels: { visible: config.showYAxisLabels ?? true, size: 0, gap: config.yAxisLabelGap ?? 8, style: yStyle }, title: { visible: config.showYAxisTitle, text: config.yAxisTitle, size: 0, gap: config.yAxisTitleGap, style: config.yAxisTitleText ?? config.axisTitleText } })
  const referenceStroke = { color: config.scatterReferenceColor ?? config.zeroLineColor ?? '#8a8791', width: config.scatterReferenceWidth ?? config.zeroLineWidth ?? 1.5, type: config.scatterReferenceType ?? config.zeroLineType ?? 'dashed' as const, opacity: 1 }
  const analyticalLayers: CartesianXYPlotScene['analyticalLayers'] = []
  if (Number.isFinite(config.scatterXReference)) analyticalLayers.push({ id: layerId('layer:reference:x'), kind: 'reference', axis: 'x', value: config.scatterXReference!, stroke: referenceStroke })
  if (Number.isFinite(config.scatterYReference)) analyticalLayers.push({ id: layerId('layer:reference:y'), kind: 'reference', axis: 'y', value: config.scatterYReference!, stroke: referenceStroke })
  if (config.showZeroLine && yScale.type !== 'log' && config.scatterYReference !== 0) analyticalLayers.push({ id: layerId('layer:reference:y:zero'), kind: 'reference', axis: 'y', value: 0, stroke: { color: config.zeroLineColor ?? '#8a8791', width: config.zeroLineWidth ?? 1.5, type: config.zeroLineType ?? 'dashed', opacity: 1 } })
  const xMinimum = xScale.minimum ?? xScale.automaticDomain.minimum, xMaximum = xScale.maximum ?? xScale.automaticDomain.maximum
  const yMinimum = yScale.minimum ?? yScale.automaticDomain.minimum, yMaximum = yScale.maximum ?? yScale.automaticDomain.maximum
  if (config.scatterDiagonal && !dateAxis) {
    const minimum = Math.max(xMinimum, yMinimum), maximum = Math.min(xMaximum, yMaximum)
    if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum >= minimum) analyticalLayers.push({ id: layerId('layer:reference:diagonal'), kind: 'reference', axis: 'diagonal', segment: [{ x: minimum, y: minimum }, { x: maximum, y: maximum }], stroke: { color: config.scatterDiagonalColor ?? '#8a8791', width: config.scatterDiagonalWidth ?? 1.5, type: config.scatterDiagonalType ?? 'dashed', opacity: 1 } })
  }
  if (config.scatterQuadrants && Number.isFinite(config.scatterXReference) && Number.isFinite(config.scatterYReference)) {
    const xr = Math.max(xMinimum, Math.min(xMaximum, config.scatterXReference!)), yr = Math.max(yMinimum, Math.min(yMaximum, config.scatterYReference!))
    const colors = config.scatterQuadrantColors ?? ['#dfeee8', '#e7eef8', '#f8e5e3', '#f2eadb'], labels = config.scatterQuadrantLabels ?? ['', '', '', '']
    const regions: XYQuadrantLayerScene['regions'] = [
      { position: 'top-left', xMinimum, xMaximum: xr, yMinimum: yr, yMaximum, fillColor: colors[0], fillOpacity: .22, label: labels[0], labelStyle: config.valueText },
      { position: 'top-right', xMinimum: xr, xMaximum, yMinimum: yr, yMaximum, fillColor: colors[1], fillOpacity: .22, label: labels[1], labelStyle: config.valueText },
      { position: 'bottom-right', xMinimum: xr, xMaximum, yMinimum, yMaximum: yr, fillColor: colors[2], fillOpacity: .22, label: labels[2], labelStyle: config.valueText },
      { position: 'bottom-left', xMinimum, xMaximum: xr, yMinimum, yMaximum: yr, fillColor: colors[3], fillOpacity: .22, label: labels[3], labelStyle: config.valueText },
    ]
    analyticalLayers.push({ id: layerId('layer:quadrants'), kind: 'quadrants', xReference: xr, yReference: yr, regions })
  }
  series.forEach((item) => {
    const style = config.seriesStyles[item.name]
    if (!(style?.scatterTrendline ?? config.scatterTrendline)) return
    const regression = linearRegression(item.points)
    if (!regression) return
    const observed = item.points.map((point) => point.x)
    const samples = sampleRegression(regression, Math.min(...observed, xMinimum), Math.max(...observed, xMaximum))
    const color = style?.scatterTrendColor ?? style?.color ?? config.scatterTrendColor ?? item.color
    const bandVisible = style?.scatterTrendBand ?? config.scatterTrendBand
    const trend: XYTrendLayerScene = { id: layerId(`layer:${item.id}:trend`), kind: 'trend', sourceSeriesId: item.id, regression: { slope: regression.slope, intercept: regression.intercept }, stroke: { color, width: style?.scatterTrendWidth ?? config.scatterTrendWidth ?? 2, type: style?.scatterTrendType ?? config.scatterTrendType ?? 'dashed', opacity: 1 }, samples: samples.map(({ x, y }) => ({ x, y })) }
    if (bandVisible) trend.confidenceBand = { id: layerId(`layer:${item.id}:trend-band`), sourceSeriesId: item.id, fillColor: color, fillOpacity: clamp01(style?.scatterTrendBandOpacity ?? config.scatterTrendBandOpacity ?? .12), samples: samples.map(({ x, lower, upper }) => ({ x, lower, upper })) }
    analyticalLayers.push(trend)
  })
  const guides: GuideSpec[] = [{ id: 'legend', kind: 'categorical-legend', visible: Boolean(config.showLegend && series.length), coordinateSpace: 'content', position: config.legendPosition ?? 'top', items: series.map((item) => ({ id: seriesLegendItemId(item.id), label: config.seriesStyles[item.name]?.legendLabel?.trim() || item.name, visible: config.seriesStyles[item.name]?.showLegendItem ?? true, color: item.color, marker: { kind: 'point' }, target: { kind: 'series', seriesId: item.id } })) }]
  if (sizeEncoding && config.scatterSizeLegend !== false && sizeValues.length) {
    const values = niceSizeGuideValue(maximumMagnitude) === minimumMagnitude ? [minimumMagnitude] : [niceSizeGuideValue(maximumMagnitude), minimumMagnitude]
    guides.push({ id: 'size-scale', kind: 'size-scale', visible: true, coordinateSpace: 'plot', position: config.scatterSizeLegendPosition ?? 'top-left', title: config.scatterSizeLegendTitle || sizeField!, items: values.map((value) => ({ value, label: formatChartNumber(value, config), diameter: encodeBubbleDiameter(value, { ...sizeRange, maximumMagnitude, missingDiameter }) })), style: config.legendText, marker: { stroke: config.legendText.color, strokeWidth: 1 } })
  }
  const elements: ChartElement[] = [
    ...series.flatMap((item) => item.points.map((point): ChartElement => ({ id: point.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: point.seriesId, datumId: point.datumId, legacyKey: point.legacyKey }))),
    ...series.map((item): ChartElement => ({ id: `legend-item:${item.id}`, role: 'legend-item', coordinateSpace: 'canvas', selectable: true, seriesId: item.id, text: item.name })),
  ]
  const frameElements = ([['title', config.title, config.titleText], ['subtitle', config.subtitle, config.subtitleText], ['note', config.note, config.noteText], ['source', config.source, config.sourceText]] as const)
    .filter(([, text], index) => Boolean(text) && (index === 0 ? config.showTitle !== false : index === 1 ? config.showSubtitle !== false : index === 2 ? config.showNote !== false : config.showSource !== false))
    .map(([role, text, style]) => ({ id: `frame:${role}`, role, text, style }))
  return { document: chartDocumentFromLegacy(table, config), compatibilityConfig: config, elements, guides, frameElements, plot: { kind: 'xy', variant, xAxis, yAxis, xScale, yScale, series, sizeEncoding, analyticalLayers } }
}

export const formatNativeXYDateTick = continuousDateLabel
export { inferBubbleSizeField, inferScatterLabelField }
