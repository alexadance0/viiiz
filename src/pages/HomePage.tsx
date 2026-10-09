import { useEffect, useRef, useState } from 'react'
import { HeroDemo } from '../components/HeroDemo'
import { BrandLogo } from '../components/BrandLogo'
import { ChartGallerySection } from '../components/ChartGallerySection'
import { HomeIntro } from '../components/HomeIntro'
import { ProcessSection } from '../components/ProcessSection'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import '../site.css'

const introSeenKey = 'viiiz:home-intro-seen'
let introSeen = false

export function HomePage() {
  const upcomingRef = useRef<HTMLElement>(null)
  const [showIntro, setShowIntro] = useState(() => {
    if (introSeen) return false
    try { return localStorage.getItem(introSeenKey) !== '1' } catch { return true }
  })
  useEffect(() => {
    introSeen = true
    try { localStorage.setItem(introSeenKey, '1') } catch { /* Keep the visit in memory when storage is unavailable. */ }
  }, [])
  useEffect(() => {
    const section = upcomingRef.current
    const logo = section?.querySelector('svg')
    if (showIntro || !section || !logo) return
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let played = false
    let observer: IntersectionObserver | undefined
    const configure = () => {
      observer?.disconnect()
      section.dataset.animate = String(!reducedMotion.matches && !played)
      if (reducedMotion.matches || played) return
      const animations = logo.getAnimations({ subtree: true })
      animations.forEach((animation) => { animation.pause(); animation.currentTime = 0 })
      observer = new IntersectionObserver(([entry]) => {
        if (entry.intersectionRatio < 0.95) return
        played = true
        animations.forEach((animation) => animation.play())
        observer?.disconnect()
      }, { threshold: 0.95, rootMargin: '-64px 0px 0px 0px' })
      observer.observe(logo)
    }
    configure()
    reducedMotion.addEventListener('change', configure)
    return () => {
      observer?.disconnect()
      reducedMotion.removeEventListener('change', configure)
      delete section.dataset.animate
    }
  }, [showIntro])
  return (
    <div className="marketing-page" id="top" aria-busy={showIntro}>
      {showIntro && <HomeIntro onComplete={() => setShowIntro(false)}/>}
      <SiteHeader />
      <main>
        <HeroDemo />
        <ProcessSection />

        <ChartGallerySection />
        <section ref={upcomingRef} className="home-upcoming" aria-labelledby="home-upcoming-title">
          <h2 id="home-upcoming-title">Скоро</h2>
          <BrandLogo variant="upcoming" />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
