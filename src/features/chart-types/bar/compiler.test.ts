import { describe, expect, it } from 'vitest'
import { getChartPlugin } from '../../../core/chartRegistry'
import { barFixtures } from '../../../test-fixtures/charts/bar'
import { NATIVE_BAR_KINDS, compileNativeBarScene } from './compiler'

describe('native bar compiler', () => {
  it.each(NATIVE_BAR_KINDS)('%s is explicitly native and produces semantic rect marks', (kind) => {
    const source = barFixtures[2]
    const plugin = getChartPlugin(kind)
    const scene = plugin.compile(source.table, { ...source.config, kind })
    expect(plugin.compilerMode).toBe('native')
    expect(scene.migrationMode).toBe('native')
    if (scene.migrationMode === 'native') {
      expect(scene.plot.kind).toBe('bar')
      expect(scene.plot.series[0].marks[0]).toMatchObject({ type: 'rect', value: expect.any(Number), legacyKey: expect.any(String) })
      expect('type' in scene.plot.series[0] && (scene.plot.series[0] as { type?: unknown }).type === 'bar').toBe(false)
    }
  })

  it.each(barFixtures)('compiles fixture: $name', ({ table, config }) => {
    const scene = compileNativeBarScene(table, config)
    expect(scene.plot.categories.length).toBeGreaterThan(0)
    expect(new Set(scene.elements.map((element) => element.id)).size).toBe(scene.elements.length)
  })

  it('keeps display overrides separate from stable datum identity', () => {
    const source = barFixtures[0]
    const plain = compileNativeBarScene(source.table, source.config)
    const edited = compileNativeBarScene(source.table, { ...source.config, categoryLabelOverrides: { x: { '0:Alpha': 'Renamed' } } })
    expect(edited.plot.categories[0].label).toBe('Renamed')
    expect(edited.plot.series[0].marks[0].datumId).toBe(plain.plot.series[0].marks[0].datumId)
  })
})
