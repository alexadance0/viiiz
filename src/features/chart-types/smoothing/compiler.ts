import type { ChartConfig, ChartKind, DataTable } from '../../../core/types'
import { formatChartNumber } from '../../../core/numberFormat'
import { markElementId, syntheticDatumId, type ChartElement, type DatumId, type SeriesId } from '../../../entities/chart/model/ChartElement'
import type { LayerId, NativeSmoothingChartScene, SmoothingLayerScene, SmoothingPointScene } from '../../../entities/chart/model/ChartScene'
import type { CategoricalLegendItem } from '../../chart-layout/guides/types'
import { compilePreparedPointScene } from '../line/compiler'
import { prepareVisibleChartData } from '../../../core/chartScale'
import { movingAverage, normalizeMovingAverageWindow } from './movingAverage'

export const NATIVE_SMOOTHING_KINDS = ['moving-average-line', 'moving-average-scatter'] as const
export type NativeSmoothingKind = typeof NATIVE_SMOOTHING_KINDS[number]
export const isNativeSmoothingKind = (kind: ChartKind): kind is NativeSmoothingKind => (NATIVE_SMOOTHING_KINDS as readonly ChartKind[]).includes(kind)

export const smoothingLayerId = (sourceSeriesId: SeriesId, role: 'raw' | 'moving-average'): LayerId => `layer:${sourceSeriesId}:${role}` as LayerId
const derivedDatumId = (layerId: LayerId, sourceDatumId: DatumId) => syntheticDatumId('moving-average', `${layerId}:${sourceDatumId}`)
export const rawLayerLabel = (sourceLabel: string, renderMode: 'line' | 'points') => `${sourceLabel} · исходные ${renderMode === 'points' ? 'значения' : 'данные'}`
export const averageLayerLabel = (sourceLabel: string, window: number) => `${sourceLabel} · среднее (${window})`

