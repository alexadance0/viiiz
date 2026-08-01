import type { ChartTextStyle } from '../../../core/types'
import type { CoordinateSpace } from '../geometry'
import type { LayoutReservation } from '../reservations'

interface GuideBase { id: string; visible: boolean; coordinateSpace: CoordinateSpace }
export interface DirectSeriesGuideItem {
  seriesId: string
  label: string
  note?: string
  visible: boolean
  style: ChartTextStyle
  color: string
  leaderLine: boolean
}
export type GuideSpec =
  | GuideBase & { kind: 'categorical-legend'; position: 'top' | 'right' | 'bottom' | 'left'; items: Array<{ seriesId: string; label: string }> }
  | GuideBase & { kind: 'direct-series'; side: 'left' | 'right'; items: DirectSeriesGuideItem[] }
  | GuideBase & { kind: 'color-scale'; position: 'top' | 'right' | 'bottom' | 'left'; minimum: number; maximum: number; colors: string[] }
  | GuideBase & { kind: 'size-scale'; position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; minimum: number; maximum: number }

export function guideReservation(guide: GuideSpec, size: number, gap: number, priority = 40): LayoutReservation | undefined {
  if (!guide.visible || guide.kind === 'size-scale') return undefined
  if (guide.kind === 'direct-series') return { id: `guide:${guide.id}`, side: guide.side, size, gap, mode: 'outside', priority }
  return { id: `guide:${guide.id}`, side: guide.position, size, gap, mode: 'outside', priority }
}
