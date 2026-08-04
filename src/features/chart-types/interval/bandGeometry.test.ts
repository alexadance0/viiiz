import { describe, expect, it } from 'vitest'
import type { DatumId, SeriesId } from '../../../entities/chart/model/ChartElement'
import type { LayerId } from '../../../entities/chart/model/ChartScene'
import { buildConfidenceBandCells, buildLinearRangeBandCells, buildStepRangeBandCells } from './bandGeometry'

const categories = ['a', 'b', 'c'] as DatumId[]
const lowerId = 'series:low' as SeriesId, upperId = 'series:high' as SeriesId
const input = (lower: Array<number | null>, upper: Array<number | null>) => ({ bandId: 'band:test' as LayerId, categoryIds: categories, lower, upper, lowerSeriesId: lowerId, upperSeriesId: upperId, lowerColor: '#111111', upperColor: '#222222', opacity: .18 })

describe('native interval band geometry', () => {
  it('builds linear cells and splits one crossing with stable IDs and top ownership', () => {
    const cells = buildLinearRangeBandCells(input([1, 3, 7], [4, 5, 2]))
    expect(cells).toHaveLength(3)
    expect(cells.map((cell) => [cell.fromT, cell.toT, cell.fillColor])).toEqual([[0, 1, '#222222'], [0, 2 / 7, '#222222'], [2 / 7, 1, '#111111']])
    expect(cells.map((cell) => cell.id)).toEqual(['band-cell:band:test:a:b:0', 'band-cell:band:test:b:c:0', 'band-cell:band:test:b:c:1'])
    expect(buildLinearRangeBandCells(input([1, null, 3], [2, 4, 5]))).toEqual([])
  })

  it('uses exact start/end step ownership for crossing, equal and missing values', () => {
    const source = input([1, 5, null], [4, 2, 8])
    expect(buildStepRangeBandCells(source, 'end').map((cell) => [cell.startBottom, cell.startTop, cell.topBoundarySeriesId])).toEqual([[1, 4, upperId], [2, 5, lowerId]])
    expect(buildStepRangeBandCells(source, 'start')).toHaveLength(1)
    expect(buildStepRangeBandCells(input([2, 2, 2], [2, 2, 2]), 'end').every((cell) => cell.topBoundarySeriesId === upperId)).toBe(true)
  })

  it('creates confidence cells only between adjacent valid triples', () => {
    const cells = buildConfidenceBandCells({ bandId: 'band:confidence' as LayerId, categoryIds: ['a', 'b', 'c', 'd'] as DatumId[], main: [2, 4, 9, 5], lower: [1, 3, 4, 4], upper: [3, 5, 8, 6], fillColor: '#abcdef', opacity: .3 })
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ fromCategoryIndex: 0, toCategoryIndex: 1, startBottom: 1, startTop: 3, fillColor: '#abcdef', fillOpacity: .3 })
  })
})
