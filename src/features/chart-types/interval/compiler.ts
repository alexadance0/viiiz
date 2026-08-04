import type { ChartConfig, DataTable } from '../../../core/types'
import { prepareVisibleChartData } from '../../../core/chartScale'
import type { SeriesId } from '../../../entities/chart/model/ChartElement'
import type { IntervalGroupId, LayerId, LineSeriesScene, NativeIntervalChartScene } from '../../../entities/chart/model/ChartScene'
import { compilePreparedPointScene } from '../line/compiler'
import { buildConfidenceBandCells, buildLinearRangeBandCells, buildStepRangeBandCells } from './bandGeometry'

export const NATIVE_INTERVAL_KINDS = ['range-line', 'step-range-line', 'confidence-line'] as const
type NativeIntervalKind = typeof NATIVE_INTERVAL_KINDS[number]
export const isNativeIntervalKind = (kind: ChartConfig['kind']): kind is NativeIntervalKind => (NATIVE_INTERVAL_KINDS as readonly ChartConfig['kind'][]).includes(kind)

const groupId = (variant: 'range' | 'confidence', ids: SeriesId[]) => `interval-group:${variant}:${ids.join(':')}` as IntervalGroupId
const bandId = (id: IntervalGroupId) => `interval-band:${id}` as LayerId
const opacity = (value: number | undefined) => Math.max(0, Math.min(1, Number.isFinite(value) ? value! : .18))
const validField = (table: DataTable, field: string | undefined) => Boolean(field && table.columns.includes(field) && table.rows.some((row) => typeof row[field] === 'number' && Number.isFinite(row[field])))

function effectiveGroups(table: DataTable, config: ChartConfig) {
  const configured = config.intervalGroups?.length ? config.intervalGroups : config.yFields.slice(0, Math.floor(config.yFields.length / 3) * 3).reduce<NonNullable<ChartConfig['intervalGroups']>>((groups, field, index, fields) => {
    if (index % 3 === 0) groups.push({ main: field, lower: fields[index + 1], upper: fields[index + 2] })
    return groups
  }, [])
  return configured.filter((group) => new Set([group.main, group.lower, group.upper]).size === 3 && validField(table, group.main) && validField(table, group.lower) && validField(table, group.upper))
}

function emptyScene(table: DataTable, config: ChartConfig): NativeIntervalChartScene {
  const fallback = config.yField && table.columns.includes(config.yField) ? config.yField : table.columns.find((field) => validField(table, field)) ?? config.yField
  const prepared = prepareVisibleChartData(table, { ...config, seriesField: '', yField: fallback, yFields: fallback ? [fallback] : [] })
  const base = compilePreparedPointScene(table, config, 'line', { ...prepared, series: [] })
  return { ...base, elements: base.elements.filter((item) => item.role !== 'legend-item'), guides: base.guides.map((guide) => guide.kind === 'categorical-legend' || guide.kind === 'direct-series' ? { ...guide, visible: false, items: [] } : guide), plot: { ...base.plot, kind: 'interval', variant: config.kind === 'confidence-line' ? 'confidence' : config.kind === 'step-range-line' ? 'step-range' : 'range', series: [], groups: [], bands: [] } } as NativeIntervalChartScene
}

