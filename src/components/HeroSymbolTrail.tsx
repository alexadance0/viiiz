import { useEffect, useRef } from 'react'
import './HeroSymbolTrail.css'

type TrailPoint = {
  x: number
  y: number
  time: number
  speed: number
  dx: number
  dy: number
}

type SafeZone = { x: number; y: number; width: number; height: number }

type GridImpulse = {
  x: number
  y: number
  time: number
  color: [number, number, number]
  column: number
  row: number
}

const SYMBOL_TRAIL_CONFIG = {
  cellWidth: 25,
  cellHeight: 27,
  fontSize: 17,
  trailLength: 56,
  smoothing: 0.24,
  minPointDistance: 5,
  trailRadius: 72,
  fadeDuration: 1_250,
  maxTextAlpha: 0.92,
  maxBackgroundAlpha: 0.2,
  impulseDuration: 720,
  impulseRadius: 190,
  impulseThickness: 34,
  secondaryDelay: 100,
  centerDuration: 320,
  maxImpulses: 4,
  textColors: {
    left: [224, 51, 171],
    center: [111, 82, 232],
    right: [17, 157, 211],
    bottom: [180, 55, 210],
  },
} as const

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.5453
  return value - Math.floor(value)
}

const mix = (a: number, b: number, amount: number) => a + (b - a) * amount

function colorAt(x: number, y: number, width: number, height: number) {
  const horizontal = Math.min(1, Math.max(0, x / width))
  const vertical = Math.min(1, Math.max(0, y / height))
  const { left, center, right, bottom } = SYMBOL_TRAIL_CONFIG.textColors
  const amount = horizontal < 0.5 ? horizontal * 2 : (horizontal - 0.5) * 2
  const from = horizontal < 0.5 ? left : center
  const to = horizontal < 0.5 ? center : right
  const bottomWeight = Math.max(0, vertical - 0.58) * 0.52

  return [
    mix(mix(from[0], to[0], amount), bottom[0], bottomWeight),
    mix(mix(from[1], to[1], amount), bottom[1], bottomWeight),
    mix(mix(from[2], to[2], amount), bottom[2], bottomWeight),
  ]
}

function symbolFor(seed: number, intensity: number) {
  if (seed > 0.965 && intensity > 0.44) return ['+', ':', '~', '*'][Math.floor(seed * 100) % 4]
  if (intensity > 0.77 && seed > 0.72) return '@'
  if (intensity > 0.42) return seed > 0.5 ? '1' : '0'
  return seed > 0.44 ? '=' : '-'
}

const recodeSymbol = (symbol: string) => ({ '0': '1', '1': '@', '@': '=', '=': '-', '-': '0' })[symbol] ?? '@'

