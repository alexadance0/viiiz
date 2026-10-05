import { expect, it } from 'vitest'
import { createF1ConstructorsDemoConfig, f1ConstructorsDemoTable } from './f1ConstructorsDemo'
import { compileNativeBumpScene, validateBumpMapping } from '../../chart-types/bump/compiler'

it('keeps official final places and team colors for all ten teams in five completed seasons', () => {
  expect(f1ConstructorsDemoTable.rows).toHaveLength(5)
  for (const row of f1ConstructorsDemoTable.rows) {
    expect(f1ConstructorsDemoTable.columns.slice(1).map((team) => row[team]).sort((a, b) => Number(a) - Number(b))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  }
  const config = createF1ConstructorsDemoConfig()
  expect(validateBumpMapping(f1ConstructorsDemoTable, config).ok).toBe(true)
  const scene = compileNativeBumpScene(f1ConstructorsDemoTable, config)
  expect(scene.plot.valueAxisInverse).toBe(true)
  expect(scene.plot.series).toHaveLength(10)
  const mclaren = scene.plot.series.find((series) => series.name === 'McLaren')!
  expect(mclaren.points.map((point) => point.value)).toEqual([4, 5, 4, 1, 1])
  expect(mclaren.color).toBe('#ff8000')
  expect(f1ConstructorsDemoTable.rows[1]).toMatchObject({ Sauber: 6, 'Aston Martin': 7 })
})
