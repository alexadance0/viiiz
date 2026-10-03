import { describe, expect, it } from 'vitest'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import { mapDemoTables } from '../../../core/demoData'
import type { ChartConfig, DataTable } from '../../../core/types'
import { getChartPlugin, chartValueLabelSelections } from '../../../core/chartRegistry'
import { renderScene } from '../../chart-renderer/echarts/renderScene'
import { compileNativeMapScene, validateMapMapping } from './compiler'
import { findMapRegion, inferMapRegionField, mapPresets, mapRegions } from './catalog'
import { resolveNativeMapScene } from './layout'
import { interiorAnchor, rectangleInsidePolygon } from './labelPlacement'

const config = (kind: ChartConfig['kind']): ChartConfig => ({ ...createDefaultChartConfig(), ...getChartPlugin(kind).defaultConfig, kind, xField: 'Территория', yField: 'Значение', yFields: ['Значение'] })
const table = (rows: DataTable['rows']): DataTable => ({ name: 'map', columns: ['Территория', 'Значение'], rows })

describe('native choropleth maps', () => {
  it.each(mapPresets)('$label enables an individual value independently of the global labels', ({ id, kind }) => {
    const initial = compileNativeMapScene(mapDemoTables[id], config(kind))
    const region = initial.plot.regions.filter((item) => item.value !== null).sort((a, b) => b.area - a.area)[0]
    const local = { ...config(kind), elementStyles: { [region.legacyKey]: { showValue: true } } }
    const scene = compileNativeMapScene(mapDemoTables[id], local)
    const selected = scene.plot.regions.find((item) => item.id === region.id)!
    expect(selected.label.text).toBe(selected.displayValue)
    expect(selected.label.visible).toBe(true)
    expect(scene.plot.regions.filter((item) => item.label.visible)).toHaveLength(1)
    const geometry = resolveNativeMapScene(scene).geometry.map[selected.id]
    expect(geometry.label).toBeDefined()
    expect(geometry.leader).toBeUndefined()
    const anchor = interiorAnchor(selected.polygons)
    const scale = geometry.rect.width / (Math.max(...selected.polygons.flat(2).map((point) => point[0])) - Math.min(...selected.polygons.flat(2).map((point) => point[0])))
    expect(rectangleInsidePolygon(anchor.center, (geometry.label!.width + 4) / scale, (geometry.label!.height + 4) / scale, anchor.polygon)).toBe(true)
    const hidden = compileNativeMapScene(mapDemoTables[id], { ...local, elementStyles: { [region.legacyKey]: { showValue: false } } })
    expect(hidden.plot.regions.find((item) => item.id === region.id)!.label.visible).toBe(false)
  })

  it('uses a visible callout for an explicitly enabled value in a tiny territory', () => {
    const source = table([{ Территория: 'DC', Значение: 7 }])
    const initial = compileNativeMapScene(source, config('map-usa'))
    const dc = initial.plot.regions.find((region) => region.regionId === 'US-DC')!
    const scene = compileNativeMapScene(source, { ...config('map-usa'), elementStyles: { [dc.legacyKey]: { showValue: true } } })
    const geometry = resolveNativeMapScene(scene).geometry.map[dc.id]
    expect(geometry.label).toBeDefined()
    expect(geometry.leader).toHaveLength(2)
  })

  it('bundles all requested territories and resolves common aliases without conflating Altai regions', () => {
    expect(mapRegions('russia')).toHaveLength(89)
    expect(mapRegions('usa')).toHaveLength(51)
    expect(mapRegions('europe')).toHaveLength(50)
    expect(mapRegions('russia').filter((region) => region.disputed).map((region) => region.id).sort()).toEqual(['UA-09', 'UA-14', 'UA-23', 'UA-40', 'UA-43', 'UA-65'])
    expect(findMapRegion('russia', 'Республика Татарстан')?.id).toBe('RU-TA')
    expect(findMapRegion('russia', 'ДНР')?.id).toBe('UA-14')
    expect(findMapRegion('russia', 'Алтайский край')?.id).toBe('RU-ALT')
    expect(findMapRegion('russia', 'Республика Алтай')?.id).toBe('RU-AL')
    expect(findMapRegion('usa', ' ca ')?.id).toBe('US-CA')
    expect(findMapRegion('usa', 'Нью-Йорк')?.id).toBe('US-NY')
    expect(findMapRegion('europe', 'DEU')?.id).toBe('DE')
    expect(findMapRegion('europe', 'UK')?.id).toBe('GB')
    expect(findMapRegion('europe', 'France')?.id).toBe('FR')
    const reordered: DataTable = { name: 'columns', columns: ['value', 'state'], rows: [{ value: 2, state: 'CA' }] }
    expect(inferMapRegionField(reordered, 'usa')).toBe('state')
  })

  it('aggregates aliases into one region and keeps zero, missing and unmatched data distinct', () => {
    const source = table([{ Территория: 'CA', Значение: 3 }, { Территория: 'California', Значение: 7 }, { Территория: 'Texas', Значение: 0 }, { Территория: 'New York', Значение: null }, { Территория: 'Atlantis', Значение: 9999 }])
    const scene = compileNativeMapScene(source, config('map-usa'))
    const get = (id: string) => scene.plot.regions.find((region) => region.regionId === id)!
    expect(get('US-CA').value).toBe(10)
    expect(get('US-TX').value).toBe(0)
    expect(get('US-NY').value).toBeNull()
    expect(get('US-AL').value).toBeNull()
    expect(get('US-TX').color).not.toBe(get('US-NY').color)
    expect(scene.plot.colorDomain).toMatchObject({ min: 0, max: 10 })
    expect(scene.plot.unmatched).toEqual(['Atlantis'])
    expect(validateMapMapping(source, config('map-usa')).ok).toBe(true)
    expect(validateMapMapping(source, { ...config('map-usa'), aggregation: 'none' }).errors).toContainEqual(expect.objectContaining({ field: 'aggregation' }))
    expect(validateMapMapping(table([{ Территория: 'Atlantis', Значение: 1 }]), config('map-usa')).ok).toBe(false)
  })

  it('retains identities across row order and styles, with renderer-neutral polygons and editable marks', () => {
    const source = table([{ Территория: 'France', Значение: -5 }, { Территория: 'DE', Значение: 12 }])
    const base = compileNativeMapScene(source, config('map-europe'))
    const france = base.plot.regions.find((region) => region.regionId === 'FR')!
    const styled = compileNativeMapScene({ ...source, rows: [...source.rows].reverse() }, { ...config('map-europe'), mapShowNames: true, elementStyles: { [france.legacyKey]: { color: '#e033ab', label: 'Франция\nОсобая подпись', showLabel: true } } })
    const modified = styled.plot.regions.find((region) => region.regionId === 'FR')!
    expect(modified.id).toBe(france.id)
    expect(modified.color).toBe('#e033ab')
    expect(modified.label.text).toBe('Франция\nОсобая подпись')
    expect(styled.document.chart).toMatchObject({ family: 'map', preset: 'europe' })
    expect(chartValueLabelSelections(source, config('map-europe')).some((selection) => selection.category === 'Франция')).toBe(true)
  })

  it.each(mapPresets)('$label resolves finite fitted geometry, all color-guide sides, tooltips and export primitives', ({ id, kind }) => {
    const scene = compileNativeMapScene(mapDemoTables[id], config(kind))
    const resolved = resolveNativeMapScene(scene)
    expect(Object.keys(resolved.geometry.map)).toHaveLength(mapRegions(id).length)
    for (const geometry of Object.values(resolved.geometry.map)) {
      expect(geometry.path).not.toMatch(/NaN|Infinity/)
      expect(geometry.rect.x).toBeGreaterThanOrEqual(resolved.geometry.plot.x - .1)
      expect(geometry.rect.y).toBeGreaterThanOrEqual(resolved.geometry.plot.y - .1)
      expect(geometry.rect.x + geometry.rect.width).toBeLessThanOrEqual(resolved.geometry.plot.x + resolved.geometry.plot.width + .1)
      expect(geometry.rect.y + geometry.rect.height).toBeLessThanOrEqual(resolved.geometry.plot.y + resolved.geometry.plot.height + .1)
    }
    const option = renderScene(resolved) as { xAxis?: unknown; series: Array<{ type: string; data: unknown[] }>; tooltip: { formatter(params: { dataIndex: number }): string } }
    expect(option.xAxis).toBeUndefined()
    expect(option.series[0].type).toBe('custom')
    expect(option.series[0].data).toHaveLength(mapRegions(id).length)
    expect(option.tooltip.formatter({ dataIndex: 0 })).toContain(scene.plot.regions[0].name)
    for (const position of ['left', 'right', 'top', 'bottom'] as const) {
      const scale = resolveNativeMapScene(compileNativeMapScene(mapDemoTables[id], { ...config(kind), heatmapScalePosition: position })).geometry.heatmap.scale
      expect(scale?.bar.width).toBeGreaterThan(0)
      expect(scale?.bar.height).toBeGreaterThan(0)
    }
  })
})
