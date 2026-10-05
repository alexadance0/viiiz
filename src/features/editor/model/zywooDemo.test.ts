import { expect, it } from 'vitest'
import { compileMarimekkoScene } from '../../chart-types/marimekko/compiler'
import { normalizeImportedTable } from '../../../core/normalization'
import { inferTypes } from '../../../core/dataProfile'
import { createZywooDemoConfig, zywooDemoTable } from './zywooDemo'

it('keeps only years and five translated weapon categories with original kill counts', () => {
  expect(zywooDemoTable.columns).toEqual(['Год', 'Винтовки', 'Снайперские винтовки', 'Пистолеты-пулемёты', 'Пистолеты', 'Гранаты и прочее'])
  expect(zywooDemoTable.rows).toHaveLength(9)
  const totals = zywooDemoTable.rows.map((row) => zywooDemoTable.columns.slice(1).reduce((sum, field) => sum + Number(row[field]), 0))
  expect(totals).toEqual([3517, 5868, 4457, 3703, 3421, 2861, 2753, 3593, 2654])
  const normalized = normalizeImportedTable(zywooDemoTable)
  expect(inferTypes(normalized).Год).toBe('text')
  expect(normalized.rows.every((row) => typeof row.Год === 'string')).toBe(true)
  expect(normalized.timeProfiles?.Год).toBeUndefined()
  const scene = compileMarimekkoScene(normalized, createZywooDemoConfig())
  expect(scene.plot.categories.map((category) => category.span?.total)).toEqual(totals)
  expect(scene.plot.series).toHaveLength(5)
  expect(scene.plot.categoryAxis.calendarTicks).toBeUndefined()
  expect(scene.plot.categories.map((category) => category.label)).toEqual([...Array.from({ length: 8 }, (_, index) => String(2018 + index)), '2026*'])
  scene.plot.categories.forEach((_, index) => expect(scene.plot.series.reduce((sum, series) => sum + Number(series.marks[index].value), 0)).toBeCloseTo(100))
  expect(scene.plot.series.find((series) => series.name === 'Винтовки')?.marks[0].value).toBeCloseTo(1284 / 3517 * 100)
  expect(createZywooDemoConfig().note).toBe('* 2026 — неполный год')
})
