import { useEffect, useRef, useState } from 'react'
import { loadCriticalFonts } from '../core/textFonts'
import { BrandLogo } from './BrandLogo'

type Stage = 'loading' | 'expanded' | 'docking'

const delay = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration))
const afterLayout = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

async function waitForPageAssets() {
  await afterLayout()
  const images = [...document.images].filter((image) => image.loading !== 'lazy')
  await Promise.all(images.map((image) => image.complete
    ? image.naturalWidth && image.decode ? image.decode().catch(() => undefined) : Promise.resolve()
    : new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })))
}

export function HomeIntro({ onComplete }: { onComplete(): void }) {
  const [stage, setStage] = useState<Stage>('loading')
  const [dockTransform, setDockTransform] = useState('none')
  const completed = useRef(false)

  const complete = () => {
    if (completed.current) return
    completed.current = true
    onComplete()
  }

  useEffect(() => {
    let cancelled = false
    let revealTimer = 0
    let completionTimer = 0
    const previousOverflow = document.body.style.overflow
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    document.body.style.overflow = 'hidden'

    void Promise.race([
      Promise.all([loadCriticalFonts(), waitForPageAssets(), delay(550)]),
      delay(5_000),
    ]).then(() => {
      if (cancelled) return
      if (reducedMotion) { complete(); return }
      setStage('expanded')
      revealTimer = window.setTimeout(() => {
        if (cancelled) return
        const source = document.querySelector<HTMLElement>('.home-intro-logo-shell')?.getBoundingClientRect()
        const target = document.querySelector<SVGElement>('.hero-wordmark .brand-logo')?.getBoundingClientRect()
        if (!source || !target) { complete(); return }
        const x = target.left + target.width / 2 - source.left - source.width / 2
        const y = target.top + target.height / 2 - source.top - source.height / 2
        setDockTransform(`translate(${x}px, ${y}px) scale(${target.width / source.width})`)
        setStage('docking')
        completionTimer = window.setTimeout(complete, 1_050)
      }, 1_650)
    })

    return () => {
      cancelled = true
      window.clearTimeout(revealTimer)
      window.clearTimeout(completionTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [onComplete])

  return (
    <div className="home-intro" data-stage={stage} role="status" aria-label="Загрузка главной страницы">
      <div
        className="home-intro-logo-shell"
        style={{ transform: dockTransform }}
        onTransitionEnd={(event) => {
          if (stage === 'docking' && event.propertyName === 'transform') complete()
        }}
      >
        <BrandLogo decorative variant="animated"/>
      </div>
    </div>
  )
}
