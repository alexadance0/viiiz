import { expect, it } from 'vitest'
import { createAiComputeScatterDemoConfig, aiComputeScatterDemoTable } from './aiComputeScatterDemo'
import { compileNativeXYScene, validateNativeXYMapping } from '../../chart-types/xy/compiler'

it('retains all systems, calendar dates and untransformed positive computation', () => {
  const table = aiComputeScatterDemoTable, config = createAiComputeScatterDemoConfig()
  expect(table.columns).toEqual(['Система', 'Дата публикации', 'Вычисления, петаFLOP'])
  expect(table.rows).toHaveLength(536)
  expect(new Set(table.rows.map((row) => row.Система)).size).toBe(536)
  expect(validateNativeXYMapping(table, config).ok).toBe(true)
  const scene = compileNativeXYScene(table, config)
  expect(scene.plot.series).toHaveLength(1)
  const points = scene.plot.series[0].points
  expect(points).toHaveLength(536)
  expect(new Set(points.map((point) => point.id)).size).toBe(536)
  expect(points.find((point) => point.label.text === 'Theseus')).toMatchObject({ x: new Date(1950, 6, 2).getTime(), y: 4e-14, displayY: '4E-14' })
  expect(points.find((point) => point.label.text === 'AlexNet')).toMatchObject({ x: new Date(2012, 8, 30).getTime(), y: 470 })
  expect(scene.plot.xScale.type).toBe('time')
  expect(scene.plot.yScale.type).toBe('log')
  expect(scene.plot.yScale.minimum).toBeLessThanOrEqual(4e-14)
  expect(scene.plot.yScale.maximum).toBeGreaterThanOrEqual(5e11)
  expect(points.every((point) => point.y > 0 && point.displayY !== '0')).toBe(true)
})
