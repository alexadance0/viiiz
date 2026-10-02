import { useEffect, useRef, useState } from 'react'
import { SYMBOL_GRID } from './symbolGrid'

const { cellWidth: CELL_WIDTH, cellHeight: CELL_HEIGHT } = SYMBOL_GRID
const SYMBOLS = '1110120100100#1200102=410110010101#932-34_+$.010'
const BINARY = '00000111001001101'

const fade = (distance: number) => {
  const weight = Math.max(0, 1 - distance / 220)
  return weight * weight * (3 - 2 * weight)
}

type Cell = { x: number; y: number; height: number; symbol: string; color: string; background: string; source: boolean }
type Layout = { width: number; height: number; cells: Cell[] }

export function ProcessStream() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout>({ width: 0, height: 0, cells: [] })

  useEffect(() => {
    const section = hostRef.current?.closest<HTMLElement>('.process-section')
    if (!section) return
    const stages = [...section.querySelectorAll<HTMLElement>('[data-process-stage]')]
    const previews = stages.map((stage) => stage.querySelector<HTMLElement>('.process-preview')!)
    let mounted = true

    const measure = () => {
      const sectionBox = section.getBoundingClientRect()
      const titleRange = document.createRange()
      titleRange.selectNodeContents(section.querySelector<HTMLElement>('#process-title')!)
      const titleBox = titleRange.getBoundingClientRect()
      const introBox = section.querySelector<HTMLElement>('.process-intro')!.getBoundingClientRect()
      const safeZones = [...section.querySelectorAll<HTMLElement>('.process-copy, .process-intro h2')].map((copy) => {
        const box = copy.getBoundingClientRect()
        return { left: box.left - sectionBox.left, right: box.right - sectionBox.left, top: box.top - sectionBox.top, bottom: box.bottom - sectionBox.top }
      })
      const cards = previews.map((preview, index) => {
        const box = preview.getBoundingClientRect()
        return {
          column: Math.round((box.left + box.width / 2 - sectionBox.left) / CELL_WIDTH),
          top: box.top - sectionBox.top,
          bottom: box.bottom - sectionBox.top,
          color: getComputedStyle(stages[index]).getPropertyValue('--stage-color').trim(),
        }
      })
      const cells: Cell[] = []
      cards.forEach((card, index) => {
        const previous = cards[index - 1]
        const rows = previous ? Math.max(1, Math.floor((card.top - previous.bottom) / CELL_HEIGHT)) : Math.max(1, Math.floor((card.top - (titleBox.bottom - sectionBox.top)) / CELL_HEIGHT))
        const top = card.top - rows * CELL_HEIGHT
        const rowHeight = CELL_HEIGHT
        const last = rows - 1
        const bend = Math.floor(last / 2)
        const from = previous?.column ?? card.column
        const direction = Math.sign(card.column - from)
        const grid = new Map<string, Cell>()
        const add = (column: number, row: number, horizontal = false) => {
          const x = column * CELL_WIDTH
          const y = top + (row + 0.5) * rowHeight
          if (safeZones.some((zone) => x > zone.left - CELL_WIDTH && x < zone.right + CELL_WIDTH && y > zone.top - CELL_HEIGHT / 2 && y < zone.bottom + CELL_HEIGHT / 2)) return
          // Both materials use one continuous color field, including at elbows.
          const arrival = fade(Math.hypot(x - card.column * CELL_WIDTH, card.top - y))
          const departure = previous ? fade(Math.hypot(x - from * CELL_WIDTH, y - previous.bottom)) : 0
          const weights = arrival + departure
          const accent = previous && weights > 0
            ? `color-mix(in srgb, ${card.color} ${arrival / weights * 100}%, ${previous.color})`
            : card.color
          const color = `color-mix(in srgb, ${accent} ${Math.max(arrival, departure) * 100}%, #202027)`
          const background = `color-mix(in srgb, ${accent} ${Math.max(arrival, departure) * 42}%, transparent)`
          const alphabet = horizontal ? SYMBOLS : BINARY
          const seed = ((column * 5 + row * 11 + index * 3) % alphabet.length + alphabet.length) % alphabet.length
          grid.set(`${column}:${row}`, { x, y, height: rowHeight, symbol: alphabet[seed], color, background, source: !previous && row < 3 })
        }
        const vertical = (column: number, start: number, end: number, arriving: boolean) => {
          for (let row = start; row <= end; row++) {
            // Only the row touching the card widens to five glyphs.
            const radius = (arriving ? last - row : row) === 0 || (previous && row === 0) ? 2 : 1
            for (let lane = -radius; lane <= radius; lane++) add(column + lane, row)
          }
        }
        if (!previous) {
          const stacked = sectionBox.width <= 900
          const trunk = stacked ? Math.floor((sectionBox.width - CELL_WIDTH / 2) / CELL_WIDTH) : card.column
          const join = Math.min(last - 4, Math.floor((introBox.bottom - sectionBox.top - top) / CELL_HEIGHT) - 2)
          const roots = ['#e033ab', '#e4a52c', '#4568e1']
          const collector = Math.round((titleBox.left - sectionBox.left + titleBox.width * 0.64) / CELL_WIDTH)
          const rootCell = (column: number, row: number, strength = 1) => {
            const x = column * CELL_WIDTH
            const y = top + (row + 0.5) * CELL_HEIGHT
            const position = (x - titleBox.left + sectionBox.left) / titleBox.width
            const stop = position <= 0.46 ? 0 : 1
            const amount = Math.max(0, Math.min(1, stop === 0 ? (position - 0.16) / 0.3 : (position - 0.46) / 0.32))
            const hue = `color-mix(in srgb, ${roots[stop + 1]} ${amount * 100}%, ${roots[stop]})`
            const blend = row >= join && column >= collector ? 1 : fade(Math.hypot((column - collector) * CELL_WIDTH, (row - join) * CELL_HEIGHT))
            const accent = `color-mix(in srgb, ${card.color} ${blend * 100}%, ${hue})`
            const seed = ((column * 5 + row * 11) % SYMBOLS.length + SYMBOLS.length) % SYMBOLS.length
            grid.set(`${column}:${row}`, {
              x, y, height: CELL_HEIGHT, symbol: SYMBOLS[seed], source: true,
              color: `color-mix(in srgb, ${accent} ${strength * 100}%, #202027)`,
              background: `color-mix(in srgb, ${accent} ${strength * 28}%, transparent)`,
            })
          }
          roots.forEach((_, index) => {
            const anchor = Math.round((titleBox.left - sectionBox.left + titleBox.width * [0.16, 0.46, 0.78][index]) / CELL_WIDTH)
            const elbow = Math.max(2, join - (2 - index) * 2)
            for (let row = 0; row <= elbow; row++) rootCell(anchor, row)
            const step = Math.sign(collector - anchor) || 1
            for (let column = anchor; column !== collector + step; column += step) rootCell(column, elbow)
            // Fine rootlets feed the larger branches without adding another frame.
            rootCell(anchor - step, 1, 0.8)
            rootCell(anchor - step * 2, 1, 0.55)
            rootCell(anchor - step * 2, 0, 0.4)
          })
          for (let row = Math.max(0, join - 4); row <= join; row++) rootCell(collector, row)
          const stemDirection = Math.sign(trunk - collector) || 1
          for (let column = collector; column !== trunk + stemDirection; column += stemDirection) rootCell(column, join)
          const turn = stacked ? last - 3 : last
          if (!stacked) {
            for (const offset of [2, 3]) {
              rootCell(trunk - offset, join + 1)
              grid.get(`${trunk - offset}:${join + 1}`)!.symbol = offset === 2 ? '1' : '0'
            }
          }
          for (let row = Math.max(0, join); row <= turn; row++) {
            const radius = stacked ? 0 : row >= last - 1 ? 2 : row > join ? 1 : 0
            for (let lane = -radius; lane <= radius; lane++) {
              rootCell(trunk + lane, row)
            }
          }
          if (stacked) {
            for (let column = card.column; column <= trunk; column++) rootCell(column, turn)
            for (let row = turn + 1; row <= last; row++) {
              for (let lane = -(row === last ? 2 : 1); lane <= (row === last ? 2 : 1); lane++) rootCell(card.column + lane, row)
            }
          }
        } else if (!direction) vertical(card.column, 0, last, true)
        else {
          vertical(from, 0, bend - 1, false)
          // The diagonal cut follows the turn: its outer edge meets the vertical stem.
          for (let lane = 0; lane < 3; lane++) {
            const shift = (lane - 1) * direction
            for (let column = from + shift; column !== card.column + shift + direction; column += direction) add(column, bend + lane, true)
          }
          vertical(card.column, bend + 3, last, true)
        }
        // Rectangles share edges, producing a continuous highlight instead of scattered tiles.
        cells.push(...grid.values())
      })
      setLayout({ width: sectionBox.width, height: sectionBox.height, cells })
    }

    const observer = new ResizeObserver(measure)
    observer.observe(section)
    for (const preview of previews) observer.observe(preview)
    measure()
    void document.fonts.ready.then(() => { if (mounted) measure() })
    return () => { mounted = false; observer.disconnect() }
  }, [])

  return (
    <div ref={hostRef} className="process-stream" aria-hidden="true">
      <svg className="process-stream-symbols" width={layout.width} height={layout.height} style={{ font: SYMBOL_GRID.font }}>
        {layout.cells.map((cell, index) => (
          <g key={index} className={cell.source ? 'process-stream-source' : undefined}>
            <rect x={cell.x - CELL_WIDTH / 2} y={cell.y - cell.height / 2} width={CELL_WIDTH} height={cell.height} fill={cell.background} />
            <text x={cell.x} y={cell.y + SYMBOL_GRID.baselineOffset} fill={cell.color}>{cell.symbol}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
