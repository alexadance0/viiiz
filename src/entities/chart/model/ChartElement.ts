import type { CoordinateSpace, Rect } from '../../../features/chart-layout/geometry'

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
  | SceneElementBase & { role: 'mark'; seriesId: string; datumId: string }
  | SceneElementBase & { role: 'axis-label' | 'category-label'; axisId: string; datumId: string; text: string }
  | SceneElementBase & { role: 'legend-item' | 'series-label'; seriesId: string; text: string }
  | SceneElementBase & { role: Exclude<ElementRole, 'mark' | 'axis-label' | 'category-label' | 'legend-item' | 'series-label'>; text?: string }

const typedValue = (value: unknown) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value)}`
const segment = (value: unknown) => encodeURIComponent(typedValue(value))
export const elementId = (role: ElementRole, sourceField: string, datum: unknown, series: unknown = ''): ElementId => `${role}:${segment(sourceField)}:${segment(series)}:${segment(datum)}`
