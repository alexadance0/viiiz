import type { ChartElementSelection, ChartSeriesSelection } from '../../../core/types'
import type { ElementId } from './ChartElement'

export type ChartSelection =
  | { kind: 'element'; id: ElementId; role: 'mark' | 'value-label'; legacy: ChartElementSelection }
  | { kind: 'category-label'; id: ElementId; axis: 'x' | 'y'; category: string; legacy: ChartElementSelection }
  | { kind: 'hierarchy-group'; id: ElementId; group: string; legacy: ChartElementSelection }
  | { kind: 'series'; id: ElementId; series: string; legacy: ChartSeriesSelection }

export function selectionFromLegacy(selection: ChartElementSelection): ChartSelection {
  if (selection.key.startsWith('treemap-group:')) return { kind: 'hierarchy-group', id: `hierarchy-group-label:${encodeURIComponent(selection.key.slice(14))}`, group: selection.seriesName, legacy: selection }
  if (selection.target === 'category-label') return { kind: 'category-label', id: `category-label:${selection.axis}:${encodeURIComponent(selection.category)}`, axis: selection.axis ?? 'x', category: selection.category, legacy: selection }
  return { kind: 'element', id: `mark:${encodeURIComponent(selection.key)}`, role: selection.target === 'value-label' ? 'value-label' : 'mark', legacy: selection }
}

export const legacySelection = (selection: ChartSelection): ChartElementSelection | ChartSeriesSelection => selection.legacy
