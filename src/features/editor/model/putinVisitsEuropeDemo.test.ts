import { expect, it } from 'vitest'
import { createPutinVisitsEuropeDemoConfig, putinVisitsEuropeDemoTable } from './putinVisitsEuropeDemo'
import { matchMapRows } from '../../chart-types/map/catalog'
import { compileNativeMapScene, validateMapMapping } from '../../chart-types/map/compiler'

it('maps all 49 supplied countries, preserves zero visits and leaves Russia missing', () => {
  expect(putinVisitsEuropeDemoTable.columns).toEqual(['Страна', 'Визиты'])
  expect(putinVisitsEuropeDemoTable.rows).toHaveLength(49)
  expect(putinVisitsEuropeDemoTable.rows.reduce((sum, row) => sum + Number(row.Визиты), 0)).toBe(194)
  const matches = matchMapRows(putinVisitsEuropeDemoTable, 'Страна', 'europe')
  expect(matches.unmatched).toEqual([])
  expect(new Set(matches.matched.map((item) => item.region?.id)).size).toBe(49)
  const config = createPutinVisitsEuropeDemoConfig()
  expect(validateMapMapping(putinVisitsEuropeDemoTable, config).ok).toBe(true)
  const scene = compileNativeMapScene(putinVisitsEuropeDemoTable, config)
  expect(scene.plot.regions.filter((region) => region.value != null)).toHaveLength(49)
  for (const [id, value] of [['BY', 28], ['UA', 21], ['DE', 19], ['GB', 7], ['VA', 6], ['AM', 8], ['DK', 0]] as const) {
    expect(scene.plot.regions.find((region) => region.regionId === id)).toMatchObject({ value, displayValue: String(value) })
  }
  expect(scene.plot.regions.find((region) => region.regionId === 'RU')?.value).toBeNull()
  expect(scene.plot.colorDomain).toMatchObject({ min: 0, max: 28 })
})