export function compileNativeSmoothingScene(table: DataTable, config: ChartConfig): NativeSmoothingChartScene {
  if (!isNativeSmoothingKind(config.kind)) throw new Error(`Native smoothing compiler cannot compile ${config.kind}.`)
  const prepared = prepareVisibleChartData(table, config)
  const base = compilePreparedPointScene(table, config, 'line', prepared)
  if (base.plot.kind !== 'line') throw new Error('Smoothing requires the shared Cartesian point contract.')
  const window = normalizeMovingAverageWindow(config.movingAverageWindow)
  const rawOpacity = config.movingAverageRawOpacity ?? .22
  const layers = base.plot.series.flatMap((source, sourceIndex): SmoothingLayerScene[] => {
    const rawId = smoothingLayerId(source.id, 'raw')
    const averageId = smoothingLayerId(source.id, 'moving-average')
    const rawPoints = source.points.map((point): SmoothingPointScene => ({
      ...point, id: markElementId(rawId, point.datumId), seriesId: rawId, layerId: rawId, role: 'observed', editable: true,
      marker: config.kind === 'moving-average-scatter'
        ? { visible: true, shape: source.marker.shape, size: config.seriesStyles[source.name]?.markerSize ?? 7, fill: source.color, stroke: source.color, strokeWidth: 0 }
        : { ...point.marker, visible: false },
      label: { ...point.label, visible: false },
      provenance: { transform: 'moving-average', sourceSeriesId: source.id, sourceDatumId: point.datumId, window },
    }))
    const averages = movingAverage(prepared.series[sourceIndex].data, window)
    const averagePoints = source.points.map((point, index): SmoothingPointScene => {
      const datumId = derivedDatumId(averageId, point.datumId)
      const value = averages[index]
      return {
        ...point, id: markElementId(averageId, datumId), datumId, seriesId: averageId, layerId: averageId, role: 'derived', value, editable: false,
        displayValue: value == null ? 'пропуск' : formatChartNumber(value, config),
        marker: { ...point.marker, visible: false, fill: source.color, stroke: source.color, strokeWidth: 0 },
        label: { visible: config.showValues, text: formatChartNumber(value, config), style: config.valueText, position: config.valueLabelPosition ?? 'auto' },
        provenance: { transform: 'moving-average', sourceSeriesId: source.id, sourceDatumId: point.datumId, window },
      }
    })
    const raw: SmoothingLayerScene = {
      ...source, id: rawId, sourceSeriesId: source.id, role: 'raw', renderMode: config.kind === 'moving-average-scatter' ? 'points' : 'line',
      name: rawLayerLabel(source.name, config.kind === 'moving-average-scatter' ? 'points' : 'line'),
      stroke: config.kind === 'moving-average-scatter' ? { ...source.stroke, opacity: 0 } : { ...source.stroke, width: Math.max(1, source.stroke.width * .55), opacity: rawOpacity },
      marker: rawPoints[0]?.marker ?? source.marker, points: rawPoints, segments: [], presentation: { opacity: rawOpacity, emphasis: 'muted', layerPriority: sourceIndex },
    }
    const average: SmoothingLayerScene = {
      ...source, id: averageId, sourceSeriesId: source.id, role: 'average', renderMode: 'line', name: averageLayerLabel(source.name, window),
      marker: { ...source.marker, visible: false, fill: source.color, stroke: source.color, strokeWidth: 0 }, points: averagePoints, segments: [],
      stroke: { ...source.stroke, opacity: 1 }, presentation: { opacity: 1, emphasis: 'accent', layerPriority: 100 + sourceIndex },
    }
    return [raw, average]
  })
  const sourceGroups = base.plot.series.map((source) => ({ sourceSeriesId: source.id, sourceName: source.name, color: source.color, rawLayerId: smoothingLayerId(source.id, 'raw'), averageLayerId: smoothingLayerId(source.id, 'moving-average') }))
  const legendItems: CategoricalLegendItem[] = layers.map((layer) => {
    const sourceName = sourceGroups.find((group) => group.sourceSeriesId === layer.sourceSeriesId)!.sourceName
    const sourceStyle = config.seriesStyles[sourceName]
    const displayName = sourceStyle?.legendLabel?.trim() || sourceName
    const generatedLabel = layer.role === 'raw' ? rawLayerLabel(displayName, layer.renderMode) : averageLayerLabel(displayName, window)
    const id = `legend:${layer.id}`
    const override = config.legendItemOverrides?.[id]
    return { id, label: override?.label?.trim() || generatedLabel, visible: override?.visible ?? sourceStyle?.showLegendItem ?? true, color: layer.color, marker: { kind: layer.renderMode === 'points' ? 'point' : 'line', opacity: layer.role === 'raw' ? rawOpacity : 1 }, target: { kind: 'layer', layerId: layer.id, sourceSeriesId: layer.sourceSeriesId, role: layer.role } }
  })
  const guides = base.guides.map((guide) => {
    if (guide.kind === 'categorical-legend') return { ...guide, items: legendItems, visible: Boolean(config.showLegend && !config.showDirectLabels && legendItems.some((item) => item.visible)) }
    if (guide.kind === 'direct-series') return { ...guide, items: guide.items.map((item) => { const sourceSeriesId = item.seriesId, layerId = smoothingLayerId(sourceSeriesId, 'moving-average'); return { ...item, seriesId: layerId, layerId, sourceSeriesId } }), visible: guide.visible }
    return guide
  })
  const elements: ChartElement[] = [
    ...base.elements.filter((element) => element.role !== 'mark' && element.role !== 'legend-item'),
    ...layers.filter((layer) => layer.role === 'raw').flatMap((layer) => layer.points.map((point): ChartElement => ({ id: point.id, role: 'mark', coordinateSpace: 'data', selectable: true, seriesId: layer.sourceSeriesId, datumId: point.datumId, legacyKey: point.legacyKey }))),
    ...layers.map((layer): ChartElement => ({ id: `legend-item:${layer.id}`, role: 'legend-item', coordinateSpace: 'canvas', selectable: true, seriesId: layer.id, text: layer.name })),
  ]
  return { ...base, elements, guides, plot: { kind: 'smoothing', variant: config.kind, window, categoryPlacement: 'point', categories: base.plot.categories, categoryLabelPlan: base.plot.categoryLabelPlan, categoryAxis: base.plot.categoryAxis, valueAxis: base.plot.valueAxis, valueDomain: base.plot.valueDomain, sourceGroups, layers } }
}
