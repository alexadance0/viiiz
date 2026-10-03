import catalog from './data/catalog.json'
import type { ChartKind, DataTable } from '../../../core/types'

export type MapPreset = 'russia' | 'usa' | 'europe'
export interface MapRegionDefinition { id: string; name: string; aliases: string[]; disputed: boolean }
export const mapPresets: Array<{ id: MapPreset; kind: ChartKind; label: string }> = [
  { id: 'russia', kind: 'map-russia', label: 'Карта России' },
  { id: 'usa', kind: 'map-usa', label: 'Карта США' },
  { id: 'europe', kind: 'map-europe', label: 'Карта Европы' },
]
export const isMapChart = (kind: ChartKind): kind is 'map-russia' | 'map-usa' | 'map-europe' => kind === 'map-russia' || kind === 'map-usa' || kind === 'map-europe'
export const mapPresetForKind = (kind: ChartKind): MapPreset => kind === 'map-usa' ? 'usa' : kind === 'map-europe' ? 'europe' : 'russia'
export const mapRegions = (preset: MapPreset): MapRegionDefinition[] => catalog[preset]
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/республика/g, '').replace(/[^\p{L}\p{N}]/gu, '')
const aliases = new Map(mapPresets.map(({ id }) => {
  const index = new Map<string, MapRegionDefinition>()
  // Canonical names win over upstream aliases (Altai Krai and Altai Republic are distinct).
  mapRegions(id).forEach((region) => [region.id, ...region.aliases].forEach((name) => { if (!index.has(normalize(name))) index.set(normalize(name), region) }))
  mapRegions(id).forEach((region) => index.set(normalize(region.name), region))
  return [id, index]
}))
export const findMapRegion = (preset: MapPreset, value: unknown) => aliases.get(preset)?.get(normalize(value))
export function unmatchedMapRegions(table: DataTable, field: string, preset: MapPreset) {
  return [...new Set(table.rows.flatMap((row) => row[field] != null && String(row[field]).trim() && !findMapRegion(preset, row[field]) ? [String(row[field])] : []))]
}
export function inferMapRegionField(table: DataTable, preset: MapPreset) {
  return [...table.columns].sort((a, b) => table.rows.filter((row) => findMapRegion(preset, row[b])).length - table.rows.filter((row) => findMapRegion(preset, row[a])).length)[0] ?? ''
}
