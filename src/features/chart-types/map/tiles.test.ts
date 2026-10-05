import { describe, expect, it } from 'vitest'
import { tileGeometry, tileGrid } from './tiles'
import { findMapRegion, tileMapPresets, mapPresets, mapRegions } from './catalog'
import { compileNativeMapScene } from './compiler'
import { resolveNativeMapScene } from './layout'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { getChartPlugin } from '../../../core/chartRegistry'
import { mapDemoTables } from '../../../core/demoData'

describe('square geographical tile maps', () => {
  it.each(tileMapPresets)('$label covers every territory once, with equal square areas and centered labels', ({ id, kind }) => {
    const grid = tileGrid(id)
    expect(Object.keys(grid).sort()).toEqual(mapRegions(id).map((region) => region.id).sort())
    expect(new Set(Object.values(grid).map((tile) => `${tile.column}:${tile.row}`)).size).toBe(mapRegions(id).length)
    const config = { ...createDefaultChartConfig(), ...getChartPlugin(kind).defaultConfig, kind, xField: 'Территория', yField: 'Значение', yFields: ['Значение'] }
    const scene = compileNativeMapScene(mapDemoTables[id], config)
    expect(new Set(scene.plot.regions.map((region) => region.area)).size).toBe(1)
    const resolved = resolveNativeMapScene(scene)
    expect(new Set(Object.values(resolved.geometry.map).map((region) => region.labelSize)).size).toBe(1)
    for (const region of scene.plot.regions) {
      expect(findMapRegion(id, grid[region.regionId].label)?.id).toBe(region.regionId)
      const geometry = resolved.geometry.map[region.id]
      expect(geometry.rect.width).toBeCloseTo(geometry.rect.height)
      expect(region.label.text).toBe(grid[region.regionId].label)
      expect(geometry.label, region.regionId).toBeDefined()
      expect(geometry.leader).toBeUndefined()
      expect(geometry.labelText).toBe(region.label.text)
      expect(geometry.label!.x + geometry.label!.width / 2).toBeCloseTo(geometry.center[0])
      expect(geometry.label!.y + geometry.label!.height / 2).toBeCloseTo(geometry.center[1])
    }
  })

  it.each([...mapPresets, ...tileMapPresets])('$label defaults to labels only for tile maps', ({ id, kind }) => {
    const config = { ...createDefaultChartConfig(), ...getChartPlugin(kind).defaultConfig, kind, xField: 'Территория', yField: 'Значение', yFields: ['Значение'] }
    const scene = compileNativeMapScene(mapDemoTables[id], config)
    expect(scene.plot.regions.every((region) => region.label.visible === kind.startsWith('tilemap-'))).toBe(true)
  })

  it('uses the reference geography and keeps Moscow distinct from its surrounding oblast', () => {
    expect(tileGrid('usa')['US-HI'].row).toBe(tileGrid('usa')['US-AK'].row)
    expect(tileGrid('usa')['US-WA'].column).toBeLessThan(tileGrid('usa')['US-NY'].column)
    expect(tileGrid('europe').NO.row).toBeLessThan(tileGrid('europe').IT.row)
    expect(tileGrid('russia')['RU-MOW'].label).toBe('Мск')
    expect(tileGrid('russia')['RU-MOS'].label).toBe('Мос')
    expect(tileGrid('world').US.column).toBeLessThan(tileGrid('world').DE.column)
    expect(tileGrid('world').DE.column).toBeLessThan(tileGrid('world').JP.column)
  })

  it('changes gutters without moving cell centers and clamps malformed gaps', () => {
    const adjacent = tileGeometry('usa', 0), spaced = tileGeometry('usa', 12)
    expect(adjacent.regions['US-CA'].center).toEqual(spaced.regions['US-CA'].center)
    expect(adjacent.regions['US-CA'].area).toBe(10000)
    expect(spaced.regions['US-CA'].area).toBe(7744)
    expect(tileGeometry('usa', Number.NaN)).toEqual(tileGeometry('usa', 4))
    expect(tileGeometry('usa', -99)).toEqual(adjacent)
    expect(tileGeometry('usa', 999)).toEqual(tileGeometry('usa', 30))
  })

  it('matches provider aliases and edits one tile without changing the other labels', () => {
    const kind = 'tilemap-usa' as const
    const config = { ...createDefaultChartConfig(), ...getChartPlugin(kind).defaultConfig, kind, xField: 'state', yField: 'Value', yFields: ['Value'] }
    const source = { name: 'Census', columns: ['state', 'Value'], rows: [{ state: '0400000US06', Value: 97 }, { state: '48', Value: 5 }] }
    const original = compileNativeMapScene(source, config), california = original.plot.regions.find((region) => region.regionId === 'US-CA')!
    const scene = compileNativeMapScene(source, { ...config, elementStyles: { [california.legacyKey]: { showValue: true } } })
    expect(scene.plot.regions.find((region) => region.regionId === 'US-CA')?.label.text).toBe('CA\n97')
    expect(scene.plot.regions.find((region) => region.regionId === 'US-TX')?.label.text).toBe('TX')
    const resolved = resolveNativeMapScene(scene)
    expect(new Set(Object.values(resolved.geometry.map).map((region) => region.labelSize)).size).toBe(1)
    const geometry = resolved.geometry.map[california.id]
    expect(geometry.label).toBeDefined()
    expect(geometry.leader).toBeUndefined()
  })
})
