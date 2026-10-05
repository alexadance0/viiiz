import { expect, it } from 'vitest'
import { lifeExpectancyDemoTable, createLifeExpectancyDemoConfig } from './lifeExpectancyDemo'
import { compileNativeMapScene, validateMapMapping } from '../../chart-types/map/compiler'

it('loads original 2023 country values without continental or world aggregates', () => {
  const rows = lifeExpectancyDemoTable.rows
  expect(rows).toHaveLength(237)
  expect(new Set(rows.map((row) => row.Код)).size).toBe(rows.length)
  expect(rows.some((row) => row.Код === 'OWID_WRL' || row.Код === 'OWID_EUR')).toBe(false)
  expect(rows.find((row) => row.Код === 'USA')?.['Продолжительность жизни']).toBe(79.3043)
  expect(rows.find((row) => row.Код === 'JPN')?.['Продолжительность жизни']).toBe(84.7123)
  expect(rows.find((row) => row.Код === 'RUS')?.['Продолжительность жизни']).toBe(73.1541)
})

it.each(['map-world', 'tilemap-world'] as const)('%s maps provider codes to their countries', (kind) => {
  const config = createLifeExpectancyDemoConfig(kind)
  expect(validateMapMapping(lifeExpectancyDemoTable, config).ok).toBe(true)
  const scene = compileNativeMapScene(lifeExpectancyDemoTable, config)
  expect(scene.plot.regions.find((region) => region.regionId === 'US')?.value).toBe(79.3043)
  expect(scene.plot.regions.find((region) => region.regionId === 'JP')?.value).toBe(84.7123)
  expect(config.source).toBe('Источник: Our World in Data')
  expect(config.note).toBe('')
})
