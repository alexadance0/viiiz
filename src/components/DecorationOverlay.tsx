import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { decorationControls, decorationSnapTargets, nearestDecorationTarget, annotationHeight, textAnchorPoint, textAnchorPositions, type DecorationPoint, type DecorationTarget } from './decorationGeometry'
import { annotationTextHtml, sanitizeAnnotationHtml } from '../core/annotationHtml'
import type { ChartAnnotation, ChartDecoration } from '../core/types'

interface Props {
  decoration: ChartDecoration
  annotations?: ChartAnnotation[]
  targets?: DecorationTarget[]
  annotationHeights?: Record<string, number>
  canvasWidth: number
  canvasHeight: number
  plotTop?: number
  plotBottom?: number
  plotLeft?: number
  plotRight?: number
  onPickAnchor?(kind: 'text' | 'data', endpoint?: 'start' | 'end'): void
  onChange(decoration: ChartDecoration): void
}

type DragMode = 'move' | 'start' | 'end' | 'control-first' | 'control-second' | 'nw' | 'ne' | 'sw' | 'se' | 'left' | 'right' | 'top' | 'bottom'
const dash = (type: ChartDecoration['lineType']) => type === 'dashed' ? '8 6' : type === 'dotted' ? '2 5' : undefined
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function DecorationAnchorPicker({ points, width, height, label = 'Выберите точку для стрелки', outlines, onSelect, onCancel }: { points: DecorationTarget[]; width: number; height: number; label?: string; outlines?: Array<{ id: string; x: number; y: number; width: number; height: number }>; onSelect(key: string): void; onCancel(): void }) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onCancel])
  return <svg className="annotation-placement-overlay" viewBox={`0 0 ${width} ${height}`} aria-label={label} onClick={(event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * width / bounds.width, y = (event.clientY - bounds.top) * height / bounds.height
    const nearest = points.reduce<DecorationTarget | null>((best, point) => !best || Math.hypot(point.x - x, point.y - y) < Math.hypot(best.x - x, best.y - y) ? point : best, null)
    if (nearest && Math.hypot(nearest.x - x, nearest.y - y) < 24) onSelect(nearest.key)
  }}>{outlines?.map((box) => <rect key={box.id} x={box.x} y={box.y} width={box.width} height={box.height} className="annotation-anchor-outline"/>)}{points.map((point) => <g key={point.key} className="annotation-anchor-target" role="button" tabIndex={0} aria-label={point.label} onClick={(event) => { if (event.detail === 0) { event.stopPropagation(); onSelect(point.key) } }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(point.key) } }}><title>{point.label}</title><circle cx={point.x} cy={point.y} r={18} fill="transparent"/><circle className="annotation-anchor-dot" cx={point.x} cy={point.y} r={6} fill="#fff" stroke="#1923e3" strokeWidth={2} pointerEvents="none"/></g>)}</svg>
}

export function DecorationTextAnchorPicker({ annotations, heights, width, height, onSelect, onCancel }: { annotations: ChartAnnotation[]; heights: Record<string, number>; width: number; height: number; onSelect(id: string, position: DecorationPoint): void; onCancel(): void }) {
  const visible = annotations.filter((annotation) => !annotation.hidden)
  const points = visible.flatMap((annotation) => {
    const text = document.createElement('div')
    text.innerHTML = sanitizeAnnotationHtml(annotation.html ?? annotationTextHtml(annotation.fragments.map((fragment) => fragment.text).join('')))
    const label = annotation.name || text.textContent?.trim() || 'Текст'
    return textAnchorPositions.map((position, index) => ({ ...textAnchorPoint(annotation, position, annotationHeight(annotation, heights[annotation.id])), key: `${annotation.id}:${index}`, label: `${label} · ${position.label}`, annotationId: annotation.id, position }))
  })
  return <DecorationAnchorPicker points={points} label="Выберите точку у текста" width={width} height={height} outlines={visible.map((annotation) => ({ ...annotation, height: annotationHeight(annotation, heights[annotation.id]) }))} onCancel={onCancel} onSelect={(key) => { const point = points.find((point) => point.key === key); if (point) onSelect(point.annotationId, { x: point.position.x, y: point.position.y }) }}/>
}

