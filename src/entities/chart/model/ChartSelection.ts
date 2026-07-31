import type { ChartElementSelection, ChartSeriesSelection } from '../../../core/types'
import type { ElementId } from './ChartElement'

export type ChartSelection =
  | { kind: 'element'; id: ElementId; role: 'mark' | 'value-label'; seriesId?: string; datumId?: string; legacyKey?: string; series?: string; category?: string; value?: string; label?: string; color?: string; legacy?: ChartElementSelection }
  | { kind: 'category-label'; id: ElementId; axis: 'x' | 'y'; category: string; legacy?: ChartElementSelection }
  | { kind: 'hierarchy-group'; id: ElementId; group: string; legacy?: ChartElementSelection }
  | { kind: 'series'; id: ElementId; series: string; color?: string; legacy?: ChartSeriesSelection }

export function selectionFromLegacy(selection: ChartElementSelection): ChartSelection {
  if (selection.key.startsWith('treemap-group:')) return { kind: 'hierarchy-group', id: `hierarchy-group-label:${encodeURIComponent(selection.key.slice(14))}`, group: selection.seriesName, legacy: selection }
  if (selection.target === 'category-label') return { kind: 'category-label', id: `category-label:${selection.axis}:${encodeURIComponent(selection.category)}`, axis: selection.axis ?? 'x', category: selection.category, legacy: selection }
  return { kind: 'element', id: `mark:${encodeURIComponent(selection.key)}`, role: selection.target === 'value-label' ? 'value-label' : 'mark', legacy: selection }
}

export function legacySelection(selection: ChartSelection): ChartElementSelection | ChartSeriesSelection {
  if (selection.legacy) return selection.legacy
  if (selection.kind === 'series') return { name: selection.series, color: selection.color ?? '' }
  if (selection.kind === 'category-label') return { key: selection.id, seriesName: '', category: selection.category, value: selection.category, target: 'category-label', axis: selection.axis }
  if (selection.kind === 'hierarchy-group') return { key: selection.id, seriesName: selection.group, category: selection.group, value: '' }
  return { key: selection.legacyKey ?? selection.id, seriesName: selection.series ?? selection.seriesId ?? '', category: selection.category ?? selection.datumId ?? '', value: selection.value ?? '', label: selection.label, color: selection.color, ...(selection.role === 'value-label' ? { target: 'value-label' as const } : {}) }
}
