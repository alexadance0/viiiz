import { expect, it } from 'vitest'
import { createUsBornInSameStateDemoConfig, usBornInSameStateDemoTable } from './usBornInSameStateDemo'
import { matchMapRows } from '../../chart-types/map/catalog'
import { compileNativeMapScene, validateMapMapping } from '../../chart-types/map/compiler'

it('maps all 50 states once, retaining the supplied ACS percentages', () => {
  expect(usBornInSameStateDemoTable.columns).toEqual(['Штат', 'Родились в своём штате, %'])
  expect(usBornInSameStateDemoTable.rows).toHaveLength(50)
  const matches = matchMapRows(usBornInSameStateDemoTable, 'Штат', 'usa')
  expect(matches.unmatched).toEqual([])
  expect(new Set(matches.matched.map((item) => item.region?.id)).size).toBe(50)
  const config = createUsBornInSameStateDemoConfig()
  expect(validateMapMapping(usBornInSameStateDemoTable, config).ok).toBe(true)
  const scene = compileNativeMapScene(usBornInSameStateDemoTable, config)
  expect(scene.plot.regions.filter((region) => region.value != null)).toHaveLength(50)
  expect(scene.plot.regions.find((region) => region.regionId === 'US-NV')).toMatchObject({ value: 28.5, displayValue: '28,5%' })
  expect(scene.plot.regions.find((region) => region.regionId === 'US-LA')).toMatchObject({ value: 77, displayValue: '77,0%' })
  expect(scene.plot.regions.find((region) => region.regionId === 'US-DC')?.value).toBeNull()
})