export function DecorationOverlay({ decoration, annotations = [], targets = [], annotationHeights = {}, canvasWidth, canvasHeight, plotTop, plotBottom, plotLeft, plotRight, onPickAnchor, onChange }: Props) {
  const overlay = useRef<SVGSVGElement>(null)
  const [screenScale, setScreenScale] = useState(1)
  // Parent canvas transforms change on zoom; measure after every render.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!overlay.current) return
    const next = Math.max(.05, overlay.current.getBoundingClientRect().width / canvasWidth)
    if (Math.abs(next - screenScale) > .001) setScreenScale(next)
  })
  const [draggingEnd, setDraggingEnd] = useState<'start' | 'end' | null>(null)
  const [snapKey, setSnapKey] = useState<string | null>(null)
  const dragCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => dragCleanup.current?.(), [decoration.id])
  const snapTargets = decorationSnapTargets(annotations, targets, annotationHeights)
  const snapped = snapTargets.find((target) => target.key === snapKey)
  const fitted = decoration.type === 'area' && decoration.fitToPlot && plotTop != null && plotBottom != null
  const fittedWidth = decoration.type === 'area' && decoration.fitToPlotWidth && plotLeft != null && plotRight != null
  const shownX = fittedWidth ? plotLeft : decoration.x, shownWidth = fittedWidth ? plotRight - plotLeft : decoration.width
  const shownY = fitted ? plotTop : decoration.y, shownHeight = fitted ? plotBottom - plotTop : decoration.height
  const endX = shownX + shownWidth, endY = shownY + shownHeight
  const controls = decorationControls(decoration)
  const selectedStroke = '#202027'

  const drag = (event: React.PointerEvent<SVGElement>, mode: DragMode) => {
    event.preventDefault(); event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const bounds = svg.getBoundingClientRect(), original = decoration, originalShownHeight = shownHeight
    const point = (next: PointerEvent) => ({ x: (next.clientX - bounds.left) * canvasWidth / Math.max(1, bounds.width), y: (next.clientY - bounds.top) * canvasHeight / Math.max(1, bounds.height) })
    dragCleanup.current?.()
    const start = point(event.nativeEvent)
    let moved = false
    const endpoint = mode === 'start' || mode === 'end'
    if (endpoint) setDraggingEnd(mode)
    const move = (next: PointerEvent) => {
      const current = point(next), dx = current.x - start.x, dy = current.y - start.y
      moved ||= Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) > 3
      if (!moved) return
      if (endpoint) {
        const target = next.shiftKey ? null : nearestDecorationTarget(current, snapTargets, bounds.width / canvasWidth, bounds.height / canvasHeight)
        setSnapKey(target?.key ?? null)
        const position = target ?? { x: clamp(current.x, 0, canvasWidth), y: clamp(current.y, 0, canvasHeight) }
        const type = target && (original.type === 'horizontal-line' || original.type === 'vertical-line') ? 'line' : original.type
        if (mode === 'start') {
          const x = type === 'vertical-line' ? original.x : position.x, y = type === 'horizontal-line' ? original.y : position.y
          onChange({ ...original, type, x, y, width: endX - x, height: endY - y, startAnchor: target?.anchor })
        } else {
          onChange({ ...original, type, width: (type === 'vertical-line' ? original.x : position.x) - original.x, height: (type === 'horizontal-line' ? original.y : position.y) - original.y, endAnchor: target?.anchor })
        }
        return
      }
      if (mode === 'move') {
        if (original.startAnchor || original.endAnchor) return
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
      if (mode === 'control-first' || mode === 'control-second') {
        const first = { x: controls.first.x - original.x, y: controls.first.y - original.y }
        const second = { x: controls.second.x - endX, y: controls.second.y - endY }
        if (mode === 'control-first') { first.x = current.x - original.x; first.y = current.y - original.y }
        else { second.x = current.x - endX; second.y = current.y - endY }
        onChange({ ...original, controlPoints: { first, second } }); return
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', escape, true)
      dragCleanup.current = null; setDraggingEnd(null); setSnapKey(null)
    }
    const cancel = () => { onChange(original); cleanup() }
    const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel() } }
    const end = (next: PointerEvent) => {
      if (moved && endpoint) move(next)
      cleanup()
      if (!moved && endpoint) {
        const anchor = original[mode === 'start' ? 'startAnchor' : 'endAnchor']
        if (anchor) onPickAnchor?.(anchor.annotationId ? 'text' : 'data', mode)
      }
    }
    dragCleanup.current = cleanup
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', escape, true)
  }

  const keyboard = (event: React.KeyboardEvent<SVGElement>, mode: DragMode) => {
    const step = event.shiftKey ? 10 : 1
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!delta) return
    event.preventDefault(); event.stopPropagation()
    let [dx, dy] = delta
    if (decoration.type === 'horizontal-line') dy = 0
    if (decoration.type === 'vertical-line') dx = 0
    if (mode === 'control-first' || mode === 'control-second') {
      const first = { x: controls.first.x - decoration.x, y: controls.first.y - decoration.y }, second = { x: controls.second.x - endX, y: controls.second.y - endY }
      const control = mode === 'control-first' ? first : second
      control.x += dx; control.y += dy
      onChange({ ...decoration, controlPoints: { first, second } })
    } else if (mode === 'start') onChange({ ...decoration, x: decoration.x + dx, y: decoration.y + dy, width: decoration.width - dx, height: decoration.height - dy, startAnchor: undefined })
    else if (mode === 'end') onChange({ ...decoration, width: decoration.width + dx, height: decoration.height + dy, endAnchor: undefined })
  }
  const anchor = (cx: number, cy: number, endpoint: 'start' | 'end') => {
    const kind = decoration[endpoint === 'start' ? 'startAnchor' : 'endAnchor']?.annotationId ? 'text' : 'data'
    return <g className="decoration-attached-anchor" data-drag-mode={endpoint} role="button" tabIndex={0} aria-label={kind === 'text' ? 'Изменить точку у текста' : 'Изменить точку на графике'} onPointerDown={(event) => drag(event, endpoint)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPickAnchor?.(kind, endpoint) }
      else keyboard(event, endpoint)
    }}><title>Перетащите конец линии к тексту или точке графика. Shift — без привязки.</title><circle cx={cx} cy={cy} r={16 / screenScale} fill="transparent"/><circle cx={cx} cy={cy} r={5 / screenScale} fill="#1923e3" stroke="#fff" strokeWidth={1.5} pointerEvents="none"/></g>
  }
  const handle = (cx: number, cy: number, mode: DragMode, cursor = 'nwse-resize') => <g className={`decoration-handle-group ${mode.startsWith('control') ? 'decoration-curve-control' : ''}`} data-drag-mode={mode} role="button" tabIndex={0} aria-label={mode === 'control-first' ? 'Первая опорная точка изгиба' : mode === 'control-second' ? 'Вторая опорная точка изгиба' : mode === 'start' ? 'Начало линии' : mode === 'end' ? 'Конец линии' : 'Изменить размер области'} style={{ cursor }} onPointerDown={(event) => drag(event, mode)} onKeyDown={(event) => keyboard(event, mode)}>
    <title>{mode.startsWith('control') ? 'Перетащите опорную точку, чтобы изменить изгиб' : 'Перетащите конец линии. Shift — без привязки'}</title>
    <circle cx={cx} cy={cy} r={14 / screenScale} fill="transparent" className="decoration-handle-hit"/>
    <circle className="decoration-handle" cx={cx} cy={cy} r={(mode.startsWith('control') ? 6 : 5) / screenScale} pointerEvents="none"/>
  </g>
  return <svg ref={overlay} className="decoration-overlay" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-label="Выбранный визуальный акцент">
    {decoration.type === 'area' ? <g>
      <rect className="decoration-selection" x={shownX} y={shownY} width={Math.max(1, shownWidth)} height={Math.max(1, shownHeight)} fill="#2020270b" stroke={selectedStroke} strokeWidth="1.5" onPointerDown={(event) => drag(event, 'move')}/>
      {fitted && !fittedWidth ? <>{handle(shownX, (shownY + endY) / 2, 'left', 'ew-resize')}{handle(endX, (shownY + endY) / 2, 'right', 'ew-resize')}</> : fittedWidth && !fitted ? <>{handle((shownX + endX) / 2, shownY, 'top', 'ns-resize')}{handle((shownX + endX) / 2, endY, 'bottom', 'ns-resize')}</> : !fitted && !fittedWidth ? <>{handle(shownX, shownY, 'nw')}{handle(endX, shownY, 'ne', 'nesw-resize')}{handle(shownX, endY, 'sw', 'nesw-resize')}{handle(endX, endY, 'se')}</> : null}
    </g> : <g>
      {decoration.type === 'curved-line'
        ? <path className="decoration-selection" d={`M ${decoration.x} ${shownY} C ${controls.first.x} ${controls.first.y} ${controls.second.x} ${controls.second.y} ${endX} ${endY}`} fill="none" stroke={selectedStroke} strokeWidth={Math.max(5, decoration.lineWidth + 3)} strokeOpacity=".42" strokeDasharray={dash(decoration.lineType)} onPointerDown={(event) => drag(event, 'move')}/>
        : <line className="decoration-selection" x1={decoration.x} y1={shownY} x2={endX} y2={endY} stroke={selectedStroke} strokeWidth={Math.max(5, decoration.lineWidth + 3)} strokeOpacity=".42" strokeDasharray={dash(decoration.lineType)} onPointerDown={(event) => drag(event, 'move')}/>} 
      {decoration.startAnchor ? anchor(decoration.x, shownY, 'start') : handle(decoration.x, shownY, 'start', 'crosshair')}{decoration.endAnchor ? anchor(endX, endY, 'end') : handle(endX, endY, 'end', 'crosshair')}
      {decoration.type === 'curved-line' && <><line x1={decoration.x} y1={shownY} x2={controls.first.x} y2={controls.first.y} className="decoration-control-guide"/><line x1={endX} y1={endY} x2={controls.second.x} y2={controls.second.y} className="decoration-control-guide"/>{handle(controls.first.x, controls.first.y, 'control-first', 'grab')}{handle(controls.second.x, controls.second.y, 'control-second', 'grab')}</>}
    </g>}
    {draggingEnd && <g className="decoration-snap-preview" aria-hidden="true">
      {annotations.filter((annotation) => !annotation.hidden).map((annotation) => <rect key={annotation.id} x={annotation.x} y={annotation.y} width={annotation.width} height={annotationHeight(annotation, annotationHeights[annotation.id])} className="annotation-anchor-outline"/>)}
      {snapTargets.map((target) => <circle key={target.key} data-snap-key={target.key} cx={target.x} cy={target.y} r={(target.key === snapKey ? 9 : 4) / screenScale} className={`decoration-snap-target ${target.key === snapKey ? 'active' : ''}`}/>)}
      {snapped && <g><circle cx={snapped.x} cy={snapped.y} r={15 / screenScale} className="decoration-snap-ring"/><text x={clamp(snapped.x + 18, 12, canvasWidth - 160)} y={Math.max(18, snapped.y - 18)} className="decoration-snap-label">{snapped.label}</text></g>}
    </g>}
  </svg>
}
