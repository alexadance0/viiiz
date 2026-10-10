import { useRef } from 'react'
import { Reorder } from 'framer-motion'
import './SeriesOrder.css'

export function SeriesOrderList({ series, selected, onSelect, onMove }: { series: Array<{ name: string; color: string }>; selected?: string; onSelect(series: { name: string; color: string }): void; onMove(name: string, index: number): void }) {
  const active = useRef<string | null>(null)
  const moved = useRef(false)
  return <Reorder.Group as="div" axis="y" values={series.map((row) => row.name)} className="series-style-list ordered-series-list" onReorder={(names) => {
    if (active.current) onMove(active.current, names.indexOf(active.current))
  }}>{series.map((row, index) => <Reorder.Item as="div" key={row.name} value={row.name} data-series-name={row.name}
    className={selected === row.name ? 'active' : ''} dragMomentum={false} dragElastic={0} transition={{ duration: .15, ease: 'easeOut' }}
    whileDrag={{ zIndex: 2, boxShadow: '0 0 0 1px var(--ink)' }}
    onPointerDownCapture={(event) => { if ((event.target as HTMLElement).closest('.series-order-buttons')) event.stopPropagation(); else moved.current = false }}
    onDragStart={() => { active.current = row.name; moved.current = true }}
    onDragEnd={() => { active.current = null; window.setTimeout(() => { moved.current = false }, 0) }}>
    <span className="series-drag" aria-hidden="true">⠿</span>
    <button type="button" className="series-name-button" onClick={() => { if (!moved.current) onSelect(row) }}><i style={{ background: row.color }}/><span>{row.name}</span></button>
    <div className="series-order-buttons"><button type="button" aria-label={`Переместить ${row.name} выше`} disabled={index === 0} onClick={() => onMove(row.name, index - 1)}>↑</button><button type="button" aria-label={`Переместить ${row.name} ниже`} disabled={index === series.length - 1} onClick={() => onMove(row.name, index + 1)}>↓</button></div>
  </Reorder.Item>)}</Reorder.Group>
}
