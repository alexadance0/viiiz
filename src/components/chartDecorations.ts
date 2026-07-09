import type { ChartDecoration } from '../core/types'

export interface PlotBounds { top: number; bottom: number; left: number; right: number }

export function decorationGraphics(decorations: ChartDecoration[], plotBounds?: PlotBounds, onSelect?: (id: string) => void) {
  return decorations.map((decoration) => {
    const lineDash = decoration.lineType === 'dashed' ? [8, 6] : decoration.lineType === 'dotted' ? [2, 5] : undefined
    const y = decoration.type === 'area' && decoration.fitToPlot && plotBounds ? plotBounds.top : decoration.y
    const height = decoration.type === 'area' && decoration.fitToPlot && plotBounds ? plotBounds.bottom - plotBounds.top : decoration.height
    const x = decoration.type === 'area' && decoration.fitToPlotWidth && plotBounds ? plotBounds.left : decoration.x
    const width = decoration.type === 'area' && decoration.fitToPlotWidth && plotBounds ? plotBounds.right - plotBounds.left : decoration.width
    const interaction = onSelect ? { silent: false, cursor: 'pointer', onclick: () => onSelect(decoration.id) } : { silent: true }
    if (decoration.type === 'area') return {
      id: `decoration-${decoration.id}`, type: 'rect', z: 3, ...interaction,
      shape: { x, y, width: Math.max(1, width), height: Math.max(1, height) },
      style: { fill: decoration.color, stroke: decoration.color, opacity: decoration.opacity, lineWidth: decoration.lineWidth, lineDash },
    }
    const x2 = decoration.x + decoration.width, y2 = y + height
    const curvature = decoration.curvature ?? .28
    const controlX = (decoration.x + x2) / 2 - height * curvature, controlY = (y + y2) / 2 + decoration.width * curvature
    const children: Record<string, unknown>[] = decoration.type === 'curved-line'
      ? [{ type: 'bezierCurve', shape: { x1: decoration.x, y1: y, x2, y2, cpx1: controlX, cpy1: controlY }, style: { stroke: decoration.color, fill: 'none', opacity: decoration.opacity, lineWidth: decoration.lineWidth, lineDash } }]
      : [{ type: 'line', shape: { x1: decoration.x, y1: y, x2, y2 }, style: { stroke: decoration.color, opacity: decoration.opacity, lineWidth: decoration.lineWidth, lineDash } }]
    const arrow = decoration.endArrow || decoration.type === 'arrow'
    const placement = decoration.arrowPlacement ?? (arrow ? 'end' : 'none'), head = decoration.arrowHead ?? 'filled', size = Math.max(8, decoration.lineWidth * 3.5)
    const addHead = (tipX: number, tipY: number, angle: number) => {
      const first = [tipX - size * Math.cos(angle - Math.PI / 6), tipY - size * Math.sin(angle - Math.PI / 6)]
      const second = [tipX - size * Math.cos(angle + Math.PI / 6), tipY - size * Math.sin(angle + Math.PI / 6)]
      if (head === 'open') children.push({ type: 'polyline', shape: { points: [first, [tipX, tipY], second] }, style: { stroke: decoration.color, fill: 'none', opacity: decoration.opacity, lineWidth: decoration.lineWidth } })
      if (head === 'filled') children.push({ type: 'polygon', shape: { points: [[tipX, tipY], first, second] }, style: { fill: decoration.color, opacity: decoration.opacity } })
      if (head === 'circle') children.push({ type: 'circle', shape: { cx: tipX, cy: tipY, r: size * .42 }, style: { fill: decoration.color, opacity: decoration.opacity } })
      if (head === 'bar') children.push({ type: 'line', shape: { x1: tipX + Math.cos(angle + Math.PI / 2) * size * .55, y1: tipY + Math.sin(angle + Math.PI / 2) * size * .55, x2: tipX + Math.cos(angle - Math.PI / 2) * size * .55, y2: tipY + Math.sin(angle - Math.PI / 2) * size * .55 }, style: { stroke: decoration.color, opacity: decoration.opacity, lineWidth: decoration.lineWidth } })
    }
    const endAngle = decoration.type === 'curved-line' ? Math.atan2(y2 - controlY, x2 - controlX) : Math.atan2(height, decoration.width)
    const startAngle = decoration.type === 'curved-line' ? Math.atan2(y - controlY, decoration.x - controlX) : endAngle + Math.PI
    if (placement === 'start' || placement === 'both') addHead(decoration.x, y, startAngle)
    if (placement === 'end' || placement === 'both') addHead(x2, y2, endAngle)
    if (onSelect) children.push({ type: decoration.type === 'curved-line' ? 'bezierCurve' : 'line', shape: decoration.type === 'curved-line' ? { x1: decoration.x, y1: y, x2, y2, cpx1: controlX, cpy1: controlY } : { x1: decoration.x, y1: y, x2, y2 }, style: { stroke: 'rgba(0,0,0,0)', fill: 'none', lineWidth: Math.max(14, decoration.lineWidth + 10) } })
    return { id: `decoration-${decoration.id}`, type: 'group', z: 70, ...interaction, children }
  })
}