export function HeroSymbolTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<TrailPoint[]>([])
  const currentRef = useRef({ x: 0, y: 0 })
  const smoothedRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)
  const impulsesRef = useRef<GridImpulse[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const context = canvas?.getContext('2d')
    if (!canvas || !host || !context || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let width = 0
    let height = 0
    let mounted = true
    let safeZones: SafeZone[] = []
    const textElements = [...host.querySelectorAll<HTMLElement>('.hero-statement, .hero-lead')]

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const ratio = Math.min(devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const range = document.createRange()
      safeZones = textElements.flatMap((element) => {
        range.selectNodeContents(element)
        return [...range.getClientRects()].map((bounds) => ({
          x: bounds.left - rect.left,
          y: bounds.top - rect.top,
          width: bounds.width,
          height: bounds.height,
        }))
      })
    }

    const render = (now: number) => {
      const config = SYMBOL_TRAIL_CONFIG
      const points = historyRef.current
      const impulses = impulsesRef.current
      while (points.length && now - points[0].time > config.fadeDuration) points.shift()
      while (impulses.length && now - impulses[0].time > config.impulseDuration + config.secondaryDelay) impulses.shift()
      context.clearRect(0, 0, width, height)

      if (points.length < 2 && !impulses.length) {
        frameRef.current = 0
        return
      }

      let minX = width
      let minY = height
      let maxX = 0
      let maxY = 0
      for (const point of points) {
        const radius = config.trailRadius + point.speed * 10
        minX = Math.min(minX, point.x - radius)
        minY = Math.min(minY, point.y - radius)
        maxX = Math.max(maxX, point.x + radius)
        maxY = Math.max(maxY, point.y + radius)
      }
      for (const impulse of impulses) {
        minX = Math.min(minX, impulse.x - config.impulseRadius - config.impulseThickness)
        minY = Math.min(minY, impulse.y - config.impulseRadius - config.impulseThickness)
        maxX = Math.max(maxX, impulse.x + config.impulseRadius + config.impulseThickness)
        maxY = Math.max(maxY, impulse.y + config.impulseRadius + config.impulseThickness)
      }

      const firstColumn = Math.max(0, Math.floor(minX / config.cellWidth))
      const lastColumn = Math.min(Math.ceil(width / config.cellWidth), Math.ceil(maxX / config.cellWidth))
      const firstRow = Math.max(0, Math.floor(minY / config.cellHeight))
      const lastRow = Math.min(Math.ceil(height / config.cellHeight), Math.ceil(maxY / config.cellHeight))
      context.font = `500 ${config.fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      for (let row = firstRow; row <= lastRow; row += 1) {
        const y = row * config.cellHeight + config.cellHeight / 2
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const x = column * config.cellWidth + config.cellWidth / 2
          const seed = hash(column, row)
          let intensity = 0
          let impulseIntensity = 0
          let centerIntensity = 0
          let impulseColor: [number, number, number] | undefined

          for (let index = 1; index < points.length; index += 1) {
            const start = points[index - 1]
            const end = points[index]
            const segmentX = end.x - start.x
            const segmentY = end.y - start.y
            const lengthSquared = segmentX * segmentX + segmentY * segmentY || 1
            const projection = Math.max(0, Math.min(1, ((x - start.x) * segmentX + (y - start.y) * segmentY) / lengthSquared))
            const nearestX = start.x + segmentX * projection
            const nearestY = start.y + segmentY * projection
            const distance = Math.hypot(x - nearestX, y - nearestY)
            const freshness = Math.max(0, 1 - (now - mix(start.time, end.time, projection)) / config.fadeDuration)
            const radius = config.trailRadius + mix(start.speed, end.speed, projection) * 10 + (seed - 0.5) * 15
            const contribution = Math.max(0, 1 - distance / radius) ** 2 * freshness
            intensity = Math.max(intensity, contribution)
          }

          for (const impulse of impulses) {
            const elapsed = now - impulse.time
            const distance = Math.hypot(x - impulse.x, y - impulse.y)
            for (let wave = 0; wave < 2; wave += 1) {
              const delay = wave * config.secondaryDelay
              const progress = (elapsed - delay) / config.impulseDuration
              if (progress < 0 || progress > 1) continue
              const radius = config.impulseRadius * (1 - (1 - progress) ** 3) * (wave ? 0.82 : 1)
              const thickness = config.impulseThickness * (wave ? 0.72 : 1)
              const strength = Math.max(0, 1 - Math.abs(distance - radius) / thickness) * (1 - progress) * (wave ? 0.55 : 1)
              if (strength > impulseIntensity) {
                impulseIntensity = strength
                impulseColor = impulse.color
              }
            }
            if (column === impulse.column && row === impulse.row && elapsed < config.centerDuration) {
              const strength = 1 - elapsed / config.centerDuration
              if (strength > centerIntensity) {
                centerIntensity = strength
                impulseColor = impulse.color
              }
            }
          }

          intensity = Math.max(intensity, impulseIntensity, centerIntensity)
          if (intensity < 0.035) continue
          const zoneColor = colorAt(x, y, width, height)
          const colorWeight = Math.min(1, impulseIntensity + centerIntensity)
          const red = mix(zoneColor[0], impulseColor?.[0] ?? zoneColor[0], colorWeight)
          const green = mix(zoneColor[1], impulseColor?.[1] ?? zoneColor[1], colorWeight)
          const blue = mix(zoneColor[2], impulseColor?.[2] ?? zoneColor[2], colorWeight)
          const textAlpha = Math.min(config.maxTextAlpha, intensity * 1.42 + impulseIntensity * 0.2)
          const backgroundAlpha = intensity > 0.25 && (seed > 0.33 || impulseIntensity > 0.18 || centerIntensity > 0)
            ? Math.min(centerIntensity ? 0.42 : 0.3, (intensity - 0.16) * 0.5)
            : 0

          if (backgroundAlpha > 0.015) {
            context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${backgroundAlpha})`
            context.beginPath()
            context.roundRect(x - 9, y - 11, 18, 22, 4)
            context.fill()
          }

          let symbol = symbolFor(seed, intensity)
          if (impulseIntensity > 0.08) symbol = recodeSymbol(symbol)
          if (centerIntensity > 0) symbol = seed > 0.5 ? '@' : '1'
          context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${textAlpha})`
          if (centerIntensity > 0) {
            context.save()
            context.translate(x, y)
            const scale = 1 + centerIntensity * 0.08
            context.scale(scale, scale)
            context.fillText(symbol, 0, 0.5)
            context.restore()
          } else {
            context.fillText(symbol, x, y + 0.5)
          }
        }
      }

      context.save()
      context.globalCompositeOperation = 'destination-out'
      context.fillStyle = 'rgba(0, 0, 0, 0.12)'
      for (let feather = 12; feather >= 2; feather -= 2) {
        for (const zone of safeZones) {
          context.beginPath()
          context.roundRect(
            zone.x - feather,
            zone.y - feather,
            zone.width + feather * 2,
            zone.height + feather * 2,
            4 + feather / 2,
          )
          context.fill()
        }
      }
      context.restore()
      for (const zone of safeZones) context.clearRect(zone.x, zone.y, zone.width, zone.height)

      frameRef.current = requestAnimationFrame(render)
    }

    const startLoop = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(render)
    }

    const addPoint = (event: PointerEvent) => {
      if (!event.isPrimary) return
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return

      const current = currentRef.current
      const smoothed = smoothedRef.current
      const points = historyRef.current
      if (!points.length) {
        current.x = smoothed.x = x
        current.y = smoothed.y = y
        const first = { x, y, time: performance.now(), speed: 0, dx: 0, dy: 0 }
        points.push(first, { ...first })
        startLoop()
        return
      }

      current.x = x
      current.y = y
      const dx = x - smoothed.x
      const dy = y - smoothed.y
      smoothed.x += dx * SYMBOL_TRAIL_CONFIG.smoothing
      smoothed.y += dy * SYMBOL_TRAIL_CONFIG.smoothing
      if (Math.hypot(smoothed.x - points.at(-1)!.x, smoothed.y - points.at(-1)!.y) < SYMBOL_TRAIL_CONFIG.minPointDistance) return

      points.push({
        x: smoothed.x,
        y: smoothed.y,
        time: performance.now(),
        speed: Math.min(3.2, Math.hypot(dx, dy) / 10),
        dx,
        dy,
      })
      if (points.length > SYMBOL_TRAIL_CONFIG.trailLength) points.shift()
      startLoop()
    }

    const addImpulse = (event: PointerEvent) => {
      if (!event.isPrimary) return
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
      const localColor = colorAt(x, y, width, height)
      const impulses = impulsesRef.current
      impulses.push({
        x,
        y,
        time: performance.now(),
        color: [localColor[0], localColor[1], localColor[2]],
        column: Math.floor(x / SYMBOL_TRAIL_CONFIG.cellWidth),
        row: Math.floor(y / SYMBOL_TRAIL_CONFIG.cellHeight),
      })
      if (impulses.length > SYMBOL_TRAIL_CONFIG.maxImpulses) impulses.shift()
      startLoop()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    for (const element of textElements) observer.observe(element)
    resize()
    void document.fonts.ready.then(() => {
      if (mounted) resize()
    })
    host.addEventListener('pointerdown', addImpulse, { passive: true })
    host.addEventListener('pointermove', addPoint, { passive: true })

    return () => {
      mounted = false
      observer.disconnect()
      host.removeEventListener('pointerdown', addImpulse)
      host.removeEventListener('pointermove', addPoint)
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="symbol-trail-canvas" aria-hidden="true" />
}
