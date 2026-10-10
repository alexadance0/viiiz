import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChartConfig } from '../core/types'
import type { EditableDirectLabel } from '../features/chart-renderer/echarts/directLabelEditing'
import { moveDirectLabel } from '../features/chart-renderer/echarts/directLabelEditing'
import './DirectLabelOverlay.css'

interface Props {
  labels: EditableDirectLabel[]
  config: ChartConfig
  width: number
  height: number
  onChange(positions: NonNullable<ChartConfig['directLabelPositions']>): void
  onRefresh(): void
  toolbarHost?: HTMLElement | null
}

export function DirectLabelOverlay({ labels, config, width, height, onChange, onRefresh, toolbarHost }: Props) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState('')
  const drag = useRef<{ id: string; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null)
  const positions = config.directLabelPositions ?? {}
  const hasPinned = Object.keys(positions).some((id) => id.startsWith(`${config.kind}:`))
  const label = labels.find((label) => label.id === selected)
  const commit = (label: EditableDirectLabel) => onChange({ ...positions, [label.id]: { x: (label.bounds.x + label.bounds.width / 2) / width, y: (label.bounds.y + label.bounds.height / 2) / height } })
  const move = (label: EditableDirectLabel, x: number, y: number) => {
    moveDirectLabel(label, Math.max(label.bounds.width / 2, Math.min(width - label.bounds.width / 2, x)), Math.max(label.bounds.height / 2, Math.min(height - label.bounds.height / 2, y)))
    onRefresh()
  }
  useEffect(() => {
    if (!toolbarHost) { setEditing(false); return }
    const section = toolbarHost.closest('details')
    const closed = () => { if (!section?.open) setEditing(false) }
    section?.addEventListener('toggle', closed)
    return () => section?.removeEventListener('toggle', closed)
  }, [toolbarHost])
  if (!labels.length || !toolbarHost) return null
  const toolbar = <div className="direct-label-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>Расположение подписей</button>
      <button type="button" disabled={!hasPinned} onClick={() => onChange(Object.fromEntries(Object.entries(positions).filter(([id]) => !id.startsWith(`${config.kind}:`))))}>Вернуть все подписи автоматически</button>
      {editing && <div className="direct-label-actions">
        <span>{label ? `${label.name} · ${positions[label.id] ? 'Закреплено' : 'Автоматически'}` : 'Перетащите название ряда'}</span>
        <button type="button" onClick={() => setEditing(false)}>Готово</button>
      </div>}
    </div>
  return <>
    {createPortal(toolbar, toolbarHost)}
    {editing && <div className="direct-label-handles">
      {labels.map((label) => <button type="button" key={label.id} className={`direct-label-handle${selected === label.id ? ' selected' : ''}`} data-label-id={label.id} aria-label={`Переместить подпись ${label.name}`} onFocus={() => setSelected(label.id)} style={{ left: label.bounds.x - 4, top: label.bounds.y - 4, width: label.bounds.width + 8, height: label.bounds.height + 8 }} onClick={(event) => { event.stopPropagation(); setSelected(label.id) }} onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setSelected(label.id)
        drag.current = { id: label.id, startX: event.clientX, startY: event.clientY, x: label.bounds.x + label.bounds.width / 2, y: label.bounds.y + label.bounds.height / 2, moved: false }
      }} onPointerMove={(event) => {
        const current = drag.current
        if (!current || current.id !== label.id) return
        const canvas = event.currentTarget.closest('.chart-canvas-shell')!.getBoundingClientRect()
        const dx = (event.clientX - current.startX) * width / canvas.width, dy = (event.clientY - current.startY) * height / canvas.height
        if (Math.hypot(dx, dy) < 2 && !current.moved) return
        current.moved = true; move(label, current.x + dx, current.y + dy)
      }} onPointerUp={(event) => {
        event.stopPropagation()
        if (drag.current?.moved) commit(label)
        drag.current = null
      }} onPointerCancel={() => {
        const current = drag.current
        if (current) move(label, current.x, current.y)
        drag.current = null
      }} onKeyDown={(event) => {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
        if (!direction) return
        event.preventDefault(); event.stopPropagation()
        const step = event.shiftKey ? 10 : 1
        move(label, label.bounds.x + label.bounds.width / 2 + direction[0] * step, label.bounds.y + label.bounds.height / 2 + direction[1] * step)
        commit(label)
      }}/>) }
    </div>}
  </>
}
