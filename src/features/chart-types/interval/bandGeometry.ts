import type { DatumId, ElementId, SeriesId } from '../../../entities/chart/model/ChartElement'
import type { IntervalBandCellScene, LayerId } from '../../../entities/chart/model/ChartScene'

interface RangeBandInput {
  bandId: LayerId
  categoryIds: DatumId[]
  lower: Array<number | null>
  upper: Array<number | null>
  lowerSeriesId: SeriesId
  upperSeriesId: SeriesId
  lowerColor: string
  upperColor: string
  customColor?: string
  opacity: number
}

interface ConfidenceBandInput {
  bandId: LayerId
  categoryIds: DatumId[]
  main: Array<number | null>
  lower: Array<number | null>
  upper: Array<number | null>
  fillColor: string
  opacity: number
}

const cellId = (bandId: LayerId, from: DatumId, to: DatumId, part: number): ElementId => `band-cell:${bandId}:${encodeURIComponent(from)}:${encodeURIComponent(to)}:${part}`
const finite = (value: number | null): value is number => value != null && Number.isFinite(value)

function cell(input: RangeBandInput, index: number, part: number, fromT: number, toT: number, startLow: number, startHigh: number, endLow: number, endHigh: number, topSeriesId: SeriesId): IntervalBandCellScene {
  return {
    id: cellId(input.bandId, input.categoryIds[index], input.categoryIds[index + 1], part),
    fromCategoryIndex: index, toCategoryIndex: index + 1, fromT, toT,
    startBottom: Math.min(startLow, startHigh), startTop: Math.max(startLow, startHigh),
    endBottom: Math.min(endLow, endHigh), endTop: Math.max(endLow, endHigh),
    fillColor: input.customColor ?? (topSeriesId === input.upperSeriesId ? input.upperColor : input.lowerColor),
    fillOpacity: input.opacity, topBoundarySeriesId: topSeriesId,
  }
}

export function buildLinearRangeBandCells(input: RangeBandInput): IntervalBandCellScene[] {
  return input.categoryIds.slice(0, -1).flatMap((_category, index) => {
    const firstLow = input.lower[index], firstHigh = input.upper[index], nextLow = input.lower[index + 1], nextHigh = input.upper[index + 1]
    if (!finite(firstLow) || !finite(firstHigh) || !finite(nextLow) || !finite(nextHigh)) return []
    const firstDelta = firstHigh - firstLow, nextDelta = nextHigh - nextLow
    if (firstDelta * nextDelta < 0) {
      const ratio = Math.abs(firstDelta) / (Math.abs(firstDelta) + Math.abs(nextDelta))
      const crossing = firstLow + (nextLow - firstLow) * ratio
      return [
        cell(input, index, 0, 0, ratio, firstLow, firstHigh, crossing, crossing, firstDelta > 0 ? input.upperSeriesId : input.lowerSeriesId),
        cell(input, index, 1, ratio, 1, crossing, crossing, nextLow, nextHigh, nextDelta > 0 ? input.upperSeriesId : input.lowerSeriesId),
      ]
    }
    return [cell(input, index, 0, 0, 1, firstLow, firstHigh, nextLow, nextHigh, (firstDelta || nextDelta) >= 0 ? input.upperSeriesId : input.lowerSeriesId)]
  })
}

export function buildStepRangeBandCells(input: RangeBandInput, step: 'start' | 'end'): IntervalBandCellScene[] {
  return input.categoryIds.slice(0, -1).flatMap((_category, index) => {
    const owner = step === 'start' ? index + 1 : index
    const low = input.lower[owner], high = input.upper[owner]
    if (!finite(low) || !finite(high)) return []
    const top = high >= low ? input.upperSeriesId : input.lowerSeriesId
    return [cell(input, index, 0, 0, 1, low, high, low, high, top)]
  })
}

export function buildConfidenceBandCells(input: ConfidenceBandInput): IntervalBandCellScene[] {
  const valid = input.categoryIds.map((_category, index) => {
    const main = input.main[index], lower = input.lower[index], upper = input.upper[index]
    return finite(main) && finite(lower) && finite(upper) && lower <= main && main <= upper
  })
  return input.categoryIds.slice(0, -1).flatMap((_category, index) => {
    if (!valid[index] || !valid[index + 1]) return []
    return [{
      id: cellId(input.bandId, input.categoryIds[index], input.categoryIds[index + 1], 0),
      fromCategoryIndex: index, toCategoryIndex: index + 1, fromT: 0, toT: 1,
      startBottom: input.lower[index]!, startTop: input.upper[index]!,
      endBottom: input.lower[index + 1]!, endTop: input.upper[index + 1]!,
      fillColor: input.fillColor, fillOpacity: input.opacity,
    }]
  })
}
