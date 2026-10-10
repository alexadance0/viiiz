import { measureTextWidth } from '../../core/textMetrics'
import type { ChartConfig, ChartTextStyle, DataValue } from '../../core/types'
import type { CalendarAxis } from '../../core/chartDateAxis'
import type { Rect } from './geometry'
import type { LayoutReservation } from './reservations'

export type AxisPlacement = { kind: 'side'; side: 'top' | 'right' | 'bottom' | 'left' } | { kind: 'internal'; anchor: 'center' | 'zero' }
export interface AxisSpec {
  timeScale?: CalendarAxis
  calendarTicks?: Array<{ value: number; label: string; position: number }>
  id: string
  channel: 'category' | 'value' | 'lane' | 'x' | 'y'
  orientation: 'horizontal' | 'vertical'
  placement: AxisPlacement
  line: { visible: boolean }
  ticks: { visible: boolean; length: number }
  labels: { visible: boolean; size: number; gap: number; rotation?: number; style: ChartTextStyle }
  title?: { visible: boolean; text: string; size: number; gap: number; style: ChartTextStyle }
}

export function categoryAxisFraction(categories: Array<{ value: DataValue }>, axis: AxisSpec, index: number, placement: 'band' | 'point' = 'band') {
  if (axis.timeScale) {
    const value = categories[index]?.value
    return value instanceof Date ? (+value - axis.timeScale.min) / Math.max(1, axis.timeScale.max - axis.timeScale.min) : 1 - .5 / Math.max(1, categories.length)
  }
  return placement === 'point' ? categories.length < 2 ? .5 : index / (categories.length - 1) : (index + .5) / Math.max(1, categories.length)
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
  const ticks = axis.ticks.visible ? Math.max(0, axis.ticks.length - (axis.labels.visible ? axis.labels.gap : 0)) : 0
  const title = axis.title?.visible && axis.title.text ? axis.title.size + axis.title.gap : 0
  const size = label + ticks + title
  return size ? { id: `axis:${axis.id}`, side: axis.placement.side, size, gap: 0, mode: 'outside', priority } : undefined
}

// Keep manual positive angles; zero also falls back to rotation when text cannot fit.
export function categoryLabelRotation(labels: string[], style: ChartTextStyle, slots: number[], requested: ChartConfig['xAxisLabelRotate']) {
  if (typeof requested === 'number' && requested > 0) return requested
  return labels.some((label, index) => Math.max(0, ...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight))) > Math.max(1, slots[index] ?? 0) * .92) ? 90 : 0
}
