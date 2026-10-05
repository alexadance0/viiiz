import catalog from './data/catalog.json'
import providers from './data/provider-aliases.json'
import type { ChartKind, DataTable } from '../../../core/types'
import { exclusiveRegionNames, inclusiveRussiaRegion, isRussiaTotal, regionalOkato, russiaRegionAliases, russiaRegionKey } from './russiaRegions'
import { tileGrid } from './tiles'

export type MapPreset = 'russia' | 'usa' | 'europe' | 'world'
export interface MapRegionDefinition { id: string; name: string; aliases: string[]; disputed: boolean }
export const mapPresets: Array<{ id: MapPreset; kind: ChartKind; label: string }> = [
  { id: 'russia', kind: 'map-russia', label: 'Карта России' },
  { id: 'usa', kind: 'map-usa', label: 'Карта США' },
  { id: 'europe', kind: 'map-europe', label: 'Карта Европы' },
  { id: 'world', kind: 'map-world', label: 'Карта мира' },
]
export const tileMapPresets: typeof mapPresets = [
  { id: 'russia', kind: 'tilemap-russia', label: 'Плиточная карта России' },
  { id: 'usa', kind: 'tilemap-usa', label: 'Плиточная карта США' },
  { id: 'europe', kind: 'tilemap-europe', label: 'Плиточная карта Европы' },
  { id: 'world', kind: 'tilemap-world', label: 'Плиточная карта мира' },
]
export const mapChartPresets = [...mapPresets, ...tileMapPresets]
export const isTileMapChart = (kind: ChartKind) => kind.startsWith('tilemap-')
export const isMapChart = (kind: ChartKind): kind is 'map-russia' | 'map-usa' | 'map-europe' | 'map-world' | 'tilemap-russia' | 'tilemap-usa' | 'tilemap-europe' | 'tilemap-world' => mapChartPresets.some((preset) => preset.kind === kind)
export const mapPresetForKind = (kind: ChartKind): MapPreset => kind.endsWith('-world') ? 'world' : kind.endsWith('-usa') ? 'usa' : kind.endsWith('-europe') ? 'europe' : 'russia'
export const mapRegions = (preset: MapPreset): MapRegionDefinition[] => catalog[preset]
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/республика/g, '').replace(/[^\p{L}\p{N}]/gu, '')
const countryTotals = new Set(providers.countryTotals.map(normalize))
const countryOutside = new Set(providers.countryOutside.map(normalize))
const historical = new Set(providers.historical.map(normalize))
const stateOutside = new Set(providers.stateOutside.map(normalize))
const stateTotals = new Set(['US', 'USA', 'United States', 'United States of America', 'United States total', 'США', '0100000US', '00000', '0', 'Northeast', 'Midwest', 'South', 'West', 'New England', 'Mideast', 'Great Lakes', 'Plains', 'Southeast', 'Southwest', 'Rocky Mountain', 'Far West', ...Array.from({ length: 8 }, (_, index) => String(91000 + index * 1000))].map(normalize))
function providerNames(preset: MapPreset, id: string) {
  const index: Record<string, string[]> = preset === 'usa' ? providers.states : providers.countries
  return preset === 'russia' ? [] : index[id] ?? []
}
const aliases = new Map(mapPresets.map(({ id }) => {
  const index = new Map<string, MapRegionDefinition>()
  const key = id === 'russia' ? russiaRegionKey : normalize
  // Canonical names win over upstream aliases (Altai Krai and Altai Republic are distinct).
  mapRegions(id).forEach((region) => [region.id, ...region.aliases, ...providerNames(id, region.id), tileGrid(id)[region.id].label, ...(id === 'russia' ? russiaRegionAliases(region.id, region.name) : [])].forEach((name) => { if (!index.has(key(name))) index.set(key(name), region) }))
  mapRegions(id).forEach((region) => [region.id, region.name].forEach((name) => index.set(key(name), region)))
  return [id, index]
}))
export function findMapRegion(preset: MapPreset, value: unknown) {
  if (preset !== 'russia') return aliases.get(preset)?.get(normalize(value))
  const exclusive = exclusiveRegionNames.get(russiaRegionKey(value))
  return aliases.get(preset)?.get(exclusive ? russiaRegionKey(exclusive) : regionalOkato(value) ?? russiaRegionKey(value))
}

export function matchMapRows(table: DataTable, field: string, preset: MapPreset) {
  const resolved = table.rows.map((row) => ({ row, region: findMapRegion(preset, row[field]) }))
  const matched: typeof resolved = [], unmatched = new Set<string>(), totals = new Set<string>(), inclusive = new Set<string>(), outside = new Set<string>(), past = new Set<string>()
  for (const item of resolved) {
    const value = item.row[field], name = String(value ?? '')
    if (!name.trim()) continue
    if (preset !== 'russia') {
      const key = normalize(value)
      if ((preset === 'usa' ? stateTotals : countryTotals).has(key)) { totals.add(name); continue }
      if (preset !== 'usa' && historical.has(key)) { past.add(name); continue }
      if (!item.region && ((preset === 'usa' ? stateOutside : countryOutside).has(key) || (preset !== 'usa' && findMapRegion('world', value)))) { outside.add(name); continue }
    }
    if (preset === 'russia') {
      if (isRussiaTotal(value)) { totals.add(name); continue }
      if (inclusiveRussiaRegion(value)) { inclusive.add(name); continue }

    }
    if (item.region) matched.push(item)
    else unmatched.add(name)
  }
  return { matched, unmatched: [...unmatched], totals: [...totals], inclusive: [...inclusive], outside: [...outside], historical: [...past] }
}
export function unmatchedMapRegions(table: DataTable, field: string, preset: MapPreset) {
  return matchMapRows(table, field, preset).unmatched
}
export function inferMapRegionField(table: DataTable, preset: MapPreset) {
  // Explicit geographic headers break numeric FIPS/value ties in Census and BEA exports.
  const headers = ['code', 'countrycode', 'iso3', 'iso2', 'geoid', 'geofips', 'statefp', 'state', 'stusab', 'fips', 'statefips', 'statecode', 'ansicode', 'statens', 'entity', 'countryname', 'country', 'statename', 'name', 'территория', 'регион', 'штат', 'страна', 'код']
  const ranked = table.columns.map((field) => {
    const header = headers.indexOf(normalize(field))
    const matches = table.rows.filter((row) => findMapRegion(preset, row[field]) && !(preset === 'usa' && header < 0 && /^\d+$/.test(String(row[field] ?? '').trim()))).length
    return { field, matches, header }
  })
  return ranked.sort((a, b) => b.matches - a.matches || (a.header < 0 ? headers.length : a.header) - (b.header < 0 ? headers.length : b.header))[0]?.field ?? ''
}
