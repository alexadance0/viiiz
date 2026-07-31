import type { ChartTextStyle } from '../../core/types'
import type { Rect } from './geometry'
import type { LayoutReservation } from './reservations'

export type AxisPlacement = { kind: 'side'; side: 'top' | 'right' | 'bottom' | 'left' } | { kind: 'internal'; anchor: 'center' | 'zero' }
export interface AxisSpec {
  id: string
  channel: 'category' | 'value'
  orientation: 'horizontal' | 'vertical'
  placement: AxisPlacement
  line: { visible: boolean }
  ticks: { visible: boolean; length: number }
  labels: { visible: boolean; size: number; gap: number; rotation?: number; style: ChartTextStyle }
  title?: { visible: boolean; text: string; size: number; gap: number; style: ChartTextStyle }
}
export interface AxisLayout { spec: AxisSpec; bounds: Rect; reservation?: LayoutReservation }

export function resolveLogicalAxes(orientation: 'vertical' | 'horizontal', categorySide: 'top' | 'right' | 'bottom' | 'left', valueSide: 'top' | 'right' | 'bottom' | 'left') {
  return {
    category: { orientation: orientation === 'vertical' ? 'horizontal' : 'vertical', placement: { kind: 'side', side: categorySide } },
    value: { orientation: orientation === 'vertical' ? 'vertical' : 'horizontal', placement: { kind: 'side', side: valueSide } },
  } as const
}

export function axisReservation(axis: AxisSpec, priority = 50): LayoutReservation | undefined {
  if (axis.placement.kind === 'internal') return undefined
  const label = axis.labels.visible ? axis.labels.size + axis.labels.gap : 0
  const ticks = axis.ticks.visible ? axis.ticks.length : 0
  const title = axis.title?.visible && axis.title.text ? axis.title.size + axis.title.gap : 0
  const size = label + ticks + title
  return size ? { id: `axis:${axis.id}`, side: axis.placement.side, size, gap: 0, mode: 'outside', priority } : undefined
}
