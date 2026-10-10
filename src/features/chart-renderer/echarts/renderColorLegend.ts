import type { ChartConfig } from '../../../core/types'
import type { GuideSpec } from '../../chart-layout/guides/types'
import type { Rect } from '../../chart-layout/geometry'
import { measureTextWidth, wrapMeasuredText } from '../../../core/textMetrics'

export const missingDecal = (pattern?: 'diagonal') => pattern ? { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: -Math.PI / 4, color: 'rgba(32,32,39,.45)' } : undefined
export function renderColorLegend(guides: GuideSpec[], reservations: Record<string, Rect>, config: ChartConfig) {
  const guide = guides.find((item) => item.kind === 'categorical-legend' && item.items.some((item) => item.target.kind === 'group' && !item.target.seriesIds.length))
  if (!guide?.visible || guide.kind !== 'categorical-legend') return []
  const rail = reservations[`guide:${guide.id}`]
  if (!rail) return []
  const style = config.legendText, horizontal = guide.position === 'top' || guide.position === 'bottom', lineHeight = Math.round(style.size * style.lineHeight / 100)
  let x = rail.x, y = rail.y
  return guide.items.filter((item) => item.visible).map((item) => {
    const label = horizontal ? item.label : wrapMeasuredText(item.label, style.size, Math.max(20, rail.width - 38), style.fontFamily, style.weight, false).text
    const width = Math.max(...label.split('\n').map((line) => measureTextWidth(line, style.size, style.fontFamily, style.weight))) + 38
    if (horizontal && x > rail.x && x + width > rail.x + rail.width) { x = rail.x; y += lineHeight + 7 }
    const cx = x, cy = y
    const markerY = cy + Math.max(0, (lineHeight - 12) / 2)
    if (horizontal) x += width
    else y += label.split('\n').length * lineHeight + 7
    return { id: `color-legend:${item.id}`, type: 'group', silent: true, z: 90, children: [
      { type: 'group', clipPath: { type: 'rect', shape: { x: cx, y: markerY, width: 12, height: 12 } }, children: [
        { type: 'rect', shape: { x: cx, y: markerY, width: 12, height: 12 }, style: { fill: item.color } },
        ...(item.pattern ? [-12, -6, 0, 6, 12].map((offset) => ({ type: 'line', shape: { x1: cx + offset, y1: markerY + 12, x2: cx + offset + 12, y2: markerY }, style: { stroke: config.axisLineColor, lineWidth: 1, opacity: .5 } })) : []),
      ] },
      { type: 'text', style: { x: cx + 20, y: cy, text: label, fill: style.color, fontFamily: style.fontFamily, fontSize: style.size, fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal', lineHeight, verticalAlign: 'top' } },
    ] }
  })
}
