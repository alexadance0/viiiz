import { useEffect, useRef, useState } from 'react'
import type { AnnotationPlacement, AnnotationTool } from './AnnotationSettings'

interface Props { tool: AnnotationTool; width: number; height: number; onPlace(value: AnnotationPlacement): void; onCancel(): void }
export function AnnotationPlacementOverlay({ tool, width, height, onPlace, onCancel }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const [preview, setPreview] = useState<AnnotationPlacement | null>(null)
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onCancel() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onCancel])
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: Math.round(Math.max(0, Math.min(width, (event.clientX - bounds.left) * width / bounds.width))), y: Math.round(Math.max(0, Math.min(height, (event.clientY - bounds.top) * height / bounds.height))) }
  }
  const placement = (event: React.PointerEvent<SVGSVGElement>) => {
    const from = start.current!, to = point(event)
    let dx = to.x - from.x, dy = to.y - from.y
    if (event.shiftKey && tool !== 'area') { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0 }
    return tool === 'area' ? { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(dx), height: Math.abs(dy) } : { ...from, width: dx, height: dy }
  }
  return <svg className="annotation-placement-overlay" viewBox={`0 0 ${width} ${height}`} aria-label="Размещение аннотации" onPointerDown={(event) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); start.current = point(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreview({ ...start.current, width: 0, height: 0 })
  }} onPointerMove={(event) => { if (start.current) setPreview(placement(event)) }} onPointerUp={(event) => {
    if (!start.current) return
    const value = placement(event)
    start.current = null; setPreview(null)
    if (tool === 'text' || Math.hypot(value.width ?? 0, value.height ?? 0) < 8) onPlace({ x: value.x, y: value.y })
    else onPlace(value)
  }} onPointerCancel={() => { start.current = null; setPreview(null) }}>
    {preview && tool === 'area' && <rect x={preview.x} y={preview.y} width={preview.width} height={preview.height} fill="#20202718" stroke="#202027" strokeDasharray="6 4"/>}
    {preview && tool !== 'text' && tool !== 'area' && <line x1={preview.x} y1={preview.y} x2={preview.x + (preview.width ?? 0)} y2={preview.y + (preview.height ?? 0)} stroke="#202027" strokeWidth="2" strokeDasharray="6 4"/>}
  </svg>
}