export function compileNativeIntervalScene(table: DataTable, config: ChartConfig): NativeIntervalChartScene {
  if (!isNativeIntervalKind(config.kind)) throw new Error(`Native interval compiler cannot compile ${config.kind}.`)
  const confidence = config.kind === 'confidence-line'
  const groups = confidence ? effectiveGroups(table, config) : []
  const rangeFields = [config.rangeLowerField, config.rangeUpperField].filter((field): field is string => Boolean(field))
  if (confidence ? !groups.length : rangeFields.length !== 2 || rangeFields[0] === rangeFields[1] || !rangeFields.every((field) => validField(table, field))) return emptyScene(table, config)
  const fields = confidence ? [...new Set(groups.flatMap((group) => [group.main, group.lower, group.upper]))] : rangeFields
  const scoped = { ...config, seriesField: '', yField: fields[0], yFields: fields }
  const prepared = prepareVisibleChartData(table, scoped)
  const base = compilePreparedPointScene(table, scoped, config.kind === 'step-range-line' ? 'step-line' : 'line', prepared)
  if (base.plot.kind !== 'line') throw new Error('Interval source compiler must produce line semantics.')
  const linePlot = base.plot
  const byName = new Map(linePlot.series.map((series) => [series.name, series]))
  const visible = new Set<string>(confidence ? groups.flatMap((group) => [group.main, ...(group.showBounds ? [group.lower, group.upper] : [])]) : fields)
  const series = linePlot.series.map((source): LineSeriesScene => {
    if (!confidence) return { ...source, visible: visible.has(source.name) }
    const style = config.seriesStyles[source.name]
    const owner = groups.findLast((group) => group.lower === source.name || group.upper === source.name)
    if (!owner) return { ...source, visible: visible.has(source.name) }
    const main = owner && byName.get(owner.main)
    return { ...source, color: main?.color ?? source.color, visible: visible.has(source.name), marker: { ...source.marker, visible: false }, stroke: { ...source.stroke, color: main?.color ?? source.color, width: style?.lineWidth ?? 1.25, type: style?.lineType ?? 'dashed', opacity: style?.fillOpacity ?? .58 } }
  })
  const seriesByName = new Map(series.map((item) => [item.name, item]))
  const fillOpacity = opacity(config.intervalFillOpacity)
  const semanticGroups = (confidence ? groups : [{ lower: fields[0], upper: fields[1], showBounds: true }]).map((group) => {
    const lower = seriesByName.get(group.lower)!, upper = seriesByName.get(group.upper)!, main = 'main' in group ? seriesByName.get(group.main) : undefined
    const id = groupId(confidence ? 'confidence' : 'range', confidence ? [main!.id, lower.id, upper.id] : [lower.id, upper.id])
    const layer = bandId(id)
    const bandColor = config.intervalFillMode === 'custom' ? config.intervalFillColor ?? config.color : confidence ? main!.color : undefined
    const cells = confidence
      ? buildConfidenceBandCells({ bandId: layer, categoryIds: linePlot.categories.map((item) => item.id), main: main!.points.map((point) => point.value), lower: lower.points.map((point) => point.value), upper: upper.points.map((point) => point.value), fillColor: bandColor!, opacity: fillOpacity })
      : config.kind === 'step-range-line'
        ? buildStepRangeBandCells({ bandId: layer, categoryIds: linePlot.categories.map((item) => item.id), lower: lower.points.map((point) => point.value), upper: upper.points.map((point) => point.value), lowerSeriesId: lower.id, upperSeriesId: upper.id, lowerColor: lower.color, upperColor: upper.color, customColor: bandColor, opacity: fillOpacity }, config.stepPosition === 'start' ? 'start' : 'end')
        : buildLinearRangeBandCells({ bandId: layer, categoryIds: linePlot.categories.map((item) => item.id), lower: lower.points.map((point) => point.value), upper: upper.points.map((point) => point.value), lowerSeriesId: lower.id, upperSeriesId: upper.id, lowerColor: lower.color, upperColor: upper.color, customColor: bandColor, opacity: fillOpacity })
    const validPointCount = confidence ? main!.points.filter((point, index) => point.value != null && lower.points[index]?.value != null && upper.points[index]?.value != null && lower.points[index].value! <= point.value && point.value <= upper.points[index].value!).length : lower.points.filter((point, index) => point.value != null && upper.points[index]?.value != null).length
    return { group: { id, mainSeriesId: main?.id, lowerSeriesId: lower.id, upperSeriesId: upper.id, bandLayerId: layer, boundsVisible: Boolean(group.showBounds), validPointCount }, band: { id: layer, groupId: id, fill: { colorMode: 'resolved-per-cell' as const, opacity: fillOpacity }, interpolation: config.kind === 'step-range-line' ? config.stepPosition === 'start' ? 'step-start' as const : 'step-end' as const : 'linear' as const, cells } }
  })
  const visibleIds = new Set(series.filter((item) => item.visible).map((item) => item.id))
  const visibleById = new Map(series.filter((item) => item.visible).map((item) => [item.id, item]))
  const guides = base.guides.map((guide) => {
    if (guide.kind === 'categorical-legend') {
      const items = guide.items.flatMap((item) => item.target.kind === 'series' && visibleById.has(item.target.seriesId) ? [{ ...item, color: visibleById.get(item.target.seriesId)!.color }] : [])
      return { ...guide, items, visible: guide.visible && items.length > 0 }
    }
    if (guide.kind === 'direct-series') {
      const items = guide.items.flatMap((item) => {
        const source = visibleById.get(item.seriesId)
        if (!source) return []
        return [{ ...item, color: source.color, style: { ...item.style, color: config.seriesStyles[source.name]?.directLabelText?.color ?? source.color } }]
      })
      return { ...guide, items, visible: guide.visible && items.length > 0 }
    }
    return guide
  })
  const elements = base.elements.filter((item) => item.role === 'mark' || item.role === 'legend-item' ? visibleIds.has(item.seriesId) : true)
  return { ...base, compatibilityConfig: config, elements, guides, plot: { ...linePlot, kind: 'interval', variant: confidence ? 'confidence' : config.kind === 'step-range-line' ? 'step-range' : 'range', series, groups: semanticGroups.map((item) => item.group), bands: semanticGroups.map((item) => item.band) } } as NativeIntervalChartScene
}
