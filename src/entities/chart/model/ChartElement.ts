import type { CoordinateSpace, Rect } from '../../../features/chart-layout/geometry'

export type SeriesId = string
export type DatumId = string
export type ElementId = string
export type ElementRole = 'title' | 'subtitle' | 'axis-line' | 'axis-tick' | 'axis-label' | 'axis-title' | 'legend-item' | 'series-label' | 'color-scale' | 'size-scale' | 'value-label' | 'category-label' | 'mark' | 'note' | 'source' | 'annotation' | 'decoration' | 'hierarchy-group-label' | 'hierarchy-leaf-label'

interface SceneElementBase {
  id: ElementId
  role: ElementRole
  coordinateSpace: CoordinateSpace
  bounds?: Rect
  selectable?: boolean
}

export type ChartElement =
  | SceneElementBase & { role: 'mark'; seriesId: SeriesId; datumId: DatumId; legacyKey?: string }
  | SceneElementBase & { role: 'axis-label' | 'category-label'; axisId: string; datumId: DatumId; text: string }
  | SceneElementBase & { role: 'legend-item' | 'series-label'; seriesId: SeriesId; text: string }
  | SceneElementBase & { role: Exclude<ElementRole, 'mark' | 'axis-label' | 'category-label' | 'legend-item' | 'series-label'>; text?: string }

const typedValue = (value: unknown) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value)}`
const segment = (value: unknown) => encodeURIComponent(typedValue(value))
export const elementId = (role: ElementRole, sourceField: string, datum: unknown, series: unknown = ''): ElementId => `${role}:${segment(sourceField)}:${segment(series)}:${segment(datum)}`
export const seriesId = (field: string, value: unknown): SeriesId => `series:${segment(field)}:${segment(value)}`
export const rawDatumId = (rowIndex: number, measure: string): DatumId => `raw:${rowIndex}:${segment(measure)}`
export const aggregateDatumId = (group: unknown, measureOrSeries: unknown): DatumId => `aggregate:${segment(group)}:${segment(measureOrSeries)}`
export const syntheticDatumId = (family: string, key: unknown): DatumId => `synthetic:${encodeURIComponent(family)}:${segment(key)}`
export const markElementId = (series: SeriesId, datum: DatumId): ElementId => `mark:${encodeURIComponent(series)}:${encodeURIComponent(datum)}`
