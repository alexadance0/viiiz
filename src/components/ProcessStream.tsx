import { useEffect, useRef } from 'react'

type StreamNode = {
  progress: number
  x: number
  y: number
  symbol: string
  scale: number
  tile: boolean
}

const VIEWBOX_WIDTH = 1_200
const VIEWBOX_HEIGHT = 4_000
const SYMBOLS = ['0', '1', '@', '=', '-', '%', '$', '#', '+', '/', '*', '<', '>']
const STAGE_COLORS = [
  [24, 174, 218],
  [224, 51, 171],
  [132, 91, 232],
  [69, 104, 225],
] as const

const PATH = 'M 1200 570 L 934 570 Q 844 570 844 660 L 844 1541 Q 844 1631 754 1631 L 446 1631 Q 356 1631 356 1721 L 356 2334 Q 356 2424 446 2424 L 754 2424 Q 844 2424 844 2514 L 844 3127 Q 844 3217 754 3217 L 446 3217 Q 356 3217 356 3307 L 356 3500'
const LANE_OFFSETS = [-40, -20, 0, 20, 40]

const hash = (value: number) => {
  const result = Math.sin(value * 127.1) * 43_758.5453
  return result - Math.floor(result)
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount

function colorAt(progress: number) {
  const position = clamp(progress) * (STAGE_COLORS.length - 1)
  const index = Math.min(STAGE_COLORS.length - 2, Math.floor(position))
  const amount = position - index
  const from = STAGE_COLORS[index]
  const to = STAGE_COLORS[index + 1]
  return [mix(from[0], to[0], amount), mix(from[1], to[1], amount), mix(from[2], to[2], amount)]
}

export function ProcessStream() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const path = pathRef.current
    const section = canvas?.closest<HTMLElement>('.process-section')
    const context = canvas?.getContext('2d')
    if (!canvas || !path || !section || !context) return

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes: StreamNode[] = []
    const length = path.getTotalLength()
    let frame = 0
    let viewportHeight = innerHeight

    for (let step = 0; step < 260; step += 1) {
      const progress = (step + 0.5) / 260
      const point = path.getPointAtLength(progress * length)
      const before = path.getPointAtLength(Math.max(0, progress * length - 2))
      const after = path.getPointAtLength(Math.min(length, progress * length + 2))
      const tangentLength = Math.hypot(after.x - before.x, after.y - before.y) || 1
      const normalX = -(after.y - before.y) / tangentLength
      const normalY = (after.x - before.x) / tangentLength

      for (let lane = 0; lane < LANE_OFFSETS.length; lane += 1) {
        const offset = LANE_OFFSETS[lane]
        const seed = step * 11 + lane * 41
        nodes.push({
          progress,
          x: point.x + normalX * offset,
          y: point.y + normalY * offset,
          symbol: SYMBOLS[Math.floor(hash(seed + 40) * SYMBOLS.length)],
          scale: 0.98 + hash(seed + 70) * 0.04,
          tile: hash(seed + 80) > 0.91,
        })
      }
    }

    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 1)
      viewportHeight = innerHeight
      canvas.width = Math.round(section.clientWidth * ratio)
      canvas.height = Math.round(section.clientHeight * ratio)
      canvas.style.width = `${section.clientWidth}px`
      canvas.style.height = `${section.clientHeight}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw()
    }

    const draw = () => {
      frame = 0
      const rect = section.getBoundingClientRect()
      const intro = section.querySelector<HTMLElement>('.process-intro')
      const stages = section.querySelectorAll<HTMLElement>('[data-process-stage]')
      const introRect = intro?.getBoundingClientRect()
      const lastStageRect = stages[stages.length - 1]?.getBoundingClientRect()
      const start = introRect ? introRect.top + introRect.height / 2 - rect.top : 0
      const end = lastStageRect ? lastStageRect.top + lastStageRect.height / 2 - rect.top : rect.height
      // The whole path completes while scrolling from the intro to the last stage.
      const headProgress = clamp((viewportHeight / 2 - rect.top - start) / Math.max(1, end - start))

      const visibleTop = Math.max(0, -rect.top)
      context.clearRect(0, Math.max(0, visibleTop - 40), section.clientWidth, viewportHeight + 80)
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      for (const node of nodes) {
        const x = node.x / VIEWBOX_WIDTH * rect.width
        const y = node.y / VIEWBOX_HEIGHT * rect.height
        const screenY = y + rect.top
        if (screenY < -30 || screenY > viewportHeight + 30) continue

        const distanceBehind = headProgress - node.progress
        let alpha = 0
        if (reducedMotion) alpha = 0.18
        else if (distanceBehind >= 0 && distanceBehind < 0.12) alpha = 0.96 - distanceBehind * 2.4
        else if (distanceBehind >= 0.12 && distanceBehind < 0.32) alpha = (0.32 - distanceBehind) / 0.2 * 0.34
        else if (distanceBehind < 0 && distanceBehind > -0.045) alpha = (1 + distanceBehind / 0.045) * 0.12
        const entranceAlpha = node.progress < 0.12 ? (1 - node.progress / 0.12) * 0.32 : 0
        alpha = Math.max(alpha, entranceAlpha)
        if (alpha < 0.025) continue

        const [red, green, blue] = colorAt(node.progress)
        const inHead = Math.abs(distanceBehind) < 0.1
        const scale = node.scale * (inHead ? 1.03 : 1)
        context.font = `500 ${14 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`

        if (node.tile && inHead && alpha > 0.34) {
          context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.min(0.2, alpha * 0.2)})`
          context.beginPath()
          context.roundRect(x - 8, y - 10, 16, 20, 4)
          context.fill()
        }

        context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`
        context.fillText(node.symbol, x, y)
      }

      for (const stage of stages) {
        const stageRect = stage.getBoundingClientRect()
        const activity = reducedMotion ? 1 : clamp(1 - Math.abs(stageRect.top + stageRect.height / 2 - viewportHeight / 2) / (viewportHeight * 0.72))
        stage.style.setProperty('--stage-activity', activity.toFixed(3))
        stage.style.setProperty('--stage-shift', `${((1 - activity) * 8).toFixed(2)}px`)
        stage.style.setProperty('--stage-scale', (1 + activity * 0.012).toFixed(4))
        stage.style.setProperty('--stage-border-opacity', (0.08 + activity * 0.35).toFixed(3))
        stage.style.setProperty('--stage-number-opacity', (0.35 + activity * 0.65).toFixed(3))
      }
    }

    const scheduleDraw = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    addEventListener('scroll', scheduleDraw, { passive: true })
    addEventListener('resize', resize)
    resize()

    return () => {
      removeEventListener('scroll', scheduleDraw)
      removeEventListener('resize', resize)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="process-stream" aria-hidden="true">
      <svg className="process-stream-path" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="none">
        <path ref={pathRef} d={PATH} />
      </svg>
      <canvas ref={canvasRef} className="process-stream-canvas" />
    </div>
  )
}
