import { describe, expect, it } from 'vitest'
import { getChartPlugin } from '../../../core/chartRegistry'
import { lineAreaFixtures } from '../../../test-fixtures/charts/lineArea'
import { compileNativeLineScene, NATIVE_LINE_KINDS } from './compiler'
import { compileNativeAreaScene, NATIVE_AREA_KINDS } from '../area/compiler'

describe('native line and area compilers', () => {
  it.each(NATIVE_LINE_KINDS)('%s produces a semantic line plot', (kind) => {
    const source = lineAreaFixtures[0], scene = compileNativeLineScene(source.table, { ...source.config, kind })
    expect(getChartPlugin(kind).compilerMode).toBe('native')
    expect(scene.plot).toMatchObject({ kind: 'line', categoryPlacement: 'point' })
    expect(scene.plot.series[0].points[0]).toMatchObject({ type: 'point', legacyKey: expect.any(String), datumId: expect.any(String) })
  })

  it.each(NATIVE_AREA_KINDS)('%s produces a semantic area plot', (kind) => {
    const source = lineAreaFixtures[13], scene = compileNativeAreaScene(source.table, { ...source.config, kind })
    expect(getChartPlugin(kind).compilerMode).toBe('native')
    expect(scene.plot).toMatchObject({ kind: 'area', categoryPlacement: 'point', stacking: kind === 'area' ? 'none' : kind === 'stacked-area' ? 'stacked' : 'normalized' })
    expect(scene.plot.series[0].fill).toEqual(expect.objectContaining({ color: expect.any(String), opacity: expect.any(Number) }))
  })

  it.each(lineAreaFixtures)('compiles fixture: $name', ({ table, config }) => {
    const scene = config.kind === 'area' || config.kind === 'stacked-area' || config.kind === 'normalized-stacked-area' ? compileNativeAreaScene(table, config) : compileNativeLineScene(table, config)
    expect(scene.plot.categories).toHaveLength(table.rows.length)
    expect(new Set(scene.elements.map((element) => element.id)).size).toBe(scene.elements.length)
  })

  it('models interpolation, missing data, segment overrides, and normalized values explicitly', () => {
    const spline = compileNativeLineScene(lineAreaFixtures[3].table, lineAreaFixtures[3].config)
    const step = compileNativeLineScene(lineAreaFixtures[4].table, lineAreaFixtures[4].config)
    const edited = compileNativeLineScene(lineAreaFixtures[7].table, lineAreaFixtures[7].config)
    const normalized = compileNativeAreaScene(lineAreaFixtures[14].table, lineAreaFixtures[14].config)
    expect(spline.plot.series[0]).toMatchObject({ interpolation: 'spline', missing: 'gap', segments: [] })
    expect(step.plot.series[0].interpolation).toBe('step-start')
    expect(edited.plot.series[0].segments[0]?.stroke).toMatchObject({ color: '#6956e8', width: 5, type: 'dashed' })
    expect(normalized.plot.valueDomain).toMatchObject({ min: -100, max: 100, step: 20 })
  })

  it('rejects every kind outside its explicit family boundary', () => {
    const source = lineAreaFixtures[0]
    expect(() => compileNativeLineScene(source.table, { ...source.config, kind: 'indexed-line' })).toThrow(/cannot compile indexed-line/)
    expect(() => compileNativeAreaScene(source.table, { ...source.config, kind: 'confidence-line' })).toThrow(/cannot compile confidence-line/)
  })
})
