import { expect, it } from 'vitest'
import { createRussiaTurnoutDemoConfig, russiaTurnoutDemoTable } from './russiaTurnoutDemo'
import { matchMapRows } from '../../chart-types/map/catalog'
import { compileNativeMapScene, validateMapMapping } from '../../chart-types/map/compiler'

it('maps all 89 source regions once, retaining exact turnout percentages', () => {
  expect(russiaTurnoutDemoTable.columns).toEqual(['Регион', 'Явка, %'])
  expect(russiaTurnoutDemoTable.rows).toHaveLength(89)
  const matches = matchMapRows(russiaTurnoutDemoTable, 'Регион', 'russia')
  expect(matches.unmatched).toEqual([])
  expect(matches.inclusive).toEqual([])
  expect(matches.totals).toEqual([])
  expect(new Set(matches.matched.map((item) => item.region?.id)).size).toBe(89)
  const config = createRussiaTurnoutDemoConfig()
  expect(validateMapMapping(russiaTurnoutDemoTable, config).ok).toBe(true)
  const scene = compileNativeMapScene(russiaTurnoutDemoTable, config)
  expect(scene.plot.regions.every((region) => region.value != null)).toBe(true)
  expect(scene.plot.regions.find((region) => region.regionId === 'RU-CE')).toMatchObject({ value: 93.98, displayValue: '93,98%' })
  expect(scene.plot.regions.find((region) => region.regionId === 'RU-IRK')).toMatchObject({ value: 36.09, displayValue: '36,09%' })
  expect(scene.plot.colorDomain).toMatchObject({ min: 0, max: 100 })
})
