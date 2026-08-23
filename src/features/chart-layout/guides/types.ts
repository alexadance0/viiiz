import type { ChartTextStyle } from '../../../core/types'
import type { LayerId } from '../../../entities/chart/model/ChartScene'
import type { SeriesId } from '../../../entities/chart/model/ChartElement'
import type { CoordinateSpace } from '../geometry'
import type { LayoutReservation } from '../reservations'

interface GuideBase { id: string; visible: boolean; coordinateSpace: CoordinateSpace }
export interface CategoricalLegendItem {
  id: string
  label: string
  visible: boolean
  color: string
  marker?: { kind: 'line' | 'point'; opacity?: number }
  target: { kind: 'series'; seriesId: string } | { kind: 'group'; seriesIds: string[] } | { kind: 'layer'; layerId: LayerId; sourceSeriesId: SeriesId; role: 'raw' | 'average' }
}
export interface DirectSeriesGuideItem {
  seriesId: string
  layerId?: LayerId
  sourceSeriesId?: SeriesId
  label: string
  note?: string
  visible: boolean
  style: ChartTextStyle
  color: string
  leaderLine: boolean
}
export type GuideSpec =
  | GuideBase & { kind: 'categorical-legend'; position: 'top' | 'right' | 'bottom' | 'left'; items: CategoricalLegendItem[] }
  | GuideBase & { kind: 'direct-series'; side: 'left' | 'right'; items: DirectSeriesGuideItem[] }
  | GuideBase & { kind: 'color-scale'; position: 'top' | 'right' | 'bottom' | 'left'; minimum: number; maximum: number; colors: string[]; stops?: Array<{ offset: number; color: string }>; ticks?: Array<{ offset: number; value: number; label: string }>; style?: ChartTextStyle }
  | GuideBase & { kind: 'size-scale'; position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; title: string; items: Array<{ value: number; label: string; diameter: number }>; style: ChartTextStyle; marker: { stroke: string; strokeWidth: number } }

export function guideReservation(guide: GuideSpec, size: number, gap: number, priority = 40): LayoutReservation | undefined {
  if (!guide.visible || guide.kind === 'size-scale') return undefined
  if (guide.kind === 'direct-series') return { id: `guide:${guide.id}`, side: guide.side, size, gap, mode: 'outside', priority }
  return { id: `guide:${guide.id}`, side: guide.position, size, gap, mode: 'outside', priority }
}
