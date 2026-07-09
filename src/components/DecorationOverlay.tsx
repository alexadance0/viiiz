import type { ChartDecoration } from '../core/types'

interface Props {
  decoration: ChartDecoration
  canvasWidth: number
  canvasHeight: number
  plotTop?: number
  plotBottom?: number
  plotLeft?: number
  plotRight?: number
  onChange(decoration: ChartDecoration): void
}

type DragMode = 'move' | 'start' | 'end' | 'control' | 'nw' | 'ne' | 'sw' | 'se' | 'left' | 'right' | 'top' | 'bottom'
const dash = (type: ChartDecoration['lineType']) => type === 'dashed' ? '8 6' : type === 'dotted' ? '2 5' : undefined
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function DecorationOverlay({ decoration, canvasWidth, canvasHeight, plotTop, plotBottom, plotLeft, plotRight, onChange }: Props) {
  const fitted = decoration.type === 'area' && decoration.fitToPlot && plotTop != null && plotBottom != null
  const fittedWidth = decoration.type === 'area' && decoration.fitToPlotWidth && plotLeft != null && plotRight != null
  const shownX = fittedWidth ? plotLeft : decoration.x, shownWidth = fittedWidth ? plotRight - plotLeft : decoration.width
  const shownY = fitted ? plotTop : decoration.y, shownHeight = fitted ? plotBottom - plotTop : decoration.height
  const endX = shownX + shownWidth, endY = shownY + shownHeight
  const distance = Math.max(1, Math.hypot(decoration.width, shownHeight))
  const curvature = decoration.curvature ?? .28
  const controlX = (decoration.x + endX) / 2 - shownHeight * curvature
  const controlY = (shownY + endY) / 2 + decoration.width * curvature
  const selectedStroke = '#6956e8'

  const drag = (event: React.PointerEvent<SVGElement>, mode: DragMode) => {
    event.preventDefault(); event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const bounds = svg.getBoundingClientRect(), original = decoration, originalShownHeight = shownHeight
    const point = (next: PointerEvent) => ({ x: (next.clientX - bounds.left) * canvasWidth / Math.max(1, bounds.width), y: (next.clientY - bounds.top) * canvasHeight / Math.max(1, bounds.height) })
    const start = point(event.nativeEvent)
    const move = (next: PointerEvent) => {
      const current = point(next), dx = current.x - start.x, dy = current.y - start.y
      if (mode === 'move') {
        const minX = -Math.min(0, original.width), maxX = canvasWidth - Math.max(0, original.width)
        const minY = -Math.min(0, originalShownHeight), maxY = canvasHeight - Math.max(0, originalShownHeight)
        onChange({ ...original, x: fittedWidth ? original.x : clamp(original.x + dx, minX, maxX), y: fitted ? original.y : clamp(original.y + dy, minY, maxY) }); return
      }
      if (original.type === 'area') {
        if (fitted) {
          if (mode === 'left') { const x = clamp(original.x + dx, 0, original.x + original.width - 10); onChange({ ...original, x, width: original.width + original.x - x }) }
          if (mode === 'right') onChange({ ...original, width: clamp(original.width + dx, 10, canvasWidth - original.x) })
          return
        }
        if (fittedWidth) {
          if (mode === 'top') { const y = clamp(original.y + dy, 0, original.y + original.height - 10); onChange({ ...original, y, height: original.height + original.y - y }) }
          if (mode === 'bottom') onChange({ ...original, height: clamp(original.height + dy, 10, canvasHeight - original.y) })
          return
        }
        let x = original.x, y = original.y, width = original.width, height = original.height
        if (mode === 'nw' || mode === 'sw') { x = clamp(original.x + dx, 0, original.x + original.width - 10); width = original.width + original.x - x }
        if (mode === 'ne' || mode === 'se') width = clamp(original.width + dx, 10, canvasWidth - original.x)
        if (mode === 'nw' || mode === 'ne') { y = clamp(original.y + dy, 0, original.y + original.height - 10); height = original.height + original.y - y }
        if (mode === 'sw' || mode === 'se') height = clamp(original.height + dy, 10, canvasHeight - original.y)
        onChange({ ...original, x, y, width, height }); return
      }
      if (mode === 'control') {
        const midpointX = (original.x + original.x + original.width) / 2, midpointY = (original.y + original.y + original.height) / 2
        const offset = -(current.x - midpointX) * original.height + (current.y - midpointY) * original.width
        onChange({ ...original, curvature: clamp(offset / Math.max(1, distance * distance), -1, 1) }); return
      }
      if (mode === 'start') {
        if (original.type === 'horizontal-line') onChange({ ...original, x: clamp(current.x, 0, endX - 10), width: endX - clamp(current.x, 0, endX - 10) })
        else if (original.type === 'vertical-line') onChange({ ...original, y: clamp(current.y, 0, endY - 10), height: endY - clamp(current.y, 0, endY - 10) })
        else onChange({ ...original, x: current.x, y: current.y, width: endX - current.x, height: endY - current.y })
      }
      if (mode === 'end') {
        if (original.type === 'horizontal-line') onChange({ ...original, width: clamp(current.x, original.x + 10, canvasWidth) - original.x })
        else if (original.type === 'vertical-line') onChange({ ...original, height: clamp(current.y, original.y + 10, canvasHeight) - original.y })
        else onChange({ ...original, width: current.x - original.x, height: current.y - original.y })
      }
    }
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end)
  }

  const handle = (cx: number, cy: number, mode: DragMode, cursor = 'nwse-resize') => <circle className="decoration-handle" cx={cx} cy={cy} r="5" style={{ cursor }} onPointerDown={(event) => drag(event, mode)}/>
  return <svg className="decoration-overlay" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-label="Выбранный визуальный акцент">
    {decoration.type === 'area' ? <g>
      <rect className="decoration-selection" x={shownX} y={shownY} width={Math.max(1, shownWidth)} height={Math.max(1, shownHeight)} fill="#6956e80b" stroke={selectedStroke} strokeWidth="1.5" onPointerDown={(event) => drag(event, 'move')}/>
      {fitted && !fittedWidth ? <>{handle(shownX, (shownY + endY) / 2, 'left', 'ew-resize')}{handle(endX, (shownY + endY) / 2, 'right', 'ew-resize')}</> : fittedWidth && !fitted ? <>{handle((shownX + endX) / 2, shownY, 'top', 'ns-resize')}{handle((shownX + endX) / 2, endY, 'bottom', 'ns-resize')}</> : !fitted && !fittedWidth ? <>{handle(shownX, shownY, 'nw')}{handle(endX, shownY, 'ne', 'nesw-resize')}{handle(shownX, endY, 'sw', 'nesw-resize')}{handle(endX, endY, 'se')}</> : null}
    </g> : <g>
      {decoration.type === 'curved-line'
        ? <path className="decoration-selection" d={`M ${decoration.x} ${shownY} Q ${controlX} ${controlY} ${endX} ${endY}`} fill="none" stroke={selectedStroke} strokeWidth={Math.max(5, decoration.lineWidth + 3)} strokeOpacity=".42" strokeDasharray={dash(decoration.lineType)} onPointerDown={(event) => drag(event, 'move')}/>
        : <line className="decoration-selection" x1={decoration.x} y1={shownY} x2={endX} y2={endY} stroke={selectedStroke} strokeWidth={Math.max(5, decoration.lineWidth + 3)} strokeOpacity=".42" strokeDasharray={dash(decoration.lineType)} onPointerDown={(event) => drag(event, 'move')}/>} 
      {handle(decoration.x, shownY, 'start', 'crosshair')}{handle(endX, endY, 'end', 'crosshair')}
      {decoration.type === 'curved-line' && <>{<line x1={(decoration.x + endX) / 2} y1={(shownY + endY) / 2} x2={controlX} y2={controlY} className="decoration-control-guide"/>}{handle(controlX, controlY, 'control', 'grab')}</>}
    </g>}
  </svg>
}
