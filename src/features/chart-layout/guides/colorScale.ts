import type { ChartConfig } from '../../../core/types'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'
import type { Rect } from '../geometry'
import type { LayoutReservation } from '../reservations'
import type { GuideSpec } from './types'

export type ColorScaleGuide = Extract<GuideSpec, { kind: 'color-scale' }>
export interface ColorScaleTick { x: number; y: number; value: number; label: string; align: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom' }
export interface ColorScaleGeometry { bar: Rect; ticks: ColorScaleTick[]; missing?: { bar: Rect; label: ColorScaleTick } }
const verticalScale = (guide: ColorScaleGuide) => guide.position === 'left' || guide.position === 'right'

export function colorScaleReservation(guide: ColorScaleGuide, config: ChartConfig, availableWidth: number): LayoutReservation | undefined {
  if (!guide.visible) return undefined
  const style = guide.style ?? config.legendText, vertical = verticalScale(guide)
  const labels = [...(guide.ticks ?? []).map((tick) => tick.label), ...(guide.missing ? [guide.missing.label] : [])]
  const labelWidth = Math.max(0, ...labels.map((label) => measureTextWidth(label, style.size, style.fontFamily, style.weight)))
  const lineHeight = Math.round(style.size * style.lineHeight / 100)
  const slot = Math.max(30, Math.min(720, availableWidth * .85) / Math.max(1, guide.segments?.length ?? 3))
  const rows = guide.intervalLabels ? Math.max(1, ...labels.map((label) => wrapMeasuredText(label, style.size, slot, style.fontFamily, style.weight, false).text.split('\n').length)) : 1
  return { id: `guide:${guide.id}`, side: guide.position, size: vertical ? Math.ceil(labelWidth + 40) : Math.ceil(lineHeight * rows + 42), gap: guide.position === 'bottom' ? 12 : 0, mode: 'outside', priority: 40 }
}

export function layoutColorScale(guide: ColorScaleGuide, plot: Rect, rail: Rect, config: ChartConfig): ColorScaleGeometry {
  const vertical = verticalScale(guide), style = guide.style ?? config.legendText
  const missingWidth = guide.missing ? Math.max(50, measureTextWidth(guide.missing.label, style.size, style.fontFamily, style.weight)) : 0
  const extraWidth = guide.missing && !vertical ? missingWidth + 24 : 0
  const horizontalWidth = guide.segments ? Math.max(30, Math.min(720, plot.width - extraWidth - 20)) : Math.min(360, plot.width * .6)
  const extraHeight = vertical && guide.missing ? Math.round(style.size * style.lineHeight / 100) + 36 : 0
  const verticalHeight = Math.max(12, Math.min(Math.max(12, plot.height - extraHeight), Math.max(90, Math.min(360, plot.height * .6))))
  const bar: Rect = vertical
    ? { x: guide.position === 'left' ? rail.x + 8 : rail.x + rail.width - 20, y: plot.y + (plot.height - verticalHeight - extraHeight) / 2, width: 12, height: verticalHeight }
    : { x: plot.x + (plot.width - horizontalWidth - extraWidth) / 2, y: guide.position === 'top' ? rail.y + rail.height - 20 : rail.y + 8, width: horizontalWidth, height: 12 }
  const ticks: ColorScaleTick[] = (guide.ticks ?? []).map((tick) => {
    const slot = horizontalWidth / Math.max(1, guide.segments?.length ?? 1)
    const label = guide.intervalLabels && !vertical ? wrapMeasuredText(tick.label, style.size, Math.max(30, slot - 6), style.fontFamily, style.weight, false).text : tick.label
    return vertical ? { x: guide.position === 'left' ? bar.x + bar.width + 8 : bar.x - 8, y: bar.y + bar.height * (1 - tick.offset), value: tick.value, label, align: guide.position === 'left' ? 'left' : 'right', verticalAlign: 'middle' } : { x: bar.x + bar.width * tick.offset, y: guide.position === 'top' ? bar.y - 8 : bar.y + bar.height + 8, value: tick.value, label, align: 'center', verticalAlign: guide.position === 'top' ? 'bottom' : 'top' }
  })
  const result: ColorScaleGeometry = { bar, ticks }
  if (guide.missing) {
    const sample: Rect = vertical ? { x: bar.x, y: bar.y + bar.height + 24, width: 12, height: 12 } : { x: bar.x + bar.width + 24 + (missingWidth - 32) / 2, y: bar.y, width: 32, height: 12 }
    result.missing = { bar: sample, label: { x: vertical ? guide.position === 'left' ? sample.x + sample.width + 8 : sample.x - 8 : sample.x + sample.width / 2, y: vertical ? sample.y + sample.height / 2 : guide.position === 'top' ? sample.y - 8 : sample.y + sample.height + 8, value: 0, label: guide.missing.label, align: vertical ? guide.position === 'left' ? 'left' : 'right' : 'center', verticalAlign: vertical ? 'middle' : guide.position === 'top' ? 'bottom' : 'top' } }
  }
  return result
}
