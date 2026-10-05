import { expect, it } from 'vitest'
import { createStreamGraphDemoConfig, streamGraphDemoTable } from './streamGraphDemo'
import data from './data/usMusicRevenue1973_2025.json'
import { compileStreamScene } from '../../chart-types/stream/compiler'

it('uses complete RIAA annual data in 2025 dollars and preserves every format’s revenue', () => {
  const config = createStreamGraphDemoConfig()
  expect(data.years).toHaveLength(53)
  expect(data.years.map((row) => row.year)).toEqual(Array.from({ length: 53 }, (_, i) => 1973 + i))
  expect(data.years.at(-1)!.adjusted).toEqual(data.years.at(-1)!.nominal)
  expect(data.years.at(-1)!.adjusted.reduce((sum, value) => sum + value, 0)).toBeCloseTo(11.53529769, 8)
  expect(data.years[0].adjusted[data.groups.indexOf('cassette')]).toBeCloseTo(.301437261, 9)
  expect(data.years[0].nominal[data.groups.indexOf('cassette')]).toBeCloseTo(.041572, 9)
  const scene = compileStreamScene(streamGraphDemoTable, config)
  expect(scene.plot.series).toHaveLength(7)
  for (const [index, row] of streamGraphDemoTable.rows.entries()) {
    expect(row.Год).toEqual(new Date(1973 + index, 0, 1))
    const expected = data.years[index].adjusted.reduce((sum, value) => sum + value, 0)
    const actual = scene.plot.series.reduce((sum, series) => {
      const band = series.streamBands![index]
      const value = series.points[index].value!
      expect(Number.isFinite(value) && value >= 0).toBe(true)
      expect(band.upper - band.lower).toBeCloseTo(value, 8)
      return sum + value
    }, 0)
    expect(actual).toBeCloseTo(expected, 8)
  }
})
